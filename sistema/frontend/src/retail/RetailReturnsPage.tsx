import { useCallback, useEffect, useState } from "react";
import { Search, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";
import { RetailSwitch } from "@/components/ui/Switch";
import { CustomerPicker } from "./CustomerPicker";
import { money, apiError } from "./types";

export function RetailReturnsPage() {
  const user = useAuthStore((state) => state.user);
  const storageKey = `lojista-return-pending:${user?.tenant}:${user?.id}`;
  const [reference, setReference] = useState("");
  const [sale, setSale] = useState<any>(null);
  const [customerId, setCustomerId] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<
    Record<string, { quantity: number; restock: boolean }>
  >({});
  const [history, setHistory] = useState<any[]>([]);
  const [pending, setPending] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadHistory = useCallback(
    () =>
      api
        .get("/retail/returns")
        .then((res) => setHistory(res.data))
        .catch((err) => setError(apiError(err))),
    [],
  );

  useEffect(() => {
    void loadHistory();
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setPending(JSON.parse(saved));
    } catch {
      setError("Não foi possível ler a troca pendente deste dispositivo.");
    }
  }, [loadHistory, storageKey]);

  async function find(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSale(null);
    setNotice("");
    try {
      const res = await api.get(
        `/retail/returns/sale/${encodeURIComponent(reference.trim())}`,
      );
      setSale(res.data);
      setCustomerId(res.data.customerId || "");
      setSelected({});
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    const items = Object.entries(selected)
      .filter(([, row]) => row.quantity > 0)
      .map(([saleItemId, row]) => ({ saleItemId, ...row }));
    if (!pending && (!items.length || !customerId || !reason.trim())) {
      setError("Selecione os itens, o cliente e o motivo.");
      return;
    }
    const payload = pending || {
      requestKey: crypto.randomUUID(),
      saleId: sale.id,
      customerId,
      reason: reason.trim(),
      items,
    };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      // Grava a instrução antes de enviar; um timeout nunca vira outra troca.
      localStorage.setItem(storageKey, JSON.stringify(payload));
      setPending(payload);
      const res = await api.post("/retail/returns", payload);
      localStorage.removeItem(storageKey);
      setPending(null);
      setSale(null);
      setSelected({});
      setReason("");
      setNotice(
        `Troca registrada. Crédito de ${money(res.data.total)} disponível para o cliente.`,
      );
      void loadHistory();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status >= 400 && status < 500 && ![401, 409, 429].includes(status)) {
        localStorage.removeItem(storageKey);
        setPending(null);
      }
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="retail-page-header">
        <div>
          <h1>Trocas e crédito na loja</h1>
          <p>
            Localize a venda, devolva as peças e registre o saldo para a próxima
            compra.
          </p>
        </div>
      </div>
      {notice && (
        <p role="status" className="retail-message">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="retail-message">
          {error}
        </p>
      )}
      {pending ? (
        <div className="retail-panel">
          <h2>Troca aguardando confirmação</h2>
          <p className="retail-muted">
            A tentativa foi preservada neste dispositivo. Consulte ou reenvie a
            mesma operação para obter a confirmação, sem gerar outro crédito.
          </p>
          <button
            type="button"
            className="retail-button retail-button-primary"
            onClick={() => void create()}
            disabled={busy}
          >
            {busy ? (
              <>
                <PdvLojistaLoader
                  mode="loader"
                  compact
                  size={18}
                  label="Conferindo troca"
                />
                <span>Conferindo…</span>
              </>
            ) : (
              "Recuperar confirmação da troca"
            )}
          </button>
        </div>
      ) : (
        <>
          <form className="retail-toolbar" onSubmit={find}>
            <label className="retail-search">
              <Search size={18} />
              <span className="sr-only">Número ou identificador da venda</span>
              <input
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Número ou identificador da venda"
              />
            </label>
            <button
              type="submit"
              className="retail-button retail-button-primary"
              disabled={busy}
            >
              {busy ? (
                <>
                  <PdvLojistaLoader
                    mode="loader"
                    compact
                    size={18}
                    label="Buscando venda"
                  />
                  <span>Buscando…</span>
                </>
              ) : (
                "Localizar venda"
              )}
            </button>
          </form>
          {sale && (
            <div className="retail-panel">
              <div className="retail-row retail-spread">
                <h2>Venda #{sale.code || sale.id}</h2>
                <span className="retail-badge">
                  {sale.status === "completed" ? "Concluída" : sale.status}
                </span>
              </div>
              {sale.status === "completed" ? (
                <div className="retail-stack">
                  <div className="retail-table-wrap">
                    <table className="retail-table">
                      <thead>
                        <tr>
                          <th>Mercadoria vendida</th>
                          <th>Disponível para troca</th>
                          <th>Quantidade</th>
                          <th>Volta ao estoque?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.items.map((item: any) => {
                          const remaining =
                            Number(item.quantity) -
                            item.retailReturnItems.reduce(
                              (n: number, r: any) => n + r.quantity,
                              0,
                            );
                          const row = selected[item.id] || {
                            quantity: 0,
                            restock: true,
                          };
                          return (
                            <tr key={item.id}>
                              <td>
                                {item.productName}
                                <br />
                                <span className="retail-muted">
                                  Preço na venda: {money(item.priceUnit)}
                                </span>
                              </td>
                              <td>{remaining}</td>
                              <td>
                                <input
                                  aria-label={`Quantidade a trocar de ${item.productName}`}
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  step="1"
                                  value={row.quantity}
                                  disabled={remaining <= 0}
                                  onChange={(e) =>
                                    setSelected((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...row,
                                        quantity: Number(e.target.value),
                                      },
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <RetailSwitch
                                  checked={row.restock}
                                  onCheckedChange={(checked) =>
                                    setSelected((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...row,
                                        restock: checked,
                                      },
                                    }))
                                  }
                                  label="Peça em condição de venda"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <CustomerPicker
                    value={customerId}
                    onChange={setCustomerId}
                    required
                    disabled={Boolean(sale.customerId)}
                  />
                  <label className="retail-field">
                    Motivo da troca
                    <textarea
                      value={reason}
                      maxLength={500}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ex.: troca de tamanho"
                    />
                  </label>
                  <p className="retail-muted">
                    O crédito considera o valor pago pelos itens e o desconto da
                    venda original. Peças sem condição de venda não retornam ao
                    estoque.
                  </p>
                  <button
                    type="button"
                    className="retail-button retail-button-primary"
                    disabled={busy}
                    onClick={() => void create()}
                  >
                    {busy ? (
                      <>
                        <PdvLojistaLoader
                          mode="loader"
                          compact
                          size={18}
                          label="Registrando troca"
                        />
                        <span>Registrando…</span>
                      </>
                    ) : (
                      "Registrar troca e emitir crédito"
                    )}
                  </button>
                </div>
              ) : (
                <p className="retail-message">
                  Somente vendas concluídas podem gerar uma troca.
                </p>
              )}
            </div>
          )}
        </>
      )}
      <div className="retail-section-heading">
        <h3>Trocas recentes</h3>
        <span className="retail-muted">Últimos 100 registros</span>
      </div>
      {history.length ? (
        <div className="retail-table-wrap">
          <table className="retail-table">
            <thead>
              <tr>
                <th>Venda</th>
                <th>Cliente</th>
                <th>Motivo</th>
                <th>Crédito emitido</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td>#{row.sale.code || row.saleId}</td>
                  <td>{row.customer.name}</td>
                  <td>{row.reason}</td>
                  <td className="retail-number">{money(row.total)}</td>
                  <td className="retail-number">
                    {money(row.credit?.balance || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="retail-empty">
          <RotateCcw size={32} />
          <p>Nenhuma troca registrada ainda.</p>
        </div>
      )}
    </>
  );
}
