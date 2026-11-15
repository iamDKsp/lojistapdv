import { useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { api } from "@/lib/api";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";
import { RetailSelect } from "@/components/ui/Select";
import { apiError, type Customer } from "./types";

export function CustomerPicker({
  value,
  onChange,
  required = false,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get("/customers")
      .then((res) => {
        if (active) setCustomers(res.data);
      })
      .catch((err) => {
        if (active) setError(apiError(err));
      });
    return () => {
      active = false;
    };
  }, []);

  async function create() {
    if (!name.trim() || phone.replace(/\D/g, "").length < 8) {
      setError("Informe nome e telefone do cliente.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/customers", {
        name: name.trim(),
        phone: phone.replace(/\D/g, ""),
      });
      setCustomers((rows) => [...rows, res.data]);
      onChange(res.data.id);
      setName("");
      setPhone("");
      setQuickCreateOpen(false);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="retail-customer-picker">
      <div className="retail-field">
        <div className="retail-field-head">
          <span>Cliente{required ? " (obrigatório)" : ""}</span>
          <button
            type="button"
            className={`retail-pill-toggle ${quickCreateOpen ? "is-open" : ""}`}
            disabled={disabled || busy}
            aria-expanded={quickCreateOpen}
            onClick={() => {
              setQuickCreateOpen((open) => !open);
              setError("");
            }}
          >
            {quickCreateOpen ? (
              <>
                <X size={13} aria-hidden="true" />
                <span>Fechar cadastro</span>
              </>
            ) : (
              <>
                <UserPlus size={13} aria-hidden="true" />
                <span>Cadastrar cliente</span>
              </>
            )}
          </button>
        </div>
        <RetailSelect
          aria-label={required ? "Cliente (obrigatório)" : "Cliente"}
          value={value}
          disabled={disabled || busy}
          searchable
          searchPlaceholder="Buscar por nome ou telefone..."
          onValueChange={onChange}
          options={[
            {
              value: "",
              label: required
                ? "Selecione o titular do crédito"
                : "Consumidor não identificado",
            },
            ...customers.map((c) => ({
              value: c.id,
              label: `${c.name} · ${c.phone}`,
              description: c.phone,
            })),
          ]}
        />
      </div>
      {quickCreateOpen && (
        <div className="retail-inline-drawer">
          <div className="retail-form-grid">
            <label className="retail-field">
              Nome
              <input
                disabled={disabled || busy}
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="retail-field">
              Telefone
              <input
                disabled={disabled || busy}
                type="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void create();
                  }
                }}
              />
            </label>
          </div>
          <div className="retail-inline-drawer-actions">
            <button
              type="button"
              className="retail-button retail-button-primary retail-drawer-submit"
              disabled={disabled || busy}
              onClick={() => void create()}
            >
              {busy ? (
                <>
                  <PdvLojistaLoader
                    mode="loader"
                    compact
                    size={16}
                    label="Cadastrando cliente"
                  />
                  <span>Cadastrando…</span>
                </>
              ) : (
                <>
                  <UserPlus size={15} aria-hidden="true" />
                  <span>Cadastrar e selecionar</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="retail-message">
          {error}
        </p>
      )}
    </div>
  );
}
