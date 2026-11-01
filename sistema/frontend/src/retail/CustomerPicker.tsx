import { useEffect, useState } from "react";
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
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="retail-stack">
      <div className="retail-field">
        <span>Cliente{required ? " (obrigatório)" : ""}</span>
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
      <details>
        <summary className="retail-muted">Cadastrar cliente</summary>
        <div className="retail-form-grid" style={{ marginTop: 12 }}>
          <label className="retail-field">
            Nome
            <input
              disabled={disabled || busy}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="retail-field">
            Telefone
            <input
              disabled={disabled || busy}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="retail-button"
          disabled={disabled || busy}
          style={{ marginTop: 12 }}
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
            "Cadastrar e selecionar"
          )}
        </button>
      </details>
      {error && (
        <p role="alert" className="retail-message">
          {error}
        </p>
      )}
    </div>
  );
}
