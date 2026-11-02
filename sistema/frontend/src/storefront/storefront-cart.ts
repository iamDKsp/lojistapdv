export interface StorefrontCartItem {
  productId: string;
  retailGroupId: string;
  productSlug: string;
  productName: string;
  size: string | null;
  color: string | null;
  imageUrl: string | null;
  unit: string;
  quantity: number;
  priceUnit: number;
  maxAvailableStock: number;
}

export interface StoredStorefrontCart {
  storePublicId: string;
  storeSlug: string;
  updatedAt: number;
  pendingIdempotencyKey?: string;
  items: StorefrontCartItem[];
}

const CART_KEY_PREFIX = 'pdv-lojista-storefront-cart:';
const ORDER_TOKEN_KEY_PREFIX = 'pdv-lojista-storefront-order-token:';

function getCartStorageKey(storePublicId: string): string {
  return `${CART_KEY_PREFIX}${String(storePublicId || '').trim()}`;
}

export function loadStoreCart(
  storePublicId: string,
  storeSlug: string,
): StoredStorefrontCart {
  const cleanId = String(storePublicId || '').trim();
  if (!cleanId || typeof window === 'undefined') {
    return { storePublicId: cleanId, storeSlug, updatedAt: Date.now(), items: [] };
  }
  try {
    const raw = window.localStorage.getItem(getCartStorageKey(cleanId));
    if (!raw) {
      return { storePublicId: cleanId, storeSlug, updatedAt: Date.now(), items: [] };
    }
    const parsed = JSON.parse(raw) as StoredStorefrontCart;
    if (
      !parsed ||
      parsed.storePublicId !== cleanId ||
      !Array.isArray(parsed.items)
    ) {
      return { storePublicId: cleanId, storeSlug, updatedAt: Date.now(), items: [] };
    }
    return {
      storePublicId: cleanId,
      storeSlug: storeSlug || parsed.storeSlug,
      updatedAt: parsed.updatedAt || Date.now(),
      pendingIdempotencyKey: parsed.pendingIdempotencyKey,
      items: parsed.items.filter(
        (item) =>
          item &&
          typeof item.productId === 'string' &&
          Number.isInteger(Number(item.quantity)) &&
          Number(item.quantity) > 0,
      ),
    };
  } catch {
    return { storePublicId: cleanId, storeSlug, updatedAt: Date.now(), items: [] };
  }
}

export function saveStoreCart(cart: StoredStorefrontCart): void {
  if (!cart?.storePublicId || typeof window === 'undefined') return;
  try {
    const payload: StoredStorefrontCart = {
      ...cart,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(
      getCartStorageKey(cart.storePublicId),
      JSON.stringify(payload),
    );
    window.dispatchEvent(
      new CustomEvent('storefront-cart-updated', {
        detail: { storePublicId: cart.storePublicId },
      }),
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function addOrUpdateCartItem(
  storePublicId: string,
  storeSlug: string,
  newItem: StorefrontCartItem,
): StoredStorefrontCart {
  const cart = loadStoreCart(storePublicId, storeSlug);
  const existingIdx = cart.items.findIndex(
    (i) => i.productId === newItem.productId,
  );
  const maxStock = Math.max(1, Number(newItem.maxAvailableStock || 1));

  if (existingIdx >= 0) {
    const current = cart.items[existingIdx];
    const nextQty = Math.min(maxStock, current.quantity + newItem.quantity);
    cart.items[existingIdx] = {
      ...current,
      ...newItem,
      quantity: nextQty,
      maxAvailableStock: maxStock,
    };
  } else {
    cart.items.push({
      ...newItem,
      quantity: Math.min(maxStock, Math.max(1, Math.floor(newItem.quantity))),
      maxAvailableStock: maxStock,
    });
  }

  // Alterar itens invalida a chave de tentativa anterior para gerar nova idempotência
  delete cart.pendingIdempotencyKey;
  saveStoreCart(cart);
  return cart;
}

export function setCartItemQuantity(
  storePublicId: string,
  storeSlug: string,
  productId: string,
  quantity: number,
): StoredStorefrontCart {
  const cart = loadStoreCart(storePublicId, storeSlug);
  if (quantity <= 0) {
    cart.items = cart.items.filter((i) => i.productId !== productId);
  } else {
    cart.items = cart.items.map((item) => {
      if (item.productId !== productId) return item;
      const capped = Math.min(
        Math.max(1, Number(item.maxAvailableStock || 999)),
        Math.floor(quantity),
      );
      return { ...item, quantity: capped };
    });
  }
  delete cart.pendingIdempotencyKey;
  saveStoreCart(cart);
  return cart;
}

export function clearStoreCart(storePublicId: string, storeSlug: string): void {
  if (!storePublicId || typeof window === 'undefined') return;
  saveStoreCart({
    storePublicId,
    storeSlug,
    updatedAt: Date.now(),
    items: [],
  });
}

export function getOrCreateOrderAttemptKey(
  storePublicId: string,
  storeSlug: string,
): string {
  const cart = loadStoreCart(storePublicId, storeSlug);
  if (cart.pendingIdempotencyKey && cart.pendingIdempotencyKey.length >= 12) {
    return cart.pendingIdempotencyKey;
  }
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const key = `sf-${storePublicId.slice(0, 8)}-${randomPart}`;
  cart.pendingIdempotencyKey = key;
  saveStoreCart(cart);
  return key;
}

export function saveOrderAccessToken(
  storePublicId: string,
  reference: string,
  accessToken: string,
): void {
  if (
    !storePublicId ||
    !reference ||
    !accessToken ||
    typeof window === 'undefined'
  ) {
    return;
  }
  try {
    const key = `${ORDER_TOKEN_KEY_PREFIX}${storePublicId}:${reference.toUpperCase()}`;
    window.localStorage.setItem(key, accessToken);
  } catch {
    // Ignore storage errors
  }
}

export function getSavedOrderAccessToken(
  storePublicId: string,
  reference: string,
): string | null {
  if (!storePublicId || !reference || typeof window === 'undefined') return null;
  try {
    const key = `${ORDER_TOKEN_KEY_PREFIX}${storePublicId}:${reference.toUpperCase()}`;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
