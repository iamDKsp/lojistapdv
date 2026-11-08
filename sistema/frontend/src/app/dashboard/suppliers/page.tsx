'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Edit,
  Trash,
  Package,
  Search,
  Phone,
  Save,
  X,
  MapPin,
  Store,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { PdvLojistaLoader } from '@/components/ui';
import { SpWholesaleMapHub } from '@/components/suppliers/SpWholesaleMapHub';

export default function SuppliersPage() {
  const [activeView, setActiveView] = useState<'sp_hub' | 'local'>('sp_hub');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', whatsapp: '', cnpjCpf: '', email: '' });
  const [saving, setSaving] = useState(false);

  // Catalog State
  const [activeSupplier, setActiveSupplier] = useState<any>(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data } = await api.get('/suppliers');
      setSuppliers(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Erro ao carregar fornecedores.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editData) {
        await api.patch(`/suppliers/${editData.id}`, formData);
        toast.success('Fornecedor atualizado!');
      } else {
        await api.post('/suppliers', formData);
        toast.success('Fornecedor criado!');
      }
      setShowModal(false);
      fetchSuppliers();
    } catch {
      toast.error('Erro ao salvar fornecedor.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este fornecedor?')) return;
    try {
      await api.delete(`/suppliers/${id}`);
      toast.success('Fornecedor excluído.');
      fetchSuppliers();
      if (activeSupplier?.id === id) setActiveSupplier(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir fornecedor.');
    }
  };

  const normalize = (str: string) =>
    str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
  const filtered = suppliers.filter((s) => normalize(s.name).includes(normalize(search)));

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Page Header + View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink flex items-center gap-3">
            <Truck className="text-brand" /> Hub de Fornecedores & Atacado SP
          </h1>
          <p className="text-muted mt-1 text-sm">
            Explore fabricantes exclusivos do Brás, 25 de Março e Bom Retiro no mapa interativo ou gerencie seus fornecedores locais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-2xl border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => setActiveView('sp_hub')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all ${
                activeView === 'sp_hub'
                  ? 'bg-brand text-on-brand shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <MapPin size={15} />
              Mapa Atacado SP (Brás & 25 de Março)
            </button>
            <button
              type="button"
              onClick={() => setActiveView('local')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all ${
                activeView === 'local'
                  ? 'bg-brand text-on-brand shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Store size={15} />
              Meus Fornecedores ({suppliers.length})
            </button>
          </div>

          {activeView === 'local' && (
            <button
              onClick={() => {
                setEditData(null);
                setFormData({ name: '', whatsapp: '', cnpjCpf: '', email: '' });
                setShowModal(true);
              }}
              className="bg-brand hover:bg-brand-hover text-on-brand px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition"
            >
              <Plus size={16} /> Novo Fornecedor Local
            </button>
          )}
        </div>
      </div>

      {/* View 1: Interactive SP Wholesale Map Hub */}
      {activeView === 'sp_hub' ? (
        <SpWholesaleMapHub onSupplierImported={fetchSuppliers} />
      ) : (
        /* View 2: Local Tenant Suppliers & Product Catalog */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Lista de Fornecedores */}
          <div className="md:col-span-1 bg-page border border-line rounded-2xl overflow-hidden flex flex-col max-h-[700px]">
            <div className="p-4 border-b border-line bg-page/50">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Buscar fornecedor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-page border border-line rounded-xl pl-9 pr-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar p-2 space-y-1">
              {loading ? (
                <div className="flex justify-center py-8">
                  <PdvLojistaLoader mode="loader" size={40} label="Carregando fornecedores..." />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-muted p-4 text-sm">Nenhum fornecedor encontrado.</p>
              ) : (
                filtered.map((sup) => (
                  <div
                    key={sup.id}
                    onClick={() => setActiveSupplier(sup)}
                    className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between group ${
                      activeSupplier?.id === sup.id
                        ? 'bg-support border border-brand'
                        : 'hover:bg-surface/50 border border-transparent'
                    }`}
                  >
                    <div>
                      <strong
                        className={`block text-sm ${
                          activeSupplier?.id === sup.id ? 'text-brand' : 'text-ink'
                        }`}
                      >
                        {sup.name}
                      </strong>
                      <span className="text-xs text-muted flex items-center gap-1 mt-1">
                        <Phone size={10} /> {sup.whatsapp || 'Sem número'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditData(sup);
                          setFormData(sup);
                          setShowModal(true);
                        }}
                        className="p-1.5 text-muted hover:text-ink bg-surface rounded-lg"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(sup.id);
                        }}
                        className="p-1.5 text-muted hover:text-brand bg-surface rounded-lg"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Catálogo do Fornecedor */}
          <div className="md:col-span-2 bg-page border border-line rounded-2xl p-6">
            {activeSupplier ? (
              <SupplierCatalog supplier={activeSupplier} onUpdate={fetchSuppliers} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted opacity-50 py-16">
                <Truck size={48} className="mb-4" />
                <p>Selecione um fornecedor para ver seu catálogo.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
          <form
            onSubmit={handleSave}
            className="bg-page border border-line w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-5 border-b border-line flex justify-between items-center">
              <h2 className="font-bold text-ink">
                {editData ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">Nome *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-page border border-line rounded-xl px-4 py-2.5 text-sm text-ink"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">WhatsApp</label>
                <input
                  type="text"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="Ex: 11999999999"
                  className="w-full bg-page border border-line rounded-xl px-4 py-2.5 text-sm text-ink"
                />
              </div>
            </div>
            <div className="p-5 bg-page/50 border-t border-line">
              <button
                disabled={saving}
                type="submit"
                className="w-full bg-brand hover:bg-brand-hover text-on-brand py-3 rounded-xl font-bold flex justify-center items-center gap-2"
              >
                {saving ? (
                  <PdvLojistaLoader mode="loader" compact size={18} label="Salvando fornecedor" />
                ) : (
                  <Save size={18} />
                )}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SupplierCatalog({ supplier, onUpdate }: { supplier: any; onUpdate: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setSearch('');
    fetchCatalog();
  }, [supplier.id]);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const response = await api.get('/products?limit=2000');
      const productsList = response.data.data || response.data;
      setProducts(productsList);
    } catch {
      toast.error('Erro ao buscar produtos.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (product: any) => {
    setAdding(true);
    try {
      await api.post(`/suppliers/${supplier.id}/products`, { productId: product.id });
      toast.success('Produto adicionado ao catálogo do fornecedor!');
      onUpdate();
      setSearch('');
    } catch {
      toast.error('Erro ao adicionar produto.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (productId: string) => {
    if (!window.confirm('Remover produto deste fornecedor?')) return;
    try {
      await api.delete(`/suppliers/${supplier.id}/products/${productId}`);
      toast.success('Produto removido.');
      onUpdate();
    } catch {
      toast.error('Erro ao remover produto.');
    }
  };

  const catalog = supplier.products || [];

  const normalize = (str: string) =>
    str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
  const filteredProducts = products.filter((p: any) => {
    const searchTerms = normalize(search)
      .split(' ')
      .filter((t) => t.trim() !== '');
    if (searchTerms.length === 0) return false;
    const searchString = normalize(`${p.name} ${p.shortCode || ''}`);
    return searchTerms.every((term) => searchString.includes(term));
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-ink">{supplier.name}</h2>
          <p className="text-xs text-muted">Catálogo de produtos oferecidos</p>
        </div>
        <div className="bg-surface/50 px-3 py-1.5 rounded-lg text-xs font-bold text-muted">
          {catalog.length} Itens
        </div>
      </div>

      <div className="mb-6 relative">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Pesquisar produto do sistema para vincular..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-page border border-line rounded-xl px-4 py-3 text-sm text-ink"
          />
          <button className="bg-surface px-4 rounded-xl text-muted">
            <Search size={18} />
          </button>
        </div>

        {filteredProducts.length > 0 && search && (
          <div className="absolute top-full mt-2 w-full bg-surface border border-line rounded-xl shadow-2xl z-10 max-h-60 overflow-y-auto p-2 space-y-1">
            {filteredProducts.slice(0, 15).map((p) => {
              const alreadyHas = catalog.some((cp: any) => cp.productId === p.id);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 hover:bg-support/50 rounded-lg transition"
                >
                  <div>
                    <strong className="block text-sm text-muted flex items-center gap-2">
                      {p.imageUrl && (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-6 h-6 rounded object-cover bg-page"
                        />
                      )}
                      {p.name}
                    </strong>
                    <span className="text-xs text-muted">
                      Custo atual: R$ {Number(p.priceCost).toFixed(2)}
                    </span>
                  </div>
                  <button
                    disabled={alreadyHas || adding}
                    onClick={() => handleAdd(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      alreadyHas
                        ? 'bg-support text-brand'
                        : 'bg-brand hover:bg-brand-hover text-on-brand'
                    }`}
                  >
                    {alreadyHas ? 'Vinculado' : 'Vincular'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
        {catalog.length === 0 ? (
          <p className="text-center text-muted text-sm mt-10">Nenhum produto vinculado ainda.</p>
        ) : (
          catalog.map((sp: any) => (
            <div
              key={sp.id}
              className="flex items-center justify-between p-4 bg-page border border-line rounded-xl group hover:border-line transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-page flex items-center justify-center overflow-hidden">
                  {sp.product?.imageUrl ? (
                    <img
                      src={sp.product.imageUrl}
                      alt={sp.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={18} className="text-muted" />
                  )}
                </div>
                <div>
                  <strong className="block text-sm text-muted">{sp.product.name}</strong>
                  <span className="text-xs text-muted">
                    Custo atual no sistema: R$ {Number(sp.product.priceCost).toFixed(2)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleRemove(sp.productId)}
                className="text-muted hover:text-brand p-2 opacity-0 group-hover:opacity-100 transition"
              >
                <Trash size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
