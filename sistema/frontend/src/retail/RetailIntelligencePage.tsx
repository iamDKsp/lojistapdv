import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Eye,
  Filter,
  Percent,
  RefreshCw,
  RotateCcw,
  Save,
  ShoppingBag,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getFullUrl } from "@/lib/getFullUrl";
import { ROUTES } from "@/lib/routes";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";
import {
  StoreKpiCard,
  StorePeriodFilterBar,
  getSaoPauloPresetRange,
  type StorePeriodPreset,
} from "@/components/analytics/StoreAnalyticsUI";
import { RetailDialog } from "./RetailDialog";
import { apiError, money } from "./types";
import {
  OperatorAvatarThumb,
  OperatorInlineBadge,
  StockItemThumb,
  useResolvedOperatorPhoto,
} from "@/components/EntityPhotos";

type RankingCriterionId =
  | "netRevenue"
  | "grossRevenue"
  | "pa"
  | "piecesCount"
  | "avgTicket"
  | "dailyWinsCount"
  | "identifiedRatePct";

interface RankingCriterionOption {
  id: RankingCriterionId;
  segmentLabel: string;
  shortLabel: string;
  description: string;
}

const RANKING_CRITERIA: RankingCriterionOption[] = [
  {
    id: "netRevenue",
    segmentLabel: "Líquido",
    shortLabel: "Líquido",
    description:
      "Ordenado por faturamento líquido (vendas concluídas descontando trocas da venda original).",
  },
  {
    id: "grossRevenue",
    segmentLabel: "Bruto",
    shortLabel: "Bruto",
    description: "Ordenado pelo volume financeiro bruto vendido antes de trocas.",
  },
  {
    id: "pa",
    segmentLabel: "PA",
    shortLabel: "PA",
    description:
      "Ordenado pela média de peças por atendimento (eficiência de venda casada).",
  },
  {
    id: "piecesCount",
    segmentLabel: "Peças",
    shortLabel: "Peças",
    description: "Ordenado pela quantidade total de peças vendidas no período.",
  },
  {
    id: "avgTicket",
    segmentLabel: "Ticket Médio",
    shortLabel: "Ticket",
    description: "Ordenado pelo valor médio por venda concluída.",
  },
  {
    id: "dailyWinsCount",
    segmentLabel: "Vitórias",
    shortLabel: "Vitórias",
    description:
      "Ordenado pela quantidade de dias em que o consultor liderou o dia (#1).",
  },
  {
    id: "identifiedRatePct",
    segmentLabel: "Fidelização",
    shortLabel: "Fidelização",
    description:
      "Ordenado pelo percentual de atendimentos com cliente identificado no PDV.",
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

function formatDec(value: number | null | undefined, digits = 1): string {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
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
  const dt = new Date(
    Date.UTC(Number(yStr), Number(mStr) - 1 + deltaMonths, 1),
  );
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

function SellerAvatar({
  name,
  imageUrl,
  operatorId,
  size = 40,
  rank,
}: {
  name: string;
  imageUrl?: string | null;
  operatorId?: string | null;
  size?: number;
  rank?: number;
}) {
  const resolvedPhoto = useResolvedOperatorPhoto({
    operatorId,
    name,
    imageUrl,
  });
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedPhoto]);

  const initials = useMemo(() => {
    const clean = (name || "VD").trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }, [name]);

  const isTop1 = rank === 1;
  const isPodium = rank === 2 || rank === 3;

  return (
    <span
      className={`retail-intel-avatar ${isTop1 ? "is-rank-1" : isPodium ? "is-rank-podium" : ""}`}
      style={{ width: size, height: size }}
    >
      {resolvedPhoto && !imgFailed ? (
        <img
          src={getFullUrl(resolvedPhoto)}
          alt={name}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="retail-intel-avatar-fallback">{initials}</span>
      )}
    </span>
  );
}

function InsightKindIcon({ kind }: { kind?: string }) {
  switch (kind) {
    case "leader":
      return <Trophy size={14} />;
    case "pa":
      return <ShoppingBag size={14} />;
    case "discount":
      return <Percent size={14} />;
    case "return":
      return <RotateCcw size={14} />;
    case "calendar":
      return <CalendarIcon size={14} />;
    default:
      return <Users size={14} />;
  }
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

  const initialRange = useMemo(() => getSaoPauloPresetRange("month"), []);
  const [preset, setPreset] = useState<StorePeriodPreset>("month");
  const [start, setStart] = useState(initialRange.startDate);
  const [end, setEnd] = useState(initialRange.endDate);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Estado do Ranking
  const [criterion, setCriterion] = useState<RankingCriterionId>("netRevenue");
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

  const handleSelectPreset = (nextPreset: StorePeriodPreset) => {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      const range = getSaoPauloPresetRange(nextPreset);
      setStart(range.startDate);
      setEnd(range.endDate);
    }
  };

  const handleChangeRange = (nextStart: string, nextEnd: string) => {
    setPreset("custom");
    setStart(nextStart);
    setEnd(nextEnd);
  };

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
              if (s.isUnassigned || s.operatorId === "sem-vendedor") continue;
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

  // Vendedores reais ordenados pelo critério selecionado (separando atendimentos sem vendedor)
  const { teamRankedSellers, unassignedSeller, allOrderedSellers } =
    useMemo(() => {
      const raw: any[] = data?.sellers || [];
      const real = raw
        .filter((s) => !s.isUnassigned && s.operatorId !== "sem-vendedor")
        .sort((a, b) => {
          const valA = Number(a[criterion] || 0);
          const valB = Number(b[criterion] || 0);
          if (valB !== valA) return valB - valA;
          return (
            Number(b.netRevenue || 0) - Number(a.netRevenue || 0) ||
            Number(b.grossRevenue || 0) - Number(a.grossRevenue || 0)
          );
        });
      const unassigned =
        raw.find((s) => s.isUnassigned || s.operatorId === "sem-vendedor") ||
        null;
      return {
        teamRankedSellers: real,
        unassignedSeller: unassigned,
        allOrderedSellers: unassigned ? [...real, unassigned] : real,
      };
    }, [data?.sellers, criterion]);

  const maxTeamMetric = useMemo(() => {
    if (!teamRankedSellers.length) return 1;
    return Math.max(
      1,
      ...teamRankedSellers.map((s) => Math.max(0, Number(s[criterion] || 0))),
    );
  }, [teamRankedSellers, criterion]);

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
          return `${formatDec(seller.pa, 2)} PA`;
        case "avgTicket":
          return money(seller.avgTicket);
        case "identifiedRatePct":
          return `${formatDec(seller.identifiedRatePct, 1)}% fiel`;
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
    const monthPreset = getSaoPauloPresetRange("month");
    if (bounds.start === monthPreset.startDate && nextYm === todaySaoPaulo().slice(0, 7)) {
      setPreset("month");
      setStart(monthPreset.startDate);
      setEnd(monthPreset.endDate);
    } else {
      setPreset("custom");
      setStart(bounds.start);
      setEnd(bounds.end);
    }
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

  const maxHealthyDiscount = data?.goalsConfig?.maxHealthyDiscountPct ?? 8;
  const maxHealthyReturn = data?.goalsConfig?.maxHealthyReturnPct ?? 10;
  const storeAlertsTriggered = Boolean(
    data &&
      (Number(data.summary?.discountRatePct || 0) > maxHealthyDiscount ||
        Number(data.summary?.returnRatePct || 0) > maxHealthyReturn),
  );

  const storeRealizedForGoal = useMemo(() => {
    if (!data?.summary) return 0;
    return data.goalsConfig?.commissionBasis === "gross"
      ? Number(data.summary.grossRevenue || 0)
      : Math.max(0, Number(data.summary.netRevenue || 0));
  }, [data]);

  const remainingStoreGoal = useMemo(() => {
    if (!data?.summary) return 0;
    return Math.max(0, Number(data.summary.storeGoal || 0) - storeRealizedForGoal);
  }, [data, storeRealizedForGoal]);

  const topTeamLeader = useMemo(() => {
    if (!data?.summary?.topSeller) return null;
    const match = teamRankedSellers.find(
      (s) => s.operatorId === data.summary.topSeller.operatorId,
    );
    return match || data.summary.topSeller;
  }, [data?.summary?.topSeller, teamRankedSellers]);

  return (
    <div className="space-y-5 pb-8">
      {/* =====================================================================
          TOPO UNIFICADO: FILTRO DE PERÍODO + ATUALIZAÇÃO
         ===================================================================== */}
      <StorePeriodFilterBar
        preset={preset}
        startDate={start}
        endDate={end}
        presets={[
          { id: "today", label: "Hoje" },
          { id: "yesterday", label: "Ontem" },
          { id: "last7", label: "7 dias" },
          { id: "month", label: "Este mês" },
          { id: "custom", label: "Personalizado" },
        ]}
        alwaysShowDateInputs
        onSelectPreset={handleSelectPreset}
        onChangeRange={handleChangeRange}
        rightSlot={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-line text-ink hover:bg-support hover:border-brand text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={loading ? "animate-spin text-brand" : "text-brand"}
            />
            Atualizar
          </button>
        }
      />

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-brand bg-support p-4 text-xs font-medium text-ink flex items-center justify-between gap-3"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-1.5 rounded-lg bg-brand text-on-brand font-bold cursor-pointer shrink-0"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {loading && !data ? (
        <div
          className="retail-loader-region py-16 flex items-center justify-center"
          role="status"
          aria-busy="true"
        >
          <PdvLojistaLoader
            mode="loader"
            size={80}
            label="Calculando ranking, metas e calendário comercial…"
          />
        </div>
      ) : (
        data && (
          <div className="space-y-5">
            {/* ===============================================================
                4 KPIS EXECUTIVOS NO TOPO (ACIMA DA DOBRA)
               =============================================================== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StoreKpiCard
                emphasis="primary"
                label="Faturamento Líquido da Loja"
                value={money(data.summary.netRevenue)}
                icon={<TrendingUp size={17} />}
                subtitle={
                  <span>
                    Bruto{" "}
                    <strong className="text-ink">
                      {money(data.summary.grossRevenue)}
                    </strong>{" "}
                    · {data.summary.totalSales}{" "}
                    {data.summary.totalSales === 1 ? "venda" : "vendas"} (
                    {data.summary.totalPieces} pçs)
                  </span>
                }
              />

              <StoreKpiCard
                label="Líder do Período (#1)"
                value={
                  topTeamLeader ? (
                    <span className="inline-flex items-center gap-2 min-w-0 max-w-full">
                      <OperatorAvatarThumb
                        name={topTeamLeader.name}
                        imageUrl={topTeamLeader.imageUrl}
                        operatorId={topTeamLeader.operatorId}
                        size="md"
                      />
                      <span className="truncate">{topTeamLeader.name}</span>
                    </span>
                  ) : (
                    "Sem vendas da equipe"
                  )
                }
                icon={<Trophy size={17} />}
                onClick={
                  topTeamLeader
                    ? () => setSelectedSellerId(topTeamLeader.operatorId)
                    : undefined
                }
                badge={
                  topTeamLeader && typeof topTeamLeader.sharePct === "number" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-support text-brand border border-brand tabular-nums">
                      {formatDec(topTeamLeader.sharePct, 1)}% da loja
                    </span>
                  ) : undefined
                }
                subtitle={
                  topTeamLeader ? (
                    <span>
                      <strong className="text-ink">
                        {money(topTeamLeader.netRevenue)}
                      </strong>{" "}
                      líquidos · {topTeamLeader.dailyWinsCount}{" "}
                      {topTeamLeader.dailyWinsCount === 1
                        ? "dia em 1º"
                        : "dias em 1º"}
                    </span>
                  ) : (
                    <span>Vincule o vendedor nas vendas do PDV</span>
                  )
                }
              />

              <StoreKpiCard
                label="PA & Ticket Médio"
                value={`${formatDec(data.summary.pa, 2)} pçs/venda`}
                icon={<ShoppingBag size={17} />}
                subtitle={
                  <span>
                    Ticket{" "}
                    <strong className="text-ink">
                      {money(data.summary.avgTicket)}
                    </strong>{" "}
                    · {formatDec(data.summary.multiItemRatePct, 1)}% c/ 2+ peças
                  </span>
                }
              />

              <StoreKpiCard
                label="Descontos & Taxa de Trocas"
                value={`${formatDec(data.summary.discountRatePct, 1)}% · ${formatDec(data.summary.returnRatePct, 1)}%`}
                icon={<RotateCcw size={17} />}
                badge={
                  storeAlertsTriggered ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-page text-ink border border-ink">
                      <AlertTriangle size={11} />
                      Acima do teto configurado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-page text-muted border border-line">
                      <CheckCircle2 size={11} />
                      Dentro dos parâmetros
                    </span>
                  )
                }
                subtitle={
                  <span>
                    Desc.{" "}
                    <strong className="text-ink">
                      {money(data.summary.totalDiscounts)}
                    </strong>{" "}
                    · Trocas{" "}
                    <strong className="text-ink">
                      {money(data.summary.returnsTotal)}
                    </strong>
                  </span>
                }
              />
            </div>

            {/* ===============================================================
                ABA 1: RANKING EDITORIAL & PAINEL DE META / LEITURA COMERCIAL
               =============================================================== */}
            {activeSubTab === "ranking" && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* COLUNA PRINCIPAL (8 COL): CARDS TOP 3 + TABELA COMPARATIVA */}
                <section
                  aria-label="Ranking Comercial de Vendedores"
                  className="xl:col-span-8 bg-surface border border-line rounded-xl overflow-hidden"
                >
                  {/* Cabeçalho + Seletor Segmentado 1-Clique */}
                  <div className="p-5 border-b border-line space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <h2 className="text-base font-bold text-ink tracking-tight">
                          Ranking de Vendedores
                        </h2>
                        <p className="text-xs text-muted mt-0.5">
                          {activeCriterionObj.description}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-page border border-line text-[11px] font-medium text-muted shrink-0 self-start tabular-nums">
                        <Users size={12} className="text-brand" />
                        {data.summary.activeSellersCount} de{" "}
                        {data.summary.totalSellersCount}{" "}
                        {data.summary.totalSellersCount === 1
                          ? "consultor com venda"
                          : "consultores com venda"}
                      </span>
                    </div>

                    <div
                      role="tablist"
                      aria-label="Critério de classificação do ranking"
                      className="inline-flex flex-wrap items-center bg-page border border-line rounded-lg p-1 gap-1"
                    >
                      {RANKING_CRITERIA.map((opt) => {
                        const isActive = criterion === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => setCriterion(opt.id)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                              isActive
                                ? "bg-brand text-on-brand"
                                : "text-muted hover:text-ink hover:bg-surface"
                            }`}
                          >
                            {opt.segmentLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* DESTAQUES EDITORIAIS TOP 3 (LADO A LADO, SEM ILUSTRAÇÃO GENÉRICA) */}
                  {teamRankedSellers.length > 0 ? (
                    <div className="p-5 bg-page border-b border-line">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {[0, 1, 2].map((slotIdx) => {
                          const seller = teamRankedSellers[slotIdx] || null;
                          const rankNum = slotIdx + 1;
                          const isLeader = rankNum === 1;

                          if (!seller) {
                            return (
                              <div
                                key={`empty-slot-${rankNum}`}
                                className="rounded-xl border border-dashed border-line bg-surface p-4 flex flex-col justify-between gap-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-page border border-line text-[11px] font-semibold text-muted">
                                    {rankNum}º Lugar
                                  </span>
                                  <span className="text-[11px] text-muted">
                                    Vaga aberta
                                  </span>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-ink">
                                    Posição disponível na equipe
                                  </p>
                                  <p className="text-[11px] text-muted mt-1 leading-relaxed">
                                    Cadastre novos consultores para acompanhar
                                    metas, PA e comissões individuais.
                                  </p>
                                </div>
                                <Link
                                  to={ROUTES.equipe}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                                >
                                  Gerenciar equipe <ArrowRight size={12} />
                                </Link>
                              </div>
                            );
                          }

                          const goalPctClamped = Math.min(
                            100,
                            Math.max(0, Number(seller.goalProgressPct || 0)),
                          );

                          return (
                            <button
                              key={seller.operatorId}
                              type="button"
                              onClick={() =>
                                setSelectedSellerId(seller.operatorId)
                              }
                              className={`relative overflow-hidden rounded-xl border p-4 text-left flex flex-col justify-between gap-3.5 transition-colors cursor-pointer bg-surface ${
                                isLeader
                                  ? "border-brand hover:bg-support/40"
                                  : "border-line hover:border-brand"
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`absolute inset-x-0 top-0 h-1 ${
                                  isLeader
                                    ? "bg-brand"
                                    : rankNum === 2
                                      ? "bg-ink"
                                      : "bg-line"
                                }`}
                              />

                              {/* Topo do card: Posição + % da loja */}
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide tabular-nums ${
                                    isLeader
                                      ? "bg-brand text-on-brand"
                                      : rankNum === 2
                                        ? "bg-ink text-on-brand"
                                        : "bg-page text-ink border border-line"
                                  }`}
                                >
                                  {isLeader && <Trophy size={11} />}
                                  {rankNum}º Lugar
                                </span>
                                <span
                                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md tabular-nums ${
                                    isLeader
                                      ? "bg-support text-brand"
                                      : "bg-page text-muted border border-line"
                                  }`}
                                >
                                  {formatDec(seller.sharePct, 1)}% da loja
                                </span>
                              </div>

                              {/* Identificação do vendedor */}
                              <div className="flex items-center gap-3 min-w-0">
                                <SellerAvatar
                                  name={seller.name}
                                  imageUrl={seller.imageUrl}
                                  operatorId={seller.operatorId}
                                  size={44}
                                  rank={rankNum}
                                />
                                <div className="min-w-0">
                                  <strong className="block text-sm font-bold text-ink truncate">
                                    {seller.name}
                                  </strong>
                                  <span className="block text-xs text-muted truncate">
                                    {seller.jobTitle}
                                  </span>
                                </div>
                              </div>

                              {/* Métrica principal do critério */}
                              <div>
                                <div className="text-xl font-bold text-ink tracking-tight tabular-nums">
                                  {formatCriterionMetric(seller)}
                                </div>
                                <div className="text-[11px] text-muted mt-0.5 tabular-nums">
                                  {seller.salesCount}{" "}
                                  {seller.salesCount === 1 ? "venda" : "vendas"}{" "}
                                  · {seller.piecesCount} pçs · PA{" "}
                                  {formatDec(seller.pa, 2)}
                                </div>
                              </div>

                              {/* Progresso da meta individual */}
                              <div className="pt-2.5 border-t border-line w-full space-y-1.5">
                                <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                                  <span className="text-muted">
                                    Meta {money(seller.goal)}
                                  </span>
                                  <strong className="text-ink font-semibold">
                                    {formatDec(seller.goalProgressPct, 1)}%
                                  </strong>
                                </div>
                                <div
                                  className={`h-1.5 w-full rounded-full overflow-hidden ${
                                    isLeader ? "bg-support" : "bg-page"
                                  }`}
                                >
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      isLeader ? "bg-brand" : "bg-ink"
                                    }`}
                                    style={{ width: `${goalPctClamped}%` }}
                                  />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 bg-page border-b border-line text-center">
                      <p className="text-sm font-semibold text-ink">
                        Nenhum vendedor cadastrado na equipe
                      </p>
                      <p className="text-xs text-muted mt-1">
                        Cadastre seus consultores para acompanhar metas,
                        comissões e ranking comercial.
                      </p>
                      <Link
                        to={ROUTES.equipe}
                        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand text-on-brand text-xs font-bold"
                      >
                        Cadastrar vendedores <ArrowRight size={13} />
                      </Link>
                    </div>
                  )}

                  {/* TABELA COMPARATIVA DA EQUIPE */}
                  {teamRankedSellers.length > 0 && (
                    <div className="overflow-x-auto">
                      <table
                        className="w-full text-left border-collapse min-w-[740px]"
                        aria-label="Classificação detalhada de vendedores"
                      >
                        <thead>
                          <tr className="border-b border-line">
                            <th className="py-2.5 pl-5 pr-3">Vendedor</th>
                            <th className="py-2.5 px-3 text-right">
                              Volume &amp; PA
                            </th>
                            <th className="py-2.5 px-3 text-right">
                              Meta &amp; Comissão
                            </th>
                            <th className="py-2.5 px-3 text-right">
                              Descontos
                            </th>
                            <th className="py-2.5 px-3 text-right">Trocas</th>
                            <th className="py-2.5 px-3 text-right">
                              Melhor Dia
                            </th>
                            <th className="py-2.5 pl-3 pr-5 text-right">
                              {activeCriterionObj.shortLabel}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {teamRankedSellers.map((seller: any, idx: number) => {
                            const pos = idx + 1;
                            const metricVal = Math.max(
                              0,
                              Number(seller[criterion] || 0),
                            );
                            const barWidthPct =
                              maxTeamMetric > 0 && metricVal > 0
                                ? Math.max(
                                    4,
                                    Math.round((metricVal / maxTeamMetric) * 100),
                                  )
                                : 0;
                            const isHighDiscount =
                              Number(seller.discountRatePct || 0) >
                              maxHealthyDiscount;
                            const isHighReturn =
                              Number(seller.returnRatePct || 0) >
                              maxHealthyReturn;

                            return (
                              <tr
                                key={seller.operatorId}
                                onClick={() =>
                                  setSelectedSellerId(seller.operatorId)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setSelectedSellerId(seller.operatorId);
                                  }
                                }}
                                tabIndex={0}
                                role="button"
                                className="cursor-pointer transition-colors"
                              >
                                <td className="py-3 pl-5 pr-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span
                                      className={`retail-intel-lb-badge ${
                                        pos === 1
                                          ? "is-pos-1"
                                          : pos <= 3
                                            ? "is-pos-podium"
                                            : ""
                                      }`}
                                    >
                                      {pos}º
                                    </span>
                                    <SellerAvatar
                                      name={seller.name}
                                      imageUrl={seller.imageUrl}
                                      operatorId={seller.operatorId}
                                      size={36}
                                      rank={pos}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <strong className="text-[13px] font-semibold text-ink truncate">
                                          {seller.name}
                                        </strong>
                                        {seller.dailyWinsCount > 0 && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-page border border-line text-[10px] font-semibold text-muted shrink-0 tabular-nums">
                                            {seller.dailyWinsCount}d #1
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-muted truncate">
                                        {seller.jobTitle} ·{" "}
                                        {formatDec(seller.sharePct, 1)}% da loja
                                      </div>
                                      <div className="mt-1.5 h-1 w-full max-w-[180px] rounded-full bg-page overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${
                                            pos === 1 ? "bg-brand" : "bg-muted"
                                          }`}
                                          style={{ width: `${barWidthPct}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3 px-3 text-right tabular-nums">
                                  <strong className="block text-xs font-semibold text-ink">
                                    {seller.salesCount}{" "}
                                    {seller.salesCount === 1
                                      ? "venda"
                                      : "vendas"}{" "}
                                    · PA {formatDec(seller.pa, 2)}
                                  </strong>
                                  <span className="block text-[11px] text-muted">
                                    Ticket {money(seller.avgTicket)} (
                                    {seller.piecesCount} pçs)
                                  </span>
                                </td>

                                <td className="py-3 px-3 text-right tabular-nums">
                                  <strong className="block text-xs font-semibold text-ink">
                                    {formatDec(seller.goalProgressPct, 1)}%
                                  </strong>
                                  <span className="block text-[11px] text-muted">
                                    Comissão {money(seller.estimatedCommission)}
                                  </span>
                                </td>

                                <td className="py-3 px-3 text-right tabular-nums">
                                  <strong className="inline-flex items-center justify-end gap-1 text-xs font-semibold text-ink">
                                    {isHighDiscount && (
                                      <AlertTriangle
                                        size={12}
                                        className="text-ink shrink-0"
                                      />
                                    )}
                                    {formatDec(seller.discountRatePct, 1)}%
                                  </strong>
                                  <span className="block text-[11px] text-muted">
                                    {money(seller.discountTotal)}
                                    {isHighDiscount ? " · Acima do teto" : ""}
                                  </span>
                                </td>

                                <td className="py-3 px-3 text-right tabular-nums">
                                  <strong className="inline-flex items-center justify-end gap-1 text-xs font-semibold text-ink">
                                    {isHighReturn && (
                                      <AlertTriangle
                                        size={12}
                                        className="text-ink shrink-0"
                                      />
                                    )}
                                    {formatDec(seller.returnRatePct, 1)}%
                                  </strong>
                                  <span className="block text-[11px] text-muted">
                                    {seller.returnsCount}{" "}
                                    {seller.returnsCount === 1
                                      ? "troca"
                                      : "trocas"}{" "}
                                    ({money(seller.returnsAmount)})
                                  </span>
                                </td>

                                <td className="py-3 px-3 text-right tabular-nums">
                                  {seller.bestDay ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openSellerInCalendar(
                                          seller.operatorId,
                                          seller.bestDay.date,
                                        );
                                      }}
                                      className="text-right group cursor-pointer"
                                      title="Ver este dia no calendário de vendas"
                                    >
                                      <strong className="block text-xs font-semibold text-ink group-hover:text-brand group-hover:underline">
                                        {formatShortBrDate(seller.bestDay.date)}
                                      </strong>
                                      <span className="block text-[11px] text-muted">
                                        {money(seller.bestDay.revenue)}
                                      </span>
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-muted">
                                      Sem vendas
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 pl-3 pr-5 text-right tabular-nums">
                                  <strong
                                    className={`block text-[13px] font-bold ${
                                      pos === 1 ? "text-brand" : "text-ink"
                                    }`}
                                  >
                                    {formatCriterionMetric(seller)}
                                  </strong>
                                  <span className="block text-[11px] text-muted">
                                    {criterion === "netRevenue"
                                      ? `Bruto ${money(seller.grossRevenue)}`
                                      : `Líquido ${money(seller.netRevenue)}`}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* RODAPÉ SEPARADO: ATENDIMENTOS DE BALCÃO (SEM VENDEDOR VINCULADO) */}
                  {unassignedSeller &&
                    (unassignedSeller.salesCount > 0 ||
                      unassignedSeller.returnsCount > 0) && (
                      <div className="border-t border-line bg-page px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-surface border border-line text-muted flex items-center justify-center shrink-0">
                            <ShoppingBag size={15} />
                          </span>
                          <div className="min-w-0">
                            <strong className="block text-xs font-bold text-ink">
                              Atendimentos de Balcão (sem vendedor vinculado)
                            </strong>
                            <span className="block text-[11px] text-muted">
                              Contabilizado no faturamento da loja, mas fora do
                              pódio e sem geração de comissão.
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 shrink-0 tabular-nums">
                          <div className="text-right">
                            <strong className="block text-xs font-bold text-ink">
                              Líquido {money(unassignedSeller.netRevenue)}
                            </strong>
                            <span className="block text-[11px] text-muted">
                              {unassignedSeller.salesCount}{" "}
                              {unassignedSeller.salesCount === 1
                                ? "venda"
                                : "vendas"}{" "}
                              ({money(unassignedSeller.grossRevenue)})
                              {unassignedSeller.returnsCount > 0
                                ? ` · ${unassignedSeller.returnsCount} ${unassignedSeller.returnsCount === 1 ? "troca" : "trocas"} (${money(unassignedSeller.returnsAmount)})`
                                : ""}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSellerId(unassignedSeller.operatorId)
                            }
                            className="px-3 py-1.5 rounded-lg bg-surface border border-line text-xs font-semibold text-ink hover:border-brand hover:text-brand transition-colors cursor-pointer"
                          >
                            Auditar
                          </button>
                        </div>
                      </div>
                    )}
                </section>

                {/* COLUNA LATERAL DIREITA (4 COL): META DA LOJA + LEITURA COMERCIAL ENXUTA */}
                <aside className="xl:col-span-4 space-y-5">
                  {/* Card 1: Meta Comercial da Loja & Comissões */}
                  <section className="bg-surface border border-line rounded-xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-ink flex items-center gap-2">
                          <Target size={17} className="text-brand" />
                          Meta da Loja &amp; Comissões
                        </h2>
                        <p className="text-xs text-muted mt-0.5">
                          Acompanhamento do objetivo configurado e comissão da
                          equipe
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(ROUTES.inteligenciaComercial.metas)
                        }
                        className="text-xs font-semibold text-brand hover:underline shrink-0 cursor-pointer"
                      >
                        Ajustar
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2 tabular-nums">
                        <span className="text-2xl font-bold text-ink tracking-tight">
                          {formatDec(data.summary.storeGoalProgressPct, 1)}%
                        </span>
                        <span className="text-xs text-muted">
                          <strong className="text-ink">
                            {money(storeRealizedForGoal)}
                          </strong>{" "}
                          de {money(data.summary.storeGoal)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-support overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(0, Number(data.summary.storeGoalProgressPct || 0)))}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-line">
                      <div className="rounded-lg bg-page border border-line p-3">
                        <span className="block text-[11px] font-medium text-muted">
                          Saldo p/ bater a meta
                        </span>
                        <strong className="block text-sm font-bold text-ink mt-0.5 tabular-nums">
                          {remainingStoreGoal > 0
                            ? money(remainingStoreGoal)
                            : "Meta batida"}
                        </strong>
                      </div>
                      <div className="rounded-lg bg-page border border-line p-3">
                        <span className="block text-[11px] font-medium text-muted">
                          Comissão est. equipe
                        </span>
                        <strong className="block text-sm font-bold text-ink mt-0.5 tabular-nums">
                          {money(data.summary.totalEstimatedCommission)}
                        </strong>
                      </div>
                    </div>
                  </section>

                  {/* Card 2: Leitura Comercial do Período (Sem Sparkles e sem lista duplicada) */}
                  <section className="bg-surface border border-line rounded-xl p-5">
                    <div className="mb-3.5">
                      <h2 className="text-base font-bold text-ink">
                        Leitura Comercial do Período
                      </h2>
                      <p className="text-xs text-muted mt-0.5">
                        Destaques objetivos de conversão, venda casada e pontos
                        de auditoria
                      </p>
                    </div>

                    {(data.insights || []).length > 0 ? (
                      <div className="divide-y divide-line">
                        {data.insights.map((ins: any) => {
                          const isInteractive = Boolean(
                            ins.operatorId || ins.kind === "calendar",
                          );
                          return (
                            <div
                              key={ins.id}
                              role={isInteractive ? "button" : undefined}
                              tabIndex={isInteractive ? 0 : undefined}
                              onClick={() => {
                                if (ins.kind === "calendar" && ins.date) {
                                  openSellerInCalendar("ALL", ins.date);
                                } else if (ins.operatorId) {
                                  setSelectedSellerId(ins.operatorId);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (
                                  isInteractive &&
                                  (e.key === "Enter" || e.key === " ")
                                ) {
                                  e.preventDefault();
                                  if (ins.kind === "calendar" && ins.date) {
                                    openSellerInCalendar("ALL", ins.date);
                                  } else if (ins.operatorId) {
                                    setSelectedSellerId(ins.operatorId);
                                  }
                                }
                              }}
                              className={`py-3 first:pt-0 last:pb-0 flex items-start gap-3 ${
                                isInteractive
                                  ? "cursor-pointer group"
                                  : ""
                              }`}
                            >
                              {ins.operatorName &&
                              ins.operatorId &&
                              ins.operatorId !== "sem-vendedor" ? (
                                <OperatorAvatarThumb
                                  name={ins.operatorName}
                                  imageUrl={ins.operatorImageUrl}
                                  operatorId={ins.operatorId}
                                  size="md"
                                  className="mt-0.5"
                                />
                              ) : (
                                <span
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                                    ins.kind === "leader"
                                      ? "bg-support border-brand text-brand"
                                      : "bg-page border-line text-ink"
                                  }`}
                                >
                                  <InsightKindIcon kind={ins.kind} />
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                                  <strong className="inline-flex items-center gap-1.5 text-xs font-bold text-ink group-hover:text-brand transition-colors">
                                    <span className="text-brand shrink-0">
                                      <InsightKindIcon kind={ins.kind} />
                                    </span>
                                    <span>{ins.title}</span>
                                  </strong>
                                  <span className="text-[11px] font-semibold text-brand tabular-nums">
                                    {ins.metric}
                                  </span>
                                </div>
                                <p className="text-xs text-muted mt-1 leading-relaxed">
                                  {ins.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted py-4">
                        Registre vendas no PDV para gerar destaques comerciais
                        da equipe.
                      </p>
                    )}
                  </section>
                </aside>
              </div>
            )}

            {/* ===============================================================
                ABA 2: CALENDÁRIO COMERCIAL DE VENDAS & CAMPEÃO DO DIA
               =============================================================== */}
            {activeSubTab === "calendario" && (
              <div className="retail-stack" style={{ gap: 18 }}>
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
                    {allOrderedSellers.map((s: any) => (
                      <button
                        type="button"
                        key={s.operatorId}
                        className={`retail-pill inline-flex items-center gap-1.5 ${calendarSellerFilter === s.operatorId ? "is-active" : ""}`}
                        onClick={() => setCalendarSellerFilter(s.operatorId)}
                      >
                        {!s.isUnassigned && s.operatorId !== "sem-vendedor" && (
                          <OperatorAvatarThumb
                            name={s.name}
                            imageUrl={s.imageUrl}
                            operatorId={s.operatorId}
                            size="xs"
                          />
                        )}
                        <span>
                          {s.name} ({s.salesCount})
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <div className="retail-intel-calendar-split">
                  <section className="retail-panel">
                    <div className="retail-intel-calendar-weekdays">
                      {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                        (wk) => (
                          <span key={wk}>{wk}</span>
                        ),
                      )}
                    </div>

                    <div className="retail-intel-calendar-grid">
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
                                      <OperatorAvatarThumb
                                        name={day.champion.name}
                                        imageUrl={day.champion.imageUrl}
                                        operatorId={day.champion.operatorId}
                                        size="xs"
                                      />
                                      <Trophy size={10} />
                                      <span className="truncate">
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
                              {formatDec(selectedDayData.pa, 2)}
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

                        {selectedDayData.sellerBreakdown?.length > 0 && (
                          <div className="retail-intel-day-sellers-box">
                            <strong
                              style={{
                                display: "block",
                                fontSize: "0.82rem",
                                marginBottom: 8,
                              }}
                            >
                              Desempenho no dia:
                            </strong>
                            <div className="retail-stack" style={{ gap: 8 }}>
                              {selectedDayData.sellerBreakdown.map(
                                (ds: any, idx: number) => {
                                  const isUnassignedRow =
                                    ds.operatorId === "sem-vendedor";
                                  return (
                                    <div
                                      key={ds.operatorId}
                                      className="retail-row retail-spread retail-intel-day-seller-item"
                                    >
                                      <div
                                        className="retail-row"
                                        style={{ gap: 8 }}
                                      >
                                        <span
                                          className={`retail-intel-lb-badge is-small ${
                                            !isUnassignedRow && idx === 0
                                              ? "is-pos-1"
                                              : !isUnassignedRow && idx < 3
                                                ? "is-pos-podium"
                                                : ""
                                          }`}
                                        >
                                          {isUnassignedRow ? "—" : `${idx + 1}º`}
                                        </span>
                                        <SellerAvatar
                                          name={ds.name}
                                          imageUrl={ds.imageUrl}
                                          operatorId={ds.operatorId}
                                          size={30}
                                          rank={
                                            isUnassignedRow ? undefined : idx + 1
                                          }
                                        />
                                        <div>
                                          <strong>{ds.name}</strong>
                                          <small
                                            className="retail-muted"
                                            style={{ display: "block" }}
                                          >
                                            {ds.salesCount} vendas ·{" "}
                                            {ds.piecesCount} peças · PA{" "}
                                            {formatDec(ds.pa, 2)}
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
                                          {formatDec(ds.shareOfDayPct, 1)}% do
                                          dia
                                        </small>
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        )}

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
                                    <OperatorInlineBadge
                                      label="Vendedor:"
                                      name={sale.operatorName}
                                      imageUrl={sale.operatorImageUrl}
                                      operatorId={
                                        sale.operatorId !== "sem-vendedor"
                                          ? sale.operatorId
                                          : undefined
                                      }
                                      size="xs"
                                    />
                                    <span className="retail-muted">
                                      {sale.customerName
                                        ? `Cliente: ${sale.customerName}`
                                        : "Consumidor Balcão"}
                                    </span>
                                  </div>

                                  <div className="retail-intel-sale-items">
                                    {(sale.items || []).map(
                                      (it: any, iIdx: number) => (
                                        <div
                                          key={it.id || iIdx}
                                          className="retail-row retail-spread"
                                          style={{ gap: 8 }}
                                        >
                                          <span className="inline-flex items-center gap-2 min-w-0">
                                            <StockItemThumb
                                              name={it.productName}
                                              imageUrl={it.imageUrl}
                                              size="xs"
                                            />
                                            <span className="truncate">
                                              {it.quantity}x {it.productName}
                                            </span>
                                          </span>
                                          <span className="retail-number shrink-0">
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
                                          {formatDec(sale.discountPct, 1)}%)
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

            {/* ===============================================================
                ABA 3: AUDITORIA DE DESCONTOS, TAXA DE TROCAS & METAS/COMISSÕES
               =============================================================== */}
            {activeSubTab === "metas" && (
              <div className="retail-stack" style={{ gap: 20 }}>
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
                        {allOrderedSellers.map((s: any, index: number) => {
                          const isUnassignedRow = Boolean(
                            s.isUnassigned || s.operatorId === "sem-vendedor",
                          );
                          const pos = index + 1;
                          return (
                            <tr key={s.operatorId}>
                              <td data-label="Vendedor">
                                <div className="retail-row" style={{ gap: 10 }}>
                                  <span
                                    className={`retail-intel-lb-badge is-small ${
                                      !isUnassignedRow && pos === 1
                                        ? "is-pos-1"
                                        : !isUnassignedRow && pos <= 3
                                          ? "is-pos-podium"
                                          : ""
                                    }`}
                                  >
                                    {isUnassignedRow ? "—" : `${pos}º`}
                                  </span>
                                  <SellerAvatar
                                    name={s.name}
                                    imageUrl={s.imageUrl}
                                    operatorId={s.operatorId}
                                    size={34}
                                    rank={isUnassignedRow ? undefined : pos}
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
                                  {formatDec(s.discountRatePct, 1)}% (
                                  {money(s.discountTotal)})
                                </strong>
                                <small
                                  className="retail-muted"
                                  style={{ display: "block" }}
                                >
                                  Em {s.discountedSalesCount} vendas (
                                  {formatDec(s.discountedSalesRatePct, 1)}%)
                                </small>
                              </td>
                              <td
                                data-label="Taxa de Trocas (Origem)"
                                className="retail-number"
                              >
                                <strong>
                                  {formatDec(s.returnRatePct, 1)}% (
                                  {money(s.returnsAmount)})
                                </strong>
                                <small
                                  className="retail-muted"
                                  style={{ display: "block" }}
                                >
                                  {s.returnsCount} trocas · {s.returnedPieces}{" "}
                                  pçs devolvidas
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
                                  {formatDec(s.marginRatePct, 1)}%)
                                </small>
                              </td>
                              <td
                                data-label="PA / Venda Casada"
                                className="retail-number"
                              >
                                <strong>
                                  {formatDec(s.pa, 2)} pçs/venda
                                </strong>
                                <small
                                  className="retail-muted"
                                  style={{ display: "block" }}
                                >
                                  {formatDec(s.multiItemRatePct, 1)}% vendas c/
                                  2+ peças
                                </small>
                              </td>
                              <td
                                data-label="Cliente Identificado"
                                className="retail-number"
                              >
                                <strong>
                                  {formatDec(s.identifiedRatePct, 1)}%
                                </strong>
                                <small
                                  className="retail-muted"
                                  style={{ display: "block" }}
                                >
                                  {s.identifiedSalesCount} vendas (
                                  {s.uniqueCustomersCount} clientes)
                                </small>
                              </td>
                              <td
                                data-label="Meta & Comissão"
                                className="retail-number"
                              >
                                {isUnassignedRow ? (
                                  <small className="retail-muted">
                                    Sem vínculo de comissão
                                  </small>
                                ) : (
                                  <>
                                    <strong>
                                      {formatDec(s.goalProgressPct, 1)}% da meta
                                      ({money(s.goal)})
                                    </strong>
                                    <small
                                      className="retail-muted"
                                      style={{ display: "block" }}
                                    >
                                      Comissão ({formatDec(s.commissionPct, 1)}
                                      %): {money(s.estimatedCommission)}
                                    </small>
                                  </>
                                )}
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
                          );
                        })}
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

                  {teamRankedSellers.length > 0 && (
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
                        {teamRankedSellers.map((s: any) => {
                          const ov = goalsForm.sellerOverrides[
                            s.operatorId
                          ] || {
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
                                  operatorId={s.operatorId}
                                  size={36}
                                />
                                <div>
                                  <strong>{s.name}</strong>
                                  <small
                                    className="retail-muted"
                                    style={{ display: "block" }}
                                  >
                                    Atual: {money(s.netRevenue)} líquidos (
                                    {formatDec(s.goalProgressPct, 1)}%)
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
                  )}
                </form>
              </div>
            )}
          </div>
        )
      )}

      {/* =====================================================================
          MODAL DE RAIO-X 360º DO VENDEDOR / AUDITORIA DE BALCÃO
         ===================================================================== */}
      {selectedSeller && (
        <RetailDialog
          title={
            selectedSeller.isUnassigned ||
            selectedSeller.operatorId === "sem-vendedor"
              ? `Auditoria de Atendimentos · ${selectedSeller.name}`
              : `Raio-X 360º do Vendedor · ${selectedSeller.name} (${selectedSeller.jobTitle})`
          }
          onClose={() => setSelectedSellerId(null)}
          wide
        >
          <div className="retail-stack" style={{ gap: 18 }}>
            <div className="retail-intel-modal-hero">
              <div className="retail-row" style={{ gap: 14 }}>
                <SellerAvatar
                  name={selectedSeller.name}
                  imageUrl={selectedSeller.imageUrl}
                  operatorId={selectedSeller.operatorId}
                  size={64}
                  rank={
                    selectedSeller.isUnassigned ||
                    selectedSeller.operatorId === "sem-vendedor"
                      ? undefined
                      : 1
                  }
                />
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
                    {selectedSeller.name}
                  </h3>
                  <p className="retail-muted" style={{ margin: "2px 0 6px" }}>
                    {selectedSeller.isUnassigned ||
                    selectedSeller.operatorId === "sem-vendedor"
                      ? "Vendas concluídas sem seleção de consultor no fechamento do PDV"
                      : `${selectedSeller.jobTitle} · ${selectedSeller.dailyWinsCount} ${
                          selectedSeller.dailyWinsCount === 1
                            ? "dia como Campeão de Vendas (#1)"
                            : "dias como Campeão de Vendas (#1)"
                        }`}
                  </p>
                  <div
                    className="retail-row"
                    style={{ gap: 8, flexWrap: "wrap" }}
                  >
                    <span className="retail-intel-tag">
                      Participação: {formatDec(selectedSeller.sharePct, 1)}% da
                      loja
                    </span>
                    {!selectedSeller.isUnassigned &&
                      selectedSeller.operatorId !== "sem-vendedor" && (
                        <span className="retail-intel-tag">
                          Comissão est. (
                          {formatDec(selectedSeller.commissionPct, 1)}%):{" "}
                          {money(selectedSeller.estimatedCommission)}
                        </span>
                      )}
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
                        Maior dia: {formatBrDate(selectedSeller.bestDay.date)} (
                        {money(selectedSeller.bestDay.revenue)}) · Ver no
                        Calendário →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="retail-kpis">
              <article className="retail-kpi">
                <span className="retail-muted">Venda Líquida Real</span>
                <strong className="retail-number">
                  {money(selectedSeller.netRevenue)}
                </strong>
                <small className="retail-muted">
                  Bruto {money(selectedSeller.grossRevenue)}
                  {!selectedSeller.isUnassigned &&
                  selectedSeller.operatorId !== "sem-vendedor"
                    ? ` · Meta ${formatDec(selectedSeller.goalProgressPct, 1)}%`
                    : ""}
                </small>
              </article>

              <article className="retail-kpi">
                <span className="retail-muted">PA &amp; Ticket Médio</span>
                <strong className="retail-number">
                  {formatDec(selectedSeller.pa, 2)} pçs/venda
                </strong>
                <small className="retail-muted">
                  Ticket {money(selectedSeller.avgTicket)} ·{" "}
                  {formatDec(selectedSeller.multiItemRatePct, 1)}% vendas
                  casadas (2+ pçs)
                </small>
              </article>

              <article className="retail-kpi">
                <span className="retail-muted">Índice de Desconto</span>
                <strong className="retail-number">
                  {formatDec(selectedSeller.discountRatePct, 1)}% (
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
                  {formatDec(selectedSeller.returnRatePct, 1)}% (
                  {money(selectedSeller.returnsAmount)})
                </strong>
                <small className="retail-muted">
                  {selectedSeller.returnsCount} trocas ·{" "}
                  {selectedSeller.returnedPieces} peças trocadas
                </small>
              </article>
            </div>

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
                    <span className="retail-muted">Horário de pico</span>
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
                      {formatDec(selectedSeller.identifiedRatePct, 1)}% (
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
                  Mercadorias Mais Vendidas
                </h4>
                {selectedSeller.topGroups?.length > 0 ? (
                  <div className="retail-stack" style={{ gap: 8 }}>
                    {selectedSeller.topGroups.slice(0, 4).map((g: any) => (
                      <div
                        key={g.id}
                        className="retail-row retail-spread"
                        style={{ gap: 8 }}
                      >
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <StockItemThumb
                            name={g.name}
                            imageUrl={g.imageUrl}
                            size="sm"
                          />
                          <span className="truncate font-medium">{g.name}</span>
                        </span>
                        <strong className="retail-number shrink-0">
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

            {selectedSeller.recentReturns?.length > 0 && (
              <div className="retail-panel">
                <h4 style={{ margin: "0 0 8px" }}>
                  <RotateCcw
                    size={15}
                    style={{ display: "inline", marginRight: 6 }}
                  />
                  Trocas Registradas ({selectedSeller.recentReturns.length})
                </h4>
                <div className="retail-stack" style={{ gap: 8 }}>
                  {selectedSeller.recentReturns.map((ret: any) => (
                    <div
                      key={ret.id}
                      className="retail-stack retail-intel-sale-card"
                      style={{ gap: 6 }}
                    >
                      <div className="retail-row retail-spread">
                        <div>
                          <strong>
                            Venda #{ret.saleCode || "—"} ·{" "}
                            {ret.customerName || "Consumidor Balcão"}
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
                      {ret.processedByOperatorName && (
                        <div>
                          <OperatorInlineBadge
                            label="Processado por:"
                            name={ret.processedByOperatorName}
                            imageUrl={ret.processedByOperatorImageUrl}
                            operatorId={ret.processedByOperatorId}
                            size="xs"
                          />
                        </div>
                      )}
                      {ret.items?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {ret.items.map((ri: any, riIdx: number) => (
                            <span
                              key={`${ret.id}-${riIdx}`}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-page border border-line text-xs"
                            >
                              <StockItemThumb
                                name={ri.productName}
                                imageUrl={ri.imageUrl}
                                size="xs"
                              />
                              <span className="truncate max-w-[180px]">
                                {ri.quantity}x {ri.productName}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
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
                Fechar
              </button>
            </div>
          </div>
        </RetailDialog>
      )}
    </div>
  );
}
