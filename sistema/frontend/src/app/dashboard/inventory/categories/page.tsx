"use client";
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Edit3, Trash2, Tag, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PdvLojistaLoader, RetailSelect } from '@/components/ui';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [taxGroups, setTaxGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [name, setName] = useState('');
  const [grupoTributacaoId, setGrupoTributacaoId] = useState('');

  const fetchCategories = () => {
    setLoading(true);
    api.get('/categories')
      .then(res => setCategories(res.data))
      .catch(() => toast.error('Erro ao carregar categorias'))
      .finally(() => setLoading(false));
  };

  const fetchTaxGroups = () => {
    api.get('/tributacao')
      .then(res => setTaxGroups(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchCategories();
    fetchTaxGroups();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name,
        grupoTributacaoId: grupoTributacaoId || null
      };

      if (editingCategory) {
        await api.patch(`/categories/${editingCategory.id}`, payload);
        toast.success('Categoria editada!');
      } else {
        await api.post('/categories', payload);
        toast.success('Categoria criada!');
      }
      setIsModalOpen(false);
      setName('');
      setGrupoTributacaoId('');
      setEditingCategory(null);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar categoria');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta categoria?')) return;
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Categoria excluída!');
      fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir (Pode haver produtos vinculados)');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link to="/dashboard/inventory" className="text-muted hover:text-brand flex items-center gap-2 text-sm font-semibold mb-2 transition-colors">
            <ArrowLeft size={16} /> Voltar ao Catálogo
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-ink flex items-center gap-3">
             <Tag className="text-brand" /> Categorias
          </h1>
          <p className="text-muted text-sm mt-1">Gerencie as categorias de produtos e vincule regras tributárias para NFC-e simplificada</p>
        </div>
        
        <button 
          onClick={() => { 
            setEditingCategory(null); 
            setName(''); 
            setGrupoTributacaoId('');
            setIsModalOpen(true); 
          }} 
          className="bg-brand hover:bg-brand text-on-brand px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95 text-sm hover:text-on-brand"
        >
          <Plus size={18} />
          Nova Categoria
        </button>
      </div>

      <div className="bg-page border border-line rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="flex justify-center p-10">
            <PdvLojistaLoader mode="loader" size={48} label="Carregando categorias…" />
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-page text-muted text-sm">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Nome da Categoria</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Tributação Padrão (NFC-e)</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {categories.length === 0 && (
                <tr><td colSpan={3} className="p-6 text-center text-muted">Nenhuma categoria cadastrada.</td></tr>
              )}
              {categories.map(cat => (
                <tr key={cat.id} className="hover:bg-surface transition-colors">
                  <td className="px-6 py-5 font-bold text-ink text-lg">
                    {cat.name}
                  </td>
                  <td className="px-6 py-5 text-muted">
                    {cat.grupoTributacao ? (
                      <span className="bg-support border border-brand text-brand px-3 py-1 rounded-full text-xs font-semibold">
                        {cat.grupoTributacao.nome}
                      </span>
                    ) : (
                      <span className="text-muted text-xs">Padrão do produto (Fallback)</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right space-x-2">
                    <button 
                      onClick={() => { 
                        setEditingCategory(cat); 
                        setName(cat.name); 
                        setGrupoTributacaoId(cat.grupoTributacaoId || '');
                        setIsModalOpen(true); 
                      }}
                      className="p-2 text-muted hover:text-brand hover:bg-support rounded-lg transition-colors inline-block"
                      data-tooltip="Editar categoria"
                      aria-label="Editar categoria"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(cat.id)}
                      className="p-2 text-muted hover:text-brand hover:bg-support rounded-lg transition-colors inline-block"
                      data-tooltip="Excluir categoria"
                      aria-label="Excluir categoria"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm">
          <div className="bg-page border border-line p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-ink mb-4">
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="text-sm font-semibold text-muted mb-1.5 block">Nome</label>
                <input 
                  autoFocus
                  required
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-page border border-line rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-brand transition-colors"
                  placeholder="Ex: Destilados"
                />
              </div>

              <div className="mb-4">
                <label className="text-sm font-semibold text-muted mb-1.5 block">Tributação Padrão NFC-e (Opcional)</label>
                <RetailSelect
                  value={grupoTributacaoId}
                  onValueChange={setGrupoTributacaoId}
                  options={[
                    { value: '', label: 'Nenhuma (Usa imposto do produto)' },
                    ...taxGroups.map((group) => ({
                      value: group.id,
                      label: `${group.nome} (CFOP ${group.cfop} - ${
                        group.csosn ? `CSOSN ${group.csosn}` : `CST ${group.cstIcms}`
                      })`,
                    })),
                  ]}
                />
                <p className="text-xs text-muted mt-2.5 leading-relaxed">
                   **Dica Fiscal:** Ao vincular um grupo aqui, todos os produtos dessa categoria sem tributação específica herdarão estas regras automaticamente. **Recomendamos fortemente confirmar com seu contador se as alíquotas configuradas estão corretas para a sua UF e regime fiscal.**
                </p>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-muted hover:bg-surface font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-brand hover:bg-brand text-on-brand font-bold transition-colors hover:text-on-brand"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
