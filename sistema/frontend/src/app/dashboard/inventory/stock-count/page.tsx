"use client";
import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  ArrowLeft, ArrowRight, Check, Download, Upload, Package,
  LayoutGrid, ListChecks, Search, CheckSquare, Square,
  FileSpreadsheet, RefreshCw, AlertTriangle, ChevronRight,
  Clock, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp
} from 'lucide-react';
import { PdvLojistaLoader } from '@/components/ui';

// ── Tipos ───────────────────────────────────────────────────────────────────

interface Category { id: string; name: string; }
interface Product { id: string; name: string; shortCode: string; category: { name: string }; unit: string; stock: number; }
interface ImportRow { productId: string; name: string; category: string; unit: string; shortCode: string; before: number; counted: number | null; }
interface ImportResult { productId: string; name: string; before: number; after: number; }
interface HistorySession {
  sessionId: string;
  date: string;
  totalProducts: number;
  increases: number;
  decreases: number;
  unchanged: number;
  items: { name: string; before: number; after: number; diff: number }[];
}

type ScopeMode = 'all' | 'category' | 'manual';
type Step = 1 | 2 | 3;

// ── Helpers ─────────────────────────────────────────────────────────────────

const normalizeStr = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1 as Step, label: 'Escopo' },
    { n: 2 as Step, label: 'Exportar' },
    { n: 3 as Step, label: 'Importar' },
  ];
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            current === s.n ? 'bg-brand text-on-brand shadow-[0_0_20px_color-mix(in srgb, #7C3AED 30%, transparent)]'
            : current > s.n ? 'bg-support text-brand border border-brand'
            : 'bg-surface/50 text-muted'
          }`}>
            {current > s.n
              ? <Check size={14} />
              : <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs">{s.n}</span>
            }
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight size={16} className={`mx-1 ${current > s.n ? 'text-brand' : 'text-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Componente Principal ─────────────────────────────────────────────────────

export default function StockCountPage() {
  const [step, setStep] = useState<Step>(1);

  // Escopo
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState('');
  const [loadingScope, setLoadingScope] = useState(false);

  // Export
  const [exportedProducts, setExportedProducts] = useState<any[]>([]);
  const [loadingExport, setLoadingExport] = useState(false);

  // Import
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);

  // Histórico
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const fetchHistory = () => {
    setLoadingHistory(true);
    api.get('/products/inventory/history')
      .then(res => setHistory(res.data || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  };

  // ── Carregamento inicial ────────────────────────────────────────────────

  useEffect(() => {
    setLoadingScope(true);
    Promise.all([
      api.get('/categories'),
      api.get('/products?limit=5000'),
    ]).then(([catRes, prodRes]) => {
      setCategories(catRes.data || []);
      const data = Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data as any).data;
      setProducts((data || []).filter((p: any) => p.stock !== undefined));
    }).catch(() => toast.error('Erro ao carregar dados.')).finally(() => setLoadingScope(false));
    fetchHistory();
  }, []);

  // ── Produto filtrado para seleção manual ───────────────────────────────

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const term = normalizeStr(productSearch);
    return products.filter(p => normalizeStr(`${p.name} ${p.shortCode || ''}`).includes(term));
  }, [products, productSearch]);

  // ── Step 1 → 2: busca produtos do escopo ──────────────────────────────

  const handleGoToExport = async () => {
    setLoadingExport(true);
    try {
      let url = '/products/inventory/export';
      const params: string[] = [];
      if (scopeMode === 'category' && selectedCategories.size > 0) {
        params.push(`categoryIds=${[...selectedCategories].join(',')}`);
      } else if (scopeMode === 'manual' && selectedProducts.size > 0) {
        params.push(`productIds=${[...selectedProducts].join(',')}`);
      }
      if (params.length) url += '?' + params.join('&');
      const res = await api.get(url);
      setExportedProducts(res.data);
      setStep(2);
    } catch {
      toast.error('Erro ao buscar produtos.');
    } finally {
      setLoadingExport(false);
    }
  };

  // ── Step 2: gera e baixa o arquivo Excel ──────────────────────────────

  const handleDownload = () => {
    const rows = exportedProducts.map(p => ({
      'ID (não alterar)': p.id,
      'Código': p.shortCode,
      'Produto': p.name,
      'Categoria': p.category,
      'Unidade': p.unit,
      'Qtd Sistema': p.stock,
      'Qtd Contada': '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 38 }, { wch: 10 }, { wch: 35 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventário');
    XLSX.writeFile(wb, `inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Planilha baixada! Preencha a coluna "Qtd Contada" e importe de volta.');
  };

  // ── Step 2 → 3: lê arquivo importado e monta preview ─────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });

        const parsed: ImportRow[] = rawRows
          .filter(r => r['ID (não alterar)'])
          .map(r => ({
            productId: String(r['ID (não alterar)']),
            name: String(r['Produto'] || ''),
            category: String(r['Categoria'] || ''),
            unit: String(r['Unidade'] || 'UN'),
            shortCode: String(r['Código'] || ''),
            before: Number(r['Qtd Sistema'] || 0),
            counted: r['Qtd Contada'] !== null && r['Qtd Contada'] !== '' ? Number(r['Qtd Contada']) : null,
          }));

        setImportRows(parsed);
        setStep(3);
      } catch {
        toast.error('Erro ao ler a planilha. Verifique se o arquivo não foi corrompido.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ── Step 3: aplica o inventário ───────────────────────────────────────

  const rowsToUpdate = importRows.filter(r => r.counted !== null);

  const handleApplyInventory = async () => {
    if (rowsToUpdate.length === 0) {
      toast.error('Nenhum produto com "Qtd Contada" preenchida foi encontrado.');
      return;
    }
    setImporting(true);
    try {
      const res = await api.post('/products/inventory/import', {
        items: rowsToUpdate.map(r => ({ productId: r.productId, newStock: r.counted })),
      });
      setImportResults(res.data.results);
      toast.success(`Inventário aplicado! ${res.data.updated} produto(s) atualizado(s).`);
      fetchHistory(); // atualiza o histórico
    } catch {
      toast.error('Erro ao aplicar o inventário.');
    } finally {
      setImporting(false);
    }
  };

  // ── JSX ──────────────────────────────────────────────────────────────────

  const canProceedStep1 = scopeMode === 'all' ||
    (scopeMode === 'category' && selectedCategories.size > 0) ||
    (scopeMode === 'manual' && selectedProducts.size > 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard/inventory" className="p-2 rounded-xl bg-surface hover:bg-support text-muted hover:text-ink transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="text-brand" size={28} />
              Contagem de Estoque
            </h1>
            <p className="text-muted text-sm mt-0.5">Exporte, conte e importe os valores corretos</p>
          </div>
        </div>
        <StepIndicator current={step} />
      </div>

      {/* ── STEP 1: Escopo ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-page border border-line rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h2 className="text-lg font-bold text-ink mb-1">O que você quer contar?</h2>
            <p className="text-muted text-sm">Selecione o escopo desta contagem. Você pode contar tudo de uma vez ou dividir por partes.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button onClick={() => setScopeMode('all')}
              className={`flex flex-col items-center justify-center text-center gap-3 p-6 rounded-2xl border-2 transition-all ${scopeMode === 'all' ? 'border-brand bg-support text-ink shadow-[0_0_24px_color-mix(in srgb, #7C3AED 15%, transparent)]' : 'border-line bg-page text-muted hover:border-line hover:bg-page'}`}>
              <Package size={36} className={scopeMode === 'all' ? 'text-brand' : 'text-muted'} />
              <div>
                <p className="font-bold text-base">Todos os Produtos</p>
                <p className="text-xs text-muted mt-1">Contagem geral de todo o estoque</p>
              </div>
            </button>

            <button onClick={() => setScopeMode('category')}
              className={`flex flex-col items-center justify-center text-center gap-3 p-6 rounded-2xl border-2 transition-all ${scopeMode === 'category' ? 'border-brand bg-support text-ink shadow-[0_0_24px_color-mix(in srgb, #7C3AED 15%, transparent)]' : 'border-line bg-page text-muted hover:border-line hover:bg-page'}`}>
              <LayoutGrid size={36} className={scopeMode === 'category' ? 'text-brand' : 'text-muted'} />
              <div>
                <p className="font-bold text-base">Por Categoria</p>
                <p className="text-xs text-muted mt-1">Selecione uma ou mais categorias</p>
              </div>
            </button>

            <button onClick={() => setScopeMode('manual')}
              className={`flex flex-col items-center justify-center text-center gap-3 p-6 rounded-2xl border-2 transition-all ${scopeMode === 'manual' ? 'border-brand bg-support text-ink shadow-[0_0_24px_color-mix(in srgb, #7C3AED 15%, transparent)]' : 'border-line bg-page text-muted hover:border-line hover:bg-page'}`}>
              <ListChecks size={36} className={scopeMode === 'manual' ? 'text-brand' : 'text-muted'} />
              <div>
                <p className="font-bold text-base">Selecionar Produtos</p>
                <p className="text-xs text-muted mt-1">Escolha produto por produto</p>
              </div>
            </button>
          </div>

          {scopeMode === 'category' && (
            <div className="border border-brand rounded-xl p-4 bg-support space-y-3 animate-in fade-in slide-in-from-top-2">
              <p className="text-sm text-muted font-medium">Selecione as categorias:</p>
              {loadingScope ? (
                <div className="flex justify-center py-6"><PdvLojistaLoader mode="loader" size={40} label="Carregando categorias..." /></div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                  {categories.map(cat => {
                    const selected = selectedCategories.has(cat.id);
                    return (
                      <button key={cat.id} onClick={() => {
                        const next = new Set(selectedCategories);
                        selected ? next.delete(cat.id) : next.add(cat.id);
                        setSelectedCategories(next);
                      }} className={`flex items-center gap-2 p-2.5 rounded-lg text-sm text-left transition-all border ${selected ? 'border-brand bg-support text-ink font-medium' : 'border-line bg-page text-muted hover:border-line'}`}>
                        {selected ? <CheckSquare size={16} className="text-brand shrink-0" /> : <Square size={16} className="shrink-0" />}
                        <span className="truncate">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedCategories.size > 0 && (
                <p className="text-xs text-brand font-medium">{selectedCategories.size} categoria(s) selecionada(s)</p>
              )}
            </div>
          )}

          {scopeMode === 'manual' && (
            <div className="border border-brand rounded-xl p-4 bg-support space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted font-medium flex-1">Selecione os produtos:</p>
                {selectedProducts.size > 0 && (
                  <span className="text-xs text-brand font-bold">{selectedProducts.size} selecionado(s)</span>
                )}
              </div>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="text" placeholder="Buscar produto..." value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full bg-page border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand" />
              </div>
              {loadingScope ? (
                <div className="flex justify-center py-6"><PdvLojistaLoader mode="loader" size={40} label="Carregando produtos..." /></div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                  {filteredProducts.slice(0, 100).map(p => {
                    const selected = selectedProducts.has(p.id);
                    return (
                      <button key={p.id} onClick={() => {
                        const next = new Set(selectedProducts);
                        selected ? next.delete(p.id) : next.add(p.id);
                        setSelectedProducts(next);
                      }} className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-sm text-left transition-all border ${selected ? 'border-brand bg-support text-ink' : 'border-line bg-page/50 text-muted hover:border-line'}`}>
                        {selected ? <CheckSquare size={16} className="text-brand shrink-0" /> : <Square size={16} className="shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted">{p.category?.name} • Estoque: {p.stock} {p.unit}</p>
                        </div>
                      </button>
                    );
                  })}
                  {filteredProducts.length > 100 && (
                    <p className="text-xs text-muted text-center py-2">Mostrando 100 de {filteredProducts.length}. Refine a busca.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={handleGoToExport} disabled={!canProceedStep1 || loadingExport}
              className="flex items-center gap-2 bg-brand hover:bg-brand disabled:opacity-50 disabled:cursor-not-allowed text-on-brand font-bold px-6 py-3 rounded-xl transition hover:text-on-brand">
              {loadingExport ? <PdvLojistaLoader mode="loader" compact size={18} label="Preparando planilha" /> : null}
              {loadingExport ? 'Preparando...' : 'Avançar'}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Exportar ───────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-page border border-line rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-ink mb-1">Baixe a Planilha</h2>
            <p className="text-muted text-sm mb-6">
              <strong className="text-ink">{exportedProducts.length}</strong> produto(s) prontos. Baixe, preencha a coluna{' '}
              <strong className="text-brand">"Qtd Contada"</strong> e importe de volta.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <button onClick={handleDownload}
                className="flex items-center gap-3 bg-brand hover:bg-brand text-on-brand font-bold px-6 py-3 rounded-xl transition shadow-[0_0_20px_color-mix(in srgb, #7C3AED 20%, transparent)] hover:text-on-brand">
                <Download size={20} />
                Baixar Planilha (.xlsx)
              </button>
              <span className="text-muted text-sm">ou</span>
              <label className="flex items-center gap-3 bg-brand hover:bg-brand text-on-brand font-bold px-6 py-3 rounded-xl transition cursor-pointer shadow-[0_0_20px_color-mix(in srgb, #7C3AED 20%, transparent)] hover:text-on-brand">
                <Upload size={20} />
                Já tenho a planilha preenchida
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>

          <div className="bg-page border border-line rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-line flex items-center gap-2">
              <Package size={18} className="text-brand" />
              <span className="font-bold text-ink">Preview — {exportedProducts.length} produtos</span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="bg-page/50 text-muted text-xs uppercase sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-left">Produto</th>
                    <th className="px-4 py-3 text-left">Categoria</th>
                    <th className="px-4 py-3 text-left">Un.</th>
                    <th className="px-4 py-3 text-right">Qtd Sistema</th>
                    <th className="px-4 py-3 text-right text-brand">Qtd Contada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {exportedProducts.map(p => (
                    <tr key={p.id} className="hover:bg-surface">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted">{p.shortCode || '—'}</td>
                      <td className="px-4 py-2.5 text-muted font-medium">{p.name}</td>
                      <td className="px-4 py-2.5 text-muted">{p.category}</td>
                      <td className="px-4 py-2.5 text-muted">{p.unit}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-muted">{p.stock}</td>
                      <td className="px-4 py-2.5 text-right text-brand text-xs italic">— preencher —</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 bg-surface hover:bg-support text-muted font-bold px-5 py-2.5 rounded-xl transition">
              <ArrowLeft size={16} /> Voltar
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Import Preview / Resultado ────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          {importResults ? (
            <div className="bg-page border border-brand rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center gap-3 text-brand">
                <div className="w-12 h-12 rounded-full bg-support flex items-center justify-center">
                  <Check size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink">Inventário Aplicado!</h2>
                  <p className="text-muted text-sm">{importResults.length} produto(s) atualizado(s) com sucesso.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-page/50 text-muted text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Produto</th>
                      <th className="px-4 py-3 text-right">Antes</th>
                      <th className="px-4 py-3 text-right">Depois</th>
                      <th className="px-4 py-3 text-right">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {importResults.map(r => {
                      const diff = r.after - r.before;
                      return (
                        <tr key={r.productId} className="hover:bg-surface">
                          <td className="px-4 py-2.5 text-muted font-medium">{r.name}</td>
                          <td className="px-4 py-2.5 text-right text-muted">{r.before}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-ink">{r.after}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${diff > 0 ? 'text-brand' : diff < 0 ? 'text-brand' : 'text-muted'}`}>
                            {diff > 0 ? `+${diff}` : diff === 0 ? '=' : diff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 justify-end">
                <Link to="/dashboard/inventory" className="flex items-center gap-2 bg-surface hover:bg-support text-muted font-bold px-5 py-2.5 rounded-xl transition">
                  <Package size={16} /> Ver Estoque
                </Link>
                <button onClick={() => { setStep(1); setImportRows([]); setImportResults(null); setSelectedCategories(new Set()); setSelectedProducts(new Set()); }}
                  className="flex items-center gap-2 bg-brand hover:bg-brand text-on-brand font-bold px-5 py-2.5 rounded-xl transition hover:text-on-brand">
                  <RefreshCw size={16} /> Nova Contagem
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-page border border-line rounded-2xl p-6 shadow-xl">
                <h2 className="text-lg font-bold text-ink mb-1">Confirmar Aplicação</h2>
                <p className="text-muted text-sm mb-4">
                  Planilha lida com <strong className="text-ink">{importRows.length}</strong> linha(s).{' '}
                  <strong className="text-brand">{rowsToUpdate.length}</strong> produto(s) com "Qtd Contada" preenchida serão atualizados.
                  {importRows.length - rowsToUpdate.length > 0 && (
                    <span className="text-muted ml-1">({importRows.length - rowsToUpdate.length} linha(s) em branco serão ignoradas.)</span>
                  )}
                </p>
                {rowsToUpdate.length === 0 && (
                  <div className="flex items-center gap-3 bg-support border border-brand rounded-xl p-4 text-brand">
                    <AlertTriangle size={20} />
                    <p className="text-sm font-medium">Nenhuma linha com "Qtd Contada" preenchida. Preencha a planilha e reimporte.</p>
                  </div>
                )}
              </div>

              <div className="bg-page border border-line rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-line flex items-center justify-between">
                  <span className="font-bold text-ink flex items-center gap-2"><ListChecks size={18} className="text-brand" /> Preview das Alterações</span>
                  <span className="text-xs text-muted">{rowsToUpdate.length} de {importRows.length} serão alterados</span>
                </div>
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-sm">
                    <thead className="bg-page/50 text-muted text-xs uppercase sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left">Código</th>
                        <th className="px-4 py-3 text-left">Produto</th>
                        <th className="px-4 py-3 text-right">Qtd Sistema</th>
                        <th className="px-4 py-3 text-right">Qtd Contada</th>
                        <th className="px-4 py-3 text-right">Diferença</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {importRows.map(r => {
                        const willUpdate = r.counted !== null;
                        const diff = willUpdate ? (r.counted! - r.before) : null;
                        return (
                          <tr key={r.productId} className={`hover:bg-surface ${!willUpdate ? 'opacity-40' : ''}`}>
                            <td className="px-4 py-2.5 font-mono text-xs text-muted">{r.shortCode || '—'}</td>
                            <td className="px-4 py-2.5 text-muted font-medium">{r.name}</td>
                            <td className="px-4 py-2.5 text-right text-muted">{r.before}</td>
                            <td className={`px-4 py-2.5 text-right font-bold ${willUpdate ? 'text-ink' : 'text-muted italic text-xs'}`}>
                              {willUpdate ? r.counted : '— ignorado —'}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-bold ${diff === null ? 'text-muted' : diff > 0 ? 'text-brand' : diff < 0 ? 'text-brand' : 'text-muted'}`}>
                              {diff === null ? '—' : diff > 0 ? `+${diff}` : diff === 0 ? '=' : diff}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {willUpdate
                                ? <span className="text-[10px] font-bold text-brand bg-support border border-brand px-2 py-0.5 rounded">ATUALIZAR</span>
                                : <span className="text-[10px] font-bold text-muted bg-surface border border-line px-2 py-0.5 rounded">IGNORAR</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between gap-3">
                <button onClick={() => setStep(2)} className="flex items-center gap-2 bg-surface hover:bg-support text-muted font-bold px-5 py-2.5 rounded-xl transition">
                  <ArrowLeft size={16} /> Voltar
                </button>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 bg-surface hover:bg-support text-muted font-bold px-5 py-2.5 rounded-xl transition cursor-pointer">
                    <RefreshCw size={16} /> Reimportar
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                  </label>
                  <button onClick={handleApplyInventory} disabled={importing || rowsToUpdate.length === 0}
                    className="flex items-center gap-2 bg-brand hover:bg-brand disabled:opacity-50 disabled:cursor-not-allowed text-on-brand font-bold px-6 py-2.5 rounded-xl transition shadow-[0_0_20px_color-mix(in srgb, #7C3AED 20%, transparent)] hover:text-on-brand">
                    {importing ? <PdvLojistaLoader mode="loader" compact size={18} label="Aplicando inventário" /> : <Check size={18} />}
                    {importing ? 'Aplicando...' : 'Aplicar Inventário'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Histórico de Contagens ──────────────────────────────────────── */}
      <div className="mt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center">
              <Clock size={18} className="text-muted" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">Histórico de Contagens</h2>
              <p className="text-xs text-muted">Registros das últimas contagens físicas aplicadas</p>
            </div>
          </div>
          <button onClick={fetchHistory} className="p-2 rounded-xl bg-surface hover:bg-support text-muted hover:text-ink transition" data-tooltip="Atualizar">
            <RefreshCw size={16} />
          </button>
        </div>

        {loadingHistory ? (
          <div className="flex justify-center py-10">
            <PdvLojistaLoader mode="loader" size={44} label="Carregando histórico..." />
          </div>
        ) : history.length === 0 ? (
          <div className="bg-page border border-line rounded-2xl p-10 text-center">
            <Clock size={36} className="text-muted mx-auto mb-3" />
            <p className="text-muted font-medium">Nenhuma contagem realizada ainda</p>
            <p className="text-muted text-sm mt-1">O histórico aparecerá aqui após a primeira contagem</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((session, idx) => {
              const isExpanded = expandedSession === session.sessionId;
              const date = new Date(session.date);
              const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
              const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={session.sessionId} className={`bg-page border rounded-2xl overflow-hidden transition-all ${isExpanded ? 'border-brand' : 'border-line'}`}>
                  {/* Cabeçalho da sessão */}
                  <button
                    onClick={() => setExpandedSession(isExpanded ? null : session.sessionId)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-surface transition text-left"
                  >
                    {/* Número da contagem */}
                    <div className="w-10 h-10 rounded-xl bg-support border border-brand flex items-center justify-center shrink-0">
                      <span className="text-brand font-bold text-sm">#{history.length - idx}</span>
                    </div>

                    {/* Data e hora */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-ink text-sm">{dateStr} às {timeStr}</p>
                      <p className="text-xs text-muted mt-0.5">{session.totalProducts} produto(s) ajustado(s)</p>
                    </div>

                    {/* Badges de aumento / redução / igual */}
                    <div className="flex items-center gap-2 shrink-0">
                      {session.increases > 0 && (
                        <div className="flex items-center gap-1 bg-support border border-brand text-brand text-xs font-bold px-2.5 py-1 rounded-lg">
                          <TrendingUp size={12} /> +{session.increases}
                        </div>
                      )}
                      {session.decreases > 0 && (
                        <div className="flex items-center gap-1 bg-support border border-brand text-brand text-xs font-bold px-2.5 py-1 rounded-lg">
                          <TrendingDown size={12} /> -{session.decreases}
                        </div>
                      )}
                      {session.unchanged > 0 && (
                        <div className="flex items-center gap-1 bg-surface border border-line text-muted text-xs font-bold px-2.5 py-1 rounded-lg">
                          <Minus size={12} /> {session.unchanged}
                        </div>
                      )}
                      <div className="ml-1 text-muted">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </button>

                  {/* Detalhe expandido */}
                  {isExpanded && (
                    <div className="border-t border-line overflow-x-auto animate-in fade-in slide-in-from-top-1 duration-200">
                      <table className="w-full text-sm">
                        <thead className="bg-page/60 text-muted text-xs uppercase">
                          <tr>
                            <th className="px-4 py-3 text-left">Produto</th>
                            <th className="px-4 py-3 text-right">Antes</th>
                            <th className="px-4 py-3 text-right">Depois</th>
                            <th className="px-4 py-3 text-right">Diferença</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {session.items.map((item, i) => (
                            <tr key={i} className="hover:bg-surface">
                              <td className="px-4 py-2.5 text-muted font-medium">{item.name}</td>
                              <td className="px-4 py-2.5 text-right text-muted">{item.before}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-ink">{item.after}</td>
                              <td className={`px-4 py-2.5 text-right font-bold ${item.diff > 0 ? 'text-brand' : item.diff < 0 ? 'text-brand' : 'text-muted'}`}>
                                {item.diff > 0 ? `+${item.diff}` : item.diff === 0 ? '=' : item.diff}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

