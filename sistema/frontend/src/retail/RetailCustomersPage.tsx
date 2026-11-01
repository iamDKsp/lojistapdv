import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  CreditCard,
  Crown,
  Eye,
  FileText,
  MapPin,
  MessageCircle,
  Palette,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { api } from "@/lib/api";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";
import { RetailSelect } from "@/components/ui/Select";
import { RetailDialog } from "./RetailDialog";
import { apiError, money } from "./types";

interface CustomerInsightRow {
  id: string;
  name: string;
  phone: string;
  cpfCnpj: string | null;
  address: string | null;
  reference: string | null;
  createdAt: string;
  purchasesCount: number;
  totalPieces: number;
  totalSpent: number;
  totalReturned: number;
  netSpent: number;
  avgTicket: number;
  returnsCount: number;
  lastPurchaseAt: string | null;
  daysSinceLastPurchase: number | null;
  creditBalance: number;
  favoriteSize: string | null;
  favoriteColor: string | null;
  segment: "vip" | "active" | "inactive" | "new";
  isVip: boolean;
  isActive30d: boolean;
  isInactive: boolean;
  isNew30d: boolean;
}

interface CustomersInsightsResponse {
  summary: {
    totalCustomers: number;
    activeCustomers30d: number;
    inactiveCustomers60d: number;
    vipCustomersCount: number;
    withoutPurchaseCount: number;
    newCustomers30d: number;
    customersWithCreditCount: number;
    totalOutstandingCredit: number;
    identifiedSalesCount: number;
    unidentifiedSalesCount: number;
    identifiedSharePercent: number;
    identifiedRevenue: number;
    unidentifiedRevenue: number;
    avgTicketIdentified: number;
    avgTicketUnidentified: number;
  };
  highlights: {
    topVips: CustomerInsightRow[];
    reactivationCandidates: CustomerInsightRow[];
  };
  customers: CustomerInsightRow[];
}

export function formatPhoneDisplay(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function buildWhatsAppLink(row: {
  name: string;
  phone: string;
  creditBalance?: number;
  daysSinceLastPurchase?: number | null;
  favoriteSize?: string | null;
}): string {
  const digits = String(row.phone || "").replace(/\D/g, "");
  const normalized =
    digits.length >= 10 && digits.length <= 11 ? `55${digits}` : digits;
  const firstName = row.name.trim().split(/\s+/)[0] || row.name;

  let text = `Olá, ${firstName}! Tudo bem? Aqui é da loja.`;
  if (row.creditBalance && row.creditBalance > 0) {
    text += ` Passando para lembrar que você possui um crédito disponível de ${money(row.creditBalance)} conosco para usar quando quiser!`;
  } else if (row.daysSinceLastPurchase && row.daysSinceLastPurchase >= 60) {
    text += ` Faz um tempinho que não nos vemos! Chegaram novidades${row.favoriteSize ? ` no tamanho ${row.favoriteSize}` : ""} que têm tudo a ver com o seu estilo.`;
  } else {
    text += ` Como posso ajudar você hoje?`;
  }
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

function formatDatePtBr(dateStr: string | null | undefined, withTime = false) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return withTime
    ? d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : d.toLocaleDateString("pt-BR");
}

function SegmentBadge({ row }: { row: Pick<CustomerInsightRow, "isVip" | "isInactive" | "purchasesCount"> }) {
  if (row.isVip && row.isInactive) {
    return (
      <span className="retail-badge">
        <Clock size={13} aria-hidden="true" />
        <span>VIP sumido (+60d)</span>
      </span>
    );
  }
  if (row.isVip) {
    return (
      <span className="retail-badge retail-badge-strong">
        <Crown size={13} aria-hidden="true" />
        <span>Cliente VIP</span>
      </span>
    );
  }
  if (row.isInactive) {
    return (
      <span className="retail-badge">
        <Clock size={13} aria-hidden="true" />
        <span>Sumido (+60d)</span>
      </span>
    );
  }
  if (row.purchasesCount > 0) {
    return (
      <span className="retail-badge">
        <Sparkles size={13} aria-hidden="true" />
        <span>Cliente ativo</span>
      </span>
    );
  }
  return (
    <span className="retail-badge">
      <UserPlus size={13} aria-hidden="true" />
      <span>Sem compras</span>
    </span>
  );
}

export function RetailCustomersPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<CustomersInsightsResponse | null>(null);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const [sort, setSort] = useState("spent_desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Modal de Cadastro / Edição
  const [editorCustomer, setEditorCustomer] = useState<any | null | undefined>(
    undefined,
  );
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCpfCnpj, setFormCpfCnpj] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formReference, setFormReference] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");

  // Modal Raio-X 360º
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [profileData, setProfileData] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileTab, setProfileTab] = useState<"sales" | "credits">("sales");

  const loadInsights = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/customers/insights", {
          params: { search, segment, sort },
          signal,
        });
        if (!signal?.aborted) {
          setData(res.data);
        }
      } catch (err) {
        if (!signal?.aborted) setError(apiError(err));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [search, segment, sort],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void loadInsights(controller.signal), 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [loadInsights]);

  const openProfile = useCallback(async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setProfileTab("sales");
    setProfileLoading(true);
    setProfileError("");
    setProfileData(null);
    try {
      const res = await api.get(`/customers/${customerId}/profile`);
      setProfileData(res.data);
    } catch (err) {
      setProfileError(apiError(err));
    } finally {
      setProfileLoading(false);
    }
  }, []);

  function openEditor(customer: any | null) {
    setEditorCustomer(customer);
    setFormName(customer?.name || "");
    setFormPhone(customer?.phone ? formatPhoneDisplay(customer.phone) : "");
    setFormCpfCnpj(customer?.cpfCnpj || "");
    setFormAddress(customer?.address || "");
    setFormReference(customer?.reference || "");
    setFormError("");
  }

  async function saveCustomer(event: React.FormEvent) {
    event.preventDefault();
    if (!formName.trim() || formPhone.replace(/\D/g, "").length < 8) {
      setFormError("Informe o nome e um telefone válido (mínimo 8 dígitos).");
      return;
    }
    setFormBusy(true);
    setFormError("");
    setNotice("");
    try {
      const payload = {
        name: formName.trim(),
        phone: formPhone.replace(/\D/g, ""),
        cpfCnpj: formCpfCnpj.trim() || null,
        address: formAddress.trim() || null,
        reference: formReference.trim() || null,
      };
      if (editorCustomer?.id) {
        await api.put(`/customers/${editorCustomer.id}`, payload);
        setNotice(`Cadastro de ${payload.name} atualizado com sucesso.`);
        if (selectedCustomerId === editorCustomer.id) {
          void openProfile(editorCustomer.id);
        }
      } else {
        await api.post("/customers", payload);
        setNotice(`Cliente ${payload.name} cadastrado na carteira da loja.`);
      }
      setEditorCustomer(undefined);
      void loadInsights();
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setFormBusy(false);
    }
  }

  const summary = data?.summary;
  const highlights = data?.highlights;
  const customers = data?.customers || [];

  const filterPills = [
    {
      id: "all",
      label: "Todos",
      count: summary?.totalCustomers ?? 0,
    },
    {
      id: "vip",
      label: "Clientes VIP",
      count: summary?.vipCustomersCount ?? 0,
    },
    {
      id: "active",
      label: "Ativos (30d)",
      count: summary?.activeCustomers30d ?? 0,
    },
    {
      id: "inactive",
      label: "Sumidos (+60d)",
      count: summary?.inactiveCustomers60d ?? 0,
    },
    {
      id: "with_credit",
      label: "Com crédito em loja",
      count: summary?.customersWithCreditCount ?? 0,
    },
    {
      id: "new",
      label: "Sem compras",
      count: summary?.withoutPurchaseCount ?? 0,
    },
  ];

  return (
    <>
      <div className="retail-page-header">
        <div>
          <h1>Clientes e inteligência de vendas</h1>
          <p>
            Carteira da loja, retenção RFM, preferências de grade (tamanho e
            cor) e Raio-X 360º de compras, trocas e créditos.
          </p>
        </div>
        <div className="retail-row">
          <button
            type="button"
            className="retail-button"
            onClick={() => void loadInsights()}
          >
            <RefreshCw size={16} />
            <span>Atualizar</span>
          </button>
          <button
            type="button"
            className="retail-button retail-button-primary"
            onClick={() => openEditor(null)}
          >
            <Plus size={18} />
            <span>Novo cliente</span>
          </button>
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

      {summary && (
        <div className="retail-summary-grid retail-customers-kpi-grid">
          <article className="retail-panel">
            <div className="retail-row retail-spread">
              <span className="retail-muted">Carteira de clientes</span>
              <Users size={18} aria-hidden="true" />
            </div>
            <strong className="retail-summary-value retail-number">
              {summary.totalCustomers}
            </strong>
            <small className="retail-muted">
              {summary.activeCustomers30d} ativos nos últimos 30 dias ·{" "}
              {summary.newCustomers30d} cadastros recentes
            </small>
          </article>

          <article className="retail-panel">
            <div className="retail-row retail-spread">
              <span className="retail-muted">
                Clientes VIP & Ticket identificado
              </span>
              <Crown size={18} aria-hidden="true" />
            </div>
            <strong className="retail-summary-value retail-number">
              {summary.vipCustomersCount} VIPs ·{" "}
              {money(summary.avgTicketIdentified)}
            </strong>
            <small className="retail-muted">
              Ticket sem cliente: {money(summary.avgTicketUnidentified)} ·{" "}
              {summary.identifiedSharePercent}% das vendas identificadas
            </small>
          </article>

          <article className="retail-panel">
            <div className="retail-row retail-spread">
              <span className="retail-muted">Radar de retenção (+60 dias)</span>
              <Clock size={18} aria-hidden="true" />
            </div>
            <strong className="retail-summary-value retail-number">
              {summary.inactiveCustomers60d} sumidos
            </strong>
            <small className="retail-muted">
              Clientes que já compraram na loja e não retornam há 60 dias ou
              mais
            </small>
          </article>

          <article className="retail-panel">
            <div className="retail-row retail-spread">
              <span className="retail-muted">Créditos na loja em aberto</span>
              <Wallet size={18} aria-hidden="true" />
            </div>
            <strong className="retail-summary-value retail-number">
              {money(summary.totalOutstandingCredit)}
            </strong>
            <small className="retail-muted">
              {summary.customersWithCreditCount} clientes com saldo pronto para
              nova compra
            </small>
          </article>
        </div>
      )}

      {highlights &&
        (highlights.topVips.length > 0 ||
          highlights.reactivationCandidates.length > 0) && (
          <div className="retail-customers-insights-grid">
            <section className="retail-panel">
              <div className="retail-row retail-spread">
                <div>
                  <h2>Top Clientes VIP (Maior Valor Líquido)</h2>
                  <p className="retail-muted">
                    Compradores mais fiéis considerando compras concluídas menos
                    trocas.
                  </p>
                </div>
                <Crown size={20} aria-hidden="true" />
              </div>

              {highlights.topVips.length ? (
                <div className="retail-customer-highlight-list">
                  {highlights.topVips.map((vip, idx) => (
                    <div className="retail-customer-highlight-row" key={vip.id}>
                      <div className="retail-customer-highlight-main">
                        <span className="retail-customer-rank">#{idx + 1}</span>
                        <div>
                          <strong>{vip.name}</strong>
                          <small className="retail-muted">
                            {vip.purchasesCount} compras · {vip.totalPieces}{" "}
                            peças
                            {vip.favoriteSize
                              ? ` · Tam. ${vip.favoriteSize}`
                              : ""}
                            {vip.favoriteColor ? ` · ${vip.favoriteColor}` : ""}
                          </small>
                        </div>
                      </div>
                      <div className="retail-row">
                        <strong className="retail-number">
                          {money(vip.netSpent)}
                        </strong>
                        <button
                          type="button"
                          className="retail-button"
                          onClick={() => void openProfile(vip.id)}
                        >
                          <Eye size={15} />
                          <span>Raio-X</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="retail-muted">
                  Realize vendas identificando o cliente para formar o ranking
                  VIP.
                </p>
              )}
            </section>

            <section className="retail-panel">
              <div className="retail-row retail-spread">
                <div>
                  <h2>Radar de Reativação & Créditos Parados</h2>
                  <p className="retail-muted">
                    Clientes com crédito disponível para gastar ou ausentes há
                    mais de 60 dias.
                  </p>
                </div>
                <Sparkles size={20} aria-hidden="true" />
              </div>

              {highlights.reactivationCandidates.length ? (
                <div className="retail-customer-highlight-list">
                  {highlights.reactivationCandidates.map((cand) => (
                    <div
                      className="retail-customer-highlight-row"
                      key={cand.id}
                    >
                      <div className="retail-customer-highlight-main">
                        <div>
                          <strong>{cand.name}</strong>
                          <small className="retail-muted">
                            {cand.creditBalance > 0
                              ? `Crédito disponível: ${money(cand.creditBalance)}`
                              : `Sem comprar há ${cand.daysSinceLastPurchase} dias`}{" "}
                            · Histórico: {money(cand.netSpent)}
                          </small>
                        </div>
                      </div>
                      <div className="retail-row">
                        <a
                          href={buildWhatsAppLink(cand)}
                          target="_blank"
                          rel="noreferrer"
                          className="retail-button"
                          aria-label={`Conversar no WhatsApp com ${cand.name}`}
                        >
                          <MessageCircle size={15} />
                          <span>WhatsApp</span>
                        </a>
                        <button
                          type="button"
                          className="retail-button"
                          onClick={() => void openProfile(cand.id)}
                        >
                          <Eye size={15} />
                          <span>Raio-X</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="retail-muted">
                  Nenhum cliente com alerta de inatividade ou crédito parado no
                  momento.
                </p>
              )}
            </section>
          </div>
        )}

      <div className="retail-customers-filterbar">
        <div
          className="retail-category-row"
          role="group"
          aria-label="Segmentos de clientes"
        >
          {filterPills.map((pill) => {
            const active = segment === pill.id;
            return (
              <button
                type="button"
                key={pill.id}
                aria-pressed={active}
                className={`retail-cat-pill ${active ? "is-active" : ""}`}
                onClick={() => setSegment(pill.id)}
              >
                <span>{pill.label}</span>
                <span className="retail-cat-count retail-number">
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="retail-toolbar" style={{ marginBottom: 0 }}>
          <label className="retail-search">
            <Search size={18} />
            <span className="sr-only">
              Buscar por nome, telefone, CPF/CNPJ ou observação
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, telefone, CPF/CNPJ ou observação..."
            />
          </label>
          <div className="retail-field" style={{ minWidth: 230 }}>
            <RetailSelect
              aria-label="Ordenar clientes"
              value={sort}
              onValueChange={setSort}
              options={[
                { value: "spent_desc", label: "Maior valor líquido" },
                { value: "recent_desc", label: "Compra mais recente" },
                { value: "purchases_desc", label: "Mais compras realizadas" },
                { value: "credit_desc", label: "Maior saldo de crédito" },
                { value: "name_asc", label: "Ordem alfabética (A–Z)" },
              ]}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="retail-loader-region" role="status" aria-busy="true">
          <PdvLojistaLoader
            mode="loader"
            size={88}
            label="Carregando carteira de clientes…"
          />
        </div>
      ) : customers.length ? (
        <div className="retail-table-wrap">
          <table className="retail-table retail-table-cards">
            <thead>
              <tr>
                <th>Cliente & Segmento</th>
                <th>Compras & Volume</th>
                <th>Investimento Líquido</th>
                <th>DNA de Grade</th>
                <th>Última Compra</th>
                <th>Crédito na Loja</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td data-label="Cliente" className="retail-cell-primary">
                    <div className="retail-customer-cell-main">
                      <div className="retail-row">
                        <strong>{c.name}</strong>
                        <SegmentBadge row={c} />
                      </div>
                      <small className="retail-muted">
                        {formatPhoneDisplay(c.phone)}
                        {c.cpfCnpj ? ` · CPF/CNPJ: ${c.cpfCnpj}` : ""}
                      </small>
                      {c.reference && (
                        <small className="retail-customer-note-preview">
                          Obs.: {c.reference}
                        </small>
                      )}
                    </div>
                  </td>
                  <td data-label="Compras & Volume">
                    <strong className="retail-number">
                      {c.purchasesCount}{" "}
                      {c.purchasesCount === 1 ? "compra" : "compras"}
                    </strong>
                    <br />
                    <span className="retail-muted retail-number">
                      {c.totalPieces} peças
                      {c.returnsCount > 0 ? ` · ${c.returnsCount} trocas` : ""}
                    </span>
                  </td>
                  <td data-label="Investimento Líquido">
                    <strong className="retail-number">
                      {money(c.netSpent)}
                    </strong>
                    <br />
                    <span className="retail-muted retail-number">
                      Ticket: {money(c.avgTicket)}
                    </span>
                  </td>
                  <td data-label="DNA de Grade">
                    {c.favoriteSize || c.favoriteColor ? (
                      <div className="retail-row" style={{ gap: 6 }}>
                        {c.favoriteSize && (
                          <span className="retail-badge">
                            Tam. {c.favoriteSize}
                          </span>
                        )}
                        {c.favoriteColor && (
                          <span className="retail-badge">
                            {c.favoriteColor}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="retail-muted">Sem histórico</span>
                    )}
                  </td>
                  <td data-label="Última Compra">
                    {c.lastPurchaseAt ? (
                      <>
                        <strong className="retail-number">
                          {formatDatePtBr(c.lastPurchaseAt)}
                        </strong>
                        <br />
                        <span className="retail-muted">
                          {c.daysSinceLastPurchase === 0
                            ? "Comprou hoje"
                            : `Há ${c.daysSinceLastPurchase} ${
                                c.daysSinceLastPurchase === 1 ? "dia" : "dias"
                              }`}
                        </span>
                      </>
                    ) : (
                      <span className="retail-muted">Ainda não comprou</span>
                    )}
                  </td>
                  <td data-label="Crédito na Loja" className="retail-number">
                    {c.creditBalance > 0 ? (
                      <span className="retail-badge retail-badge-strong">
                        <Wallet size={13} aria-hidden="true" />
                        <span>{money(c.creditBalance)}</span>
                      </span>
                    ) : (
                      <span className="retail-muted">{money(0)}</span>
                    )}
                  </td>
                  <td data-label="Ações" className="retail-cell-actions">
                    <div className="retail-row" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className="retail-button"
                        onClick={() => void openProfile(c.id)}
                      >
                        <Eye size={15} />
                        <span>Raio-X 360º</span>
                      </button>
                      <a
                        href={buildWhatsAppLink(c)}
                        target="_blank"
                        rel="noreferrer"
                        className="retail-icon-button"
                        aria-label={`Conversar no WhatsApp com ${c.name}`}
                        data-tooltip={`WhatsApp de ${c.name}`}
                      >
                        <MessageCircle size={16} />
                      </a>
                      <button
                        type="button"
                        className="retail-icon-button"
                        aria-label={`Editar cadastro de ${c.name}`}
                        data-tooltip={`Editar ${c.name}`}
                        onClick={() => openEditor(c)}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="retail-empty">
          <Users size={40} />
          <h2>
            {search || segment !== "all"
              ? "Nenhum cliente encontrado para este filtro"
              : "Comece cadastrando seus clientes"}
          </h2>
          <p>
            {search || segment !== "all"
              ? "Altere os termos da busca ou selecione outro segmento acima."
              : "Identifique os clientes nas vendas para acompanhar preferências de tamanho, cor, compras anteriores e créditos."}
          </p>
          {search || segment !== "all" ? (
            <button
              type="button"
              className="retail-button"
              onClick={() => {
                setSearch("");
                setSegment("all");
              }}
            >
              Limpar filtros
            </button>
          ) : (
            <button
              type="button"
              className="retail-button retail-button-primary"
              onClick={() => openEditor(null)}
            >
              <Plus size={18} />
              <span>Cadastrar primeiro cliente</span>
            </button>
          )}
        </div>
      )}

      {/* Modal Raio-X 360º do Cliente */}
      {selectedCustomerId && (
        <RetailDialog
          title={
            profileData?.customer
              ? `Raio-X 360º · ${profileData.customer.name}`
              : "Raio-X 360º do Cliente"
          }
          wide
          onClose={() => {
            setSelectedCustomerId(null);
            setProfileData(null);
          }}
        >
          <div className="retail-dialog-body retail-stack">
            {profileLoading ? (
              <div
                className="retail-loader-region"
                role="status"
                aria-busy="true"
              >
                <PdvLojistaLoader
                  mode="loader"
                  size={72}
                  label="Carregando histórico e DNA do cliente…"
                />
              </div>
            ) : profileError ? (
              <p role="alert" className="retail-message">
                {profileError}
              </p>
            ) : (
              profileData && (
                <>
                  {/* Cabeçalho de Identificação 360º */}
                  <div className="retail-panel retail-customer-360-header">
                    <div className="retail-stack" style={{ gap: 8 }}>
                      <div className="retail-row">
                        <h3 style={{ margin: 0, fontSize: 19 }}>
                          {profileData.customer.name}
                        </h3>
                        <SegmentBadge
                          row={{
                            isVip: profileData.metrics.isVip,
                            isInactive: profileData.metrics.isInactive,
                            purchasesCount: profileData.metrics.purchasesCount,
                          }}
                        />
                      </div>
                      <div className="retail-row retail-customer-meta-row">
                        <span>
                          <Phone size={14} aria-hidden="true" />{" "}
                          {formatPhoneDisplay(profileData.customer.phone)}
                        </span>
                        {profileData.customer.cpfCnpj && (
                          <span>
                            <FileText size={14} aria-hidden="true" /> CPF/CNPJ:{" "}
                            {profileData.customer.cpfCnpj}
                          </span>
                        )}
                        {profileData.customer.address && (
                          <span>
                            <MapPin size={14} aria-hidden="true" />{" "}
                            {profileData.customer.address}
                          </span>
                        )}
                        <span>
                          Cliente desde{" "}
                          {formatDatePtBr(profileData.customer.createdAt)}
                        </span>
                      </div>
                      {profileData.customer.reference && (
                        <p
                          className="retail-message"
                          style={{ margin: "4px 0 0" }}
                        >
                          <strong>Observações e preferências:</strong>{" "}
                          {profileData.customer.reference}
                        </p>
                      )}
                    </div>

                    <div className="retail-row">
                      <a
                        href={buildWhatsAppLink({
                          name: profileData.customer.name,
                          phone: profileData.customer.phone,
                          creditBalance: profileData.metrics.creditBalance,
                          daysSinceLastPurchase:
                            profileData.metrics.daysSinceLastPurchase,
                          favoriteSize:
                            profileData.dna.topSizes?.[0]?.label || null,
                        })}
                        target="_blank"
                        rel="noreferrer"
                        className="retail-button"
                      >
                        <MessageCircle size={16} />
                        <span>Chamar no WhatsApp</span>
                      </a>
                      <button
                        type="button"
                        className="retail-button"
                        onClick={() => openEditor(profileData.customer)}
                      >
                        <Pencil size={16} />
                        <span>Editar cadastro</span>
                      </button>
                    </div>
                  </div>

                  {/* Métricas do Cliente */}
                  <div className="retail-summary-grid retail-customer-360-kpis">
                    <article className="retail-panel">
                      <span className="retail-muted">Investimento líquido</span>
                      <strong className="retail-summary-value retail-number">
                        {money(profileData.metrics.netSpent)}
                      </strong>
                      <small className="retail-muted">
                        Bruto: {money(profileData.metrics.totalSpent)} ·
                        Trocado: {money(profileData.metrics.totalReturned)}
                      </small>
                    </article>

                    <article className="retail-panel">
                      <span className="retail-muted">Compras & Volume</span>
                      <strong className="retail-summary-value retail-number">
                        {profileData.metrics.purchasesCount} vendas
                      </strong>
                      <small className="retail-muted">
                        {profileData.metrics.totalPieces} peças adquiridas ·
                        Ticket médio: {money(profileData.metrics.avgTicket)}
                      </small>
                    </article>

                    <article className="retail-panel">
                      <span className="retail-muted">
                        Recorrência & Última visita
                      </span>
                      <strong className="retail-summary-value retail-number">
                        {profileData.metrics.avgDaysBetweenPurchases
                          ? `A cada ${profileData.metrics.avgDaysBetweenPurchases}d`
                          : profileData.metrics.daysSinceLastPurchase !== null
                            ? `Há ${profileData.metrics.daysSinceLastPurchase}d`
                            : "Sem compras"}
                      </strong>
                      <small className="retail-muted">
                        {profileData.metrics.lastPurchaseAt
                          ? `Última compra em ${formatDatePtBr(profileData.metrics.lastPurchaseAt)}`
                          : "Nenhuma compra registrada"}
                      </small>
                    </article>

                    <article className="retail-panel">
                      <span className="retail-muted">
                        Saldo de crédito na loja
                      </span>
                      <strong className="retail-summary-value retail-number">
                        {money(profileData.metrics.creditBalance)}
                      </strong>
                      <small className="retail-muted">
                        Emitido: {money(profileData.metrics.totalCreditIssued)}{" "}
                        · Já usado: {money(profileData.metrics.totalCreditUsed)}
                      </small>
                    </article>
                  </div>

                  {/* DNA de Consumo Lojista */}
                  <div className="retail-customer-dna-grid">
                    <div className="retail-panel">
                      <div className="retail-row retail-spread">
                        <h3>Tamanhos habituais</h3>
                        <Tag size={16} aria-hidden="true" />
                      </div>
                      {profileData.dna.topSizes.length ? (
                        <div className="retail-row" style={{ gap: 8 }}>
                          {profileData.dna.topSizes.map((s: any) => (
                            <span
                              className="retail-badge retail-badge-strong"
                              key={s.label}
                            >
                              Tam. {s.label} · {s.quantity} pçs
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="retail-muted">
                          Sem tamanhos identificados nas compras.
                        </p>
                      )}

                      <div
                        className="retail-row retail-spread"
                        style={{ marginTop: 16 }}
                      >
                        <h3>Cores mais escolhidas</h3>
                        <Palette size={16} aria-hidden="true" />
                      </div>
                      {profileData.dna.topColors.length ? (
                        <div className="retail-row" style={{ gap: 8 }}>
                          {profileData.dna.topColors.map((col: any) => (
                            <span className="retail-badge" key={col.label}>
                              {col.label} · {col.quantity} pçs
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="retail-muted">
                          Sem cores identificadas nas compras.
                        </p>
                      )}
                    </div>

                    <div className="retail-panel">
                      <div className="retail-row retail-spread">
                        <h3>Mercadorias e categorias favoritas</h3>
                        <ShoppingBag size={16} aria-hidden="true" />
                      </div>
                      {profileData.dna.topGroups.length ? (
                        <div className="retail-stack" style={{ gap: 8 }}>
                          {profileData.dna.topGroups.map((g: any) => (
                            <div
                              className="retail-payment-line"
                              key={g.id}
                              style={{ padding: "6px 0" }}
                            >
                              <span>
                                <strong>{g.name}</strong>
                                {g.categoryName ? (
                                  <small className="retail-muted">
                                    {" "}
                                    · {g.categoryName}
                                  </small>
                                ) : null}
                              </span>
                              <span className="retail-number">
                                {g.quantity} pçs ·{" "}
                                <strong>{money(g.total)}</strong>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="retail-muted">
                          Nenhuma mercadoria comprada ainda.
                        </p>
                      )}
                    </div>

                    <div className="retail-panel">
                      <div className="retail-row retail-spread">
                        <h3>Pagamentos preferidos</h3>
                        <CreditCard size={16} aria-hidden="true" />
                      </div>
                      {profileData.dna.paymentMethods.length ? (
                        <div className="retail-stack" style={{ gap: 6 }}>
                          {profileData.dna.paymentMethods.map((pm: any) => (
                            <div
                              className="retail-payment-line"
                              key={pm.label}
                              style={{ padding: "4px 0" }}
                            >
                              <span>
                                {pm.label} ({pm.count}×)
                              </span>
                              <strong className="retail-number">
                                {money(pm.total)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="retail-muted">Sem pagamentos.</p>
                      )}

                      <div
                        className="retail-row retail-spread"
                        style={{ marginTop: 16 }}
                      >
                        <h3>Atendido na loja por</h3>
                        <UserCheck size={16} aria-hidden="true" />
                      </div>
                      {profileData.dna.operators.length ? (
                        <div className="retail-row" style={{ gap: 8 }}>
                          {profileData.dna.operators.map((op: any) => (
                            <span className="retail-badge" key={op.id}>
                              {op.name} · {op.count}{" "}
                              {op.count === 1 ? "venda" : "vendas"}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="retail-muted">
                          Sem operador vinculado às vendas.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Abas de Histórico (Compras vs Trocas/Créditos) */}
                  <div className="retail-row" style={{ borderBottom: "1px solid var(--pdv-border)", paddingBottom: 12 }}>
                    <button
                      type="button"
                      className={`retail-cat-pill ${profileTab === "sales" ? "is-active" : ""}`}
                      aria-pressed={profileTab === "sales"}
                      onClick={() => setProfileTab("sales")}
                    >
                      <span>Histórico de compras</span>
                      <span className="retail-cat-count retail-number">
                        {profileData.sales.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`retail-cat-pill ${profileTab === "credits" ? "is-active" : ""}`}
                      aria-pressed={profileTab === "credits"}
                      onClick={() => setProfileTab("credits")}
                    >
                      <span>Trocas e extrato de créditos</span>
                      <span className="retail-cat-count retail-number">
                        {profileData.returns.length}
                      </span>
                    </button>
                  </div>

                  {profileTab === "sales" ? (
                    profileData.sales.length ? (
                      <div className="retail-stack">
                        {profileData.sales.map((sale: any) => (
                          <div className="retail-panel" key={sale.id}>
                            <div className="retail-row retail-spread">
                              <div>
                                <strong>
                                  Venda #{sale.code || sale.id.slice(0, 8)}
                                </strong>
                                <span className="retail-muted">
                                  {" "}
                                  · {formatDatePtBr(sale.createdAt, true)}
                                  {sale.operatorName
                                    ? ` · Atendido por ${sale.operatorName}`
                                    : ""}
                                </span>
                              </div>
                              <div className="retail-row">
                                <span className="retail-badge">
                                  {sale.status === "completed"
                                    ? "Concluída"
                                    : sale.status === "cancelled"
                                      ? "Cancelada"
                                      : sale.status}
                                </span>
                                <strong className="retail-number">
                                  {money(sale.total)}
                                </strong>
                                {sale.canInitiateReturn && (
                                  <button
                                    type="button"
                                    className="retail-button"
                                    onClick={() => {
                                      const ref = String(sale.code || sale.id);
                                      setSelectedCustomerId(null);
                                      navigate(
                                        `/clientes/trocas?sale=${encodeURIComponent(ref)}`,
                                      );
                                    }}
                                  >
                                    <RotateCcw size={15} />
                                    <span>Iniciar troca</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            <div
                              className="retail-stack"
                              style={{ marginTop: 12, gap: 6 }}
                            >
                              {sale.items.map((item: any) => (
                                <div
                                  className="retail-payment-line"
                                  key={item.id}
                                >
                                  <span>
                                    <strong className="retail-number">
                                      {item.quantity}×
                                    </strong>{" "}
                                    {item.productName}
                                    {(item.size || item.color) && (
                                      <small className="retail-muted">
                                        {" "}
                                        (
                                        {[
                                          item.size && `Tam. ${item.size}`,
                                          item.color,
                                        ]
                                          .filter(Boolean)
                                          .join(" · ")}
                                        )
                                      </small>
                                    )}
                                    {item.returnedQuantity > 0 && (
                                      <small className="retail-muted">
                                        {" "}
                                        · {item.returnedQuantity}{" "}
                                        {item.returnedQuantity === 1
                                          ? "peça trocada"
                                          : "peças trocadas"}
                                      </small>
                                    )}
                                  </span>
                                  <span className="retail-number">
                                    {money(item.subtotal)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div
                              className="retail-row retail-spread"
                              style={{ marginTop: 10 }}
                            >
                              <span className="retail-muted">
                                Pagamento:{" "}
                                {sale.payments
                                  .map(
                                    (p: any) => `${p.label} (${money(p.value)})`,
                                  )
                                  .join(", ") || "—"}
                              </span>
                              {sale.discount > 0 && (
                                <span className="retail-muted retail-number">
                                  Desconto concedido: {money(sale.discount)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="retail-empty">
                        <ShoppingBag size={32} />
                        <p>Este cliente ainda não possui compras registradas.</p>
                      </div>
                    )
                  ) : profileData.credits.length ||
                    profileData.returns.length ? (
                    <div className="retail-stack">
                      {profileData.credits.map((credit: any) => (
                        <div className="retail-panel" key={credit.id}>
                          <div className="retail-row retail-spread">
                            <div>
                              <strong>
                                Crédito de troca · Venda #
                                {credit.saleCode || credit.saleId || "—"}
                              </strong>
                              <span className="retail-muted">
                                {" "}
                                · Emitido em{" "}
                                {formatDatePtBr(credit.createdAt, true)}
                              </span>
                            </div>
                            <div className="retail-row">
                              <span className="retail-muted retail-number">
                                Valor original: {money(credit.amount)}
                              </span>
                              <span className="retail-badge retail-badge-strong retail-number">
                                Saldo atual: {money(credit.balance)}
                              </span>
                            </div>
                          </div>
                          {credit.reason && (
                            <p
                              className="retail-muted"
                              style={{ margin: "8px 0 0" }}
                            >
                              Motivo da troca: {credit.reason}
                            </p>
                          )}
                          {credit.uses?.length > 0 && (
                            <div
                              className="retail-stack"
                              style={{ marginTop: 10, gap: 6 }}
                            >
                              {credit.uses.map((use: any) => (
                                <div
                                  className="retail-payment-line"
                                  key={use.id}
                                >
                                  <span>
                                    Utilizado na Venda #
                                    {use.saleCode || use.saleId.slice(0, 8)} em{" "}
                                    {formatDatePtBr(use.createdAt, true)}
                                    {use.reversedAt
                                      ? " (Estornado por cancelamento)"
                                      : ""}
                                  </span>
                                  <strong className="retail-number">
                                    {money(use.amount)}
                                  </strong>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="retail-empty">
                      <RotateCcw size={32} />
                      <p>
                        Nenhuma troca ou crédito registrado para este cliente.
                      </p>
                    </div>
                  )}
                </>
              )
            )}
          </div>
          <footer className="retail-dialog-footer">
            <button
              type="button"
              className="retail-button retail-button-primary"
              onClick={() => {
                setSelectedCustomerId(null);
                setProfileData(null);
              }}
            >
              Fechar Raio-X
            </button>
          </footer>
        </RetailDialog>
      )}

      {/* Modal de Cadastro / Edição de Cliente */}
      {editorCustomer !== undefined && (
        <RetailDialog
          title={
            editorCustomer?.id
              ? `Editar cliente · ${editorCustomer.name}`
              : "Novo cliente da loja"
          }
          onClose={() => {
            if (!formBusy) setEditorCustomer(undefined);
          }}
          busy={formBusy}
        >
          <form onSubmit={saveCustomer}>
            <div className="retail-dialog-body retail-stack">
              <div className="retail-form-grid">
                <label className="retail-field">
                  Nome completo *
                  <input
                    required
                    maxLength={120}
                    disabled={formBusy}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex.: Marina Costa"
                  />
                </label>

                <label className="retail-field">
                  Telefone / WhatsApp *
                  <input
                    required
                    type="tel"
                    maxLength={20}
                    disabled={formBusy}
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Ex.: (11) 98888-7777"
                  />
                </label>
              </div>

              <div className="retail-form-grid">
                <label className="retail-field">
                  CPF ou CNPJ (opcional)
                  <input
                    maxLength={20}
                    disabled={formBusy}
                    value={formCpfCnpj}
                    onChange={(e) => setFormCpfCnpj(e.target.value)}
                    placeholder="Para identificação fiscal na NFC-e"
                  />
                </label>

                <label className="retail-field">
                  Endereço / Bairro (opcional)
                  <input
                    maxLength={255}
                    disabled={formBusy}
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Ex.: Rua das Flores, 120 - Centro"
                  />
                </label>
              </div>

              <label className="retail-field">
                Observações e preferências do cliente (opcional)
                <textarea
                  maxLength={500}
                  disabled={formBusy}
                  value={formReference}
                  onChange={(e) => setFormReference(e.target.value)}
                  placeholder="Ex.: Veste camiseta G, calçado 41, prefere modelagem oversized e tons escuros."
                />
                <small>
                  Estas anotações aparecem na Ficha 360º para ajudar a equipe a
                  oferecer atendimento personalizado.
                </small>
              </label>

              {formError && (
                <p role="alert" className="retail-message">
                  {formError}
                </p>
              )}
            </div>

            <footer className="retail-dialog-footer">
              <button
                type="button"
                className="retail-button"
                disabled={formBusy}
                onClick={() => setEditorCustomer(undefined)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="retail-button retail-button-primary"
                disabled={formBusy}
              >
                {formBusy ? (
                  <>
                    <PdvLojistaLoader
                      mode="loader"
                      compact
                      size={16}
                      label="Salvando cliente"
                    />
                    <span>Salvando…</span>
                  </>
                ) : editorCustomer?.id ? (
                  "Salvar alterações"
                ) : (
                  "Cadastrar cliente"
                )}
              </button>
            </footer>
          </form>
        </RetailDialog>
      )}
    </>
  );
}
