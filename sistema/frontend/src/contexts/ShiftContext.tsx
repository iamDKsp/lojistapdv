import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { toast } from 'sonner';
import { api, apiGet } from '@/lib/api';
import { useOperatorTokenStore } from '@/store/operatorToken';
import { usePinAuthStore } from '@/store/pinAuth';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { getOfflineSale } from '@/lib/db';

export interface Operator {
  id: string;
  name: string;
  role: string;
  isManager?: boolean;
  jobTitle?: string | null;
  imageUrl?: string | null;
  active?: boolean;
  hasOpenRegister?: boolean;
}

interface CashRegister {
  id: string;
  status: string;
  code?: number;
  openingValue?: number;
  operator?: { id: string; name: string; isManager?: boolean };
}

export type RegisterStatus =
  | 'idle'             // Nenhum operador logado
  | 'querying'         // Consulta ao servidor em andamento
  | 'open_confirmed'   // Servidor respondeu 200 confirmando caixa aberto
  | 'closed_confirmed' // Servidor respondeu 200 confirmando que NÃO há caixa aberto
  | 'query_failed';    // Consulta falhou por timeout, rede ou offline

interface ShiftContextType {
  operator: Operator | null;
  operators: Operator[];
  cashRegister: CashRegister | null;
  registerStatus: RegisterStatus;
  /** true quando os dados de caixa foram lidos do cache local e não revalidados pelo servidor */
  isUnconfirmedCache: boolean;
  /** token opcional: instala credencial do operador atomicamente com a transição de identidade */
  setOperator: (op: Operator | null, token?: string) => void;
  quickSwitchOperator: (targetOp: Operator) => Promise<boolean>;
  refreshOperators: () => Promise<void>;
  setCashRegister: (reg: CashRegister | null) => void;
  isLoading: boolean;
  isRegisterQuerying: boolean;
  registerQueryFailed: boolean;
  /** true quando operador foi restaurado do localStorage mas ainda não tem token em memória
   *  (ex: recarga da página). Componentes sensíveis devem solicitar re-autenticação por PIN. */
  needsOperatorReauth: boolean;
  logoutOperator: () => void;
  refreshShift: (operatorId?: string) => Promise<void>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export function ShiftProvider({ children }: { children: ReactNode }) {
  const [operator, setOperatorState] = useState<Operator | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [registerStatus, setRegisterStatus] = useState<RegisterStatus>('idle');
  const [isUnconfirmedCache, setIsUnconfirmedCache] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const currentTenant = useAuthStore((state) => state.user?.tenant || '');

  const hasOpToken = useOperatorTokenStore((state) => Boolean(state.token));
  const needsOperatorReauth = Boolean(operator && !hasOpToken);

  // Limpa credenciais em memória no logout da loja
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      if (!state.token) {
        useCartStore.getState().selectScope('', '');
        useOperatorTokenStore.getState().clearToken();
        usePinAuthStore.getState().clearPinAuth();
        setOperators([]);
      }
    });
    return unsub;
  }, []);

  // ─── Coordenação Centralizada de Requisições de Turno / Caixa ───────────────
  // Evita concorrência, corrida de respostas (race condition), duplicidade de polling
  // e contaminação de estado entre operadores diferentes.
  const querySeqRef = useRef<number>(0);
  const inFlightAbortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operatorRef = useRef<Operator | null>(null);
  operatorRef.current = operator;
  const cashRegisterRef = useRef<CashRegister | null>(null);
  cashRegisterRef.current = cashRegister;

  // ─── Carregamento da equipe de operadores do tenant (para avatares do topo) ──
  const refreshOperators = useCallback(async () => {
    const token = useAuthStore.getState().token;
    const tenantId = useAuthStore.getState().user?.tenant;
    if (!token || !tenantId) {
      setOperators([]);
      return;
    }
    try {
      const res = await apiGet('/operators?context=cashier', {
        skipAuthRedirect: true,
        headers: { 'X-Silent-Poll': 'true' },
      } as any);
      const list = (Array.isArray(res.data) ? res.data : [])
        .filter((op: any) => op.active !== false)
        .map((op: any) => ({
          id: op.id,
          name: op.name,
          role: op.jobTitle || 'Caixa',
          jobTitle: op.jobTitle ?? null,
          isManager: Boolean(op.isManager),
          imageUrl: op.imageUrl ?? null,
          active: op.active !== false,
          hasOpenRegister: Boolean(op.hasOpenRegister),
        }));
      setOperators(list);

      // Atualiza foto/nome do operador ativo caso tenha sido editado
      const activeId = operatorRef.current?.id;
      if (activeId) {
        const updatedActive = list.find((o) => o.id === activeId);
        if (
          updatedActive &&
          (updatedActive.imageUrl !== operatorRef.current?.imageUrl ||
            updatedActive.name !== operatorRef.current?.name ||
            updatedActive.isManager !== operatorRef.current?.isManager)
        ) {
          const merged = { ...operatorRef.current!, ...updatedActive };
          operatorRef.current = merged;
          setOperatorState(merged);
          localStorage.setItem('lojista-currentOperator', JSON.stringify(merged));
        }
      }
    } catch {
      // ignora erro de rede silencioso
    }
  }, []);

  // ─── performRegisterQuery: Pipeline Único de Consulta de Caixa ──────────────
  const performRegisterQuery = useCallback(async (targetOpId: string) => {
    if (!targetOpId) return;

    // 1. Cancela timer de polling pendente
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    // 2. Aborta qualquer requisição em voo anterior
    if (inFlightAbortRef.current) {
      inFlightAbortRef.current.abort();
      inFlightAbortRef.current = null;
    }

    // 3. Incrementa o sequenciador de requisições
    const currentReqId = ++querySeqRef.current;

    // 4. Cenário: Aba Oculta (document.hidden)
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    const currentTenantId = useAuthStore.getState().user?.tenant || '';
    const sharedCacheKey = currentTenantId ? `lojista-cached-register-shared-${currentTenantId}` : '';

    // 5. Cenário: Offline declarado no navegador
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (currentReqId === querySeqRef.current && targetOpId === operatorRef.current?.id) {
        try {
          const cached =
            localStorage.getItem(`lojista-cached-register-${targetOpId}`) ||
            (sharedCacheKey ? localStorage.getItem(sharedCacheKey) : null);
          if (cached) {
            setCashRegister(JSON.parse(cached));
            setIsUnconfirmedCache(true);
          } else {
            setCashRegister(null);
            setIsUnconfirmedCache(false);
          }
        } catch {
          setCashRegister(null);
          setIsUnconfirmedCache(false);
        }
        setRegisterStatus('query_failed');
        setIsLoading(false);
        // Reagenda tentativa em 30s
        pollTimerRef.current = setTimeout(() => {
          if (operatorRef.current?.id === targetOpId) {
            void performRegisterQuery(targetOpId);
          }
        }, 30_000);
      }
      return;
    }

    // 6. Prepara novo AbortController
    const abortController = new AbortController();
    inFlightAbortRef.current = abortController;
    if (!cashRegisterRef.current) {
      setRegisterStatus('querying');
    }

    try {
      const res = await apiGet(`/cash-registers/current?operatorId=${targetOpId}&_t=${Date.now()}`, {
        signal: abortController.signal,
        headers: {
          'X-Silent-Poll': 'true',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (currentReqId !== querySeqRef.current || targetOpId !== operatorRef.current?.id) {
        return;
      }

      const register = res.data || null;
      setCashRegister(register);
      setIsUnconfirmedCache(false);

      if (register) {
        setRegisterStatus('open_confirmed');
        localStorage.setItem(`lojista-cached-register-${targetOpId}`, JSON.stringify(register));
        if (sharedCacheKey) {
          localStorage.setItem(sharedCacheKey, JSON.stringify(register));
        }
      } else {
        setRegisterStatus('closed_confirmed');
        localStorage.removeItem(`lojista-cached-register-${targetOpId}`);
        if (sharedCacheKey) {
          localStorage.removeItem(sharedCacheKey);
        }
      }
    } catch (err: unknown) {
      if (currentReqId !== querySeqRef.current || targetOpId !== operatorRef.current?.id) {
        return;
      }

      const isCanceled =
        (err as { code?: string })?.code === 'ERR_CANCELED' ||
        (err as { name?: string })?.name === 'CanceledError' ||
        abortController.signal.aborted;

      if (isCanceled) {
        return;
      }

      console.warn(`[ShiftContext] Falha na consulta de caixa do operador ${targetOpId}:`, err);
      setRegisterStatus('query_failed');

      try {
        const cached =
          localStorage.getItem(`lojista-cached-register-${targetOpId}`) ||
          (sharedCacheKey ? localStorage.getItem(sharedCacheKey) : null);
        if (cached) {
          setCashRegister(JSON.parse(cached));
          setIsUnconfirmedCache(true);
        } else {
          setCashRegister(null);
          setIsUnconfirmedCache(false);
        }
      } catch {
        setCashRegister(null);
        setIsUnconfirmedCache(false);
      }
    } finally {
      if (inFlightAbortRef.current === abortController) {
        inFlightAbortRef.current = null;
      }

      if (currentReqId === querySeqRef.current && targetOpId === operatorRef.current?.id) setIsLoading(false);

      if (currentReqId === querySeqRef.current && targetOpId === operatorRef.current?.id) {
        if (typeof document === 'undefined' || !document.hidden) {
          pollTimerRef.current = setTimeout(() => {
            if (operatorRef.current?.id === targetOpId) {
              void performRegisterQuery(targetOpId);
            }
          }, 30_000);
        }
      }
    }
  }, []);

  // ─── Transição de Operador ─────────────────────────────────────────────────
  // Na troca de operador dentro da mesma loja, se já existe um caixa compartilhado aberto,
  // mantém o caixa aberto ativo imediatamente para permitir vendas fluidas em nome do novo operador.
  const setOperator = useCallback((newOp: Operator | null, newToken?: string) => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (inFlightAbortRef.current) {
      inFlightAbortRef.current.abort();
      inFlightAbortRef.current = null;
    }
    querySeqRef.current += 1;

    if (!newOp) {
      useCartStore.getState().selectScope('', '');
      useOperatorTokenStore.getState().clearToken();
      usePinAuthStore.getState().clearPinAuth();
      localStorage.removeItem('lojista-currentOperator');
      operatorRef.current = null;
      setOperatorState(null);
      setCashRegister(null);
      setIsUnconfirmedCache(false);
      setRegisterStatus('idle');
      setIsLoading(false);
    } else {
      const currentTenantId = useAuthStore.getState().user?.tenant || '';
      useCartStore.getState().selectScope(currentTenantId, newOp.id);
      const restoredOperationId = useCartStore.getState().cartOperationId;
      void getOfflineSale(currentTenantId, restoredOperationId).then(saved => {
        if (!saved || saved.operatorId !== newOp.id || operatorRef.current?.id !== newOp.id) return;
        const cart = useCartStore.getState();
        if (cart.scope === `lojista-cart-v1:${currentTenantId}:${newOp.id}` && cart.cartOperationId === restoredOperationId) {
          cart.setOperationLocked(false);
          cart.clearCart();
        }
      }).catch(() => { /* Preserve draft if local database cannot be inspected. */ });

      if (newToken) {
        useOperatorTokenStore.getState().setToken(newToken, newOp.id, currentTenantId);
      } else {
        const restored = useOperatorTokenStore.getState().restoreFromSession(newOp.id, currentTenantId);
        if (!restored) {
          useOperatorTokenStore.getState().clearToken();
        }
      }
      usePinAuthStore.getState().clearPinAuth();

      localStorage.setItem('lojista-currentOperator', JSON.stringify(newOp));
      operatorRef.current = newOp;

      const existingOpenRegister =
        cashRegisterRef.current && cashRegisterRef.current.status === 'open'
          ? cashRegisterRef.current
          : null;

      if (existingOpenRegister) {
        // Mantém o caixa aberto compartilhado sem interromper a operação
        setCashRegister(existingOpenRegister);
        setRegisterStatus('open_confirmed');
        setIsLoading(false);
      } else {
        setCashRegister(null);
        setIsUnconfirmedCache(false);
        setRegisterStatus('querying');
        setIsLoading(true);
      }

      setOperatorState(newOp);
    }
  }, []);

  const prevTenantRef = useRef<string>(currentTenant);

  useEffect(() => {
    if (prevTenantRef.current && prevTenantRef.current !== currentTenant) {
      setOperator(null);
    }
    prevTenantRef.current = currentTenant;

    if (!currentTenant) {
      setOperators([]);
      return;
    }
    void refreshOperators();
    const onOperatorsUpdated = () => {
      void refreshOperators();
    };
    window.addEventListener('operators-updated', onOperatorsUpdated);
    return () => {
      window.removeEventListener('operators-updated', onOperatorsUpdated);
    };
  }, [currentTenant, refreshOperators, setOperator]);

  // ─── Troca Rápida 1-Clique pelo Avatar no Topo ─────────────────────────────
  const quickSwitchOperator = useCallback(async (targetOp: Operator): Promise<boolean> => {
    if (!targetOp?.id) return false;
    try {
      const res = await api.post('/auth/operator-switch', {
        operatorId: targetOp.id,
        context: 'cashier',
      });
      const switchedOp: Operator = {
        id: res.data.id || targetOp.id,
        name: res.data.name || targetOp.name,
        role: res.data.jobTitle || targetOp.jobTitle || targetOp.role || 'Caixa',
        jobTitle: res.data.jobTitle ?? targetOp.jobTitle ?? null,
        isManager: Boolean(res.data.isManager ?? targetOp.isManager),
        imageUrl: res.data.imageUrl ?? targetOp.imageUrl ?? null,
        active: true,
      };
      setOperator(switchedOp, res.data.operatorToken);
      toast.success(`Atendimento em nome de ${switchedOp.name}`);
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Não foi possível alternar o operador.');
      return false;
    }
  }, [setOperator]);

  // ─── refreshShift: aceita operatorId EXPLÍCITO para evitar closure stale ───
  const refreshShift = useCallback(async (operatorId?: string) => {
    const resolvedId = operatorId
      ?? (() => {
        try {
          const saved = localStorage.getItem('lojista-currentOperator');
          return saved ? JSON.parse(saved).id : null;
        } catch { return null; }
      })()
      ?? operatorRef.current?.id;

    if (!resolvedId) return;

    await performRegisterQuery(resolvedId);
  }, [performRegisterQuery]);

  // ─── Inicialização: carrega o operador da sessão ───────────────────────────
  useEffect(() => {
    const IS_DEMO = import.meta.env.VITE_APP_MODE === 'demo';

    const init = async () => {
      try {
        const token = useAuthStore.getState().token;
        if (!token && !IS_DEMO) {
          setOperator(null);
          return;
        }

        const savedOp = localStorage.getItem('lojista-currentOperator');
        let currentOp = savedOp ? JSON.parse(savedOp) : null;

        if (!currentOp && IS_DEMO) {
          try {
            const res = await apiGet('/operators', {
              skipAuthRedirect: true,
              headers: { 'X-Silent-Poll': 'true' },
            } as any);
            const opsList = (res.data || []).filter((u: any) => u.active);
            if (opsList.length > 0) {
              currentOp = {
                id: opsList[0].id,
                name: opsList[0].name,
                role: opsList[0].jobTitle || 'Caixa',
                isManager: opsList[0].isManager || false,
                imageUrl: opsList[0].imageUrl ?? null,
              };
            }
          } catch (e) {
            console.warn('[Demo] Erro ao auto-selecionar operador:', e);
          }
        }

        if (currentOp && token) {
          let freshToken: string | undefined;
          try {
            const switchRes = await api.post('/auth/operator-switch', {
              operatorId: currentOp.id,
              context: 'cashier',
            });
            if (switchRes.data) {
              currentOp = {
                ...currentOp,
                name: switchRes.data.name || currentOp.name,
                isManager: Boolean(switchRes.data.isManager),
                jobTitle: switchRes.data.jobTitle ?? currentOp.jobTitle,
                imageUrl: switchRes.data.imageUrl ?? currentOp.imageUrl ?? null,
              };
              freshToken = switchRes.data.operatorToken;
            }
          } catch {
            /* se falhar rede, mantém o cache local */
          }

          setOperator(currentOp, freshToken);
        } else if (currentOp && !token) {
          setOperator(null);
        } else {
          setOperator(null);
        }
      } catch (err) {
        console.error('Erro na inicialização do turno:', err);
        setOperator(null);
      }
    };

    void init();
  }, [setOperator]);

  // ─── Ciclo de Caixa e Polling Vinculado ao Operador Ativo ──────────────────
  useEffect(() => {
    if (!operator?.id) return;

    void performRegisterQuery(operator.id);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (operatorRef.current?.id) {
          void performRegisterQuery(operatorRef.current.id);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      querySeqRef.current += 1;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (inFlightAbortRef.current) {
        inFlightAbortRef.current.abort();
        inFlightAbortRef.current = null;
      }
    };
  }, [operator?.id, hasOpToken, performRegisterQuery]);

  const logoutOperator = () => {
    setOperator(null);
  };

  return (
    <ShiftContext.Provider
      value={{
        operator,
        operators,
        cashRegister,
        registerStatus,
        isUnconfirmedCache,
        setOperator,
        quickSwitchOperator,
        refreshOperators,
        setCashRegister,
        isLoading,
        isRegisterQuerying: registerStatus === 'querying',
        registerQueryFailed: registerStatus === 'query_failed',
        needsOperatorReauth,
        logoutOperator,
        refreshShift,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift(): ShiftContextType {
  const context = useContext(ShiftContext);
  if (context === undefined) {
    return {
      operator: null,
      operators: [],
      cashRegister: null,
      registerStatus: 'idle',
      isUnconfirmedCache: false,
      setOperator: () => {},
      quickSwitchOperator: async () => false,
      refreshOperators: async () => {},
      setCashRegister: () => {},
      isLoading: false,
      isRegisterQuerying: false,
      registerQueryFailed: false,
      needsOperatorReauth: false,
      logoutOperator: () => {},
      refreshShift: async () => {},
    };
  }
  return context;
}
