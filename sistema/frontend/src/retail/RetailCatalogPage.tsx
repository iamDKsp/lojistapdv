import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Package, Pencil, RefreshCw, Tag } from "lucide-react";
import { api } from "@/lib/api";
import { getFullUrl } from "@/lib/getFullUrl";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";
import {
  CategoryIconBadge,
  CategoryIconIllustration,
} from "@/components/CategoryIcons";
import { RetailSwitch } from "@/components/ui/Switch";
import { RetailGroupEditor } from "./RetailGroupEditor";
import { apiError, money, type RetailGroup } from "./types";

export function RetailCatalogPage() {
  const [groups, setGroups] = useState<RetailGroup[]>([]);
  const [search, setSearch] = useState("");
  const [inactive, setInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, lastPage: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<RetailGroup | null | undefined>(
    undefined,
  );
  const [ungrouped, setUngrouped] = useState<any[] | null>(null);
  const [sourceProduct, setSourceProduct] = useState<any>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/retail/groups", {
          params: { page, limit: 30, search, inactive },
          signal,
        });
        if (!signal?.aborted) {
          setGroups(res.data.data);
          setMeta(res.data.meta);
        }
      } catch (err) {
        if (!signal?.aborted) setError(apiError(err));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, search, inactive],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [load]);

  return (
    <>
      <div className="retail-page-header">
        <div>
          <h1>Mercadorias e grades</h1>
          <p>
            Uma foto e um preço por grupo. Estoque separado por tamanho e cor.
          </p>
        </div>
        <button
          type="button"
          className="retail-button retail-button-primary"
          onClick={() => {
            setSourceProduct(null);
            setEditor(null);
          }}
        >
          <Plus size={18} />
          Novo grupo
        </button>
      </div>
      <div className="retail-row" style={{ marginBottom: 16 }}>
        <Link to="/estoque/categorias" className="retail-button">
          <Tag size={16} />
          Categorias e ícones
        </Link>
        <button
          type="button"
          className="retail-button"
          onClick={async () => {
            try {
              const res = await api.get("/retail/ungrouped", {
                params: { search },
              });
              setUngrouped(res.data);
            } catch (err) {
              setError(apiError(err));
            }
          }}
        >
          Ver itens importados sem grupo
        </button>
        {ungrouped !== null && (
          <button
            type="button"
            className="retail-button"
            onClick={() => setUngrouped(null)}
          >
            Voltar aos grupos
          </button>
        )}
      </div>
      {ungrouped !== null && (
        <div className="retail-panel" style={{ marginBottom: 20 }}>
          <h2>Itens sem grupo · até 200 resultados</h2>
          <p className="retail-muted">
            Organize os itens importados sem duplicar seus saldos ou histórico.
            Use a busca antes de abrir a lista para filtrar por nome.
          </p>
          {ungrouped.map((item) => (
            <div className="retail-payment-line" key={item.id}>
              <span>
                {item.name} · {Number(item.stock)} peças
              </span>
              <button
                type="button"
                className="retail-button"
                onClick={() => {
                  setSourceProduct(item);
                  setEditor(null);
                }}
              >
                Organizar grade
              </button>
            </div>
          ))}
          {!ungrouped.length && (
            <p className="retail-muted">Nenhum item sem grupo encontrado.</p>
          )}
        </div>
      )}
      <div className="retail-toolbar">
        <label className="retail-search">
          <Search size={18} />
          <span className="sr-only">Buscar grupo, tamanho, cor ou código</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar grupo, tamanho, cor ou código"
          />
        </label>
        <RetailSwitch
          checked={inactive}
          onCheckedChange={(checked) => {
            setInactive(checked);
            setPage(1);
          }}
          label="Mostrar inativos"
        />
        <button
          type="button"
          className="retail-icon-button"
          aria-label="Atualizar catálogo"
          data-tooltip="Atualizar catálogo"
          onClick={() => void load()}
        >
          <RefreshCw size={17} />
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
            label="Carregando mercadorias…"
          />
        </div>
      ) : groups.length ? (
        <>
          <div className="retail-table-wrap">
            <table className="retail-table retail-table-cards">
              <thead>
                <tr>
                  <th>Grupo de mercadorias</th>
                  <th>Grade</th>
                  <th>Saldo ativo</th>
                  <th>Preço</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id}>
                    <td data-label="Grupo" className="retail-cell-primary">
                      <div className="retail-product-title">
                        {group.imageUrl ? (
                          <img src={getFullUrl(group.imageUrl)} alt="" />
                        ) : (
                          <span className="retail-product-image-empty" style={{ overflow: "hidden", padding: 0 }}>
                            <CategoryIconIllustration
                              compact
                              iconId={group.category?.icon}
                              categoryId={group.categoryId}
                              categoryName={group.category?.name}
                              productName={group.name}
                            />
                          </span>
                        )}
                        <div>
                          <strong>{group.name}</strong>
                          <small style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            {group.category && (
                              <CategoryIconBadge
                                iconId={group.category.icon}
                                categoryId={group.categoryId}
                                categoryName={group.category.name}
                                size={14}
                              />
                            )}
                            {group.category?.name}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Grade">{group.variants.length} variações</td>
                    <td data-label="Saldo ativo" className="retail-number">
                      {group.stock}
                    </td>
                    <td data-label="Preço" className="retail-number">
                      {money(group.priceSell)}
                    </td>
                    <td data-label="Situação">
                      <span className="retail-badge">
                        {group.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td data-label="Ações" className="retail-cell-actions">
                      <button
                        type="button"
                        className="retail-icon-button"
                        aria-label={`Editar ${group.name}`}
                        data-tooltip={`Editar ${group.name}`}
                        onClick={() => setEditor(group)}
                      >
                        <Pencil size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="retail-row retail-spread" style={{ marginTop: 16 }}>
            <span className="retail-muted">
              {meta.total} grupos · página {page} de{" "}
              {Math.max(1, meta.lastPage)}
            </span>
            <div className="retail-row">
              <button
                type="button"
                className="retail-button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </button>
              <button
                type="button"
                className="retail-button"
                disabled={page >= meta.lastPage}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      ) : (
        !error && (
          <div className="retail-empty">
            <Package size={40} />
            <h2>
              {search
                ? "Nenhum grupo encontrado"
                : "Comece pelo primeiro grupo"}
            </h2>
            <p>
              {search
                ? "Tente outro nome, tamanho, cor ou código."
                : "Cadastre “Camiseta Peruana” e organize os saldos na grade de tamanhos e cores."}
            </p>
            {!search && (
              <button
                type="button"
                className="retail-button retail-button-primary"
                onClick={() => setEditor(null)}
              >
                Cadastrar primeiro grupo
              </button>
            )}
          </div>
        )
      )}
      {editor !== undefined && (
        <RetailGroupEditor
          group={editor}
          sourceProduct={sourceProduct}
          onClose={() => {
            setEditor(undefined);
            setSourceProduct(null);
          }}
          onSaved={() => {
            setEditor(undefined);
            setUngrouped(null);
            setSourceProduct(null);
            void load();
          }}
        />
      )}
    </>
  );
}
