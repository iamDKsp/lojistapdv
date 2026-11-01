'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  FileText, Plus, Pencil, Trash2, X, Save, ChevronDown, ChevronUp, CheckCircle, Download, Tag
} from 'lucide-react';
import { ExportXmlModal } from '@/components/ExportXmlModal';
import { PdvLojistaLoader, RetailSelect, RetailSwitch } from '@/components/ui';

interface Category {
  id: string;
  name: string;
  grupoTributacaoId?: string | null;
}

interface GrupoTributacao {
  id: string;
  nome: string;
  ativo: boolean;
  csosn?: string;
  cstIcms?: string;
  cfop: string;
  aliqIcms: number;
  redBcIcms: number;
  cstPis: string;
  aliqPis: number;
  cstCofins: string;
  aliqCofins: number;
  cstIpi?: string;
  aliqIpi: number;
  isPadrao?: boolean;
  categories?: Category[];
}

const EMPTY_FORM: Omit<GrupoTributacao, 'id'> = {
  nome: '', ativo: true,
  csosn: '102', cstIcms: '', cfop: '5102',
  aliqIcms: 0, redBcIcms: 0,
  cstPis: '99', aliqPis: 0,
  cstCofins: '99', aliqCofins: 0,
  cstIpi: '', aliqIpi: 0,
};

const CSOSN_OPTIONS = [
  { value: '102', label: '102 — SN sem crédito de ICMS' },
  { value: '400', label: '400 — SN — Isento de ICMS' },
  { value: '500', label: '500 — SN — ICMS cobrado anteriormente por ST' },
  { value: '900', label: '900 — SN — Outros' },
];
const CST_PIS_COFINS_OPTIONS = [
  { value: '99', label: '99 — SN (não informado)' },
  { value: '49', label: '49 — Outras Operações de Saída' },
  { value: '01', label: '01 — Tributado' },
  { value: '07', label: '07 — Isento' },
];

export default function TributacaoPage() {
  const [grupos, setGrupos] = useState<GrupoTributacao[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GrupoTributacao | null>(null);
  const [form, setForm] = useState<Omit<GrupoTributacao, 'id'>>(EMPTY_FORM);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/tributacao'),
      api.get('/categories')
    ])
      .then(([resGrupos, resCats]) => {
        setGrupos(resGrupos.data);
        setAllCategories(resCats.data);
      })
      .catch(() => toast.error('Erro ao carregar dados de tributação e categorias.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedCategoryIds([]);
    setModalOpen(true);
  };

  const openEdit = (g: GrupoTributacao) => {
    setEditing(g);
    const { id, categories, ...rest } = g;
    setForm(rest);
    setSelectedCategoryIds(categories?.map(c => c.id) || []);
    setModalOpen(true);
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const handleSave = async () => {
    if (!form.nome || !form.cfop) {
      toast.error('Nome e CFOP são obrigatórios.');
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      categoryIds: selectedCategoryIds,
    };
    try {
      if (editing) {
        await api.patch(`/tributacao/${editing.id}`, payload);
        toast.success('Grupo e vinculação de categorias atualizados!');
      } else {
        await api.post('/tributacao', payload);
        toast.success('Grupo criado com sucesso!');
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar grupo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g: GrupoTributacao) => {
    if (!confirm(`Remover "${g.nome}"? Produtos e categorias vinculados perderão o grupo.`)) return;
    try {
      await api.delete(`/tributacao/${g.id}`);
      toast.success('Grupo removido.');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao remover grupo.');
    }
  };

  const f = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const inputCls = 'w-full bg-page border border-line rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors text-sm';
  const labelCls = 'text-xs font-semibold text-muted mb-1 block uppercase tracking-wider';

  const [restoring, setRestoring] = useState(false);

  const handleRestoreDefaults = async () => {
    if (!confirm('Deseja restaurar os grupos tributários padrões? Isso criará os 10 grupos essenciais caso ainda não existam. Grupos customizados existentes não serão afetados.')) return;
    setRestoring(true);
    try {
      const res = await api.post('/tributacao/seed-defaults');
      toast.success(`Grupos padrões restaurados! ${res.data.criados} criados, ${res.data.existentes} já existiam.`);
      load();
    } catch (err: any) {
      toast.error('Erro ao restaurar grupos padrões.');
    } finally {
      setRestoring(false);
    }
  };

  const getGrupoBadge = (nome: string, csosn?: string) => {
    const lower = nome.toLowerCase();
    if (lower.includes('não fiscal') || lower.includes('sem nota')) {
      return <span className="text-[10px] bg-support border border-brand text-brand px-2 py-0.5 rounded-full font-bold">NÃO FISCAL</span>;
    }
    if (csosn === '500') {
      return <span className="text-[10px] bg-support border border-brand text-brand px-2 py-0.5 rounded-full font-bold">SUBSTITUIÇÃO TRIBUTÁRIA (ST)</span>;
    }
    if (csosn === '102') {
      return <span className="text-[10px] bg-support border border-brand text-brand px-2 py-0.5 rounded-full font-bold">TRIBUTAÇÃO NORMAL (SN)</span>;
    }
    if (csosn === '400') {
      return <span className="text-[10px] bg-support border border-brand text-brand px-2 py-0.5 rounded-full font-bold">ISENTO</span>;
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <FileText className="text-brand" size={30} />
          Grupos Tributários
        </h1>
        <div className="flex gap-3">
          <button
            onClick={handleRestoreDefaults}
            disabled={restoring}
            className="bg-surface hover:bg-support text-muted px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
          >
            {restoring ? <PdvLojistaLoader mode="loader" compact size={18} label="Restaurando padrões" /> : <Save size={18} />}
            {restoring ? 'Restaurando...' : 'Restaurar Padrões'}
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="bg-surface hover:bg-support text-muted px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition active:scale-95"
          >
            <Download size={18} /> Exportar XML
          </button>
          <button
            onClick={openCreate}
            className="bg-brand hover:bg-brand text-on-brand px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition active:scale-95 hover:text-on-brand"
          >
            <Plus size={18} /> Novo Grupo
          </button>
        </div>
      </div>

      <div className="bg-support border border-brand rounded-2xl p-4 flex gap-3 text-sm text-brand leading-relaxed">
        <span className="text-lg"></span>
        <div>
          <strong className="text-ink block mb-0.5">Atenção sobre conformidade fiscal:</strong>
          Os perfis fiscais foram pré-configurados com base nas regras gerais do Simples Nacional para o comércio varejista. É essencial exportar essa lista ou validar com a contabilidade da empresa para garantir a correta aplicação de alíquotas conforme a legislação do seu estado.
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><PdvLojistaLoader mode="loader" size={44} label="Carregando grupos tributários..." /></div>
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <FileText size={48} className="mb-4 opacity-30" />
          <p className="text-lg">Nenhum grupo cadastrado.</p>
          <p className="text-sm mb-4">Crie um grupo ou clique em Restaurar Padrões para inicializar os 10 grupos essenciais.</p>
          <button onClick={handleRestoreDefaults} className="bg-surface hover:bg-support px-4 py-2 rounded-xl text-xs font-bold text-ink transition">Restaurar Padrões</button>
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map(g => (
            <div key={g.id} className="bg-page border border-line hover:border-line rounded-2xl p-5 flex items-center gap-4 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-bold text-ink text-lg">{g.nome}</span>
                  {getGrupoBadge(g.nome, g.csosn)}
                  {g.ativo
                    ? <span className="text-[10px] bg-support border border-brand text-brand px-2 py-0.5 rounded-full">Ativo</span>
                    : <span className="text-[10px] bg-surface border border-line text-muted px-2 py-0.5 rounded-full">Inativo</span>
                  }
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-mono mb-2.5">
                  <span className="bg-support border border-brand text-brand px-2 py-1 rounded-lg">CSOSN: {g.csosn || '—'}</span>
                  <span className="bg-support border border-brand text-brand px-2 py-1 rounded-lg">CFOP: {g.cfop}</span>
                  <span className="bg-surface border border-line text-muted px-2 py-1 rounded-lg">CST PIS: {g.cstPis}</span>
                  <span className="bg-surface border border-line text-muted px-2 py-1 rounded-lg">CST COFINS: {g.cstCofins}</span>
                  {Number(g.aliqIcms) > 0 && <span className="bg-support border border-brand text-brand px-2 py-1 rounded-lg">ICMS: {g.aliqIcms}%</span>}
                </div>

                {/* Categorias Vinculadas */}
                {g.categories && g.categories.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                      <Tag size={11} className="text-brand" /> Categorias:
                    </span>
                    {g.categories.map(cat => (
                      <span key={cat.id} className="text-xs bg-support border border-brand text-brand px-2 py-0.5 rounded-md font-semibold">
                        {cat.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-muted italic">
                    Nenhuma categoria vinculada a este grupo.
                  </div>
                )}
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(g)} className="p-2 bg-surface hover:bg-brand rounded-xl transition text-muted hover:text-ink cursor-pointer hover:text-on-brand" data-tooltip="Editar Grupo e Categorias">
                  <Pencil size={16} />
                </button>
                {!g.isPadrao ? (
                  <button onClick={() => handleDelete(g)} className="p-2 bg-surface hover:bg-support rounded-xl transition text-muted hover:text-brand cursor-pointer" data-tooltip="Remover Grupo">
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <button disabled className="p-2 bg-page border border-line rounded-xl text-muted cursor-not-allowed" data-tooltip="Perfis fiscais padrão do sistema não podem ser excluídos">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4">
          <div className="bg-page border border-line rounded-3xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-line">
              <h3 className="text-lg font-bold text-ink">{editing ? 'Editar Grupo Tributário' : 'Novo Grupo Tributário'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-2 bg-surface hover:bg-support rounded-full transition text-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className={labelCls}>Nome do Grupo *</label>
                <input className={inputCls} value={form.nome} onChange={e => f('nome', e.target.value)} placeholder="Ex: TRIBUTADOS - Consumidor Final SP" />
              </div>

              {/* Seção de Seleção de Categorias Vinculadas */}
              <div className="bg-page/60 border border-line rounded-2xl p-4 space-y-3">
                <div>
                  <label className="text-xs font-bold text-brand uppercase tracking-wider flex items-center gap-1.5">
                    <Tag size={14} /> Categorias Vinculadas a Este Grupo
                  </label>
                  <p className="text-muted text-xs mt-0.5">
                    Selecione quais categorias de produtos receberão automaticamente este perfil tributário:
                  </p>
                </div>

                {allCategories.length === 0 ? (
                  <p className="text-muted text-xs italic">Nenhuma categoria cadastrada no sistema.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {allCategories.map(cat => {
                      const isChecked = selectedCategoryIds.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                            isChecked
                              ? 'bg-support border-brand text-brand shadow-sm'
                              : 'bg-page border-line text-muted hover:border-line hover:text-muted'
                          }`}
                        >
                          <span className="truncate mr-1">{cat.name}</span>
                          <span className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                            isChecked ? 'bg-brand border-brand text-on-brand' : 'border-line bg-page'
                          }`}>
                            {isChecked && <CheckCircle size={12} className="stroke-[3]" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedCategoryIds.length > 0 && (
                  <p className="text-[11px] text-brand font-semibold">
                    ✓ {selectedCategoryIds.length} {selectedCategoryIds.length === 1 ? 'categoria selecionada' : 'categorias selecionadas'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>CSOSN (Simples Nacional)</label>
                  <RetailSelect value={form.csosn || ''} onChange={e => f('csosn', e.target.value)}>
                    <option value="">— Não usar —</option>
                    {CSOSN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                  </RetailSelect>
                  <p className="text-muted text-xs mt-1">{CSOSN_OPTIONS.find(o => o.value === form.csosn)?.label || ''}</p>
                </div>
                <div>
                  <label className={labelCls}>CFOP *</label>
                  <input className={`${inputCls} font-mono`} value={form.cfop} onChange={e => f('cfop', e.target.value)} placeholder="5102" maxLength={4} />
                  <p className="text-muted text-xs mt-1">5102 = Venda interna consumidor</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>CST PIS</label>
                  <RetailSelect value={form.cstPis} onChange={e => f('cstPis', e.target.value)}>
                    {CST_PIS_COFINS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                  </RetailSelect>
                </div>
                <div>
                  <label className={labelCls}>CST COFINS</label>
                  <RetailSelect value={form.cstCofins} onChange={e => f('cstCofins', e.target.value)}>
                    {CST_PIS_COFINS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                  </RetailSelect>
                </div>
              </div>

              {/* Avançado */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-muted hover:text-muted text-sm font-medium transition"
              >
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Configurações avançadas (ICMS, IPI, alíquotas)
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-line">
                  <div>
                    <label className={labelCls}>Alíq. ICMS (%)</label>
                    <input type="number" className={inputCls} value={form.aliqIcms} onChange={e => f('aliqIcms', parseFloat(e.target.value) || 0)} step="0.01" />
                  </div>
                  <div>
                    <label className={labelCls}>Red. Base Cálc. ICMS (%)</label>
                    <input type="number" className={inputCls} value={form.redBcIcms} onChange={e => f('redBcIcms', parseFloat(e.target.value) || 0)} step="0.01" />
                  </div>
                  <div>
                    <label className={labelCls}>Alíq. PIS (%)</label>
                    <input type="number" className={inputCls} value={form.aliqPis} onChange={e => f('aliqPis', parseFloat(e.target.value) || 0)} step="0.01" />
                  </div>
                  <div>
                    <label className={labelCls}>Alíq. COFINS (%)</label>
                    <input type="number" className={inputCls} value={form.aliqCofins} onChange={e => f('aliqCofins', parseFloat(e.target.value) || 0)} step="0.01" />
                  </div>
                  <div>
                    <label className={labelCls}>CST IPI</label>
                    <input className={`${inputCls} font-mono`} value={form.cstIpi || ''} onChange={e => f('cstIpi', e.target.value)} placeholder="Ex: 99" />
                  </div>
                  <div>
                    <label className={labelCls}>Alíq. IPI (%)</label>
                    <input type="number" className={inputCls} value={form.aliqIpi} onChange={e => f('aliqIpi', parseFloat(e.target.value) || 0)} step="0.01" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>CST ICMS (Regime Normal)</label>
                    <input className={`${inputCls} font-mono`} value={form.cstIcms || ''} onChange={e => f('cstIcms', e.target.value)} placeholder="Apenas para Lucro Presumido/Real" />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <RetailSwitch
                  checked={form.ativo}
                  onCheckedChange={(checked) => f('ativo', checked)}
                  label="Grupo Ativo"
                />
              </div>
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-4 rounded-xl font-bold text-on-brand bg-brand hover:bg-brand disabled:opacity-50 transition active:scale-95 flex items-center justify-center gap-2 hover:text-on-brand"
              >
                {saving ? <PdvLojistaLoader mode="loader" compact size={18} label="Salvando grupo" /> : <Save size={18} />}
                {saving ? 'Salvando...' : (editing ? 'Salvar Alterações' : 'Criar Grupo')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ExportXmlModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
    </div>
  );
}
