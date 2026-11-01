import { useEffect, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getFullUrl } from "@/lib/getFullUrl";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";
import {
  CategoryIconIllustration,
  CategoryIconPicker,
  saveCategoryIconPreference,
  syncCategoriesIconsToStorage,
} from "@/components/CategoryIcons";
import { RetailSelect } from "@/components/ui/Select";
import { RetailSwitch } from "@/components/ui/Switch";
import { RetailDialog } from "./RetailDialog";
import { apiError, type RetailGroup, type RetailVariant } from "./types";

export function RetailGroupEditor({
  group,
  sourceProduct,
  onClose,
  onSaved,
}: {
  group: RetailGroup | null;
  sourceProduct?: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = group || sourceProduct;
  const [form, setForm] = useState({
    name: initial?.name || "",
    categoryId: initial?.categoryId || "",
    priceSell: String(initial?.priceSell ?? ""),
    priceCost: String(initial?.priceCost ?? 0),
    imageUrl: initial?.imageUrl || "",
    ncm: initial?.ncm || "",
    cest: initial?.cest || "",
    origem: initial?.origem || 0,
    grupoTributacaoId: initial?.grupoTributacaoId || "",
    active: initial?.active ?? true,
  });
  const [variants, setVariants] = useState<RetailVariant[]>(
    group?.variants.map((v) => ({ ...v, stockToAdd: 0 })) || [
      {
        existingProductId: sourceProduct?.id,
        size: "Único",
        color: "Sortida",
        barcode: sourceProduct?.barcode || "",
        stock: sourceProduct?.stock || 0,
        stockToAdd: 0,
        active: true,
      },
    ],
  );
  const [categories, setCategories] = useState<{ id: string; name: string; icon?: string | null }[]>(
    [],
  );
  const [taxGroups, setTaxGroups] = useState<{ id: string; nome: string }[]>(
    [],
  );
  const [sizes, setSizes] = useState("P, M, G, GG");
  const [colors, setColors] = useState("Preta, Branca");
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState<string | null>(null);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [imageLinkOpen, setImageLinkOpen] = useState(false);
  const [imageLink, setImageLink] = useState(initial?.imageUrl || "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/categories")
      .then((res) => {
        if (active) {
          const list = Array.isArray(res.data) ? res.data : [];
          syncCategoriesIconsToStorage(list);
          setCategories(list);
        }
      })
      .catch((err) => {
        if (active) setError(apiError(err));
      });
    api
      .get("/tributacao")
      .then((res) => {
        if (active) setTaxGroups(res.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function update(index: number, key: keyof RetailVariant, value: any) {
    setVariants((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }

  function addMatrix() {
    const sizeList = [
      ...new Set(
        sizes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    const colorList = [
      ...new Set(
        colors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    if (
      !sizeList.length ||
      !colorList.length ||
      sizeList.length * colorList.length > 300
    ) {
      setError("Informe tamanhos e cores. A grade pode ter até 300 variações.");
      return;
    }
    const isPlaceholder =
      !group &&
      !sourceProduct &&
      variants.length === 1 &&
      variants[0].size === "Único" &&
      variants[0].color === "Sortida" &&
      !Number(variants[0].stockToAdd);
    const result = isPlaceholder ? [] : [...variants];
    for (const size of sizeList)
      for (const color of colorList)
        if (
          !result.some(
            (v) =>
              v.size.toLocaleUpperCase() === size.toLocaleUpperCase() &&
              v.color.toLocaleUpperCase() === color.toLocaleUpperCase(),
          )
        )
          result.push({
            size,
            color,
            barcode: "",
            stock: 0,
            stockToAdd: 0,
            active: true,
          });
    if (result.length > 300) {
      setError("A grade pode ter até 300 variações.");
      return;
    }
    setVariants(result);
    setError("");
  }

  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("A foto deve ter até 8 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const payload = new FormData();
      payload.append("file", file);
      const res = await api.post("/products/upload", payload);
      setForm((prev) => ({ ...prev, imageUrl: res.data.imageUrl }));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setUploading(false);
    }
  }

  async function createCategory() {
    const name = categoryName.trim();
    if (!name || busy) return;
    setError("");
    const existing = categories.find(
      (category) => category.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
    );
    if (existing) {
      setForm((prev) => ({ ...prev, categoryId: existing.id }));
      setCategoryName("");
      setCategoryEditorOpen(false);
      toast.success("Categoria existente selecionada.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post("/categories", { name, icon: categoryIcon || null });
      saveCategoryIconPreference(res.data?.id || name, categoryIcon, res.data?.name || name);
      setCategories((old) => [...old, res.data]);
      setForm((prev) => ({ ...prev, categoryId: res.data.id }));
      setCategoryName("");
      setCategoryIcon(null);
      setCategoryEditorOpen(false);
      toast.success("Categoria criada e selecionada.");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  function applyImageLink() {
    try {
      const value = imageLink.trim();
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || value.length > 2000) {
        throw new Error("invalid image URL");
      }
      setForm((prev) => ({ ...prev, imageUrl: url.href }));
      setImageLinkOpen(false);
      setError("");
    } catch {
      setError("Informe um link de foto válido, começando com https:// ou http://.");
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        priceSell: Number(form.priceSell),
        priceCost: Number(form.priceCost),
        version: group?.version,
        variants: variants.map((v) => ({
          id: v.id,
          existingProductId: v.existingProductId,
          size: v.size,
          color: v.color,
          barcode: v.barcode,
          stockToAdd: Number(v.stockToAdd || 0),
          active: v.active,
        })),
      };
      if (group) await api.put(`/retail/groups/${group.id}`, payload);
      else await api.post("/retail/groups", payload);
      toast.success(
        group ? "Grupo e grade atualizados." : "Grupo e grade cadastrados.",
      );
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <RetailDialog
      title={
        group ? "Editar grupo de mercadorias" : "Novo grupo de mercadorias"
      }
      onClose={onClose}
      wide
      busy={busy || uploading}
    >
      <form onSubmit={save}>
        <div className="retail-dialog-body" aria-busy={busy || uploading}>
          <div className="retail-upload">
            {form.imageUrl ? (
              <img
                src={getFullUrl(form.imageUrl)}
                alt="Foto compartilhada do grupo"
              />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", border: "1px solid var(--pdv-border)", flexShrink: 0 }}>
                <CategoryIconIllustration
                  compact
                  iconId={categories.find((c) => c.id === form.categoryId)?.icon}
                  categoryId={form.categoryId}
                  categoryName={categories.find((c) => c.id === form.categoryId)?.name}
                  productName={form.name}
                />
              </div>
            )}
            <div className="retail-stack">
              <label className="retail-button">
                {uploading ? (
                  <>
                    <PdvLojistaLoader
                      mode="loader"
                      compact
                      size={16}
                      label="Enviando foto"
                    />
                    <span>Enviando…</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    <span>Escolher foto do grupo</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  disabled={uploading || busy}
                  onChange={(event) => void upload(event.target.files?.[0])}
                />
              </label>
              <button
                type="button"
                className="retail-button"
                aria-expanded={imageLinkOpen}
                disabled={uploading || busy}
                onClick={() => {
                  setImageLink(form.imageUrl);
                  setImageLinkOpen((open) => !open);
                }}
              >
                Usar link de foto
              </button>
              {imageLinkOpen && (
                <div className="retail-stack">
                  <label className="retail-field">
                    Link da foto
                    <input
                      type="url"
                      maxLength={2000}
                      placeholder="https://exemplo.com/foto.jpg"
                      value={imageLink}
                      onChange={(event) => setImageLink(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          applyImageLink();
                        }
                      }}
                    />
                  </label>
                  <button type="button" className="retail-button" onClick={applyImageLink}>
                    Aplicar foto
                  </button>
                </div>
              )}
              <span className="retail-muted">
                Uma foto para todas as cores e tamanhos. As estampas podem
                variar.
              </span>
            </div>
            {form.imageUrl && (
              <button
                type="button"
                className="retail-icon-button"
                onClick={() => setForm((prev) => ({ ...prev, imageUrl: "" }))}
                aria-label="Remover foto"
                data-tooltip="Remover foto"
              >
                <Trash2 size={17} />
              </button>
            )}
          </div>
          <div className="retail-form-grid">
            <label className="retail-field">
              Nome do grupo
              <input
                aria-label="Nome do grupo"
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Camiseta Peruana"
              />
              <small>
                Use o nome que continua útil mesmo quando as estampas mudam.
              </small>
            </label>
            <div className="retail-field">
              <span>Categoria</span>
              <RetailSelect
                aria-label="Categoria"
                value={form.categoryId}
                onValueChange={(val) => setForm({ ...form, categoryId: val })}
                options={[
                  { value: "", label: "Selecione" },
                  ...categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                ]}
              />
              <button
                type="button"
                className="retail-button"
                aria-expanded={categoryEditorOpen || !categories.length}
                disabled={busy || uploading}
                onClick={() => setCategoryEditorOpen((open) => !open)}
              >
                <Plus size={16} aria-hidden="true" />
                Nova categoria
              </button>
              {(categoryEditorOpen || !categories.length) && (
                <div className="retail-message" style={{ display: "grid", gap: 10 }}>
                  <label className="retail-field">
                    Nome da nova categoria
                    <input
                      maxLength={120}
                      value={categoryName}
                      disabled={busy}
                      onChange={(event) => setCategoryName(event.target.value)}
                      placeholder="Ex.: Relógios, Óculos, Vestidos, Promoções..."
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void createCategory();
                        }
                      }}
                    />
                  </label>
                  <CategoryIconPicker
                    compact
                    value={categoryIcon}
                    categoryName={categoryName}
                    onChange={setCategoryIcon}
                  />
                  <div className="retail-row">
                    <button
                      type="button"
                      className="retail-button"
                      disabled={busy || !categoryName.trim()}
                      onClick={() => void createCategory()}
                    >
                      Criar categoria
                    </button>
                    {categories.length > 0 && (
                      <button
                        type="button"
                        className="retail-button"
                        disabled={busy}
                        onClick={() => {
                          setCategoryEditorOpen(false);
                          setCategoryName("");
                          setCategoryIcon(null);
                        }}
                      >
                        Cancelar nova categoria
                      </button>
                    )}
                  </div>
                  <small>A categoria e o ícone escolhido serão selecionados sem perder os dados do produto.</small>
                </div>
              )}
            </div>
            <label className="retail-field">
              Preço de venda compartilhado (R$)
              <input
                aria-label="Preço de venda compartilhado (R$)"
                required
                type="number"
                min="0"
                max="9999999"
                step=".01"
                value={form.priceSell}
                onChange={(e) =>
                  setForm({ ...form, priceSell: e.target.value })
                }
              />
            </label>
            <label className="retail-field">
              Custo das novas entradas (R$)
              <input
                required
                type="number"
                min="0"
                max="9999999"
                step=".0001"
                value={form.priceCost}
                onChange={(e) =>
                  setForm({ ...form, priceCost: e.target.value })
                }
              />
              <small>Entradas anteriores mantêm o custo dos seus lotes.</small>
            </label>
          </div>
          <div className="retail-section-heading">
            <h3>Grade por tamanho e cor</h3>
            <button
              type="button"
              className="retail-button"
              onClick={() =>
                setVariants((rows) => [
                  ...rows,
                  {
                    size: "",
                    color: "",
                    barcode: "",
                    stock: 0,
                    stockToAdd: 0,
                    active: true,
                  },
                ])
              }
              disabled={variants.length >= 300}
            >
              <Plus size={16} />
              Adicionar variação
            </button>
          </div>
          <div className="retail-form-grid">
            <label className="retail-field">
              Tamanhos separados por vírgula
              <input
                value={sizes}
                onChange={(e) => setSizes(e.target.value)}
                placeholder="P, M, G, GG ou 36, 37, 38"
              />
            </label>
            <label className="retail-field">
              Cores separadas por vírgula
              <input
                value={colors}
                onChange={(e) => setColors(e.target.value)}
                placeholder="Preta, Branca"
              />
            </label>
          </div>
          <button
            className="retail-button"
            type="button"
            onClick={addMatrix}
            style={{ marginTop: 12 }}
          >
            Gerar combinações
          </button>
          <p className="retail-muted">
            Cada linha tem seu próprio estoque. “Entrada” acrescenta peças ao
            saldo; não substitui o estoque atual.
          </p>
          <div className="retail-table-wrap">
            <table className="retail-table retail-matrix-table">
              <thead>
                <tr>
                  <th>Tamanho</th>
                  <th>Cor</th>
                  <th>Código de barras</th>
                  <th>Saldo</th>
                  <th>Entrada</th>
                  <th>Ativa</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, index) => (
                  <tr key={v.id || index}>
                    <td data-label="Tamanho">
                      <input
                        aria-label={`Tamanho da variação ${index + 1}`}
                        required
                        maxLength={40}
                        value={v.size}
                        onChange={(e) => update(index, "size", e.target.value)}
                      />
                    </td>
                    <td data-label="Cor">
                      <input
                        aria-label={`Cor da variação ${index + 1}`}
                        required
                        maxLength={60}
                        value={v.color}
                        onChange={(e) => update(index, "color", e.target.value)}
                      />
                    </td>
                    <td data-label="Código de barras">
                      <input
                        aria-label={`Código da variação ${index + 1}`}
                        maxLength={80}
                        value={v.barcode || ""}
                        onChange={(e) =>
                          update(index, "barcode", e.target.value)
                        }
                      />
                    </td>
                    <td data-label="Saldo" className="retail-number">
                      {Number(v.stock)}
                    </td>
                    <td data-label="Entrada (+)">
                      <input
                        aria-label={`Entrada da variação ${index + 1}`}
                        type="number"
                        min="0"
                        max="9999999"
                        step="1"
                        value={v.stockToAdd ?? 0}
                        onChange={(e) =>
                          update(index, "stockToAdd", e.target.value)
                        }
                      />
                    </td>
                    <td data-label="Ativa">
                      <RetailSwitch
                        aria-label={`Variação ${index + 1} ativa`}
                        checked={v.active}
                        onCheckedChange={(checked) =>
                          update(index, "active", checked)
                        }
                      />
                    </td>
                    <td data-label="Ações" className="retail-cell-actions">
                      {!v.id && (
                        <button
                          type="button"
                          className="retail-icon-button"
                          aria-label={`Remover variação ${index + 1}`}
                          data-tooltip="Remover variação"
                          onClick={() =>
                            setVariants((rows) =>
                              rows.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details style={{ marginTop: 20 }}>
            <summary>Dados fiscais do grupo</summary>
            <div className="retail-form-grid" style={{ marginTop: 16 }}>
              <label className="retail-field">
                NCM
                <input
                  pattern="[0-9]{8}"
                  maxLength={8}
                  value={form.ncm}
                  onChange={(e) => setForm({ ...form, ncm: e.target.value })}
                />
              </label>
              <label className="retail-field">
                CEST
                <input
                  pattern="[0-9]{7}"
                  maxLength={7}
                  value={form.cest}
                  onChange={(e) => setForm({ ...form, cest: e.target.value })}
                />
              </label>
              <div className="retail-field">
                <span>Origem</span>
                <RetailSelect
                  aria-label="Origem"
                  value={String(form.origem)}
                  onValueChange={(val) =>
                    setForm({ ...form, origem: Number(val) })
                  }
                  options={[
                    "Nacional",
                    "Estrangeira — importação direta",
                    "Estrangeira — mercado interno",
                    "Nacional — conteúdo importado acima de 40%",
                    "Nacional — processo produtivo básico",
                    "Nacional — conteúdo importado até 40%",
                    "Estrangeira sem similar — direta",
                    "Estrangeira sem similar — mercado interno",
                    "Nacional — conteúdo importado acima de 70%",
                  ].map((label, i) => ({
                    value: String(i),
                    label: `${i} · ${label}`,
                  }))}
                />
              </div>
              <div className="retail-field">
                <span>Grupo tributário</span>
                <RetailSelect
                  aria-label="Grupo tributário"
                  value={form.grupoTributacaoId}
                  onValueChange={(val) =>
                    setForm({ ...form, grupoTributacaoId: val })
                  }
                  options={[
                    { value: "", label: "Usar configuração da categoria" },
                    ...taxGroups.map((g) => ({
                      value: g.id,
                      label: g.nome,
                    })),
                  ]}
                />
              </div>
            </div>
          </details>
          <div style={{ marginTop: 20 }}>
            <RetailSwitch
              checked={form.active}
              onCheckedChange={(checked) =>
                setForm({ ...form, active: checked })
              }
              label="Grupo ativo no catálogo"
            />
          </div>
          {error && (
            <p role="alert" className="retail-message">
              {error}
            </p>
          )}
        </div>
        <footer className="retail-dialog-footer">
          <button
            type="button"
            className="retail-button"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="retail-button retail-button-primary"
            disabled={busy || uploading}
          >
            {busy ? (
              <>
                <PdvLojistaLoader
                  mode="loader"
                  compact
                  size={18}
                  label="Salvando grupo e grade"
                />
                <span>Salvando…</span>
              </>
            ) : (
              "Salvar grupo e grade"
            )}
          </button>
        </footer>
      </form>
    </RetailDialog>
  );
}
