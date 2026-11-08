export interface RetailVariant {
  id?: string;
  name?: string;
  size: string;
  color: string;
  barcode: string | null;
  existingProductId?: string;
  stock: number | string;
  stockToAdd?: number;
  active: boolean;
}

export interface RetailGroup {
  id: string;
  name: string;
  categoryId: string;
  category?: { id: string; name: string; icon?: string | null; active?: boolean };
  imageUrl: string | null;
  priceSell: number | string;
  priceCost: number | string;
  ncm?: string | null;
  cest?: string | null;
  origem?: number;
  grupoTributacaoId?: string | null;
  active: boolean;
  version: number;
  variants: RetailVariant[];
  stock?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  cpfCnpj?: string | null;
  address?: string | null;
  reference?: string | null;
  createdAt?: string;
}

export const money = (value: number | string) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatBRL = money;

export function apiError(
  error: any,
  fallback = "Não foi possível concluir a operação.",
) {
  const message =
    error?.response?.data?.message ||
    error?.message ||
    fallback;
  return Array.isArray(message) ? message.join(" ") : String(message);
}
