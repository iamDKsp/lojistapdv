import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Phone,
  Sparkles,
  Store,
  User,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useOperatorTokenStore } from "@/store/operatorToken";
import PdvLojistaLoader, {
  triggerSessionEntryTransition,
} from "@/components/PdvLojistaLoader";
import { apiError } from "./types";

export interface DemoLeadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccessNavigate: (targetPath: string) => void;
}

export function normalizeWhatsappInput(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 11);
}

export function formatWhatsappMask(raw: string): string {
  const digits = normalizeWhatsappInput(raw);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function DemoLeadModal({
  open,
  onClose,
  onSuccessNavigate,
}: DemoLeadModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError("");
    setSubmitting(false);
    const timer = window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (step === 1) {
        nameInputRef.current?.focus();
      } else {
        phoneInputRef.current?.focus();
      }
    }, 50);
    return () => window.clearTimeout(timer);
  }, [step, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const trimmedName = name.trim();
  const normalizedPhone = normalizeWhatsappInput(whatsapp);
  const firstName = trimmedName.split(/\s+/)[0] || "Visitante";

  function handleStepOneSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (trimmedName.length < 2) {
      setError("Informe seu nome para continuar.");
      nameInputRef.current?.focus();
      return;
    }
    setStep(2);
  }

  async function handleStepTwoSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      setError("Informe um WhatsApp válido com DDD (10 ou 11 dígitos).");
      phoneInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/auth/demo-login", {
        name: trimmedName,
        whatsapp: normalizedPhone,
      });

      const { access_token, user, operator } = res.data || {};
      if (operator) {
        try {
          localStorage.setItem(
            "lojista-currentOperator",
            JSON.stringify({
              id: operator.id,
              name: operator.name,
              role: operator.role || operator.jobTitle || "Gerente de Loja",
              isManager: true,
              jobTitle: operator.jobTitle || "Gerente de Loja",
              active: true,
            }),
          );
          if (operator.operatorToken) {
            useOperatorTokenStore
              .getState()
              .setToken(operator.operatorToken, operator.id, user?.tenant);
          }
        } catch {
          // ignore localStorage failures
        }
      }

      login(access_token, {
        ...user,
        isDemo: true,
      });
      triggerSessionEntryTransition();
      onSuccessNavigate("/");
    } catch (err) {
      setError(apiError(err));
      setSubmitting(false);
    }
  }

  return (
    <div
      className="retail-demo-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="retail-demo-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="retail-demo-modal-card">
        {/* Faixa Superior Decorativa */}
        <div className="retail-demo-modal-glow" aria-hidden="true" />

        {/* Cabeçalho do Modal */}
        <div className="retail-demo-modal-head">
          <div className="retail-demo-modal-badge">
            <Store size={15} />
            <span>Loja Demonstração Interativa</span>
          </div>

          <button
            type="button"
            className="retail-demo-modal-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Indicador de Passos */}
        <div className="retail-demo-modal-steps" aria-label={`Etapa ${step} de 2`}>
          <div className={`retail-demo-step-bar ${step >= 1 ? "is-active" : ""}`} />
          <div className={`retail-demo-step-bar ${step >= 2 ? "is-active" : ""}`} />
          <span className="retail-demo-step-caption">Etapa {step} de 2</span>
        </div>

        {step === 1 ? (
          <form onSubmit={handleStepOneSubmit} className="retail-demo-modal-body">
            <div className="retail-demo-modal-copy">
              <h2 id="retail-demo-modal-title">Qual seu nome?</h2>
              <p>
                Preparamos um comércio completo com produtos, fotos, caixa
                aberto e financeiro alimentado para você testar livremente.
              </p>
            </div>

            <label className="retail-demo-field">
              <span className="retail-demo-field-label">Seu nome ou apelido</span>
              <div className="retail-demo-input-box">
                <User size={18} className="retail-demo-input-icon" />
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Ex.: Mariana Costa"
                  maxLength={80}
                  autoComplete="name"
                  required
                />
              </div>
            </label>

            {error && (
              <p className="retail-demo-error" role="alert">
                {error}
              </p>
            )}

            <div className="retail-demo-highlights" aria-hidden="true">
              <span>
                <CheckCircle2 size={13} /> Caixa e PDV prontos
              </span>
              <span>
                <CheckCircle2 size={13} /> Estoque com fotos
              </span>
              <span>
                <CheckCircle2 size={13} /> Todos os módulos liberados
              </span>
            </div>

            <div className="retail-demo-actions">
              <button type="submit" className="retail-demo-continue-btn">
                <span>Continuar</span>
                <ArrowRight size={17} />
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleStepTwoSubmit} className="retail-demo-modal-body">
            <div className="retail-demo-greeting-row">
              <span className="retail-demo-greeting-pill">
                <Sparkles size={13} />
                Olá, <strong>{firstName}</strong>
              </span>
              <button
                type="button"
                className="retail-demo-back-link"
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
                disabled={submitting}
              >
                <ArrowLeft size={14} />
                <span>Alterar nome</span>
              </button>
            </div>

            <div className="retail-demo-modal-copy">
              <h2 id="retail-demo-modal-title">Qual seu WhatsApp?</h2>
              <p>
                Informe seu número com DDD para liberar imediatamente o ambiente
                de demonstração. Você pode acessar quantas vezes quiser.
              </p>
            </div>

            <label className="retail-demo-field">
              <span className="retail-demo-field-label">WhatsApp com DDD</span>
              <div className="retail-demo-input-box">
                <Phone size={18} className="retail-demo-input-icon" />
                <input
                  ref={phoneInputRef}
                  type="tel"
                  inputMode="numeric"
                  value={formatWhatsappMask(whatsapp)}
                  onChange={(e) => {
                    setWhatsapp(normalizeWhatsappInput(e.target.value));
                    if (error) setError("");
                  }}
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                  disabled={submitting}
                  required
                />
              </div>
            </label>

            {error && (
              <p className="retail-demo-error" role="alert">
                {error}
              </p>
            )}

            <div className="retail-demo-actions">
              <button
                type="submit"
                className="retail-demo-continue-btn"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <PdvLojistaLoader
                      mode="loader"
                      compact
                      size={18}
                      label="Preparando Loja Demonstração"
                    />
                    <span>Abrindo Demonstração…</span>
                  </>
                ) : (
                  <>
                    <span>Continuar</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
export default DemoLeadModal;
