import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";
import { RetailDatePicker } from "@/components/ui/DatePicker";
import { apiError, money } from "./types";

function today() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
}

export function RetailDashboardPage() {
  const [start, setStart] = useState(() => today().slice(0, 8) + "01");
  const [end, setEnd] = useState(today);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/retail/overview", {
          params: { startDate: start, endDate: end },
          signal,
        });
        if (!signal?.aborted) setData(res.data);
      } catch (err) {
        if (!signal?.aborted) setError(apiError(err));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [start, end],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <>
      <div className="retail-page-header">
        <div>
          <h1>Visão geral da loja</h1>
          <p>Vendas e trocas do período · datas no horário de São Paulo.</p>
        </div>
        <Link className="retail-button retail-button-primary" to="/">
          Abrir frente de caixa
        </Link>
      </div>
      <div className="retail-toolbar">
        <div className="retail-field">
          <span>De</span>
          <RetailDatePicker
            aria-label="De"
            value={start}
            rangeStart={start}
            rangeEnd={end}
            allowClear={false}
            onValueChange={setStart}
          />
        </div>
        <div className="retail-field">
          <span>Até</span>
          <RetailDatePicker
            aria-label="Até"
            value={end}
            rangeStart={start}
            rangeEnd={end}
            allowClear={false}
            onValueChange={setEnd}
          />
        </div>
        <button
          type="button"
          className="retail-button"
          onClick={() => void load()}
        >
          Atualizar
        </button>
        <Link className="retail-button" to="/dashboard/reports">
          Relatórios de vendas
        </Link>
      </div>
      {error && (
        <p role="alert" className="retail-message">
          {error}
        </p>
      )}
      {loading ? (
        <div className="retail-loader-region" role="status" aria-busy="true">
          <PdvLojistaLoader
            mode="loader"
            size={88}
            label="Carregando resumo…"
          />
        </div>
      ) : (
        data && (
          <>
            <div className="retail-summary-grid">
              {[
                {
                  label: "Vendas concluídas",
                  value: money(data.revenue),
                  detail: `${data.transactions} vendas no período`,
                },
                {
                  label: "Trocas registradas",
                  value: money(data.returns),
                  detail: "Créditos emitidos no período",
                },
                {
                  label: "Vendas menos trocas",
                  value: money(data.netMerchandise),
                  detail: "Não representa lucro ou saldo em caixa",
                },
              ].map((item) => (
                <article className="retail-panel" key={item.label}>
                  <span className="retail-muted">{item.label}</span>
                  <strong className="retail-summary-value retail-number">
                    {item.value}
                  </strong>
                  <small className="retail-muted">{item.detail}</small>
                </article>
              ))}
            </div>
            <div className="retail-summary-grid" style={{ marginTop: 16 }}>
              <article className="retail-panel">
                <span className="retail-muted">Peças vendidas no período</span>
                <strong className="retail-summary-value retail-number">
                  {data.pieces}
                </strong>
              </article>
              <article className="retail-panel">
                <span className="retail-muted">
                  Crédito ainda disponível aos clientes
                </span>
                <strong className="retail-summary-value retail-number">
                  {money(data.outstandingCredits)}
                </strong>
                <small className="retail-muted">
                  Saldo atual de todos os créditos
                </small>
              </article>
              <article className="retail-panel">
                <span className="retail-muted">Caixas abertos agora</span>
                <strong className="retail-summary-value retail-number">
                  {data.openRegisters}
                </strong>
                <Link className="retail-muted" to="/dashboard/registers">
                  Consultar caixas
                </Link>
              </article>
            </div>
            <section className="retail-panel" style={{ marginTop: 24 }}>
              <h2>Grupos com mais peças vendidas</h2>
              <p className="retail-muted">
                Tamanhos e cores somados no mesmo grupo. Quantidades antes das
                trocas.
              </p>
              {data.topGroups.length ? (
                <div className="retail-stack">
                  {data.topGroups.map((group: any) => (
                    <div key={group.id}>
                      <div className="retail-row retail-spread">
                        <span>{group.name}</span>
                        <strong className="retail-number">
                          {group.quantity} peças
                        </strong>
                      </div>
                      <div className="retail-ranking-track">
                        <div
                          style={{
                            width: `${(group.quantity / Math.max(1, ...data.topGroups.map((g: any) => g.quantity))) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="retail-empty">
                  Nenhuma venda de mercadoria neste período.
                </p>
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
