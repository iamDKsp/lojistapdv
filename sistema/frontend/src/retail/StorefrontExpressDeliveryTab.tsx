import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  Save,
  ShieldCheck,
  Sliders,
  Sparkles,
  Store,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiError, money } from "./types";

export interface NeighborhoodOverrideItem {
  id: string;
  neighborhood: string;
  fee: number;
  estimatedMinutes?: number | null;
}

export interface AdminExpressDeliveryConfig {
  moduleEnabled: boolean;
  enabled: boolean;
  effectivelyActive: boolean;
  originZipCode: string;
  originStreet: string;
  originNumber: string;
  originNeighborhood: string;
  originCity: string;
  originState: string;
  pricingMode: "DISTANCE_KM" | "FIXED";
  baseFee: number;
  baseIncludedKm: number;
  feePerAdditionalKm: number;
  routeFactor: number;
  maxRadiusKm: number;
  fallbackFee: number;
  motoEnabled: boolean;
  carEnabled: boolean;
  carSurcharge: number;
  minOrderAmount: number;
  freeShippingAbove: number | null;
  estimatedPrepMinutes: number;
  neighborhoodOverrides: NeighborhoodOverrideItem[];
  apiIntegration: {
    mode: "HYBRID_PORTAL" | "API_99_EMPRESAS";
    corporateAccountId: string | null;
    hasCorporateToken: boolean;
    corporateTokenMasked: string | null;
    environment: "sandbox" | "production";
    autoRequestOnConfirm: boolean;
  };
}

function formatCepMask(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function StorefrontExpressDeliveryTab({
  initialConfig,
  deliveryEnabled,
  deliveryFeeNote,
  onSaved,
}: {
  initialConfig?: AdminExpressDeliveryConfig | null;
  deliveryEnabled: boolean;
  deliveryFeeNote?: string;
  onSaved: () => Promise<void> | void;
}) {
  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? true);
  const [originZipCode, setOriginZipCode] = useState(
    formatCepMask(initialConfig?.originZipCode || ""),
  );
  const [originStreet, setOriginStreet] = useState(
    initialConfig?.originStreet || "",
  );
  const [originNumber, setOriginNumber] = useState(
    initialConfig?.originNumber || "",
  );
  const [originNeighborhood, setOriginNeighborhood] = useState(
    initialConfig?.originNeighborhood || "",
  );
  const [originCity, setOriginCity] = useState(initialConfig?.originCity || "");
  const [originState, setOriginState] = useState(
    initialConfig?.originState || "",
  );
  const [pricingMode, setPricingMode] = useState<"DISTANCE_KM" | "FIXED">(
    initialConfig?.pricingMode || "DISTANCE_KM",
  );
  const [baseFee, setBaseFee] = useState(
    String(initialConfig?.baseFee ?? 7.9),
  );
  const [baseIncludedKm, setBaseIncludedKm] = useState(
    String(initialConfig?.baseIncludedKm ?? 2),
  );
  const [feePerAdditionalKm, setFeePerAdditionalKm] = useState(
    String(initialConfig?.feePerAdditionalKm ?? 2.2),
  );
  const [maxRadiusKm, setMaxRadiusKm] = useState(
    String(initialConfig?.maxRadiusKm ?? 18),
  );
  const [motoEnabled, setMotoEnabled] = useState(
    initialConfig?.motoEnabled ?? true,
  );
  const [carEnabled, setCarEnabled] = useState(
    initialConfig?.carEnabled ?? true,
  );
  const [carSurcharge, setCarSurcharge] = useState(
    String(initialConfig?.carSurcharge ?? 8),
  );
  const [minOrderAmount, setMinOrderAmount] = useState(
    String(initialConfig?.minOrderAmount ?? 0),
  );
  const [freeShippingAbove, setFreeShippingAbove] = useState(
    initialConfig?.freeShippingAbove != null
      ? String(initialConfig.freeShippingAbove)
      : "",
  );
  const [estimatedPrepMinutes, setEstimatedPrepMinutes] = useState(
    String(initialConfig?.estimatedPrepMinutes ?? 15),
  );
  const [feeNote, setFeeNote] = useState(
    deliveryFeeNote || "Cálculo automático 99 Entregas por CEP",
  );
  const [overrides, setOverrides] = useState<NeighborhoodOverrideItem[]>(
    initialConfig?.neighborhoodOverrides || [],
  );
  const [newNbName, setNewNbName] = useState("");
  const [newNbFee, setNewNbFee] = useState("");

  // API Corporativa 99 Empresas
  const [integrationMode, setIntegrationMode] = useState<
    "HYBRID_PORTAL" | "API_99_EMPRESAS"
  >(initialConfig?.apiIntegration?.mode || "HYBRID_PORTAL");
  const [corporateAccountId, setCorporateAccountId] = useState(
    initialConfig?.apiIntegration?.corporateAccountId || "",
  );
  const [corporateTokenInput, setCorporateTokenInput] = useState("");
  const [clearToken, setClearToken] = useState(false);
  const [environment, setEnvironment] = useState<"production" | "sandbox">(
    initialConfig?.apiIntegration?.environment || "production",
  );
  const [autoRequestOnConfirm, setAutoRequestOnConfirm] = useState(
    initialConfig?.apiIntegration?.autoRequestOnConfirm ?? false,
  );

  const [loadingOriginCep, setLoadingOriginCep] = useState(false);
  const [saving, setSaving] = useState(false);

  // Simulador ao vivo
  const [simCep, setSimCep] = useState("");
  const [simSubtotal, setSimSubtotal] = useState("120");
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  useEffect(() => {
    if (!initialConfig) return;
    setEnabled(initialConfig.enabled);
    setOriginZipCode(formatCepMask(initialConfig.originZipCode || ""));
    setOriginStreet(initialConfig.originStreet || "");
    setOriginNumber(initialConfig.originNumber || "");
    setOriginNeighborhood(initialConfig.originNeighborhood || "");
    setOriginCity(initialConfig.originCity || "");
    setOriginState(initialConfig.originState || "");
    setPricingMode(initialConfig.pricingMode || "DISTANCE_KM");
    setBaseFee(String(initialConfig.baseFee ?? 7.9));
    setBaseIncludedKm(String(initialConfig.baseIncludedKm ?? 2));
    setFeePerAdditionalKm(String(initialConfig.feePerAdditionalKm ?? 2.2));
    setMaxRadiusKm(String(initialConfig.maxRadiusKm ?? 18));
    setMotoEnabled(initialConfig.motoEnabled ?? true);
    setCarEnabled(initialConfig.carEnabled ?? true);
    setCarSurcharge(String(initialConfig.carSurcharge ?? 8));
    setMinOrderAmount(String(initialConfig.minOrderAmount ?? 0));
    setFreeShippingAbove(
      initialConfig.freeShippingAbove != null
        ? String(initialConfig.freeShippingAbove)
        : "",
    );
    setEstimatedPrepMinutes(String(initialConfig.estimatedPrepMinutes ?? 15));
    setOverrides(initialConfig.neighborhoodOverrides || []);
    setIntegrationMode(initialConfig.apiIntegration?.mode || "HYBRID_PORTAL");
    setCorporateAccountId(
      initialConfig.apiIntegration?.corporateAccountId || "",
    );
    setEnvironment(
      initialConfig.apiIntegration?.environment || "production",
    );
    setAutoRequestOnConfirm(
      initialConfig.apiIntegration?.autoRequestOnConfirm ?? false,
    );
    setCorporateTokenInput("");
    setClearToken(false);
  }, [initialConfig]);

  const handleLookupOriginCep = async (rawCep: string) => {
    const clean = rawCep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setLoadingOriginCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const info = r.ok ? await r.json() : null;
      if (info && !info.erro) {
        if (info.logradouro) setOriginStreet(info.logradouro);
        if (info.bairro) setOriginNeighborhood(info.bairro);
        if (info.localidade) setOriginCity(info.localidade);
        if (info.uf) setOriginState(String(info.uf).toUpperCase());
      }
    } catch {
      // ignore
    } finally {
      setLoadingOriginCep(false);
    }
  };

  const buildCandidatePayload = () => ({
    enabled,
    originZipCode: originZipCode.replace(/\D/g, ""),
    originStreet: originStreet.trim(),
    originNumber: originNumber.trim(),
    originNeighborhood: originNeighborhood.trim(),
    originCity: originCity.trim(),
    originState: originState.trim().toUpperCase(),
    pricingMode,
    baseFee: Number(baseFee || 0),
    baseIncludedKm: Number(baseIncludedKm || 0),
    feePerAdditionalKm: Number(feePerAdditionalKm || 0),
    maxRadiusKm: Number(maxRadiusKm || 18),
    motoEnabled,
    carEnabled,
    carSurcharge: Number(carSurcharge || 0),
    minOrderAmount: Number(minOrderAmount || 0),
    freeShippingAbove:
      freeShippingAbove.trim() === "" ? null : Number(freeShippingAbove),
    estimatedPrepMinutes: Number(estimatedPrepMinutes || 15),
    neighborhoodOverrides: overrides,
    apiIntegration: {
      mode: integrationMode,
      corporateAccountId: corporateAccountId.trim() || null,
      ...(corporateTokenInput.trim()
        ? { corporateToken: corporateTokenInput.trim() }
        : {}),
      ...(clearToken ? { clearCorporateToken: true } : {}),
      environment,
      autoRequestOnConfirm,
    },
  });

  const handleAddOverride = () => {
    const nb = newNbName.trim();
    const feeNum = Number(newNbFee.replace(",", "."));
    if (!nb || !Number.isFinite(feeNum) || feeNum < 0) {
      toast.error("Informe o nome do bairro e o valor da taxa.");
      return;
    }
    setOverrides((prev) => [
      ...prev.filter(
        (p) => p.neighborhood.toLowerCase() !== nb.toLowerCase(),
      ),
      {
        id: `nb-${Date.now()}`,
        neighborhood: nb,
        fee: Math.round(feeNum * 100) / 100,
      },
    ]);
    setNewNbName("");
    setNewNbFee("");
  };

  const handleSimulate = async () => {
    const clean = simCep.replace(/\D/g, "");
    if (clean.length !== 8) {
      toast.error("Informe um CEP de destino válido com 8 dígitos.");
      return;
    }
    setSimulating(true);
    try {
      const { data } = await api.post("/storefront/admin/delivery/simulate", {
        zipCode: clean,
        subtotal: Number(simSubtotal || 120),
        config: buildCandidatePayload(),
      });
      setSimResult(data);
    } catch (err) {
      toast.error(apiError(err, "Falha ao simular entrega 99."));
    } finally {
      setSimulating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motoEnabled && !carEnabled) {
      toast.error("Ative pelo menos uma modalidade (99 Moto ou 99 Carro).");
      return;
    }
    setSaving(true);
    try {
      await api.put("/storefront/admin/delivery-settings", {
        deliveryEnabled: enabled ? true : deliveryEnabled,
        deliveryFeeNote: feeNote.trim(),
        expressDelivery: buildCandidatePayload(),
      });
      toast.success(
        "Configurações do módulo 99 Entregas salvas e aplicadas na Loja Virtual!",
      );
      await onSaved();
    } catch (err) {
      toast.error(apiError(err, "Erro ao salvar configurações de entrega."));
    } finally {
      setSaving(false);
    }
  };

  const moduleActive = initialConfig?.moduleEnabled ?? false;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Cabeçalho e Status do Módulo */}
      <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-start gap-3.5">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-on-brand font-extrabold text-lg shadow-xs">
            99
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-ink">
                Módulo 99 Entregas — Loja Virtual
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                  moduleActive && enabled
                    ? "bg-support border border-brand text-brand"
                    : "bg-page border border-line text-muted"
                }`}
              >
                {moduleActive
                  ? enabled
                    ? "Ativo na Loja Virtual"
                    : "Pausado pelo Lojista"
                  : "Aguardando ativação no /sys-init"}
              </span>
            </div>
            <p className="text-xs text-muted mt-1 max-w-2xl">
              Calcule o frete automaticamente por CEP e quilometragem no
              checkout, notifique a Frente de Caixa com alerta sonoro e exiba a
              animação de rota 99 em tempo real para o seu cliente.
            </p>
          </div>
        </div>

        <label className="inline-flex items-center gap-2.5 rounded-2xl border border-line bg-page px-4 py-2.5 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          <span className="text-xs font-extrabold text-ink">
            Habilitar 99 Entregas
          </span>
        </label>
      </div>

      {!moduleActive && (
        <div className="rounded-2xl border border-brand bg-support p-4 text-xs text-ink flex items-start gap-3">
          <Sparkles size={18} className="text-brand shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold text-brand">
              Permissão do módulo no contrato desta loja
            </p>
            <p className="mt-0.5">
              Você já pode deixar todas as tarifas e endereço configurados
              abaixo. Para liberar a calculadora 99 para os clientes na vitrine,
              certifique-se de que a flag{" "}
              <code className="font-mono font-bold">entregaLojaVirtual</code>{" "}
              esteja marcada para esta loja no painel{" "}
              <strong>/sys-init</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Principal (7 cols): Origem + Regras + Exceções + API */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Endereço de Origem (Coleta na Loja) */}
          <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Store size={17} className="text-brand" />
              <h3 className="text-sm sm:text-base font-extrabold text-ink">
                1. Ponto de Coleta (Endereço da Loja)
              </h3>
            </div>
            <p className="text-xs text-muted">
              Usado como ponto zero para calcular a distância até o CEP do
              comprador e facilitar o despacho da corrida 99.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-ink flex items-center justify-between mb-1">
                  <span>CEP da Loja *</span>
                  {loadingOriginCep && (
                    <Loader2 size={12} className="animate-spin text-brand" />
                  )}
                </label>
                <input
                  type="text"
                  value={originZipCode}
                  onChange={(e) => {
                    const formatted = formatCepMask(e.target.value);
                    setOriginZipCode(formatted);
                    if (formatted.replace(/\D/g, "").length === 8) {
                      void handleLookupOriginCep(formatted);
                    }
                  }}
                  placeholder="01310-100"
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink focus:border-brand outline-none"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs font-bold text-ink block mb-1">
                  Rua / Avenida
                </label>
                <input
                  type="text"
                  value={originStreet}
                  onChange={(e) => setOriginStreet(e.target.value)}
                  placeholder="Av. Paulista"
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink focus:border-brand outline-none"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="text-xs font-bold text-ink block mb-1">
                  Nº
                </label>
                <input
                  type="text"
                  value={originNumber}
                  onChange={(e) => setOriginNumber(e.target.value)}
                  placeholder="1000"
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink focus:border-brand outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-ink block mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  value={originNeighborhood}
                  onChange={(e) => setOriginNeighborhood(e.target.value)}
                  placeholder="Bela Vista"
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink focus:border-brand outline-none"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs font-bold text-ink block mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={originCity}
                  onChange={(e) => setOriginCity(e.target.value)}
                  placeholder="São Paulo"
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink focus:border-brand outline-none"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="text-xs font-bold text-ink block mb-1">
                  UF
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={originState}
                  onChange={(e) => setOriginState(e.target.value.toUpperCase())}
                  placeholder="SP"
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm uppercase text-ink focus:border-brand outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. Precificação, Modalidades Moto/Carro e Frete Grátis */}
          <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sliders size={17} className="text-brand" />
              <h3 className="text-sm sm:text-base font-extrabold text-ink">
                2. Tarifas por Km, Modalidades 99 e Frete Grátis
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPricingMode("DISTANCE_KM")}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                  pricingMode === "DISTANCE_KM"
                    ? "border-brand bg-support"
                    : "border-line bg-page hover:border-brand"
                }`}
              >
                <p className="text-xs font-extrabold text-ink">
                  Cálculo Inteligente por Km (Recomendado)
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  Taxa base + adicional por km estimado entre a loja e o CEP do
                  cliente
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPricingMode("FIXED")}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                  pricingMode === "FIXED"
                    ? "border-brand bg-support"
                    : "border-line bg-page hover:border-brand"
                }`}
              >
                <p className="text-xs font-extrabold text-ink">
                  Taxa Fixa Única na Cidade
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  Cobra sempre a taxa base dentro do raio máximo definido
                </p>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  Taxa Base Moto (R$)
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  value={baseFee}
                  onChange={(e) => setBaseFee(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  Km Inclusos na Base
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  disabled={pricingMode === "FIXED"}
                  value={baseIncludedKm}
                  onChange={(e) => setBaseIncludedKm(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  R$ por Km Extra
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  disabled={pricingMode === "FIXED"}
                  value={feePerAdditionalKm}
                  onChange={(e) => setFeePerAdditionalKm(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  Raio Máximo (km)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={maxRadiusKm}
                  onChange={(e) => setMaxRadiusKm(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink"
                />
              </div>
            </div>

            {/* Modalidades 99 Moto & 99 Carro */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-line">
              <label className="flex items-center gap-2.5 rounded-xl border border-line bg-page p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={motoEnabled}
                  onChange={(e) => setMotoEnabled(e.target.checked)}
                  className="h-4 w-4 accent-brand"
                />
                <div>
                  <span className="text-xs font-extrabold text-ink block">
                    99Entrega Moto
                  </span>
                  <span className="text-[11px] text-muted">
                    Sacolas e pacotes leves
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 rounded-xl border border-line bg-page p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={carEnabled}
                  onChange={(e) => setCarEnabled(e.target.checked)}
                  className="h-4 w-4 accent-brand"
                />
                <div>
                  <span className="text-xs font-extrabold text-ink block">
                    99Entrega Carro
                  </span>
                  <span className="text-[11px] text-muted">
                    Caixas e compras grandes
                  </span>
                </div>
              </label>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  Adicional 99 Carro (R$)
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  disabled={!carEnabled}
                  value={carSurcharge}
                  onChange={(e) => setCarSurcharge(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink disabled:opacity-50"
                />
              </div>
            </div>

            {/* Pedido Mínimo, Frete Grátis e Tempo de Separação */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-line">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  Pedido Mínimo (R$)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  placeholder="0 = sem mínimo"
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  Frete Grátis Acima de (R$)
                </label>
                <input
                  type="number"
                  step="5"
                  min="0"
                  value={freeShippingAbove}
                  onChange={(e) => setFreeShippingAbove(e.target.value)}
                  placeholder="Vazio = desativado"
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  Tempo de Separação (min)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={estimatedPrepMinutes}
                  onChange={(e) => setEstimatedPrepMinutes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                Texto curto exibido na vitrine
              </label>
              <input
                type="text"
                value={feeNote}
                onChange={(e) => setFeeNote(e.target.value)}
                placeholder="Ex.: Entrega expressa 99 no mesmo dia"
                className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink"
              />
            </div>
          </div>

          {/* 3. Exceções por Bairro */}
          <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MapPin size={17} className="text-brand" />
              <h3 className="text-sm sm:text-base font-extrabold text-ink">
                3. Tarifas Fixas por Bairro (Opcional)
              </h3>
            </div>
            <p className="text-xs text-muted">
              Se o bairro do cliente estiver listado abaixo, o sistema usa este
              valor fixo no lugar do cálculo por km.
            </p>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newNbName}
                onChange={(e) => setNewNbName(e.target.value)}
                placeholder="Nome do bairro (ex.: Centro)"
                className="flex-1 min-w-[180px] p-2.5 rounded-xl border border-line bg-page text-xs text-ink"
              />
              <input
                type="number"
                step="0.50"
                min="0"
                value={newNbFee}
                onChange={(e) => setNewNbFee(e.target.value)}
                placeholder="Taxa R$"
                className="w-28 p-2.5 rounded-xl border border-line bg-page text-xs text-ink"
              />
              <button
                type="button"
                onClick={handleAddOverride}
                className="inline-flex items-center gap-1.5 rounded-xl bg-support border border-brand px-3.5 py-2.5 text-xs font-extrabold text-brand cursor-pointer"
              >
                <Plus size={14} />
                <span>Adicionar</span>
              </button>
            </div>

            {overrides.length > 0 && (
              <div className="divide-y divide-line rounded-2xl border border-line overflow-hidden">
                {overrides.map((ov) => (
                  <div
                    key={ov.id}
                    className="px-3.5 py-2.5 bg-page flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-ink">{ov.neighborhood}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-brand">
                        {money(ov.fee)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setOverrides((prev) =>
                            prev.filter((x) => x.id !== ov.id),
                          )
                        }
                        className="text-muted hover:text-brand cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Modo de Despacho / API 99 Empresas */}
          <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound size={17} className="text-brand" />
              <h3 className="text-sm sm:text-base font-extrabold text-ink">
                4. Modo de Operação & Credenciais 99 Empresas
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIntegrationMode("HYBRID_PORTAL")}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                  integrationMode === "HYBRID_PORTAL"
                    ? "border-brand bg-support"
                    : "border-line bg-page"
                }`}
              >
                <p className="text-xs font-extrabold text-ink">
                  Modo Híbrido Inteligente (Sem burocracia)
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  Frete automático na loja + despacho 1-clique com cópia de rota
                  para o app 99 ou Portal 99 Empresas
                </p>
              </button>
              <button
                type="button"
                onClick={() => setIntegrationMode("API_99_EMPRESAS")}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                  integrationMode === "API_99_EMPRESAS"
                    ? "border-brand bg-support"
                    : "border-line bg-page"
                }`}
              >
                <p className="text-xs font-extrabold text-ink">
                  Conta Corporativa 99 Empresas (API)
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  Armazena credenciais corporativas para integração de despacho
                  empresarial
                </p>
              </button>
            </div>

            {integrationMode === "API_99_EMPRESAS" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-line">
                <div>
                  <label className="text-xs font-bold text-ink block mb-1">
                    ID da Conta 99 Empresas
                  </label>
                  <input
                    type="text"
                    value={corporateAccountId}
                    onChange={(e) => setCorporateAccountId(e.target.value)}
                    placeholder="Ex.: corp_99_..."
                    className="w-full p-2.5 rounded-xl border border-line bg-page text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink block mb-1">
                    Ambiente
                  </label>
                  <select
                    value={environment}
                    onChange={(e) =>
                      setEnvironment(
                        e.target.value === "sandbox" ? "sandbox" : "production",
                      )
                    }
                    className="w-full p-2.5 rounded-xl border border-line bg-page text-xs font-bold text-ink"
                  >
                    <option value="production">Produção</option>
                    <option value="sandbox">Homologação (Sandbox)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-ink flex items-center justify-between mb-1">
                    <span>Token de API Corporativa 99</span>
                    {initialConfig?.apiIntegration?.hasCorporateToken &&
                      !clearToken && (
                        <span className="text-[11px] text-brand font-mono">
                          Salvo:{" "}
                          {initialConfig.apiIntegration.corporateTokenMasked}
                        </span>
                      )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={corporateTokenInput}
                      onChange={(e) => {
                        setCorporateTokenInput(e.target.value);
                        setClearToken(false);
                      }}
                      placeholder={
                        initialConfig?.apiIntegration?.hasCorporateToken
                          ? "Preencha apenas para substituir o token atual"
                          : "Cole o token corporativo 99 Empresas"
                      }
                      className="flex-1 p-2.5 rounded-xl border border-line bg-page text-xs text-ink"
                    />
                    {initialConfig?.apiIntegration?.hasCorporateToken && (
                      <button
                        type="button"
                        onClick={() => {
                          setClearToken(true);
                          setCorporateTokenInput("");
                        }}
                        className="rounded-xl border border-line px-3 text-xs font-bold text-muted hover:text-brand cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-brand hover:bg-brand-hover text-on-brand px-6 py-3.5 text-sm font-extrabold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span>Salvar Configurações 99 Entregas</span>
          </button>
        </div>

        {/* Coluna Direita (5 cols): Simulador de Cotação 99 em Tempo Real */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6 space-y-4 sticky top-20 shadow-2xs">
            <div className="flex items-center gap-2">
              <Navigation size={17} className="text-brand" />
              <h3 className="text-sm sm:text-base font-extrabold text-ink">
                Simulador de Frete 99 ao Vivo
              </h3>
            </div>
            <p className="text-xs text-muted">
              Teste qualquer CEP de cliente agora mesmo usando as regras do
              formulário ao lado antes de salvar.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  CEP do Cliente
                </label>
                <input
                  type="text"
                  value={simCep}
                  onChange={(e) => setSimCep(formatCepMask(e.target.value))}
                  placeholder="04094-050"
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  Valor da Sacola (R$)
                </label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={simSubtotal}
                  onChange={(e) => setSimSubtotal(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-line bg-page text-xs sm:text-sm text-ink"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={simulating}
              onClick={() => void handleSimulate()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-ink hover:bg-brand text-on-brand py-3 px-4 text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
            >
              {simulating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Truck size={15} />
              )}
              <span>Simular Rota e Valores 99</span>
            </button>

            {simResult && (
              <div className="rounded-2xl border border-brand bg-page p-4 space-y-3 text-xs">
                {simResult.available ? (
                  <>
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-line">
                      <span className="font-extrabold text-ink">
                        {[
                          simResult.destination?.neighborhood,
                          simResult.destination?.city,
                        ]
                          .filter(Boolean)
                          .join(" · ") || `CEP ${simResult.destination?.zipCode}`}
                      </span>
                      {simResult.distanceKm != null && (
                        <span className="rounded-full bg-support border border-brand px-2.5 py-0.5 font-bold text-brand">
                          ~{Number(simResult.distanceKm).toFixed(1).replace(".", ",")} km
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {(simResult.options || []).map((opt: any) => (
                        <div
                          key={opt.vehicleType}
                          className="rounded-xl border border-line bg-surface p-3 flex items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-extrabold text-ink">
                              {opt.label}
                            </p>
                            <p className="text-[11px] text-muted">
                              Chegada estimada: ~{opt.estimatedMinutes} min
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-extrabold text-brand">
                              {opt.fee === 0 ? "Grátis" : money(opt.fee)}
                            </p>
                            {opt.freeShippingApplied &&
                              opt.originalFee > opt.fee && (
                                <p className="text-[10px] line-through text-muted">
                                  {money(opt.originalFee)}
                                </p>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-ink font-semibold">
                    {simResult.message ||
                      "Indisponível para os parâmetros informados."}
                  </div>
                )}
              </div>
            )}

            {/* Guia rápido operacional */}
            <div className="rounded-2xl border border-line bg-page p-4 space-y-2 text-xs text-muted">
              <p className="font-extrabold text-ink">
                Como funciona no dia a dia:
              </p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>
                  O cliente digita o CEP na Loja Virtual, vê a rota animada e
                  escolhe <strong>99 Moto</strong> ou <strong>99 Carro</strong>.
                </li>
                <li>
                  A <strong>Frente de Caixa</strong> toca o alerta sonoro na
                  hora com todos os dados da entrega.
                </li>
                <li>
                  O caixa confirma, despacha o motorista 99 e o cliente vê a
                  moto/carro andando na tela com o{" "}
                  <strong>PIN de 4 dígitos</strong>!
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

/**
 * Painel de Despacho 99 Entregas embutido no detalhe do pedido em /loja-virtual/pedidos
 */
export function StorefrontOrderExpressDispatchCard({
  order,
  originAddressLine,
  onUpdated,
}: {
  order: any;
  originAddressLine?: string | null;
  onUpdated: (updatedOrder?: any) => Promise<void> | void;
}) {
  const [vehicleType, setVehicleType] = useState<"MOTO" | "CARRO">("MOTO");
  const [status, setStatus] = useState<
    "WAITING" | "REQUESTED" | "DISPATCHED" | "DELIVERED"
  >("WAITING");
  const [courierName, setCourierName] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [confirmationPin, setConfirmationPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const disp = order?.expressDispatch;
    const quote = order?.expressQuote;
    setVehicleType(disp?.vehicleType || quote?.vehicleType || "MOTO");
    setStatus(disp?.status || "WAITING");
    setCourierName(disp?.courierName || "");
    setVehiclePlate(disp?.vehiclePlate || "");
    setTrackingUrl(disp?.trackingUrl || "");
    setConfirmationPin(disp?.confirmationPin || "");
  }, [order?.id, order?.version]);

  if (!order || order.fulfillmentMode !== "DELIVERY") return null;

  const isTerminalCancelled = ["CANCELLED", "REJECTED", "EXPIRED"].includes(
    order.commercialStatus || "",
  );

  const saveDispatch = async (
    overrideStatus?: "WAITING" | "REQUESTED" | "DISPATCHED" | "DELIVERED",
    openWhatsapp = false,
  ) => {
    const targetStatus = overrideStatus || status;
    setBusy(true);
    try {
      const { data } = await api.put(
        `/storefront/admin/orders/${order.id}/dispatch-99`,
        {
          status: targetStatus,
          vehicleType,
          courierName: courierName.trim() || null,
          vehiclePlate: vehiclePlate.trim().toUpperCase() || null,
          trackingUrl: trackingUrl.trim() || null,
          confirmationPin: confirmationPin.trim() || null,
        },
      );
      setStatus(targetStatus);
      toast.success("Despacho 99 Entregas atualizado!");
      await onUpdated(data?.order);
      if (openWhatsapp && data?.customerTrackingWhatsappUrl) {
        window.open(
          data.customerTrackingWhatsappUrl,
          "_blank",
          "noopener,noreferrer",
        );
      }
    } catch (err) {
      toast.error(apiError(err, "Erro ao atualizar despacho 99."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-brand bg-page p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-on-brand font-extrabold text-xs">
            99
          </span>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-ink">
              Central de Despacho 99 Entregas
            </h4>
            <p className="text-[11px] text-muted">
              {order.expressQuote?.distanceKm
                ? `Rota ~${Number(order.expressQuote.distanceKm)
                    .toFixed(1)
                    .replace(".", ",")} km · `
                : ""}
              Frete:{" "}
              <strong className="text-brand">
                {Number(order.deliveryFee || 0) === 0
                  ? "Grátis"
                  : money(Number(order.deliveryFee || 0))}
              </strong>
            </p>
          </div>
        </div>

        <a
          href="https://empresas.99app.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink hover:border-brand"
        >
          <span>Abrir 99 Empresas</span>
          <ExternalLink size={12} className="text-brand" />
        </a>
      </div>

      {/* Cópia rápida de endereços */}
      <div className="rounded-xl border border-line bg-surface p-3 space-y-2 text-xs">
        {originAddressLine && (
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-line">
            <span className="truncate text-muted">
              <strong className="text-ink">Origem:</strong> {originAddressLine}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(originAddressLine);
                toast.success("Endereço da loja copiado!");
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-bold text-ink cursor-pointer shrink-0"
            >
              <Copy size={11} />
              <span>Copiar</span>
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink font-semibold">
            <strong className="text-brand">Destino:</strong>{" "}
            {order.dropoffCopyLine ||
              [
                order.addressLine,
                order.addressNumber,
                order.neighborhood,
                order.city,
              ]
                .filter(Boolean)
                .join(", ")}
          </span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(order.dropoffCopyLine || "");
              toast.success("Endereço do cliente copiado!");
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-support border border-brand px-2.5 py-1 text-[11px] font-bold text-brand cursor-pointer shrink-0"
          >
            <Copy size={11} />
            <span>Copiar Destino</span>
          </button>
        </div>
      </div>

      {!isTerminalCancelled && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { id: "WAITING", label: "Na Loja" },
                { id: "REQUESTED", label: "Chamando 99" },
                { id: "DISPATCHED", label: "99 a Caminho" },
                { id: "DELIVERED", label: "Entregue" },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                disabled={busy}
                onClick={() => void saveDispatch(st.id, false)}
                className={`py-2 px-2 rounded-xl border text-[11px] font-extrabold transition cursor-pointer ${
                  status === st.id
                    ? "bg-brand border-brand text-on-brand"
                    : "bg-surface border-line text-ink hover:border-brand"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-muted block mb-1">
                Modalidade
              </label>
              <select
                value={vehicleType}
                onChange={(e) =>
                  setVehicleType(
                    e.target.value === "CARRO" ? "CARRO" : "MOTO",
                  )
                }
                className="w-full p-2 rounded-xl border border-line bg-surface text-xs font-bold text-ink"
              >
                <option value="MOTO">99Entrega Moto</option>
                <option value="CARRO">99Entrega Carro</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted block mb-1">
                Nome do Entregador
              </label>
              <input
                type="text"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="Ex.: Carlos"
                className="w-full p-2 rounded-xl border border-line bg-surface text-xs text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted block mb-1">
                Placa & PIN
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  maxLength={8}
                  value={vehiclePlate}
                  onChange={(e) =>
                    setVehiclePlate(e.target.value.toUpperCase())
                  }
                  placeholder="ABC1D23"
                  className="w-full p-2 rounded-xl border border-line bg-surface text-xs font-mono uppercase text-ink"
                />
                <span className="inline-flex items-center gap-1 rounded-xl border border-brand bg-support px-2 text-xs font-mono font-extrabold text-brand shrink-0">
                  <ShieldCheck size={12} />
                  {confirmationPin || "----"}
                </span>
              </div>
            </div>
            <div className="sm:col-span-3">
              <label className="text-[11px] font-bold text-muted block mb-1">
                Link de Rastreio da Corrida na 99 (https://...)
              </label>
              <input
                type="url"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://..."
                className="w-full p-2 rounded-xl border border-line bg-surface text-xs text-ink"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveDispatch(status, false)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-bold text-ink hover:border-brand cursor-pointer"
            >
              <CheckCircle2 size={14} className="text-brand" />
              <span>Salvar Dados 99</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveDispatch("DISPATCHED", true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand px-4 py-2 text-xs font-extrabold cursor-pointer"
            >
              <MessageCircle size={14} />
              <span>Despachar 99 & Enviar Rastreio + PIN no WhatsApp</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
