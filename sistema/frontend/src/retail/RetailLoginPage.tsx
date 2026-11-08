import React, { memo, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Store,
  Monitor,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import PdvLojistaLoader, {
  triggerSessionEntryTransition,
  TRANSITION_UNVEIL_EVENT,
} from "@/components/PdvLojistaLoader";
import {
  HomeDeliveryMotoboyIllustration,
  ONBOARDING_SLIDES,
  RetailMobileLogin,
} from "./RetailMobileLogin";
import { DemoLeadModal } from "./DemoLeadModal";
import { apiError } from "./types";

/**
 * Cabeçalho de marca memoizado no topo esquerdo da coluna de login (Regra 2A):
 * aguarda a cortina de abertura revelar a tela (active=true), executa a animação
 * da logo completa uma única vez e mantém a assinatura estática visível sem
 * reiniciar ao digitar, focar campos ou validar dados.
 */
const LoginBrandIntro = memo(function LoginBrandIntro({
  active,
}: {
  active: boolean;
}) {
  return (
    <div className="retail-login-brandbar retail-login-stagger" style={{ "--stagger": 0 } as React.CSSProperties}>
      <PdvLojistaLoader
        mode="full-logo"
        size={56}
        active={active}
        label="PDV Lojista"
      />
    </div>
  );
});

const STORE_MOVEMENT_ROWS = [
  {
    tag: "CP",
    item: "Camiseta Peruana · Grade P/M/G",
    origin: "Balcão Principal",
    status: "Concluída",
    amount: "R$ 1.497,00",
  },
  {
    tag: "TC",
    item: "Tênis Casual · Numeração 36–41",
    origin: "Loja Centro",
    status: "Concluída",
    amount: "R$ 2.598,00",
  },
  {
    tag: "BA",
    item: "Boné Aba Curva · Troca de Peça",
    origin: "Crédito Cliente",
    status: "Crédito Ativo",
    amount: "R$ 159,60",
  },
  {
    tag: "RC",
    item: "Relógio & Carteira · Kit Loja",
    origin: "Balcão Rápido",
    status: "Concluída",
    amount: "R$ 897,00",
  },
] as const;

function formatSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `00:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const SHOWCASE_SLIDE_INTERVAL_MS = 5000;
const TOTAL_SHOWCASE_SLIDES = 1 + ONBOARDING_SLIDES.length;

/**
 * Painel institucional direito memoizado: preserva animações contínuas,
 * contagem progressiva dos indicadores, carrossel automático em loop a cada 5s
 * percorrendo o painel de vendas + todos os 9 slides da versão mobile e efeito
 * parallax suave sem sofrer re-renderizações enquanto o operador digita no formulário.
 */
const LoginShowcasePanel = memo(function LoginShowcasePanel({
  isUnveiled,
}: {
  isUnveiled: boolean;
}) {
  const showcaseRef = useRef<HTMLElement | null>(null);
  const [countProgress, setCountProgress] = useState(0);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [hasCycledOnce, setHasCycledOnce] = useState(false);

  useEffect(() => {
    if (!isUnveiled) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      setCountProgress(1);
      return;
    }

    let rafId = 0;
    const duration = 1350;
    const startTime = performance.now() + 180;

    const step = (now: number) => {
      if (now < startTime) {
        rafId = requestAnimationFrame(step);
        return;
      }
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // easeOutQuart para desaceleração suave e prazerosa
      const eased = 1 - Math.pow(1 - t, 4);
      setCountProgress(eased);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isUnveiled]);

  useEffect(() => {
    if (!isUnveiled || activeSlideIndex !== 0) return;
    const intervalId = window.setInterval(() => {
      setActiveRowIndex((prev) => (prev + 1) % STORE_MOVEMENT_ROWS.length);
    }, 3200);
    return () => window.clearInterval(intervalId);
  }, [isUnveiled, activeSlideIndex]);

  useEffect(() => {
    if (!isUnveiled) return;
    const timerId = window.setTimeout(() => {
      setHasCycledOnce(true);
      setActiveSlideIndex((prev) => (prev + 1) % TOTAL_SHOWCASE_SLIDES);
    }, SHOWCASE_SLIDE_INTERVAL_MS);
    return () => window.clearTimeout(timerId);
  }, [isUnveiled, activeSlideIndex]);

  function handleSelectSlide(nextIndex: number) {
    setHasCycledOnce(true);
    setActiveSlideIndex(
      ((nextIndex % TOTAL_SHOWCASE_SLIDES) + TOTAL_SHOWCASE_SLIDES) %
        TOTAL_SHOWCASE_SLIDES,
    );
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const el = showcaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    el.style.setProperty("--px", nx.toFixed(3));
    el.style.setProperty("--py", ny.toFixed(3));
  }

  function handlePointerLeave() {
    const el = showcaseRef.current;
    if (!el) return;
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
  }

  const salesTotal = Math.round(189374 * countProgress).toLocaleString("pt-BR");
  const counterPace = formatSeconds(Math.round(90 * countProgress));
  const dailyTurnover = Math.round(25684 * countProgress).toLocaleString("pt-BR");
  const totalPieces = Math.round(6248 * countProgress).toLocaleString("pt-BR");
  const catShoes = Math.round(2490 * countProgress).toLocaleString("pt-BR");
  const catShirts = Math.round(2180 * countProgress).toLocaleString("pt-BR");
  const catCaps = Math.round(1578 * countProgress).toLocaleString("pt-BR");

  const mobileSlide =
    activeSlideIndex > 0 ? ONBOARDING_SLIDES[activeSlideIndex - 1] : null;
  const SlideIllustration = mobileSlide?.Illustration ?? null;

  return (
    <aside
      ref={showcaseRef}
      className="retail-login-showcase"
      aria-label="Painel de gestão e módulos para comércios locais"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="retail-login-mosaic" aria-hidden="true">
        <div className="retail-login-mosaic-shape is-tl" />
        <div className="retail-login-mosaic-shape is-tc" />
        <div className="retail-login-mosaic-shape is-tr" />
        <div className="retail-login-mosaic-shape is-mr" />
        <div className="retail-login-mosaic-shape is-bl" />
        <div className="retail-login-mosaic-shape is-br-dotted" />
      </div>

      <div className="retail-login-showcase-inner">
        {activeSlideIndex === 0 || !mobileSlide ? (
          <div
            key="showcase-overview"
            className={`retail-login-showcase-slide ${hasCycledOnce ? "is-cycled" : ""}`}
          >
            <div className="retail-login-showcase-copy">
              <span className="retail-login-showcase-badge">
                PAINEL DO COMÉRCIO • GIRO AO VIVO
              </span>
              <h2>
                Gerencie sua equipe e o ritmo do seu comércio local sem esforço.
              </h2>
              <p>
                Entre para acessar o painel da sua loja, controlar grades por
                tamanho e cor e atender o balcão com agilidade.
              </p>
            </div>

            <div className="retail-login-mockup-stage" aria-hidden="true">
              {/* Card Principal do Painel */}
              <div className="retail-login-mockup-main">
                <div className="retail-login-mockup-top">
                  {/* Bloco Roxo de Vendas do Comércio */}
                  <div className="retail-login-metric-primary">
                    <div>
                      <div className="retail-login-metric-head">
                        <span>Vendas no Balcão</span>
                        <span className="retail-login-metric-dots">•••</span>
                      </div>
                      <small style={{ fontSize: "8.5px", opacity: 0.82 }}>
                        Total do comércio no mês
                      </small>
                    </div>
                    <strong className="retail-number">R$ {salesTotal}</strong>
                    <div className="retail-login-metric-foot">
                      <span className="retail-login-metric-pill">+18,4%</span>
                      <span>vs. mês anterior</span>
                    </div>
                  </div>

                  {/* Coluna Central: Atendimento de Balcão + Gráfico de Giro */}
                  <div className="retail-login-metric-center">
                    <div>
                      <div className="retail-login-mini-row">
                        <span>Ritmo do Balcão</span>
                        <span>Mensal ▾</span>
                      </div>
                      <div className="retail-login-time-val retail-number">
                        {counterPace}
                      </div>
                    </div>

                    <div className="retail-login-chart-row">
                      <div className="retail-login-profit-block">
                        <small>Giro Diário</small>
                        <strong className="retail-number">
                          R$ {dailyTurnover}
                        </strong>
                        <span>+12,8% na loja</span>
                      </div>

                      <div className="retail-login-spark-wrap">
                        <svg
                          width="86"
                          height="48"
                          viewBox="0 0 108 52"
                          fill="none"
                          className="retail-login-spark-svg"
                        >
                          <path
                            className="retail-login-spark-area"
                            d="M4 42 C 20 38, 26 24, 40 28 C 54 32, 62 16, 78 20 C 90 22, 96 10, 104 8 L 104 48 L 4 48 Z"
                            fill="var(--pdv-support)"
                          />
                          <path
                            className="retail-login-spark-line"
                            pathLength={100}
                            d="M4 42 C 20 38, 26 24, 40 28 C 54 32, 62 16, 78 20 C 90 22, 96 10, 104 8"
                            stroke="var(--pdv-primary)"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          />
                          <circle
                            className="retail-login-spark-dot is-d1"
                            cx="40"
                            cy="28"
                            r="2.8"
                            fill="var(--pdv-primary)"
                          />
                          <circle
                            className="retail-login-spark-dot is-d2"
                            cx="78"
                            cy="20"
                            r="2.8"
                            fill="var(--pdv-primary)"
                          />
                          <circle
                            className="retail-login-spark-pulse"
                            cx="104"
                            cy="8"
                            r="6"
                            fill="var(--pdv-primary)"
                          />
                          <circle
                            className="retail-login-spark-dot is-d3"
                            cx="104"
                            cy="8"
                            r="3.2"
                            fill="var(--pdv-primary-hover)"
                          />
                        </svg>
                        <div className="retail-login-vert-bar" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabela Inferior: Movimento de Mercadorias */}
                <div className="retail-login-mockup-table">
                  <div className="retail-login-mockup-table-head">
                    <span>Movimento de Mercadorias na Loja</span>
                    <SlidersHorizontal size={12} />
                  </div>

                  {STORE_MOVEMENT_ROWS.map((row, idx) => (
                    <div
                      className={`retail-login-tx-row ${activeRowIndex === idx ? "is-live-row" : ""}`}
                      style={{ "--row-index": idx } as React.CSSProperties}
                      key={row.item}
                      onPointerEnter={() => setActiveRowIndex(idx)}
                    >
                      <span className="retail-login-tx-item">
                        <span className="retail-login-tx-dot">{row.tag}</span>
                        <span>{row.item}</span>
                      </span>
                      <span>{row.origin}</span>
                      <span>
                        <span className="retail-login-tx-status">
                          {row.status}
                        </span>
                      </span>
                      <span className="retail-login-tx-amount retail-number">
                        {row.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Flutuante Lateral: Giro por Categoria na Grade */}
              <div className="retail-login-mockup-floating">
                <div className="retail-login-mini-row">
                  <strong style={{ color: "var(--pdv-text)", fontSize: "10px" }}>
                    Categorias da Loja
                  </strong>
                  <span>Mensal ▾</span>
                </div>

                <div className="retail-login-gauge-box">
                  <svg width="136" height="78" viewBox="0 0 136 78" fill="none">
                    {/* Segmento 1 — Calçados */}
                    <path
                      className="retail-login-gauge-arc is-arc-1"
                      pathLength={100}
                      d="M 16 66 A 52 52 0 0 1 44 21"
                      stroke="var(--pdv-primary-hover)"
                      strokeWidth="13"
                      strokeLinecap="round"
                    />
                    {/* Segmento 2 — Camisetas */}
                    <path
                      className="retail-login-gauge-arc is-arc-2"
                      pathLength={100}
                      d="M 59 15 A 52 52 0 0 1 95 21"
                      stroke="var(--pdv-primary)"
                      strokeWidth="13"
                      strokeLinecap="round"
                    />
                    {/* Segmento 3 — Acessórios */}
                    <path
                      className="retail-login-gauge-arc is-arc-3"
                      pathLength={100}
                      d="M 107 31 A 52 52 0 0 1 120 66"
                      stroke="var(--pdv-support)"
                      strokeWidth="13"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="retail-login-gauge-value">
                    <strong className="retail-number">
                      {totalPieces} Peças
                    </strong>
                    <small>Giro nas grades</small>
                  </div>
                </div>

                <div className="retail-login-legend">
                  <div className="retail-login-legend-item">
                    <span className="retail-login-legend-label">
                      <span className="retail-login-legend-swatch is-dark" />
                      Calçados e Tênis
                    </span>
                    <span className="retail-number">{catShoes} un.</span>
                  </div>
                  <div className="retail-login-legend-item">
                    <span className="retail-login-legend-label">
                      <span className="retail-login-legend-swatch" />
                      Camisetas e Moda
                    </span>
                    <span className="retail-number">{catShirts} un.</span>
                  </div>
                  <div className="retail-login-legend-item">
                    <span className="retail-login-legend-label">
                      <span className="retail-login-legend-swatch is-light" />
                      Bonés e Acessórios
                    </span>
                    <span className="retail-number">{catCaps} un.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            key={`showcase-slide-${mobileSlide.id}`}
            className="retail-login-showcase-slide is-module-slide"
          >
            <div className="retail-login-showcase-copy is-module-copy">
              <span className="retail-login-showcase-badge">
                {mobileSlide.badge}
              </span>
              <h2>{mobileSlide.title.replace("\n", " ")}</h2>
              <p>{mobileSlide.description}</p>
            </div>

            <div className="retail-login-module-stage" aria-hidden="true">
              <div className="retail-login-module-card">
                <div className="retail-login-module-card-head">
                  <span className="retail-login-module-card-tag">
                    <span className="retail-login-module-card-dot" />
                    <span>{mobileSlide.badge}</span>
                  </span>
                  <span className="retail-login-module-card-pill">
                    Ecossistema PDV Lojista
                  </span>
                </div>
                <div
                  className={`retail-login-module-card-body ${
                    mobileSlide.id === "home-delivery" ? "is-motoboy-body" : ""
                  }`}
                >
                  {mobileSlide.id === "home-delivery" ? (
                    <HomeDeliveryMotoboyIllustration stepDurationSec={0.95} />
                  ) : (
                    SlideIllustration && <SlideIllustration />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Barra Inferior de Loop Contínuo (5 em 5 segundos) */}
        <div
          className="retail-login-carousel-bar"
          role="region"
          aria-label="Navegação de módulos em destaque"
        >
          <div className="retail-login-carousel-dots" role="tablist">
            {Array.from({ length: TOTAL_SHOWCASE_SLIDES }).map((_, idx) => {
              const isActive = activeSlideIndex === idx;
              const label =
                idx === 0
                  ? "Painel de Vendas e Giro"
                  : ONBOARDING_SLIDES[idx - 1].title.replace("\n", " ");
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Slide ${idx + 1}: ${label}`}
                  className={`retail-login-carousel-dot ${isActive ? "is-active" : ""}`}
                  onClick={() => handleSelectSlide(idx)}
                >
                  {isActive && (
                    <span
                      key={`fill-${activeSlideIndex}`}
                      className="retail-login-carousel-dot-fill"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="retail-login-carousel-controls">
            <span className="retail-login-carousel-counter retail-number">
              {String(activeSlideIndex + 1).padStart(2, "0")} /{" "}
              {String(TOTAL_SHOWCASE_SLIDES).padStart(2, "0")}
            </span>
            <button
              type="button"
              className="retail-login-carousel-arrow"
              onClick={() => handleSelectSlide(activeSlideIndex - 1)}
              aria-label="Slide anterior"
            >
              <ChevronLeft size={14} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className="retail-login-carousel-arrow"
              onClick={() => handleSelectSlide(activeSlideIndex + 1)}
              aria-label="Próximo slide"
            >
              <ChevronRight size={14} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
});

export function RetailLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [helperNotice, setHelperNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [isUnveiled, setIsUnveiled] = useState(false);
  const [demoPulse, setDemoPulse] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(max-width: 768px)");
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };
    setIsMobileViewport(media.matches);
    media.addEventListener("change", handleMediaChange);
    return () => media.removeEventListener("change", handleMediaChange);
  }, []);

  useEffect(() => {
    const handleUnveil = () => {
      setIsUnveiled(true);
    };

    window.addEventListener(TRANSITION_UNVEIL_EVENT, handleUnveil);

    const hasActiveOverlay = Boolean(
      document.querySelector('[role="status"][aria-busy="true"]'),
    );
    const timer = window.setTimeout(
      () => setIsUnveiled(true),
      hasActiveOverlay ? 1480 : 40,
    );

    return () => {
      window.removeEventListener(TRANSITION_UNVEIL_EVENT, handleUnveil);
      window.clearTimeout(timer);
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setHelperNotice("");
    try {
      const res = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });
      login(res.data.access_token, res.data.user);
      triggerSessionEntryTransition();
      navigate(
        res.data.user.role === "superadmin"
          ? "/sys-init"
          : res.data.user.role === "stockist"
            ? "/estoque"
            : "/",
      );
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  function fillDemoStore() {
    setError("");
    setHelperNotice("");
    setDemoModalOpen(true);
  }

  useEffect(() => {
    if (!demoPulse) return;
    const t = window.setTimeout(() => setDemoPulse(false), 900);
    return () => window.clearTimeout(t);
  }, [demoPulse]);

  async function authenticateMobile(): Promise<{
    targetPath: string;
    userEmail: string;
  } | null> {
    setBusy(true);
    setError("");
    setHelperNotice("");
    try {
      const cleanEmail = email.trim();
      const res = await api.post("/auth/login", {
        email: cleanEmail,
        password,
      });
      login(res.data.access_token, res.data.user);
      const targetPath =
        res.data.user.role === "superadmin"
          ? "/sys-init"
          : res.data.user.role === "stockist"
            ? "/estoque"
            : "/";
      return {
        targetPath,
        userEmail: res.data.user?.email || cleanEmail,
      };
    } catch (err) {
      setError(apiError(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (isMobileViewport) {
    return (
      <>
        <RetailMobileLogin
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          rememberMe={rememberMe}
          setRememberMe={setRememberMe}
          busy={busy}
          error={error}
          helperNotice={helperNotice}
          setHelperNotice={setHelperNotice}
          demoPulse={demoPulse}
          onFillDemoStore={fillDemoStore}
          onAuthenticate={authenticateMobile}
          onNavigateTarget={(targetPath) => {
            navigate(targetPath);
          }}
        />
        <DemoLeadModal
          open={demoModalOpen}
          onClose={() => setDemoModalOpen(false)}
          onSuccessNavigate={(targetPath) => {
            setDemoModalOpen(false);
            navigate(targetPath);
          }}
        />
      </>
    );
  }

  return (
    <main className={`retail-login ${isUnveiled ? "is-ready" : "is-preparing"}`}>
      {/* Coluna Esquerda — Marca no topo, Formulário centralizado e Rodapé */}
      <div className="retail-login-left">
        <LoginBrandIntro active={isUnveiled} />

        <section className="retail-login-panel" aria-busy={busy}>
          <div
            className="retail-login-header-group retail-login-stagger"
            style={{ "--stagger": 1 } as React.CSSProperties}
          >
            <h1>Bem-vindo de volta</h1>
            <p className="retail-login-subtitle">
              Informe seu e-mail e senha para abrir o balcão e a gestão do seu
              comércio local.
            </p>
          </div>

          <form onSubmit={submit} autoComplete="off">
            <label
              className={`retail-login-field retail-login-stagger ${demoPulse ? "is-autofilled" : ""}`}
              style={{ "--stagger": 2 } as React.CSSProperties}
            >
              <span className="retail-login-field-label">E-mail</span>
              <div className="retail-login-input-wrap">
                <input
                  type="email"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  placeholder="atendimento@seucomercio.com.br"
                />
              </div>
            </label>

            <label
              className={`retail-login-field retail-login-stagger ${demoPulse ? "is-autofilled" : ""}`}
              style={{ "--stagger": 3 } as React.CSSProperties}
            >
              <span className="retail-login-field-label">Senha</span>
              <div className="retail-login-input-wrap">
                <input
                  type="text"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  placeholder="••••••••"
                  className={`has-Toggle ${showPassword ? "" : "pdv-secret-input"}`}
                />
                <button
                  type="button"
                  className="retail-login-eye-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  data-tooltip={
                    showPassword ? "Ocultar senha" : "Mostrar senha"
                  }
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <div
              className="retail-login-options retail-login-stagger"
              style={{ "--stagger": 4 } as React.CSSProperties}
            >
              <label className="retail-login-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={busy}
                />
                <span>Lembrar neste terminal</span>
              </label>

              <button
                type="button"
                className="retail-login-link-btn"
                onClick={() =>
                  setHelperNotice(
                    "Solicite a redefinição de senha ao responsável da loja ou à administração do comércio.",
                  )
                }
              >
                Esqueceu sua senha?
              </button>
            </div>

            {error && (
              <p className="retail-message retail-login-notice" role="alert">
                {error}
              </p>
            )}

            {helperNotice && !error && (
              <p className="retail-message retail-login-notice" role="status">
                {helperNotice}
              </p>
            )}

            <div
              className="retail-login-stagger"
              style={{ "--stagger": 5 } as React.CSSProperties}
            >
              <button
                type="submit"
                className={`retail-login-submit ${demoPulse ? "is-invited" : ""}`}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <PdvLojistaLoader
                      mode="loader"
                      compact
                      size={18}
                      label="Entrando na loja"
                    />
                    <span>Entrando…</span>
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </div>
          </form>

          <div
            className="retail-login-stagger"
            style={{ "--stagger": 6 } as React.CSSProperties}
          >
            <div className="retail-login-divider">
              <span>Ou acesse o comércio</span>
            </div>

            <div className="retail-login-quick-grid">
              <button
                type="button"
                className="retail-login-quick-btn"
                disabled={busy}
                onClick={fillDemoStore}
                data-tooltip="Preencher acesso da loja de demonstração"
              >
                <Store size={15} className="retail-login-QuickIcon" />
                <span>Loja Demonstração</span>
              </button>

              <button
                type="button"
                className="retail-login-quick-btn"
                disabled={busy}
                onClick={() => {
                  setHelperNotice(
                    "Após entrar com o e-mail da loja, cada atendente acessa o caixa rápido com seu PIN individual.",
                  );
                }}
                data-tooltip="Como funciona o acesso rápido de operadores"
              >
                <Monitor size={15} className="retail-login-QuickIcon" />
                <span>Caixa por PIN</span>
              </button>
            </div>

            <p className="retail-login-register">
              Ainda não informatizou seu comércio local?{" "}
              <button
                type="button"
                className="retail-login-link-btn"
                onClick={fillDemoStore}
              >
                Experimente agora.
              </button>
            </p>
          </div>
        </section>

        <footer
          className="retail-login-footer retail-login-stagger"
          style={{ "--stagger": 7 } as React.CSSProperties}
        >
          <span>Copyright © 2026 PDV Lojista · Comércios Locais.</span>
          <span>Termos e Privacidade</span>
        </footer>
      </div>

      {/* Coluna Direita — Painel Roxo Institucional e Prévia Animada do Comércio Local */}
      <LoginShowcasePanel isUnveiled={isUnveiled} />

      <DemoLeadModal
        open={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        onSuccessNavigate={(targetPath) => {
          setDemoModalOpen(false);
          navigate(targetPath);
        }}
      />
    </main>
  );
}
