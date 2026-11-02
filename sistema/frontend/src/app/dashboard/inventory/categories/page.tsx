"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus,
  Edit3,
  Trash2,
  Tag,
  ArrowLeft,
  Search,
  CheckCircle2,
  EyeOff,
  Sparkles,
  Layers,
  X,
  Check,
  Wand2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PdvLojistaLoader, RetailSelect } from "@/components/ui";
import {
  CATEGORY_ICON_OPTIONS,
  CategoryIconBadge,
  CategoryIconPicker,
  getCategoryIconDefinition,
  getSuggestedCategoryName,
  resolveCategoryIconId,
  saveCategoryIconPreference,
  syncCategoriesIconsToStorage,
} from "@/components/CategoryIcons";

type StatusFilter = "all" | "active" | "inactive" | "store" | "bonus";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [taxGroups, setTaxGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [active, setActive] = useState<boolean>(true);
  const [grupoTributacaoId, setGrupoTributacaoId] = useState("");
  const [keepOpenForNext, setKeepOpenForNext] = useState(false);
  const [savingModal, setSavingModal] = useState(false);

  const fetchCategories = () => {
    setLoading(true);
    api
      .get("/categories")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        syncCategoriesIconsToStorage(list);
        setCategories(
          list.map((cat: any) => ({
            ...cat,
            active: cat.active !== false,
          }))
        );
      })
      .catch(() => toast.error("Erro ao carregar categorias"))
      .finally(() => setLoading(false));
  };

  const fetchTaxGroups = () => {
    api
      .get("/tributacao")
      .then((res) => setTaxGroups(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchCategories();
    fetchTaxGroups();
  }, []);

  // KPI metrics
  const stats = useMemo(() => {
    const total = categories.length;
    const activeCount = categories.filter((c) => c.active !== false).length;
    const inactiveCount = total - activeCount;
    const totalGroups = categories.reduce(
      (sum, c) => sum + Number(c._count?.retailGroups ?? 0),
      0
    );
    const totalProducts = categories.reduce(
      (sum, c) => sum + Number(c._count?.products ?? 0),
      0
    );
    return { total, activeCount, inactiveCount, totalGroups, totalProducts };
  }, [categories]);

  // Existing icon/name lookup for quick templates
  const createdNamesSet = useMemo(() => {
    return new Set(
      categories.map((c) => String(c.name || "").trim().toLowerCase())
    );
  }, [categories]);

  const missingTemplates = useMemo(() => {
    return CATEGORY_ICON_OPTIONS.filter((opt) => {
      const suggested = getSuggestedCategoryName(opt.id).toLowerCase();
      return !createdNamesSet.has(suggested);
    });
  }, [createdNamesSet]);

  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const resolvedIconId = resolveCategoryIconId({
        explicitIcon: cat.icon,
        categoryId: cat.id,
        categoryName: cat.name,
      });
      const iconDef = getCategoryIconDefinition(resolvedIconId);
      const isActive = cat.active !== false;

      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;
      if (statusFilter === "store" && iconDef.group !== "category") return false;
      if (statusFilter === "bonus" && iconDef.group !== "bonus") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${cat.name || ""} ${iconDef.label} ${iconDef.shortLabel} ${cat.grupoTributacao?.nome || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [categories, statusFilter, searchQuery]);

  const openCreateModal = (presetIconId?: string) => {
    setEditingCategory(null);
    if (presetIconId) {
      setIcon(presetIconId);
      setName(getSuggestedCategoryName(presetIconId));
    } else if (missingTemplates.length > 0) {
      const next = missingTemplates[0];
      setIcon(next.id);
      setName("");
    } else {
      setIcon("camiseta");
      setName("");
    }
    setActive(true);
    setGrupoTributacaoId("");
    setIsModalOpen(true);
  };

  const openEditModal = (cat: any) => {
    setEditingCategory(cat);
    setName(cat.name);
    setIcon(
      cat.icon ||
        resolveCategoryIconId({
          explicitIcon: cat.icon,
          categoryId: cat.id,
          categoryName: cat.name,
        })
    );
    setActive(cat.active !== false);
    setGrupoTributacaoId(cat.grupoTributacaoId || "");
    setIsModalOpen(true);
  };

  const handleToggleActive = async (cat: any) => {
    const nextActive = cat.active === false;
    setTogglingId(cat.id);
    // Optimistic update
    setCategories((prev) =>
      prev.map((item) =>
        item.id === cat.id ? { ...item, active: nextActive } : item
      )
    );
    try {
      await api.patch(`/categories/${cat.id}`, {
        name: cat.name,
        icon: cat.icon,
        active: nextActive,
      });
      toast.success(
        nextActive
          ? `Categoria "${cat.name}" ativada no PDV.`
          : `Categoria "${cat.name}" ocultada do PDV.`
      );
    } catch (err: any) {
      // Revert on failure
      setCategories((prev) =>
        prev.map((item) =>
          item.id === cat.id ? { ...item, active: !nextActive } : item
        )
      );
      toast.error(
        err.response?.data?.message || "Não foi possível alterar o status."
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleBulkStatus = async (targetActive: boolean) => {
    const ids = filteredCategories.map((c) => c.id);
    if (!ids.length) return;
    setBulkLoading(true);
    try {
      await api.post("/categories/bulk-status", {
        ids,
        active: targetActive,
      });
      setCategories((prev) =>
        prev.map((c) => (ids.includes(c.id) ? { ...c, active: targetActive } : c))
      );
      toast.success(
        targetActive
          ? `${ids.length} categoria(s) ativada(s) no PDV!`
          : `${ids.length} categoria(s) desativada(s) no PDV!`
      );
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Erro ao atualizar status em lote."
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const handlePopulateShowcase = async () => {
    setBulkLoading(true);
    try {
      const res = await api.post("/categories/populate-showcase", {
        minPerCategory: 10,
      });
      const data = res.data || {};
      toast.success(
        `Catálogo completo! ${data.categoriesCreated || 0} novas categorias e ${
          data.groupsCreated || 0
        } grupos criados (mínimo 10 por categoria).`
      );
      fetchCategories();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          "Não foi possível completar o catálogo automaticamente."
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Informe o nome da categoria.");
      return;
    }
    setSavingModal(true);
    try {
      const payload = {
        name: trimmedName,
        icon: icon || null,
        active,
        grupoTributacaoId: grupoTributacaoId || null,
      };

      if (editingCategory) {
        const res = await api.patch(
          `/categories/${editingCategory.id}`,
          payload
        );
        saveCategoryIconPreference(
          editingCategory.id,
          icon,
          res.data?.name || trimmedName
        );
        toast.success(`Categoria "${trimmedName}" atualizada!`);
        setIsModalOpen(false);
        setEditingCategory(null);
      } else {
        const res = await api.post("/categories", payload);
        saveCategoryIconPreference(
          res.data?.id || trimmedName,
          icon,
          res.data?.name || trimmedName
        );
        toast.success(`Categoria "${trimmedName}" criada com sucesso!`);

        if (keepOpenForNext) {
          // Prepare next missing icon automatically
          const nextTemplate = CATEGORY_ICON_OPTIONS.find((opt) => {
            const suggested = getSuggestedCategoryName(opt.id).toLowerCase();
            return (
              suggested !== trimmedName.toLowerCase() &&
              !createdNamesSet.has(suggested)
            );
          });
          setName(nextTemplate ? getSuggestedCategoryName(nextTemplate.id) : "");
          setIcon(nextTemplate ? nextTemplate.id : null);
          setActive(true);
        } else {
          setIsModalOpen(false);
          setName("");
          setIcon(null);
          setGrupoTributacaoId("");
        }
      }
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erro ao salvar categoria");
    } finally {
      setSavingModal(false);
    }
  };

  const handleDelete = async (cat: any) => {
    if (
      !confirm(
        `Deseja realmente excluir a categoria "${cat.name}"? Dica: você também pode apenas desativá-la para ocultá-la do PDV.`
      )
    )
      return;
    try {
      await api.delete(`/categories/${cat.id}`);
      toast.success("Categoria excluída!");
      fetchCategories();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          "Não é possível excluir categoria com produtos vinculados. Use a chave Ativa/Inativa para ocultá-la."
      );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      {/* Cabeçalho Principal */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link
            to="/estoque"
            className="text-muted hover:text-brand inline-flex items-center gap-2 text-sm font-semibold mb-2 transition-colors"
          >
            <ArrowLeft size={16} /> Voltar ao Catálogo de Mercadorias
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-ink flex items-center gap-3">
            <Tag className="text-brand" /> Estúdio de Categorias & Ícones
          </h1>
          <p className="text-muted text-sm mt-1">
            Gerencie as 28 categorias visuais da loja, ative ou oculte pílulas de
            filtro no PDV em 1 clique e vincule regras fiscais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={bulkLoading}
            onClick={handlePopulateShowcase}
            className="bg-support hover:bg-surface text-brand border border-brand px-4 py-3 rounded-xl font-extrabold flex items-center gap-2 transition-all text-xs sm:text-sm disabled:opacity-60"
            title="Cria todas as 28 categorias de ícones e completa até ter no mínimo 10 grupos de produtos em cada uma"
          >
            <Wand2 size={17} />
            Completar 28 Categorias (10+ Itens)
          </button>

          <button
            type="button"
            onClick={() => openCreateModal()}
            className="bg-brand hover:bg-brand text-on-brand px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95 text-sm hover:text-on-brand"
          >
            <Plus size={18} />
            Nova Categoria
          </button>
        </div>
      </div>

      {/* Cards de Indicadores (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-page border border-line rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted block">
              Total Cadastradas
            </span>
            <strong className="text-2xl font-black text-ink mt-1 block">
              {stats.total}{" "}
              <span className="text-xs font-bold text-muted">
                / {CATEGORY_ICON_OPTIONS.length} ícones
              </span>
            </strong>
          </div>
          <div className="w-11 h-11 rounded-xl bg-support border border-line flex items-center justify-center text-brand">
            <Tag size={20} />
          </div>
        </div>

        <div className="bg-page border border-line rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted block">
              Ativas no PDV
            </span>
            <strong className="text-2xl font-black text-brand mt-1 block">
              {stats.activeCount}{" "}
              <span className="text-xs font-bold text-muted">visíveis</span>
            </strong>
          </div>
          <div className="w-11 h-11 rounded-xl bg-support border border-line flex items-center justify-center text-brand">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-page border border-line rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted block">
              Inativas / Ocultas
            </span>
            <strong className="text-2xl font-black text-ink mt-1 block">
              {stats.inactiveCount}{" "}
              <span className="text-xs font-bold text-muted">pausadas</span>
            </strong>
          </div>
          <div className="w-11 h-11 rounded-xl bg-surface border border-line flex items-center justify-center text-muted">
            <EyeOff size={20} />
          </div>
        </div>

        <div className="bg-page border border-line rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted block">
              Mercadorias Vinculadas
            </span>
            <strong className="text-2xl font-black text-ink mt-1 block">
              {stats.totalGroups}{" "}
              <span className="text-xs font-bold text-muted">
                grupos ({stats.totalProducts} var.)
              </span>
            </strong>
          </div>
          <div className="w-11 h-11 rounded-xl bg-support border border-line flex items-center justify-center text-brand">
            <Layers size={20} />
          </div>
        </div>
      </div>

      {/* Barra de Atalhos Rápidos quando ainda faltam categorias dos 28 ícones */}
      {missingTemplates.length > 0 && (
        <div className="bg-page border border-line rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-brand" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-brand">
                Sugestões de Categorias Disponíveis ({missingTemplates.length}{" "}
                restantes)
              </span>
            </div>
            <span className="text-xs text-muted font-medium">
              Clique em um ícone abaixo para abrir o estúdio já preenchido:
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {missingTemplates.map((tpl) => {
              const suggested = getSuggestedCategoryName(tpl.id);
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => openCreateModal(tpl.id)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-line bg-surface hover:border-brand hover:bg-support text-ink text-xs font-bold shrink-0 transition-colors"
                >
                  <CategoryIconBadge iconId={tpl.id} size={18} />
                  <span>+ {suggested}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra de Filtros, Busca e Ações em Lote */}
      <div className="bg-page border border-line rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all" as const, label: `Todas (${categories.length})` },
            {
              id: "active" as const,
              label: `Ativas (${stats.activeCount})`,
            },
            {
              id: "inactive" as const,
              label: `Inativas (${stats.inactiveCount})`,
            },
            { id: "store" as const, label: "Linha Loja" },
            { id: "bonus" as const, label: "Ícones Bônus" },
          ].map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors border ${
                  isSelected
                    ? "bg-brand text-on-brand border-brand"
                    : "bg-surface text-muted border-line hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[230px] flex-1 sm:flex-initial">
            <Search
              size={15}
              className="text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar categoria ou ícone..."
              className="w-full bg-surface border border-line rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-ink focus:outline-none focus:border-brand"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={bulkLoading || filteredCategories.length === 0}
            onClick={() => handleBulkStatus(true)}
            className="px-3 py-2 rounded-xl border border-line bg-surface hover:bg-support hover:text-brand text-ink text-xs font-bold transition-colors disabled:opacity-50"
          >
            Ativar todas
          </button>
          <button
            type="button"
            disabled={bulkLoading || filteredCategories.length === 0}
            onClick={() => handleBulkStatus(false)}
            className="px-3 py-2 rounded-xl border border-line bg-surface hover:bg-support hover:text-brand text-muted text-xs font-bold transition-colors disabled:opacity-50"
          >
            Pausar listadas
          </button>
        </div>
      </div>

      {/* Tabela de Categorias */}
      <div className="bg-page border border-line rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="flex justify-center p-10">
            <PdvLojistaLoader
              mode="loader"
              size={48}
              label="Carregando categorias…"
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface text-muted text-xs border-b border-line">
                <tr>
                  <th className="px-6 py-4 font-extrabold uppercase tracking-wider">
                    Categoria & Ícone no PDV
                  </th>
                  <th className="px-6 py-4 font-extrabold uppercase tracking-wider">
                    Volume no Catálogo
                  </th>
                  <th className="px-6 py-4 font-extrabold uppercase tracking-wider">
                    Status no PDV (Ativar / Desativar)
                  </th>
                  <th className="px-6 py-4 font-extrabold uppercase tracking-wider">
                    Tributação Padrão (NFC-e)
                  </th>
                  <th className="px-6 py-4 font-extrabold uppercase tracking-wider text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredCategories.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted">
                      Nenhuma categoria encontrada para o filtro selecionado.
                    </td>
                  </tr>
                )}
                {filteredCategories.map((cat) => {
                  const resolvedIconId = resolveCategoryIconId({
                    explicitIcon: cat.icon,
                    categoryId: cat.id,
                    categoryName: cat.name,
                  });
                  const iconDef = getCategoryIconDefinition(resolvedIconId);
                  const isActive = cat.active !== false;
                  const groupCount = Number(cat._count?.retailGroups ?? 0);
                  const productCount = Number(cat._count?.products ?? 0);

                  return (
                    <tr
                      key={cat.id}
                      className={`hover:bg-surface transition-colors ${
                        isActive ? "" : "opacity-75"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                              isActive
                                ? "border-brand bg-support"
                                : "border-line bg-surface"
                            }`}
                            title={`Ícone: ${iconDef.label}`}
                          >
                            <CategoryIconBadge
                              iconId={cat.icon}
                              categoryId={cat.id}
                              categoryName={cat.name}
                              size={30}
                            />
                          </div>
                          <div>
                            <div className="font-extrabold text-ink text-base leading-tight flex items-center gap-2">
                              <span>{cat.name}</span>
                              {!isActive && (
                                <span className="px-2 py-0.5 rounded-full bg-surface border border-line text-muted text-[10px] font-extrabold uppercase">
                                  Oculta
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted font-semibold mt-1 flex items-center gap-1.5">
                              <span>{iconDef.label}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                  iconDef.group === "bonus"
                                    ? "bg-support text-brand border border-brand"
                                    : "bg-surface text-muted border border-line"
                                }`}
                              >
                                {iconDef.group === "bonus" ? "Bônus" : "Loja"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="inline-flex flex-col">
                          <span className="text-sm font-extrabold text-ink">
                            {groupCount} {groupCount === 1 ? "grupo" : "grupos"}
                          </span>
                          <span className="text-xs text-muted font-semibold">
                            {productCount}{" "}
                            {productCount === 1 ? "variação" : "variações"}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <button
                          type="button"
                          disabled={togglingId === cat.id}
                          onClick={() => handleToggleActive(cat)}
                          role="switch"
                          aria-checked={isActive}
                          className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border text-xs font-extrabold transition-all cursor-pointer ${
                            isActive
                              ? "bg-support border-brand text-brand"
                              : "bg-surface border-line text-muted hover:text-ink"
                          }`}
                          title={
                            isActive
                              ? "Clique para desativar e ocultar esta categoria no PDV"
                              : "Clique para ativar e exibir esta categoria no PDV"
                          }
                        >
                          <span
                            className={`w-8 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                              isActive ? "bg-brand justify-end" : "bg-line justify-start"
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-page block shadow-sm" />
                          </span>
                          <span className="flex items-center gap-1">
                            {isActive ? (
                              <>
                                <CheckCircle2 size={13} />
                                Ativa no PDV
                              </>
                            ) : (
                              <>
                                <EyeOff size={13} />
                                Inativa
                              </>
                            )}
                          </span>
                        </button>
                      </td>

                      <td className="px-6 py-4 text-muted">
                        {cat.grupoTributacao ? (
                          <span className="bg-support border border-brand text-brand px-3 py-1 rounded-full text-xs font-semibold">
                            {cat.grupoTributacao.nome}
                          </span>
                        ) : (
                          <span className="text-muted text-xs">
                            Padrão do produto
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(cat)}
                          className="p-2 text-muted hover:text-brand hover:bg-support rounded-lg transition-colors inline-block"
                          data-tooltip="Abrir no Estúdio de Categoria"
                          aria-label="Editar categoria"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat)}
                          className="p-2 text-muted hover:text-brand hover:bg-support rounded-lg transition-colors inline-block"
                          data-tooltip="Excluir categoria"
                          aria-label="Excluir categoria"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Expandido: Estúdio de Categoria (2 Colunas) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="bg-page border border-line rounded-3xl w-full max-w-5xl shadow-2xl animate-in zoom-in-95 duration-200 my-auto max-h-[94vh] flex flex-col overflow-hidden">
            {/* Cabeçalho do Modal */}
            <div className="px-6 py-4 border-b border-line bg-surface flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-support border border-brand flex items-center justify-center shrink-0">
                  <CategoryIconBadge
                    iconId={icon}
                    categoryName={name || "Camisetas"}
                    size={30}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-support text-brand">
                      Estúdio de Categoria
                    </span>
                    <span className="text-xs font-bold text-muted">
                      {editingCategory
                        ? `Editando #${String(editingCategory.id).slice(0, 6)}`
                        : "Criação Visual Rápida"}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-ink mt-0.5">
                    {editingCategory
                      ? `Editar Categoria: ${editingCategory.name}`
                      : "Criar Nova Categoria da Loja"}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 rounded-xl border border-line bg-page hover:bg-support text-muted hover:text-brand flex items-center justify-center transition-colors"
                aria-label="Fechar modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corpo do Estúdio em 2 Colunas */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-6"
            >
              {/* Barra Superior de Modelos Rápidos (28 Categorias do Catálogo) */}
              <div className="bg-surface border border-line rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-brand flex items-center gap-1.5">
                    <Sparkles size={14} />
                    Preenchimento em 1 Clique · 28 Categorias Oficiais da Loja
                  </span>
                  <span className="text-xs text-muted font-semibold">
                    Clique em qualquer modelo para preencher nome + ícone automaticamente
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5">
                  {CATEGORY_ICON_OPTIONS.map((opt) => {
                    const suggested = getSuggestedCategoryName(opt.id);
                    const alreadyExists = createdNamesSet.has(
                      suggested.toLowerCase()
                    );
                    const isCurrent =
                      icon === opt.id &&
                      name.trim().toLowerCase() === suggested.toLowerCase();

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setIcon(opt.id);
                          setName(suggested);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 transition-all ${
                          isCurrent
                            ? "bg-brand text-on-brand border-brand shadow-sm"
                            : alreadyExists
                            ? "bg-page text-muted border-line hover:border-brand"
                            : "bg-support text-brand border-brand hover:bg-brand hover:text-on-brand"
                        }`}
                        title={
                          alreadyExists
                            ? `${suggested} (já cadastrada na loja)`
                            : `Usar modelo: ${suggested}`
                        }
                      >
                        <span className="w-5 h-5 rounded-full bg-page flex items-center justify-center shrink-0">
                          <CategoryIconBadge iconId={opt.id} size={13} />
                        </span>
                        <span>{suggested}</span>
                        {alreadyExists && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Coluna Esquerda (5 cols): Identidade, Status Ativa/Inativa e Fiscal */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Campo Nome */}
                  <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-muted block">
                      1. Nome da Categoria
                    </label>
                    <input
                      autoFocus
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-page border border-line rounded-xl px-4 py-3 text-ink font-bold text-base focus:outline-none focus:border-brand transition-colors"
                      placeholder="Ex: Camisas, Vestidos, Óculos, Linha Premium..."
                    />
                    <p className="text-xs text-muted leading-relaxed">
                      Este nome aparece nas pílulas de filtro rápido do PDV e nos
                      cards de mercadorias.
                    </p>
                  </div>

                  {/* Seletor de Status (Enable / Disable) */}
                  <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-muted block">
                        2. Disponibilidade no PDV (Ativar / Desativar)
                      </label>
                      <span className="text-[11px] font-extrabold text-brand">
                        {active ? "Visível no Caixa" : "Oculta no Caixa"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setActive(true)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                          active
                            ? "bg-support border-brand text-ink shadow-sm"
                            : "bg-page border-line text-muted hover:text-ink"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-brand flex items-center gap-1.5">
                            <CheckCircle2 size={15} />
                            Ativa no PDV
                          </span>
                          {active && (
                            <span className="w-2 h-2 rounded-full bg-brand" />
                          )}
                        </div>
                        <span className="text-[11px] text-muted leading-snug">
                          Exibe o filtro e seus produtos normalmente na tela de
                          vendas.
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActive(false)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                          !active
                            ? "bg-support border-brand text-ink shadow-sm"
                            : "bg-page border-line text-muted hover:text-ink"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-ink flex items-center gap-1.5">
                            <EyeOff size={15} />
                            Inativa / Oculta
                          </span>
                          {!active && (
                            <span className="w-2 h-2 rounded-full bg-brand" />
                          )}
                        </div>
                        <span className="text-[11px] text-muted leading-snug">
                          Oculta a categoria no PDV sem apagar nenhum produto.
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Tributação Padrão */}
                  <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-muted block">
                      3. Tributação Padrão NFC-e (Opcional)
                    </label>
                    <RetailSelect
                      value={grupoTributacaoId}
                      onValueChange={setGrupoTributacaoId}
                      options={[
                        {
                          value: "",
                          label: "Nenhuma (Usa imposto individual do produto)",
                        },
                        ...taxGroups.map((group) => ({
                          value: group.id,
                          label: `${group.nome} (CFOP ${group.cfop} - ${
                            group.csosn
                              ? `CSOSN ${group.csosn}`
                              : `CST ${group.cstIcms}`
                          })`,
                        })),
                      ]}
                    />
                    <p className="text-xs text-muted leading-relaxed pt-1">
                      Produtos vinculados a esta categoria sem regra fiscal
                      própria herdam automaticamente este grupo tributário.
                    </p>
                  </div>

                  {/* Opção de Criação em Sequência */}
                  {!editingCategory && (
                    <label className="bg-surface border border-line rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer hover:border-brand transition-colors">
                      <input
                        type="checkbox"
                        checked={keepOpenForNext}
                        onChange={(e) => setKeepOpenForNext(e.target.checked)}
                        className="w-4 h-4 accent-[var(--pdv-primary)] rounded"
                      />
                      <div className="text-xs">
                        <span className="font-extrabold text-ink block">
                          Modo criação em sequência
                        </span>
                        <span className="text-muted">
                          Manter o estúdio aberto após salvar e avançar para a
                          próxima categoria sugerida.
                        </span>
                      </div>
                    </label>
                  )}
                </div>

                {/* Coluna Direita (7 cols): Seletor Visual de Ícones e Preview Duplo */}
                <div className="lg:col-span-7">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-muted">
                      4. Escolha o Ícone Oficial (18 Categorias + 10 Ícones Bônus)
                    </label>
                    <span className="text-xs font-bold text-brand">
                      Clique em um ícone para aplicar
                    </span>
                  </div>
                  <CategoryIconPicker
                    value={icon}
                    categoryName={name}
                    onChange={setIcon}
                    categoryActive={active}
                    onSuggestName={(suggested) => setName(suggested)}
                  />
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted font-semibold">
                  {editingCategory
                    ? "As alterações de ícone e status entram em vigor imediatamente no PDV."
                    : "Dica: Use as sugestões no topo do modal para preencher nome e ícone com 1 clique."}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-line bg-surface text-muted hover:text-ink font-bold text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingModal}
                    className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand text-on-brand font-extrabold text-sm transition-all shadow-lg disabled:opacity-60 hover:text-on-brand"
                  >
                    {savingModal
                      ? "Salvando..."
                      : editingCategory
                      ? "Salvar Alterações"
                      : keepOpenForNext
                      ? "Salvar e Criar Próxima"
                      : "Criar Categoria"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
