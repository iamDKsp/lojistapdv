import { create } from 'zustand';

/** Store memory-only para a autorização adicional por PIN do caixa.
 *  Gerado após /tenants/me/verify-cashier-pin validar o PIN (compartilhado ou pessoal de gerente).
 *  Escopo: inclui o registerId do caixa para o qual foi emitido — validado pelo backend.
 *  NUNCA persiste em localStorage — intencional para segurança.
 *  Limpo em: troca de operador, logout, expiração (401 pin_auth). */
export interface PinAuthActor {
  id?: string | null;
  name: string;
  imageUrl?: string | null;
  authType?: string;
}

interface PinAuthState {
  token: string | null;
  actor: PinAuthActor | null;
  setPinAuth: (t: string, actor?: PinAuthActor | null) => void;
  clearPinAuth: () => void;
}

export const usePinAuthStore = create<PinAuthState>()((set) => ({
  token: null,
  actor: null,
  setPinAuth: (t, actor = null) => set({ token: t, actor }),
  clearPinAuth: () => set({ token: null, actor: null }),
}));
