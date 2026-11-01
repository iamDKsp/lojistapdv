import { useCallback, useEffect, useState } from "react";
import { apiError, money } from "./types";
import { useAuthStore } from "@/store/auth";
import { useShift } from "@/contexts/ShiftContext";
import {
  getPendingSales,
  getReviewSales,
  markSaleSynced,
  markSaleReview,
  type OfflineSale,
} from "@/lib/db";
import { sendCheckout } from "@/lib/checkout-api";
import { withSaleOperationLock } from "@/lib/sale-operation-lock";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";

export function RetailOperationsPage() {
  const user = useAuthStore((state) => state.user);
  const shift = useShift();
  const [rows, setRows] = useState<OfflineSale[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (!user?.tenant || !shift.operator?.id) return;
    const [pending, review] = await Promise.all([
      getPendingSales(user.tenant, shift.operator.id),
      getReviewSales(user.tenant, shift.operator.id),
    ]);
    setRows([...pending, ...review]);
  }, [user?.tenant, shift.operator?.id]);

  useEffect(() => {
    void load().catch((err) => setError(apiError(err)));
  }, [load]);

  async function retry(row: OfflineSale) {
    if (
      shift.needsOperatorReauth ||
      row.operatorId !== shift.operator?.id ||
      !row.rawPayload ||
      !navigator.onLine
    ) {
      setError(
        "Entre no caixa com o PIN do operador e conecte-se para recuperar a operação.",
      );
      return;
    }
    setBusy(row.localId);
    setError("");
    try {
      await withSaleOperationLock(row.tenantId, row.localId, async () => {
        const res = await sendCheckout(
          row.rawPayload,
          row.tenantId,
          row.operatorId,
        );
        await markSaleSynced(row.localId, res.data.id, row.tenantId);
      });
      await load();
    } catch (err: any) {
      setError(apiError(err));
      if (
        err?.response?.status >= 400 &&
        err.response.status < 500 &&
        ![401, 429].includes(err.response.status)
      )
        await markSaleReview(row.localId, row.tenantId, apiError(err));
      await load();
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className="retail-page-header">
        <div>
          <h1>Operações deste dispositivo</h1>
          <p>
            Registros pendentes e recusados do operador atual. A recuperação usa
            sempre a mesma identificação.
          </p>
        </div>
        <button
          type="button"
          className="retail-button"
          onClick={() => void load()}
        >
          Atualizar
        </button>
      </div>
      {error && (
        <p role="alert" className="retail-message">
          {error}
        </p>
      )}
      {(!shift.operator || shift.needsOperatorReauth) && (
        <p className="retail-message">
          Abra a frente de caixa e identifique o operador por PIN para recuperar
          suas operações.
        </p>
      )}
      <div className="retail-stack">
        {rows.map((row) => (
          <article className="retail-panel" key={row.localId}>
            <div className="retail-row retail-spread">
              <strong>{money(row.total)}</strong>
              <span className="retail-badge">
                {row.syncStatus === "REVIEW" ? "Conferir" : "Pendente"}
              </span>
            </div>
            <p className="retail-muted">
              {new Date(row.createdAt).toLocaleString("pt-BR")} · {row.localId}
            </p>
            {row.items.map((item) => (
              <p className="retail-muted" key={item.productId}>
                {item.quantity} × {item.productName}
              </p>
            ))}
            {row.syncError && <p className="retail-message">{row.syncError}</p>}
            <button
              type="button"
              className="retail-button"
              disabled={
                Boolean(busy) || shift.needsOperatorReauth || !row.rawPayload
              }
              onClick={() => void retry(row)}
            >
              {busy === row.localId ? (
                <>
                  <PdvLojistaLoader
                    mode="loader"
                    compact
                    size={16}
                    label="Consultando operação"
                  />
                  <span>Consultando…</span>
                </>
              ) : (
                "Recuperar esta mesma operação"
              )}
            </button>
          </article>
        ))}
        {!rows.length && (
          <p className="retail-empty">
            Nenhuma operação pendente para o operador atual.
          </p>
        )}
      </div>
    </>
  );
}
