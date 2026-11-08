import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useOperatorTokenStore } from './operatorToken';

export type User = {
  id: string;
  email?: string;
  name: string;
  role: string;
  tenant: string;
  tenantName?: string;
  logoUrl?: string | null;
  groupId?: string | null;
  termsAccepted?: boolean;
  station?: string;
  isDemo?: boolean;
};

interface AuthState {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  switchTenantSession: (token: string, user: User) => void;
  logout: () => void;
  setTermsAccepted: () => void;
  setTenantLogo: (logoUrl: string | null) => void;
  setGroupId: (groupId: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      login: (token, user) => {
        if (typeof window !== 'undefined' && (user?.isDemo || user?.email === 'demo@lojista.local' || user?.tenant === 'tenant-demo-retail')) {
          try {
            sessionStorage.setItem('lojista-demo-tab-session', '1');
          } catch {
            // ignore
          }
        }
        set({ token, user });
      },
      switchTenantSession: (token, user) => {
        useOperatorTokenStore.getState().clearToken();
        try {
          localStorage.removeItem('garcom_operator');
          localStorage.removeItem('lojista-currentOperator');
        } catch {
          // ignore
        }
        set({ token, user });
      },
      logout: () => {
        const currentUser = get().user;
        const isDemoSession = Boolean(
          currentUser?.isDemo ||
            currentUser?.email === 'demo@lojista.local' ||
            currentUser?.tenant === 'tenant-demo-retail',
        );
        useOperatorTokenStore.getState().clearToken();
        localStorage.removeItem('garcom_operator');
        localStorage.removeItem('lojista-currentOperator');
        if (typeof window !== 'undefined' && isDemoSession) {
          try {
            sessionStorage.removeItem('lojista-demo-tab-session');
          } catch {
            // ignore
          }
          fetch('/api/auth/demo-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'logout' }),
            keepalive: true,
          }).catch(() => {});
        }
        set({ token: null, user: null });
      },
      setTermsAccepted: () => set((state) => ({ user: state.user ? { ...state.user, termsAccepted: true } : null })),
      setTenantLogo: (logoUrl) => set((state) => ({ user: state.user ? { ...state.user, logoUrl } : null })),
      setGroupId: (groupId) => set((state) => ({ user: state.user ? { ...state.user, groupId } : null })),
    }),
    { name: 'lojista-auth' }
  )
);
