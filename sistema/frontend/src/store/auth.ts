import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useOperatorTokenStore } from './operatorToken';

export type User = {
  id: string;
  name: string;
  role: string;
  tenant: string;
  tenantName?: string;
  logoUrl?: string | null;
  groupId?: string | null;
  termsAccepted?: boolean;
  station?: string;
};

interface AuthState {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  setTermsAccepted: () => void;
  setTenantLogo: (logoUrl: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => {
        useOperatorTokenStore.getState().clearToken();
        localStorage.removeItem('garcom_operator');
        localStorage.removeItem('lojista-currentOperator');
        set({ token: null, user: null });
      },
      setTermsAccepted: () => set((state) => ({ user: state.user ? { ...state.user, termsAccepted: true } : null })),
      setTenantLogo: (logoUrl) => set((state) => ({ user: state.user ? { ...state.user, logoUrl } : null })),
    }),
    { name: 'lojista-auth' }
  )
);
