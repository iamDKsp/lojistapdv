import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Award,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Eye,
  Filter,
  Percent,
  RotateCcw,
  Save,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getFullUrl } from "@/lib/getFullUrl";
import { ROUTES } from "@/lib/routes";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";
import { RetailDatePicker } from "@/components/ui/DatePicker";
import { RetailDialog } from "./RetailDialog";
import { apiError, money } from "./types";

type RankingCriterionId =
  | "netRevenue"
  | "grossRevenue"
  | "dailyWinsCount"
  | "piecesCount"
  | "pa"
  | "avgTicket"
  | "identifiedRatePct";

interface RankingCriterionOption {
  id: RankingCriterionId;
  label: string;
  shortLabel: string;
  description: string;
}

const RANKING_CRITERIA: RankingCriterionOption[] = [
  {
    id: "netRevenue",
    label: "Desafio · Faturamento Líquido",
    shortLabel: "Líquido",
    description: "Vendas concluídas descontando trocas das vendas do vendedor",
  },
  {
    id: "grossRevenue",
    label: "Desafio · Faturamento Bruto",
    shortLabel: "Bruto",
    description: "Volume financeiro total vendido antes de trocas",
  },
  {
    id: "dailyWinsCount",
    label: "Desafio · Dias em 1º Lugar (Vitórias)",
    shortLabel: "Vitórias",
    description: "Quantidade de dias em que o vendedor foi o Campeão do Dia",
  },
  {
    id: "piecesCount",
    label: "Desafio · Volume de Peças",
    shortLabel: "Peças",
    description: "Quantidade total de peças vendidas no período",
  },
  {
    id: "pa",
    label: "Desafio · PA (Peças por Atendimento)",
    shortLabel: "PA",
    description: "Média de peças por sacola (eficiência de venda casada)",
  },
  {
    id: "avgTicket",
    label: "Desafio · Ticket Médio",
    shortLabel: "Ticket Médio",
    description: "Valor médio por venda concluída pelo vendedor",
  },
  {
    id: "identifiedRatePct",
    label: "Desafio · Fidelização de Clientes",
    shortLabel: "Fidelização",
    description: "Percentual de vendas com cliente identificado no PDV",
  },
];

function todaySaoPaulo(): string {
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

function formatBrDate(isoDate?: string | null): string {
  if (!isoDate) return "—";
  const clean = String(isoDate).slice(0, 10);
  const parts = clean.split("-");
  if (parts.length !== 3) return clean;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatShortBrDate(isoDate?: string | null): string {
  if (!isoDate) return "—";
  const clean = String(isoDate).slice(0, 10);
  const parts = clean.split("-");
  if (parts.length !== 3) return clean;
  return `${parts[2]}/${parts[1]}`;
}

function getMonthBounds(yearMonth: string): { start: string; end: string } {
  const [yStr, mStr] = yearMonth.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${yearMonth}-01`,
    end: `${yearMonth}-${String(lastDay).padStart(2, "0")}`,
  };
}

function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const [yStr, mStr] = yearMonth.split("-");
  const dt = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + deltaMonths, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthTitle(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split("-");
  const dt = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, 15));
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

/**
 * Coroa de louros vetorial (#1 do Pódio) inspirada na referência visual enviada,
 * construída 100% com os tokens aprovados da paleta roxa, branca e neutra.
 */
function PodiumLaurelCrownSvg() {
  return (
    <svg
      viewBox="0 0 88 52"
      className="retail-intel-laurel-svg"
      fill="none"
      aria-hidden="true"
    >
      {/* Ramo esquerdo */}
      <path
        d="M36 45 C22 42, 13 31, 14 15"
        stroke="var(--pdv-primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <ellipse
        cx="15"
        cy="34"
        rx="5.5"
        ry="2.6"
        transform="rotate(-35 15 34)"
        fill="var(--pdv-primary)"
      />
      <ellipse
        cx="12"
        cy="25"
        rx="5.5"
        ry="2.6"
        transform="rotate(-15 12 25)"
        fill="var(--pdv-support)"
      />
      <ellipse
        cx="15"
        cy="16"
        rx="5.2"
        ry="2.5"
        transform="rotate(15 15 16)"
        fill="var(--pdv-primary)"
      />
      <ellipse
        cx="23"
        cy="41"
        rx="5.2"
        ry="2.5"
        transform="rotate(-50 23 41)"
        fill="var(--pdv-support)"
      />
      {/* Ramo direito */}
      <path
        d="M52 45 C66 42, 75 31, 74 15"
        stroke="var(--pdv-primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <ellipse
        cx="73"
        cy="34"
        rx="5.5"
        ry="2.6"
        transform="rotate(35 73 34)"
        fill="var(--pdv-primary)"
      />
      <ellipse
        cx="76"
        cy="25"
        rx="5.5"
        ry="2.6"
        transform="rotate(15 76 25)"
        fill="var(--pdv-support)"
      />
      <ellipse
        cx="73"
        cy="16"
        rx="5.2"
        ry="2.5"
        transform="rotate(-15 73 16)"
        fill="var(--pdv-primary)"
      />
      <ellipse
        cx="65"
        cy="41"
        rx="5.2"
        ry="2.5"
        transform="rotate(50 65 41)"
        fill="var(--pdv-support)"
      />
      {/* Escudo central com número 1 */}
      <path
        d="M31 10 H57 L53 34 L44 41 L35 34 Z"
        fill="var(--pdv-primary)"
        stroke="var(--pdv-support)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <text
        x="44"
        y="29"
        textAnchor="middle"
        fill="var(--pdv-white)"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="900"
        fontSize="16"
      >
        1
      </text>
    </svg>
  );
}

function SellerAvatar({
  name,
  imageUrl,
  size = 44,
  rank,
}: {
  name: string;
  imageUrl?: string | null;
  size?: number;
  rank?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [imageUrl]);

  const initials = useMemo(() => {
    const clean = (name || "VD").trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }, [name]);

  const isTop1 = rank === 1;
  const isPodium = rank === 1 || rank === 2 || rank === 3;

  return (
    <span
      className={`retail-intel-avatar ${isTop1 ? "is-rank-1" : isPodium ? "is-rank-podium" : ""}`}
      style={{ width: size, height: size }}
    >
      {imageUrl && !imgFailed ? (
        <img
          src={getFullUrl(imageUrl)}
          alt={name}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="retail-intel-avatar-fallback">{initials}</span>
      )}
    </span>
  );
}

export function RetailIntelligencePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeSubTab: "ranking" | "calendario" | "metas" = useMemo(() => {
    if (location.pathname.includes("/calendario")) return "calendario";
    if (
      location.pathname.includes("/auditoria") ||
      location.pathname.includes("/metas")
    ) {
      return "metas";
    }
    return "ranking";
  }, [location.pathname]);

  const [start, setStart] = useState(() => todaySaoPaulo().slice(0, 8) + "01");
  const [end, setEnd] = useState(todaySaoPaulo);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Estado do Pódio / Ranking
  const [criterion, setCriterion] = useState<RankingCriterionId>("netRevenue");
  const [challengeMenuOpen, setChallengeMenuOpen] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);

  // Estado do Calendário Comercial
  const [calendarSellerFilter, setCalendarSellerFilter] =
    useState<string>("ALL");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    () => todaySaoPaulo(),
  );

  // Estado de Metas e Comissões
  const [goalsForm, setGoalsForm] = useState<{
    storeMonthlyGoal: string;
    defaultSellerGoal: string;
    defaultCommissionPct: string;
    commissionBasis: "net" | "gross";
    maxHealthyDiscountPct: string;
    maxHealthyReturnPct: string;
    sellerOverrides: Record<string, { goal: string; commissionPct: string }>;
  }>({
    storeMonthlyGoal: "25000",
    defaultSellerGoal: "8000",
    defaultCommissionPct: "3",
    commissionBasis: "net",
    maxHealthyDiscountPct: "8",
    maxHealthyReturnPct: "10",
    sellerOverrides: {},
  });
  const [savingGoals, setSavingGoals] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/retail/intelligence", {
          params: { startDate: start, endDate: end },
          signal,
        });
        if (!signal?.aborted) {
          setData(res.data);
          const cfg = res.data?.goalsConfig;
          if (cfg) {
            const overrides: Record<
              string,
              { goal: string; commissionPct: string }
            > = {};
            for (const s of res.data?.sellers || []) {
              const ov = cfg.sellerOverrides?.[s.operatorId] || {};
              overrides[s.operatorId] = {
                goal: String(ov.goal ?? cfg.defaultSellerGoal ?? 8000),
                commissionPct: String(
                  ov.commissionPct ?? cfg.defaultCommissionPct ?? 3,
                ),
              };
            }
            setGoalsForm({
              storeMonthlyGoal: String(cfg.storeMonthlyGoal ?? 25000),
              defaultSellerGoal: String(cfg.defaultSellerGoal ?? 8000),
              defaultCommissionPct: String(cfg.defaultCommissionPct ?? 3),
              commissionBasis: cfg.commissionBasis === "gross" ? "gross" : "net",
              maxHealthyDiscountPct: String(cfg.maxHealthyDiscountPct ?? 8),
              maxHealthyReturnPct: String(cfg.maxHealthyReturnPct ?? 10),
              sellerOverrides: overrides,
            });
          }

          // Seleciona automaticamente o último dia com vendas (ou hoje) no calendário
          const daysWithSales = (res.data?.calendar?.days || []).filter(
            (d: any) => d.hasSales,
          );
          if (daysWithSales.length > 0) {
            const latestWithSale = daysWithSales[daysWithSales.length - 1].date;
            setSelectedCalendarDate((prev) => {
              const existsInRange = (res.data?.calendar?.days || []).some(
                (d: any) => d.date === prev && d.hasSales,
              );
              return existsInRange ? prev : latestWithSale;
            });
          }
        }
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

  const activeCriterionObj = useMemo(
    () =>
      RANKING_CRITERIA.find((c) => c.id === criterion) || RANKING_CRITERIA[0],
    [criterion],
  );

  // Vendedores ordenados pelo desafio/critério selecionado no Pódio
  const rankedSellers = useMemo(() => {
    const list = [...(data?.sellers || [])];
    return list.sort((a, b) => {
      const valA = Number(a[criterion] || 0);
      const valB = Number(b[criterion] || 0);
      if (valB !== valA) return valB - valA;
      return (
        Number(b.netRevenue || 0) - Number(a.netRevenue || 0) ||
        Number(b.grossRevenue || 0) - Number(a.grossRevenue || 0)
      );
    });
  }, [data?.sellers, criterion]);

  const formatCriterionMetric = useCallback(
    (seller: any, crit: RankingCriterionId = criterion): string => {
      if (!seller) return "—";
      switch (crit) {
        case "netRevenue":
          return money(seller.netRevenue);
        case "grossRevenue":
          return money(seller.grossRevenue);
        case "dailyWinsCount":
          return `${seller.dailyWinsCount} ${seller.dailyWinsCount === 1 ? "vitória" : "vitórias"}`;
        case "piecesCount":
          return `${seller.piecesCount} ${seller.piecesCount === 1 ? "peça" : "peças"}`;
        case "pa":
          return `${Number(seller.pa || 0).toFixed(2)} PA`;
        case "avgTicket":
          return money(seller.avgTicket);
        case "identifiedRatePct":
          return `${Number(seller.identifiedRatePct || 0).toFixed(1)}% fiel`;
        default:
          return money(seller.netRevenue);
      }
    },
    [criterion],
  );

  const selectedSeller = useMemo(
    () =>
      (data?.sellers || []).find(
        (s: any) => s.operatorId === selectedSellerId,
      ) || null,
    [data?.sellers, selectedSellerId],
  );

  // Dados filtrados do Calendário (Toda a Equipe ou Vendedor Específico)
  const calendarDaysView = useMemo(() => {
    const rawDays: any[] = data?.calendar?.days || [];
    if (calendarSellerFilter === "ALL") return rawDays;

    return rawDays.map((day) => {
      const sellerEntry = (day.sellerBreakdown || []).find(
        (s: any) => s.operatorId === calendarSellerFilter,
      );
      const filteredSales = (day.sales || []).filter(
        (sale: any) => sale.operatorId === calendarSellerFilter,
      );
      const revenue = sellerEntry?.revenue || 0;
      const netRevenue = sellerEntry?.netRevenue || 0;
      const salesCount = sellerEntry?.salesCount || 0;
      const piecesCount = sellerEntry?.piecesCount || 0;
      return {
        ...day,
        hasSales: salesCount > 0,
        revenue,
        netRevenue,
        discountTotal: sellerEntry?.discountTotal || 0,
        returnsTotal: sellerEntry?.returnsTotal || 0,
        salesCount,
        piecesCount,
        pa: sellerEntry?.pa || 0,
        sales: filteredSales,
      };
    });
  }, [data?.calendar?.days, calendarSellerFilter]);

  const maxDailyRevenue = useMemo(() => {
    return Math.max(
      1,
      ...calendarDaysView.map((d: any) => Number(d.revenue || 0)),
    );
  }, [calendarDaysView]);

  const recordDayDate = useMemo(() => {
    const best = [...calendarDaysView]
      .filter((d) => d.hasSales)
      .sort((a, b) => b.revenue - a.revenue)[0];
    return best?.date || null;
  }, [calendarDaysView]);

  const selectedDayData = useMemo(() => {
    if (!calendarDaysView.length) return null;
    return (
      calendarDaysView.find((d: any) => d.date === selectedCalendarDate) ||
      calendarDaysView[calendarDaysView.length - 1]
    );
  }, [calendarDaysView, selectedCalendarDate]);

  const currentYearMonth = useMemo(() => start.slice(0, 7), [start]);

  const handleNavigateMonth = (delta: number) => {
    const nextYm = shiftYearMonth(currentYearMonth, delta);
    const bounds = getMonthBounds(nextYm);
    setStart(bounds.start);
    setEnd(bounds.end);
    setSelectedCalendarDate(bounds.start);
  };

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGoals(true);
    try {
      const overridesPayload: Record<
        string,
        { goal: number; commissionPct: number }
      > = {};
      for (const [opId, vals] of Object.entries(goalsForm.sellerOverrides)) {
        overridesPayload[opId] = {
          goal: Math.max(0, Number(vals.goal) || 0),
          commissionPct: Math.min(
            100,
            Math.max(0, Number(vals.commissionPct) || 0),
          ),
        };
      }
      await api.put("/retail/intelligence/goals", {
        storeMonthlyGoal: Math.max(0, Number(goalsForm.storeMonthlyGoal) || 0),
        defaultSellerGoal: Math.max(
          0,
          Number(goalsForm.defaultSellerGoal) || 0,
        ),
        defaultCommissionPct: Math.min(
          100,
          Math.max(0, Number(goalsForm.defaultCommissionPct) || 0),
        ),
        commissionBasis: goalsForm.commissionBasis,
        maxHealthyDiscountPct: Math.min(
          100,
          Math.max(0, Number(goalsForm.maxHealthyDiscountPct) || 0),
        ),
        maxHealthyReturnPct: Math.min(
          100,
          Math.max(0, Number(goalsForm.maxHealthyReturnPct) || 0),
        ),
        sellerOverrides: overridesPayload,
      });
      toast.success("Metas e parâmetros comerciais salvos com sucesso!");
      void load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSavingGoals(false);
    }
  };

  const openSellerInCalendar = (operatorId: string, bestDate?: string) => {
    setSelectedSellerId(null);
    setCalendarSellerFilter(operatorId);
    if (bestDate) {
      setSelectedCalendarDate(bestDate);
    }
    navigate(ROUTES.inteligenciaComercial.calendario);
  };

  const podiumTop1 = rankedSellers[0] || null;
  const podiumTop2 = rankedSellers[1] || null;
  const podiumTop3 = rankedSellers[2] || null;

  return (
    <>
      <div className="retail-page-header">
        <div>
          <div className="retail-row" style={{ gap: 8, marginBottom: 4 }}>
            <span className="retail-intel-pill-badge">
              <Trophy size={13} />
              MÓDULO EXCLUSIVO · INTELIGÊNCIA COMERCIAL
            </span>
          </div>
          <h1>Inteligência Comercial &amp; Ranking de Vendedores</h1>
          <p>
            Pódio de performance da equipe, índice de descontos, taxa de trocas
            por vendedor, recordes diários e calendário interativo de vendas.
          </p>
        </div>
        <div className="retail-row">
          <button
            type="button"
            className={`retail-button ${activeSubTab === "ranking" ? "retail-button-primary" : ""}`}
            onClick={() => navigate(ROUTES.inteligenciaComercial.ranking)}
          >
            <Trophy size={16} />
            Ranking e Pódio
          </button>
          <button
            type="button"
            className={`retail-button ${activeSubTab === "calendario" ? "retail-button-primary" : ""}`}
            onClick={() => navigate(ROUTES.inteligenciaComercial.calendario)}
          >
            <CalendarIcon size={16} />
            Calendário de Vendas
          </button>
          <button
            type="button"
            className={`retail-button ${activeSubTab === "metas" ? "retail-button-primary" : ""}`}
            onClick={() => navigate(ROUTES.inteligenciaComercial.metas)}
          >
            <Target size={16} />
            Descontos, Trocas &amp; Metas
          </button>
        </div>
      </div>

      {/* Barra de Período e Atalhos Rápidos */}
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
          onClick={() => {
            const today = todaySaoPaulo();
            setStart(today.slice(0, 8) + "01");
            setEnd(today);
          }}
        >
          Este mês
        </button>
        <button
          type="button"
          className="retail-button"
          onClick={() => {
            const today = todaySaoPaulo();
            const d7 = new Date(
              new Date(`${today}T12:00:00Z`).getTime() - 6 * 86400000,
            )
              .toISOString()
              .slice(0, 10);
            setStart(d7);
            setEnd(today);
          }}
        >
          Últimos 7 dias
        </button>
        <button
          type="button"
          className="retail-button retail-button-primary"
          onClick={() => void load()}
        >
          Atualizar inteligência
        </button>
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
            label="Calculando ranking, pódio e calendário comercial…"
          />
        </div>
      ) : (
        data && (
          <div className="retail-stack" style={{ gap: 20 }}>
            {/* Faixa Superior de KPIs Executivos da Equipe */}
            <div className="retail-kpis">
              <article className="retail-kpi">
                <span className="retail-muted">
                  Faturamento Líquido da Equipe
                </span>
                <strong className="retail-number">
                  {money(data.summary.netRevenue)}
                </strong>
                <small className="retail-muted">
                  Bruto {money(data.summary.grossRevenue)} ·{" "}
                  {data.summary.totalSales} vendas ({data.summary.totalPieces}{" "}
                  peças)
                </small>
              </article>

              <article className="retail-kpi">
                <span className="retail-muted">
                  Líder do Ranking (#1 no Período)
                </span>
                <strong className="retail-number">
                  {data.summary.topSeller?.name || "Sem vendas"}
                </strong>
                <small className="retail-muted">
                  {data.summary.topSeller
                    ? `${money(data.summary.topSeller.netRevenue)} líquidos · ${data.summary.topSeller.dailyWinsCount} ${data.summary.topSeller.dailyWinsCount === 1 ? "dia em 1º" : "dias em 1º"}`
                    : "Aguardando atendimentos"}
                </small>
              </article>

              <article className="retail-kpi">
                <span className="retail-muted">
                  Índice de Descontos Concedidos
                </span>
                <strong className="retail-number">
                  {Number(data.summary.discountRatePct || 0).toFixed(1)}% (
                  {money(data.summary.totalDiscounts)})
                </strong>
                <small className="retail-muted">
                  Aplicado em {data.summary.discountedSalesCount} de{" "}
                  {data.summary.totalSales} atendimentos
                </small>
              </article>

              <article className="retail-kpi">
                <span className="retail-muted">
                  Taxa de Trocas &amp; Recorde Diário
                </span>
                <strong className="retail-number">
                  {Number(data.summary.returnRatePct || 0).toFixed(1)}% trocas (
                  {money(data.summary.returnsTotal)})
                </strong>
                <small className="retail-muted">
                  {data.summary.bestDay
                    ? `Melhor dia: ${formatShortBrDate(data.summary.bestDay.date)} (${money(data.summary.bestDay.revenue)})`
                    : `${data.summary.returnsCount} trocas registradas`}
                </small>
              </article>
            </div>

            {/* =================================================================
                ABA 1: RANKING E PÓDIO (DESIGN INSPIRADO NA REFERÊNCIA ENVIADA)
               ================================================================= */}
            {activeSubTab === "ranking" && (
              <div className="retail-intel-ranking-layout">
                {/* COLUNA PRINCIPAL: PALCO DO PÓDIO + TABELA LEADERBOARD */}
                <section
                  className="retail-intel-stage-card"
                  aria-label="Ranking Comercial do Time"
                >
                  <div className="retail-intel-stage-top">
                    <div className="retail-intel-stage-header">
                      <span className="retail-intel-stage-tag">
                        <Crown size={14} />
                        LEADERBOARD COMERCIAL
                      </span>
                      <h2>Ranking de Vendedores</h2>
                      <p>
                        Toque em qualquer vendedor no pódio ou na lista para
                        abrir o Raio-X 360º individual
                      </p>
                    </div>

                    {/* Seletor Central "Challenges v" da referência */}
                    <div className="retail-intel-challenge-wrap">
                      <button
                        type="button"
                        className="retail-intel-challenge-btn"
                        onClick={() => setChallengeMenuOpen((prev) => !prev)}
                        aria-expanded={challengeMenuOpen}
                      >
                        <span>{activeCriterionObj.label}</span>
                        <ChevronDown size={16} />
                      </button>
                      {challengeMenuOpen && (
                        <div
                          className="retail-intel-challenge-menu"
                          role="listbox"
                        >
                          {RANKING_CRITERIA.map((opt) => (
                            <button
                              type="button"
                              key={opt.id}
                              className={`retail-intel-challenge-option ${criterion === opt.id ? "is-active" : ""}`}
                              onClick={() => {
                                setCriterion(opt.id);
                                setChallengeMenuOpen(false);
                              }}
                            >
                              <div>
                                <strong>{opt.label}</strong>
                                <small>{opt.description}</small>
                              </div>
                              {criterion === opt.id && <Trophy size={15} />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* PÓDIO TOP 3 (2º Esquerda · 1º Centro · 3º Direita) */}
                    <div className="retail-intel-podium-grid">
                      {/* 2º LUGAR */}
                      <div className="retail-intel-podium-slot is-second">
                        {podiumTop2 ? (
                          <button
                            type="button"
                            className="retail-intel-podium-person"
                            onClick={() =>
                              setSelectedSellerId(podiumTop2.operatorId)
                            }
                          >
                            <span className="retail-intel-rank-pill">2</span>
                            <SellerAvatar
                              name={podiumTop2.name}
                              imageUrl={podiumTop2.imageUrl}
                              size={80}
                              rank={2}
                            />
                            <strong className="retail-intel-podium-name">
                              {podiumTop2.name}
                            </strong>
                            <span className="retail-intel-podium-metric">
                              {formatCriterionMetric(podiumTop2)}
                            </span>
                            <small className="retail-intel-podium-sub">
                              {podiumTop2.dailyWinsCount}{" "}
                              {podiumTop2.dailyWinsCount === 1
                                ? "dia em 1º"
                                : "dias em 1º"}{" "}
                              · {podiumTop2.salesCount} vendas
                            </small>
                          </button>
                        ) : (
                          <div className="retail-intel-podium-empty">
                            <span className="retail-intel-rank-pill">2</span>
                            <small>2º Lugar</small>
                          </div>
                        )}
                      </div>

                      {/* 1º LUGAR (CENTRO COM COROA DE LOUROS) */}
                      <div className="retail-intel-podium-slot is-first">
                        {podiumTop1 ? (
                          <button
                            type="button"
                            className="retail-intel-podium-person is-champion"
                            onClick={() =>
                              setSelectedSellerId(podiumTop1.operatorId)
                            }
                          >
                            <PodiumLaurelCrownSvg />
                            <SellerAvatar
                              name={podiumTop1.name}
                              imageUrl={podiumTop1.imageUrl}
                              size={104}
                              rank={1}
                            />
                            <strong className="retail-intel-podium-name">
                              {podiumTop1.name}
                            </strong>
                            <span className="retail-intel-podium-metric is-champion-metric">
                              {formatCriterionMetric(podiumTop1)}
                            </span>
                            <small className="retail-intel-podium-sub">
                              {podiumTop1.dailyWinsCount}{" "}
                              {podiumTop1.dailyWinsCount === 1
                                ? "dia líder"
                                : "dias líder"}{" "}
                              · {podiumTop1.piecesCount} peças · PA{" "}
                              {Number(podiumTop1.pa || 0).toFixed(2)}
                            </small>
                          </button>
                        ) : (
                          <div className="retail-intel-podium-empty">
                            <PodiumLaurelCrownSvg />
                            <small>1º Lugar</small>
                          </div>
                        )}
                      </div>

                      {/* 3º LUGAR */}
                      <div className="retail-intel-podium-slot is-third">
                        {podiumTop3 ? (
                          <button
                            type="button"
                            className="retail-intel-podium-person"
                            onClick={() =>
                              setSelectedSellerId(podiumTop3.operatorId)
                            }
                          >
                            <span className="retail-intel-rank-pill">3</span>
                            <SellerAvatar
                              name={podiumTop3.name}
                              imageUrl={podiumTop3.imageUrl}
                              size={80}
                              rank={3}
                            />
                            <strong className="retail-intel-podium-name">
                              {podiumTop3.name}
                            </strong>
                            <span className="retail-intel-podium-metric">
                              {formatCriterionMetric(podiumTop3)}
                            </span>
                            <small className="retail-intel-podium-sub">
                              {podiumTop3.dailyWinsCount}{" "}
                              {podiumTop3.dailyWinsCount === 1
                                ? "dia em 1º"
                                : "dias em 1º"}{" "}
                              · {podiumTop3.salesCount} vendas
                            </small>
                          </button>
                        ) : (
                          <div className="retail-intel-podium-empty">
                            <span className="retail-intel-rank-pill">3</span>
                            <small>3º Lugar</small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* TABELA DE LEADERBOARD ABAIXO DO PÓDIO (ESTILO DA PRINT) */}
                  <div className="retail-intel-leaderboard-wrap">
                    <div className="retail-intel-leaderboard-head">
                      <span>Vendedor</span>
                      <span className="text-right">Liderança / PA</span>
                      <span className="text-right">% Desconto</span>
                      <span className="text-right">% Trocas</span>
                      <span className="text-right">Melhor Dia</span>
                      <span className="text-right">
                        {activeCriterionObj.shortLabel}
                      </span>
                    </div>

                    <div className="retail-intel-leaderboard-list">
                      {rankedSellers.map((seller: any, idx: number) => {
                        const pos = idx + 1;
                        const isHighDiscount =
                          seller.discountRatePct >
                          (data.goalsConfig?.maxHealthyDiscountPct ?? 8);
                        const isHighReturn =
                          seller.returnRatePct >
                          (data.goalsConfig?.maxHealthyReturnPct ?? 10);

                        return (
                          <div
                            key={seller.operatorId}
                            role="button"
                            tabIndex={0}
                            className={`retail-intel-leaderboard-row ${pos <= 3 ? "is-top-three" : ""}`}
                            onClick={() =>
                              setSelectedSellerId(seller.operatorId)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedSellerId(seller.operatorId);
                              }
                            }}
                          >
                            <div className="retail-intel-lb-seller">
                              <span
                                className={`retail-intel-lb-badge ${pos === 1 ? "is-pos-1" : pos <= 3 ? "is-pos-podium" : ""}`}
                              >
                                {pos}
                              </span>
                              <SellerAvatar
                                name={seller.name}
                                imageUrl={seller.imageUrl}
                                size={40}
                                rank={pos}
                              />
                              <div className="retail-intel-lb-ident">
                                <strong>{seller.name}</strong>
                                <small>
                                  {seller.jobTitle} · {seller.salesCount} vendas
                                  ({seller.piecesCount} pçs ·{" "}
                                  {seller.sharePct}% da loja)
                                </small>
                              </div>
                            </div>

                            <div
                              className="retail-intel-lb-cell text-right"
                              data-label="Liderança / PA"
                            >
                              <strong className="retail-number">
                                {seller.winRatePct}% ({seller.dailyWinsCount}d
                                #1)
                              </strong>
                              <small>
                                PA {Number(seller.pa || 0).toFixed(2)} · Ticket{" "}
                                {money(seller.avgTicket)}
                              </small>
                            </div>

                            <div
                              className="retail-intel-lb-cell text-right"
                              data-label="% Desconto"
                            >
                              <strong className="retail-number">
                                {Number(seller.discountRatePct || 0).toFixed(1)}
                                %
                              </strong>
                              <small>
                                {money(seller.discountTotal)}
                                {isHighDiscount ? " · Acima do teto" : ""}
                              </small>
                            </div>

                            <div
                              className="retail-intel-lb-cell text-right"
                              data-label="% Trocas"
                            >
                              <strong className="retail-number">
                                {Number(seller.returnRatePct || 0).toFixed(1)}%
                              </strong>
                              <small>
                                {seller.returnsCount}{" "}
                                {seller.returnsCount === 1 ? "troca" : "trocas"}{" "}
                                ({money(seller.returnsAmount)})
                                {isHighReturn ? " · Atenção" : ""}
                              </small>
                            </div>

                            <div
                              className="retail-intel-lb-cell text-right"
                              data-label="Melhor Dia"
                            >
                              {seller.bestDay ? (
                                <>
                                  <strong className="retail-number">
                                    {formatShortBrDate(seller.bestDay.date)}
                                  </strong>
                                  <small>{money(seller.bestDay.revenue)}</small>
                                </>
                              ) : (
                                <small>Sem vendas</small>
                              )}
                            </div>

                            <div
                              className="retail-intel-lb-cell retail-intel-lb-win text-right"
                              data-label={activeCriterionObj.shortLabel}
                            >
                              <strong className="retail-number">
                                {formatCriterionMetric(seller)}
                              </strong>
                              <small>
                                Bruto {money(seller.grossRevenue)}
                              </small>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* COLUNA LATERAL: INSIGHTS COMERCIAIS + RECORDE DIÁRIO + ATALHO PRO CALENDÁRIO */}
                <aside className="retail-stack" style={{ gap: 16 }}>
                  <section className="retail-panel">
                    <div
                      className="retail-row retail-spread"
                      style={{ marginBottom: 12 }}
                    >
                      <div>
                        <h2 style={{ margin: 0 }}>
                          Diagnóstico Comercial da Equipe
                        </h2>
                        <p className="retail-muted" style={{ margin: 0 }}>
                          Leitura automática de descontos, trocas, venda casada
                          e recordes
                        </p>
                      </div>
                      <Sparkles size={18} />
                    </div>

                    <div className="retail-stack" style={{ gap: 10 }}>
                      {(data.insights || []).length > 0 ? (
                        data.insights.map((ins: any) => (
                          <article
                            key={ins.id}
                            className="retail-intel-insight-card"
                            onClick={() => {
                              if (ins.operatorId) {
                                setSelectedSellerId(ins.operatorId);
                              }
                            }}
                          >
                            <div className="retail-row retail-spread">
                              <strong>{ins.title}</strong>
                              <span className="retail-intel-insight-badge retail-number">
                                {ins.metric}
                              </span>
                            </div>
                            <p className="retail-muted" style={{ margin: 0 }}>
                              {ins.description}
                            </p>
                          </article>
                        ))
                      ) : (
                        <p className="retail-empty">
                          Registre vendas no PDV para gerar diagnósticos
                          automáticos da equipe.
                        </p>
                      )}
                    </div>
                  </section>

                  {/* Card Rápido: Quem Vendeu Mais em Qual Dia */}
                  <section className="retail-panel">
                    <div
                      className="retail-row retail-spread"
                      style={{ marginBottom: 12 }}
                    >
                      <div>
                        <h2 style={{ margin: 0 }}>
                          Recorde de Vendas por Vendedor
                        </h2>
                        <p className="retail-muted" style={{ margin: 0 }}>
                          Qual dia cada vendedor mais vendeu no período
                        </p>
                      </div>
                      <CalendarIcon size={18} />
                    </div>

                    <div className="retail-stack" style={{ gap: 10 }}>
                      {rankedSellers.map((s: any) => (
                        <div
                          key={s.operatorId}
                          className="retail-intel-bestday-row"
                        >
                          <div className="retail-row" style={{ gap: 10 }}>
                            <SellerAvatar
                              name={s.name}
                              imageUrl={s.imageUrl}
                              size={36}
                            />
                            <div>
                              <strong>{s.name}</strong>
                              <small
                                className="retail-muted"
                                style={{ display: "block" }}
                              >
                                {s.bestDay
                                  ? `Melhor dia: ${formatBrDate(s.bestDay.date)} (${s.bestDay.salesCount} vendas · ${s.bestDay.piecesCount} pçs)`
                                  : "Sem vendas registradas no período"}
                              </small>
                            </div>
                          </div>
                          <div className="text-right">
                            <strong className="retail-number">
                              {s.bestDay ? money(s.bestDay.revenue) : money(0)}
                            </strong>
                            {s.bestDay && (
                              <button
                                type="button"
                                className="retail-intel-link-btn"
                                onClick={() =>
                                  openSellerInCalendar(
                                    s.operatorId,
                                    s.bestDay.date,
                                  )
                                }
                              >
                                Ver no calendário →
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </aside>
              </div>
            )}

            {/* =================================================================
                ABA 2: CALENDÁRIO COMERCIAL DE VENDAS & CAMPEÃO DO DIA
               ================================================================= */}
            {activeSubTab === "calendario" && (
              <div className="retail-stack" style={{ gap: 18 }}>
                {/* Filtro de Vendedor no Topo do Calendário */}
                <section className="retail-panel">
                  <div
                    className="retail-row retail-spread"
                    style={{ flexWrap: "wrap", gap: 12 }}
                  >
                    <div>
                      <h2 style={{ margin: 0 }}>
                        Calendário de Vendas &amp; Campeões por Dia
                      </h2>
                      <p className="retail-muted" style={{ margin: 0 }}>
                        Toque em um dia do calendário para inspecionar quais
                        vendas foram feitas, quais peças saíram e quem liderou o
                        dia.
                      </p>
                    </div>

                    <div className="retail-row" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className="retail-button"
                        onClick={() => handleNavigateMonth(-1)}
                        aria-label="Mês anterior"
                      >
                        <ChevronLeft size={16} />
                        Mês anterior
                      </button>
                      <strong
                        style={{
                          textTransform: "capitalize",
                          padding: "0 8px",
                        }}
                      >
                        {formatMonthTitle(currentYearMonth)}
                      </strong>
                      <button
                        type="button"
                        className="retail-button"
                        onClick={() => handleNavigateMonth(1)}
                        aria-label="Próximo mês"
                      >
                        Próximo mês
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Pílulas de Filtro por Vendedor */}
                  <div
                    className="retail-row"
                    style={{
                      marginTop: 14,
                      gap: 8,
                      overflowX: "auto",
                      paddingBottom: 4,
                    }}
                  >
                    <Filter size={15} className="retail-muted" />
                    <button
                      type="button"
                      className={`retail-pill ${calendarSellerFilter === "ALL" ? "is-active" : ""}`}
                      onClick={() => setCalendarSellerFilter("ALL")}
                    >
                      Toda a Equipe ({data.summary.totalSales} vendas)
                    </button>
                    {(data.sellers || []).map((s: any) => (
                      <button
                        type="button"
                        key={s.operatorId}
                        className={`retail-pill ${calendarSellerFilter === s.operatorId ? "is-active" : ""}`}
                        onClick={() => setCalendarSellerFilter(s.operatorId)}
                      >
                        {s.name} ({s.salesCount})
                      </button>
                    ))}
                  </div>
                </section>

                <div className="retail-intel-calendar-split">
                  {/* GRADE DE DIAS DO CALENDÁRIO */}
                  <section className="retail-panel">
                    <div className="retail-intel-calendar-weekdays">
                      {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                        (wk) => (
                          <span key={wk}>{wk}</span>
                        ),
                      )}
                    </div>

                    <div className="retail-intel-calendar-grid">
                      {/* Espaçamento inicial do primeiro dia do período para alinhar dia da semana */}
                      {calendarDaysView.length > 0 &&
                        Array.from({
                          length: calendarDaysView[0].weekday || 0,
                        }).map((_, idx) => (
                          <div
                            key={`pad-${idx}`}
                            className="retail-intel-day-cell is-pad"
                            aria-hidden="true"
                          />
                        ))}

                      {calendarDaysView.map((day: any) => {
                        const isSelected = day.date === selectedDayData?.date;
                        const isRecord =
                          day.hasSales && day.date === recordDayDate;
                        const dayNum = day.date.slice(8, 10);
                        const heatPct = day.hasSales
                          ? Math.max(
                              12,
                              Math.round((day.revenue / maxDailyRevenue) * 100),
                            )
                          : 0;

                        return (
                          <button
                            type="button"
                            key={day.date}
                            className={`retail-intel-day-cell ${day.hasSales ? "has-sales" : "is-empty"} ${isSelected ? "is-selected" : ""} ${isRecord ? "is-record" : ""}`}
                            onClick={() => setSelectedCalendarDate(day.date)}
                          >
                            <div className="retail-intel-day-top">
                              <span className="retail-intel-day-number">
                                {dayNum}
                              </span>
                              {isRecord && (
                                <span className="retail-intel-day-record-tag">
                                  <Crown size={11} /> Recorde
                                </span>
                              )}
                            </div>

                            {day.hasSales ? (
                              <>
                                <strong className="retail-intel-day-rev retail-number">
                                  {money(day.revenue)}
                                </strong>
                                <small className="retail-intel-day-meta">
                                  {day.salesCount}{" "}
                                  {day.salesCount === 1 ? "venda" : "vendas"} ·{" "}
                                  {day.piecesCount} pçs
                                </small>

                                {day.champion &&
                                  calendarSellerFilter === "ALL" && (
                                    <div className="retail-intel-day-champ">
                                      <Trophy size={11} />
                                      <span>
                                        {day.champion.name.split(" ")[0]}
                                      </span>
                                    </div>
                                  )}

                                <div className="retail-intel-day-bar">
                                  <div style={{ width: `${heatPct}%` }} />
                                </div>
                              </>
                            ) : (
                              <span className="retail-intel-day-zero">
                                Sem vendas
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* PAINEL LATERAL DO DIA SELECIONADO: RANKING DO DIA + LISTA DE VENDAS DO DIA */}
                  <aside className="retail-panel retail-intel-day-inspector">
                    {selectedDayData ? (
                      <div className="retail-stack" style={{ gap: 16 }}>
                        <div className="retail-row retail-spread">
                          <div>
                            <span className="retail-intel-pill-badge">
                              <CalendarIcon size={12} />
                              {selectedDayData.weekdayLabel}
                            </span>
                            <h2 style={{ margin: "6px 0 2px" }}>
                              Dia {formatBrDate(selectedDayData.date)}
                            </h2>
                            <p className="retail-muted" style={{ margin: 0 }}>
                              {selectedDayData.salesCount}{" "}
                              {selectedDayData.salesCount === 1
                                ? "venda realizada"
                                : "vendas realizadas"}{" "}
                              · {selectedDayData.piecesCount} peças · PA{" "}
                              {Number(selectedDayData.pa || 0).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="retail-muted">Total do Dia</span>
                            <strong
                              className="retail-summary-value retail-number"
                              style={{ display: "block", fontSize: "1.35rem" }}
                            >
                              {money(selectedDayData.revenue)}
                            </strong>
                            {selectedDayData.returnsTotal > 0 && (
                              <small className="retail-muted">
                                Líquido {money(selectedDayData.netRevenue)} (
                                {money(selectedDayData.returnsTotal)} em trocas)
                              </small>
                            )}
                          </div>
                        </div>

                        {/* Ranking dos Vendedores naquele Dia */}
                        {selectedDayData.sellerBreakdown?.length > 0 && (
                          <div className="retail-intel-day-sellers-box">
                            <strong
                              style={{
                                display: "block",
                                fontSize: "0.82rem",
                                marginBottom: 8,
                              }}
                            >
                              Quem vendeu mais neste dia:
                            </strong>
                            <div className="retail-stack" style={{ gap: 8 }}>
                              {selectedDayData.sellerBreakdown.map(
                                (ds: any, idx: number) => (
                                  <div
                                    key={ds.operatorId}
                                    className="retail-row retail-spread retail-intel-day-seller-item"
                                  >
                                    <div
                                      className="retail-row"
                                      style={{ gap: 8 }}
                                    >
                                      <span className="retail-intel-lb-badge is-small">
                                        {idx + 1}º
                                      </span>
                                      <SellerAvatar
                                        name={ds.name}
                                        imageUrl={ds.imageUrl}
                                        size={30}
                                      />
                                      <div>
                                        <strong>{ds.name}</strong>
                                        <small
                                          className="retail-muted"
                                          style={{ display: "block" }}
                                        >
                                          {ds.salesCount} vendas ·{" "}
                                          {ds.piecesCount} peças · PA{" "}
                                          {Number(ds.pa || 0).toFixed(2)}
                                        </small>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <strong className="retail-number">
                                        {money(ds.revenue)}
                                      </strong>
                                      <small
                                        className="retail-muted"
                                        style={{ display: "block" }}
                                      >
                                        {ds.shareOfDayPct}% do dia
                                      </small>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                        {/* Lista de Todas as Vendas Feitas naquele Dia */}
                        <div>
                          <strong
                            style={{
                              display: "block",
                              fontSize: "0.85rem",
                              marginBottom: 10,
                            }}
                          >
                            Vendas realizadas em{" "}
                            {formatBrDate(selectedDayData.date)} (
                            {selectedDayData.sales?.length || 0}):
                          </strong>

                          {selectedDayData.sales?.length > 0 ? (
                            <div
                              className="retail-stack"
                              style={{
                                gap: 10,
                                maxHeight: 480,
                                overflowY: "auto",
                                paddingRight: 4,
                              }}
                            >
                              {selectedDayData.sales.map((sale: any) => (
                                <article
                                  key={sale.id}
                                  className="retail-intel-sale-card"
                                >
                                  <div className="retail-row retail-spread">
                                    <div
                                      className="retail-row"
                                      style={{ gap: 8 }}
                                    >
                                      <span className="retail-intel-sale-code">
                                        Venda #{sale.code || "—"}
                                      </span>
                                      <span className="retail-muted">
                                        <Clock
                                          size={12}
                                          style={{
                                            display: "inline",
                                            marginRight: 3,
                                          }}
                                        />
                                        {sale.time}
                                      </span>
                                    </div>
                                    <strong className="retail-number">
                                      {money(sale.total)}
                                    </strong>
                                  </div>

                                  <div
                                    className="retail-row retail-spread"
                                    style={{ marginTop: 6, fontSize: "0.82rem" }}
                                  >
                                    <span>
                                      Vendedor:{" "}
                                      <strong>{sale.operatorName}</strong>
                                    </span>
                                    <span className="retail-muted">
                                      {sale.customerName
                                        ? `Cliente: ${sale.customerName}`
                                        : "Consumidor Balcão"}
                                    </span>
                                  </div>

                                  {/* Peças da Venda */}
                                  <div className="retail-intel-sale-items">
                                    {(sale.items || []).map(
                                      (it: any, iIdx: number) => (
                                        <div
                                          key={it.id || iIdx}
                                          className="retail-row retail-spread"
                                        >
                                          <span>
                                            {it.quantity}x {it.productName}
                                          </span>
                                          <span className="retail-number">
                                            {money(it.subtotal)}
                                          </span>
                                        </div>
                                      ),
                                    )}
                                  </div>

                                  <div
                                    className="retail-row retail-spread"
                                    style={{ marginTop: 6, flexWrap: "wrap" }}
                                  >
                                    <small className="retail-muted">
                                      {(sale.paymentMethods || []).join(" + ")}
                                    </small>
                                    <div
                                      className="retail-row"
                                      style={{ gap: 6 }}
                                    >
                                      {sale.discount > 0 && (
                                        <span className="retail-intel-tag">
                                          Desconto {money(sale.discount)} (
                                          {sale.discountPct}%)
                                        </span>
                                      )}
                                      {sale.hasReturn && (
                                        <span className="retail-intel-tag is-emphasis">
                                          Troca registrada (
                                          {money(sale.returnedAmount)})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <p className="retail-empty">
                              Nenhuma venda registrada neste dia para o filtro
                              selecionado.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="retail-empty">
                        Selecione um dia no calendário para ver as vendas.
                      </p>
                    )}
                  </aside>
                </div>
              </div>
            )}

            {/* =================================================================
                ABA 3: AUDITORIA DE DESCONTOS, TAXA DE TROCAS & METAS/COMISSÕES
               ================================================================= */}
            {activeSubTab === "metas" && (
              <div className="retail-stack" style={{ gap: 20 }}>
                {/* Tabela Analítica: Descontos, Trocas, Margem e Recordes por Vendedor */}
                <section className="retail-panel">
                  <div
                    className="retail-row retail-spread"
                    style={{ marginBottom: 14 }}
                  >
                    <div>
                      <h2 style={{ margin: 0 }}>
                        Auditoria de Descontos, Trocas, Margem &amp; Fidelização
                        por Vendedor
                      </h2>
                      <p className="retail-muted" style={{ margin: 0 }}>
                        A taxa de trocas é atribuída ao vendedor que realizou a{" "}
                        <strong>venda original</strong>, revelando qualidade de
                        atendimento e acerto de grade.
                      </p>
                    </div>
                  </div>

                  <div className="retail-table-wrap">
                    <table
                      className="retail-table"
                      aria-label="Auditoria comercial por vendedor"
                    >
                      <thead>
                        <tr>
                          <th>Vendedor</th>
                          <th>Vendas Brutas</th>
                          <th>Índice de Desconto</th>
                          <th>Taxa de Trocas (Origem)</th>
                          <th>Venda Líquida Real</th>
                          <th>PA / Venda Casada</th>
                          <th>Cliente Identificado</th>
                          <th>Meta &amp; Comissão</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankedSellers.map((s: any, index: number) => (
                          <tr key={s.operatorId}>
                            <td data-label="Vendedor">
                              <div className="retail-row" style={{ gap: 10 }}>
                                <span className="retail-intel-lb-badge is-small">
                                  {index + 1}º
                                </span>
                                <SellerAvatar
                                  name={s.name}
                                  imageUrl={s.imageUrl}
                                  size={34}
                                />
                                <div>
                                  <strong>{s.name}</strong>
                                  <small
                                    className="retail-muted"
                                    style={{ display: "block" }}
                                  >
                                    {s.jobTitle}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td
                              data-label="Vendas Brutas"
                              className="retail-number"
                            >
                              <strong>{money(s.grossRevenue)}</strong>
                              <small
                                className="retail-muted"
                                style={{ display: "block" }}
                              >
                                {s.salesCount} vendas · {s.piecesCount} peças
                              </small>
                            </td>
                            <td
                              data-label="Índice de Desconto"
                              className="retail-number"
                            >
                              <strong>
                                {Number(s.discountRatePct || 0).toFixed(1)}% (
                                {money(s.discountTotal)})
                              </strong>
                              <small
                                className="retail-muted"
                                style={{ display: "block" }}
                              >
                                Em {s.discountedSalesCount} vendas (
                                {s.discountedSalesRatePct}%)
                              </small>
                            </td>
                            <td
                              data-label="Taxa de Trocas (Origem)"
                              className="retail-number"
                            >
                              <strong>
                                {Number(s.returnRatePct || 0).toFixed(1)}% (
                                {money(s.returnsAmount)})
                              </strong>
                              <small
                                className="retail-muted"
                                style={{ display: "block" }}
                              >
                                {s.returnsCount} trocas · {s.returnedPieces} pçs
                                devolvidas
                              </small>
                            </td>
                            <td
                              data-label="Venda Líquida Real"
                              className="retail-number"
                            >
                              <strong>{money(s.netRevenue)}</strong>
                              <small
                                className="retail-muted"
                                style={{ display: "block" }}
                              >
                                Margem est. {money(s.estimatedMargin)} (
                                {s.marginRatePct}%)
                              </small>
                            </td>
                            <td
                              data-label="PA / Venda Casada"
                              className="retail-number"
                            >
                              <strong>
                                {Number(s.pa || 0).toFixed(2)} pçs/venda
                              </strong>
                              <small
                                className="retail-muted"
                                style={{ display: "block" }}
                              >
                                {s.multiItemRatePct}% vendas c/ 2+ peças
                              </small>
                            </td>
                            <td
                              data-label="Cliente Identificado"
                              className="retail-number"
                            >
                              <strong>{s.identifiedRatePct}%</strong>
                              <small
                                className="retail-muted"
                                style={{ display: "block" }}
                              >
                                {s.identifiedSalesCount} vendas ({s.uniqueCustomersCount}{" "}
                                clientes)
                              </small>
                            </td>
                            <td
                              data-label="Meta & Comissão"
                              className="retail-number"
                            >
                              <strong>
                                {s.goalProgressPct}% da meta ({money(s.goal)})
                              </strong>
                              <small
                                className="retail-muted"
                                style={{ display: "block" }}
                              >
                                Comissão ({s.commissionPct}%):{" "}
                                {money(s.estimatedCommission)}
                              </small>
                            </td>
                            <td data-label="Ações">
                              <button
                                type="button"
                                className="retail-button"
                                onClick={() =>
                                  setSelectedSellerId(s.operatorId)
                                }
                              >
                                <Eye size={15} />
                                Raio-X
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Configurador de Metas, Comissões e Limites de Alerta */}
                <form className="retail-panel" onSubmit={handleSaveGoals}>
                  <div
                    className="retail-row retail-spread"
                    style={{ marginBottom: 16, flexWrap: "wrap", gap: 12 }}
                  >
                    <div>
                      <h2 style={{ margin: 0 }}>
                        Configuração de Metas, Comissões &amp; Tetos de Auditoria
                      </h2>
                      <p className="retail-muted" style={{ margin: 0 }}>
                        Defina a meta global da loja, comissão padrão da equipe
                        e metas individuais por vendedor.
                      </p>
                    </div>
                    <button
                      type="submit"
                      className="retail-button retail-button-primary"
                      disabled={savingGoals}
                    >
                      <Save size={16} />
                      {savingGoals
                        ? "Salvando parâmetros…"
                        : "Salvar metas e comissões"}
                    </button>
                  </div>

                  <div
                    className="retail-summary-grid"
                    style={{
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 14,
                    }}
                  >
                    <label className="retail-field">
                      <span>Meta Mensal da Loja (R$)</span>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={goalsForm.storeMonthlyGoal}
                        onChange={(e) =>
                          setGoalsForm((prev) => ({
                            ...prev,
                            storeMonthlyGoal: e.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="retail-field">
                      <span>Meta Padrão por Vendedor (R$)</span>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={goalsForm.defaultSellerGoal}
                        onChange={(e) =>
                          setGoalsForm((prev) => ({
                            ...prev,
                            defaultSellerGoal: e.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="retail-field">
                      <span>Comissão Padrão (%)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={goalsForm.defaultCommissionPct}
                        onChange={(e) =>
                          setGoalsForm((prev) => ({
                            ...prev,
                            defaultCommissionPct: e.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="retail-field">
                      <span>Base de Cálculo da Comissão</span>
                      <select
                        value={goalsForm.commissionBasis}
                        onChange={(e) =>
                          setGoalsForm((prev) => ({
                            ...prev,
                            commissionBasis:
                              e.target.value === "gross" ? "gross" : "net",
                          }))
                        }
                      >
                        <option value="net">
                          Faturamento Líquido (Vendas − Trocas)
                        </option>
                        <option value="gross">
                          Faturamento Bruto (Total Vendido)
                        </option>
                      </select>
                    </label>

                    <label className="retail-field">
                      <span>Teto Saudável de Desconto (%)</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={goalsForm.maxHealthyDiscountPct}
                        onChange={(e) =>
                          setGoalsForm((prev) => ({
                            ...prev,
                            maxHealthyDiscountPct: e.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="retail-field">
                      <span>Teto Saudável de Trocas (%)</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={goalsForm.maxHealthyReturnPct}
                        onChange={(e) =>
                          setGoalsForm((prev) => ({
                            ...prev,
                            maxHealthyReturnPct: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  {/* Metas Individuais por Vendedor */}
                  <div style={{ marginTop: 20 }}>
                    <h3 style={{ marginBottom: 10, fontSize: "0.95rem" }}>
                      Metas e Comissões Individuais por Vendedor
                    </h3>
                    <div
                      className="retail-summary-grid"
                      style={{
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(260px, 1fr))",
                        gap: 12,
                      }}
                    >
                      {(data.sellers || []).map((s: any) => {
                        const ov = goalsForm.sellerOverrides[s.operatorId] || {
                          goal: goalsForm.defaultSellerGoal,
                          commissionPct: goalsForm.defaultCommissionPct,
                        };
                        return (
                          <div
                            key={s.operatorId}
                            className="retail-intel-goal-seller-card"
                          >
                            <div
                              className="retail-row"
                              style={{ gap: 10, marginBottom: 10 }}
                            >
                              <SellerAvatar
                                name={s.name}
                                imageUrl={s.imageUrl}
                                size={36}
                              />
                              <div>
                                <strong>{s.name}</strong>
                                <small
                                  className="retail-muted"
                                  style={{ display: "block" }}
                                >
                                  Atual: {money(s.netRevenue)} líquidos (
                                  {s.goalProgressPct}%)
                                </small>
                              </div>
                            </div>
                            <div className="retail-row" style={{ gap: 10 }}>
                              <label
                                className="retail-field"
                                style={{ flex: 1 }}
                              >
                                <span>Meta (R$)</span>
                                <input
                                  type="number"
                                  step="100"
                                  min="0"
                                  value={ov.goal}
                                  onChange={(e) =>
                                    setGoalsForm((prev) => ({
                                      ...prev,
                                      sellerOverrides: {
                                        ...prev.sellerOverrides,
                                        [s.operatorId]: {
                                          ...ov,
                                          goal: e.target.value,
                                        },
                                      },
                                    }))
                                  }
                                />
                              </label>
                              <label
                                className="retail-field"
                                style={{ width: 110 }}
                              >
                                <span>Comissão (%)</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  value={ov.commissionPct}
                                  onChange={(e) =>
                                    setGoalsForm((prev) => ({
                                      ...prev,
                                      sellerOverrides: {
                                        ...prev.sellerOverrides,
                                        [s.operatorId]: {
                                          ...ov,
                                          commissionPct: e.target.value,
                                        },
                                      },
                                    }))
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        )
      )}

      {/* =================================================================
          MODAL DE RAIO-X 360º DO VENDEDOR
         ================================================================= */}
      {selectedSeller && (
        <RetailDialog
          title={`Raio-X 360º do Vendedor · ${selectedSeller.name} (${selectedSeller.jobTitle})`}
          onClose={() => setSelectedSellerId(null)}
          wide
        >
          <div className="retail-stack" style={{ gap: 18 }}>
            {/* Cabeçalho do Perfil do Vendedor */}
            <div className="retail-intel-modal-hero">
              <div className="retail-row" style={{ gap: 14 }}>
                <SellerAvatar
                  name={selectedSeller.name}
                  imageUrl={selectedSeller.imageUrl}
                  size={68}
                  rank={1}
                />
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.2rem" }}>
                    {selectedSeller.name}
                  </h3>
                  <p className="retail-muted" style={{ margin: "2px 0 6px" }}>
                    {selectedSeller.jobTitle} ·{" "}
                    {selectedSeller.dailyWinsCount}{" "}
                    {selectedSeller.dailyWinsCount === 1
                      ? "dia como Campeão de Vendas (#1)"
                      : "dias como Campeão de Vendas (#1)"}
                  </p>
                  <div className="retail-row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span className="retail-intel-tag">
                      Participação: {selectedSeller.sharePct}% da loja
                    </span>
                    <span className="retail-intel-tag">
                      Comissão est. ({selectedSeller.commissionPct}%):{" "}
                      {money(selectedSeller.estimatedCommission)}
                    </span>
                    {selectedSeller.bestDay && (
                      <button
                        type="button"
                        className="retail-intel-tag is-emphasis"
                        style={{ cursor: "pointer" }}
                        onClick={() =>
                          openSellerInCalendar(
                            selectedSeller.operatorId,
                            selectedSeller.bestDay.date,
                          )
                        }
                      >
                        Recorde: {formatBrDate(selectedSeller.bestDay.date)} (
                        {money(selectedSeller.bestDay.revenue)}) · Ver no
                        Calendário →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Grade de Indicadores do Vendedor */}
            <div className="retail-kpis">
              <article className="retail-kpi">
                <span className="retail-muted">Venda Líquida Real</span>
                <strong className="retail-number">
                  {money(selectedSeller.netRevenue)}
                </strong>
                <small className="retail-muted">
                  Bruto {money(selectedSeller.grossRevenue)} · Meta{" "}
                  {selectedSeller.goalProgressPct}%
                </small>
              </article>

              <article className="retail-kpi">
                <span className="retail-muted">PA &amp; Ticket Médio</span>
                <strong className="retail-number">
                  {Number(selectedSeller.pa || 0).toFixed(2)} pçs/venda
                </strong>
                <small className="retail-muted">
                  Ticket {money(selectedSeller.avgTicket)} ·{" "}
                  {selectedSeller.multiItemRatePct}% vendas casadas (2+ pçs)
                </small>
              </article>

              <article className="retail-kpi">
                <span className="retail-muted">Índice de Desconto</span>
                <strong className="retail-number">
                  {Number(selectedSeller.discountRatePct || 0).toFixed(1)}% (
                  {money(selectedSeller.discountTotal)})
                </strong>
                <small className="retail-muted">
                  {selectedSeller.discountedSalesCount} de{" "}
                  {selectedSeller.salesCount} vendas tiveram desconto
                </small>
              </article>

              <article className="retail-kpi">
                <span className="retail-muted">Taxa de Trocas (Origem)</span>
                <strong className="retail-number">
                  {Number(selectedSeller.returnRatePct || 0).toFixed(1)}% (
                  {money(selectedSeller.returnsAmount)})
                </strong>
                <small className="retail-muted">
                  {selectedSeller.returnsCount} trocas ·{" "}
                  {selectedSeller.returnedPieces} peças trocadas
                </small>
              </article>
            </div>

            {/* Ritmo de Trabalho: Melhor Dia da Semana, Horário de Ouro e Top Mercadorias */}
            <div
              className="retail-summary-grid"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 14,
              }}
            >
              <div className="retail-panel">
                <h4 style={{ margin: "0 0 8px" }}>
                  <TrendingUp
                    size={15}
                    style={{ display: "inline", marginRight: 6 }}
                  />
                  Padrão de Conversão &amp; Fidelização
                </h4>
                <div className="retail-stack" style={{ gap: 6 }}>
                  <div className="retail-row retail-spread">
                    <span className="retail-muted">Dia recorde no período</span>
                    <strong>
                      {selectedSeller.bestDay
                        ? `${formatBrDate(selectedSeller.bestDay.date)} (${money(selectedSeller.bestDay.revenue)})`
                        : "—"}
                    </strong>
                  </div>
                  <div className="retail-row retail-spread">
                    <span className="retail-muted">
                      Dia da semana mais forte
                    </span>
                    <strong>
                      {selectedSeller.bestWeekday
                        ? `${selectedSeller.bestWeekday.label} (${money(selectedSeller.bestWeekday.revenue)})`
                        : "—"}
                    </strong>
                  </div>
                  <div className="retail-row retail-spread">
                    <span className="retail-muted">Horário de ouro</span>
                    <strong>
                      {selectedSeller.peakHour
                        ? `${selectedSeller.peakHour.label} (${money(selectedSeller.peakHour.revenue)})`
                        : "—"}
                    </strong>
                  </div>
                  <div className="retail-row retail-spread">
                    <span className="retail-muted">
                      Clientes identificados no PDV
                    </span>
                    <strong>
                      {selectedSeller.identifiedRatePct}% (
                      {selectedSeller.uniqueCustomersCount} clientes)
                    </strong>
                  </div>
                </div>
              </div>

              <div className="retail-panel">
                <h4 style={{ margin: "0 0 8px" }}>
                  <ShoppingBag
                    size={15}
                    style={{ display: "inline", marginRight: 6 }}
                  />
                  Mercadorias Mais Vendidas por {selectedSeller.name.split(" ")[0]}
                </h4>
                {selectedSeller.topGroups?.length > 0 ? (
                  <div className="retail-stack" style={{ gap: 6 }}>
                    {selectedSeller.topGroups.slice(0, 4).map((g: any) => (
                      <div key={g.id} className="retail-row retail-spread">
                        <span>{g.name}</span>
                        <strong className="retail-number">
                          {g.quantity} pçs ({money(g.revenue)})
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="retail-muted">Nenhuma mercadoria vendida.</p>
                )}
              </div>
            </div>

            {/* Motivos de Troca (se houver) */}
            {selectedSeller.recentReturns?.length > 0 && (
              <div className="retail-panel">
                <h4 style={{ margin: "0 0 8px" }}>
                  <RotateCcw
                    size={15}
                    style={{ display: "inline", marginRight: 6 }}
                  />
                  Trocas Originadas das Vendas deste Vendedor (
                  {selectedSeller.recentReturns.length})
                </h4>
                <div className="retail-stack" style={{ gap: 8 }}>
                  {selectedSeller.recentReturns.map((ret: any) => (
                    <div
                      key={ret.id}
                      className="retail-row retail-spread retail-intel-sale-card"
                    >
                      <div>
                        <strong>
                          Venda #{ret.saleCode || "—"} · {ret.customerName}
                        </strong>
                        <small
                          className="retail-muted"
                          style={{ display: "block" }}
                        >
                          {formatBrDate(ret.date)} às {ret.time} · Motivo:{" "}
                          {ret.reason}
                        </small>
                      </div>
                      <strong className="retail-number">
                        {money(ret.total)} ({ret.piecesCount} pçs)
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="retail-row retail-spread">
              <button
                type="button"
                className="retail-button"
                onClick={() =>
                  openSellerInCalendar(
                    selectedSeller.operatorId,
                    selectedSeller.bestDay?.date,
                  )
                }
              >
                <CalendarIcon size={16} />
                Filtrar Calendário para {selectedSeller.name}
              </button>
              <button
                type="button"
                className="retail-button retail-button-primary"
                onClick={() => setSelectedSellerId(null)}
              >
                Fechar Raio-X
              </button>
            </div>
          </div>
        </RetailDialog>
      )}
    </>
  );
}
