"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Plus, 
  HelpCircle, 
  Package, 
  Building2, 
  Calendar, 
  DollarSign, 
  X,
  Database,
  Trash2,
  Clock,
  Link2Off,
  Terminal
} from 'lucide-react';
import { PdvLojistaLoader, RetailSelect, RetailSwitch } from '@/components/ui';

// ── Interfaces ───────────────────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  barcode: string | null;
  shortCode: string | null;
  priceSell?: string | number | null;
}

interface NfeItem {
  id: string;
  descricao: string;
  codigoFornecedor: string | null;
  codigoBarras: string | null;
  ncm: string | null;
  cest: string | null;
  cfop: string | null;
  unidade: string;
  quantidade: string | number;
  custoUnitario: string | number;
  custoTotal: string | number;
  status: string;
  productId: string | null;
  product?: Product | null;

  uCom?: string | null;
  qCom?: string | number | null;
  vUnCom?: string | number | null;
  cEANTrib?: string | null;
  
  // Impostos
  cstIcms?: string;
  aliqIcms?: number;
  vBCIcms?: number;
  vIcms?: number;
}

interface NfeEntrada {
  id: string;
  createdAt: string;
  chave: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  cnpjFornecedor: string;
  nomeFornecedor: string;
  valorTotal: string | number;
  quantItens: number;
  status: 'RECEBIDA' | 'PROCESSANDO' | 'AGUARDANDO_CONCILIACAO' | 'PRONTA_IMPORTAR' | 'IMPORTANDO' | 'IMPORTADA' | 'CANCELADA' | 'ERRO';
  importadaEm: string | null;
  nsu: string | null;
  supplierId: string | null;
  itens?: NfeItem[];
}

export default function XmlImportPage() {
  const { user } = useAuthStore();
  const isStockist = user?.role === 'stockist';
  const [pendentes, setPendentes] = useState<NfeEntrada[]>([]);
  const [historico, setHistorico] = useState<NfeEntrada[]>([]);
  const [activeTab, setActiveTab] = useState<'pendentes' | 'historico'>('pendentes');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Controle de exclusao de nota
  const [deletingNfe, setDeletingNfe] = useState<NfeEntrada | null>(null);
  const [revertStockOnDelete, setRevertStockOnDelete] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Controle de conversao de embalagem manual
  const [conversionItem, setConversionItem] = useState<NfeItem | null>(null);
  const [conversionFactor, setConversionFactor] = useState<number>(1);
  const [conversionUnit, setConversionUnit] = useState<string>('UN');
  const [conversionLoading, setConversionLoading] = useState(false);
  const [adjustedQty, setAdjustedQty] = useState<number>(0);
  const [adjustedCost, setAdjustedCost] = useState<number>(0);

  // Controle de cadastro rapido de produto
  const [quickCreateItem, setQuickCreateItem] = useState<NfeItem | null>(null);
  const [quickCreateName, setQuickCreateName] = useState<string>('');
  const [quickCreatePriceSell, setQuickCreatePriceSell] = useState<string>('');
  const [quickCreateBarcode, setQuickCreateBarcode] = useState<string>('');
  const [quickCreateNcm, setQuickCreateNcm] = useState<string>('');
  const [quickCreateCest, setQuickCreateCest] = useState<string>('');
  const [quickCreateCategoryId, setQuickCreateCategoryId] = useState<string>('');
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);

  // Modal / Drawer de conciliação
  const [selectedNfe, setSelectedNfe] = useState<NfeEntrada | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [nfeItens, setNfeItens] = useState<NfeItem[]>([]);
  const [confirmingImport, setConfirmingImport] = useState(false);

  // Busca de produtos locais para linkar
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);
  const [linkingItem, setLinkingItem] = useState<NfeItem | null>(null);
  const [linkingLoading, setLinkingLoading] = useState(false);

  // Estatísticas DF-e
  const [syncStats, setSyncStats] = useState<{
    correlationId?: string;
    ultNSU: string | number;
    novos: number;
    duplicados: number;
    processados: number;
    tempo: number;
    diagnostico?: any;
  } | null>(null);
  const [showDiag, setShowDiag] = useState(false);

  // KPIs
  const kpis = useMemo(() => {
    const totalPendentes = pendentes.length;
    const totalErros = pendentes.filter(n => n.status === 'ERRO').length;
    const ultConsulta = syncStats ? new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Não realizada';
    const ultNSU = syncStats?.ultNSU || '0';
    return { totalPendentes, totalErros, ultConsulta, ultNSU };
  }, [pendentes, syncStats]);

  const [hasCert, setHasCert] = useState<boolean | null>(null);

  // ── Carregar Notas, Historico e Produtos ─────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resPendentes, resHistorico, resProducts, resCategories, resCompany] = await Promise.all([
        api.get('/v1/fiscal/import/pendentes'),
        api.get('/v1/fiscal/import/history'),
        api.get('/products?limit=2000'),
        api.get('/categories'),
        api.get('/v1/company/config').catch(() => null)
      ]);
      setPendentes(resPendentes.data || []);
      setHistorico(resHistorico.data || []);
      const pList = (resProducts.data as any)?.data ?? resProducts.data ?? [];
      setProductsList(pList);
      setCategoriesList(resCategories.data || []);

      const certConfigured = Boolean(resCompany?.data?.certPfxBase64);
      setHasCert(certConfigured);
    } catch {
      toast.error('Erro ao carregar dados de importação.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Excluir Nota Fiscal (com estorno opcional) ──────────────────────────────────
  const handleDeleteNfe = async () => {
    if (!deletingNfe) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/v1/fiscal/import/nfe/${deletingNfe.id}?revertStock=${revertStockOnDelete}`);
      toast.success('Nota fiscal excluída com sucesso!');
      setDeletingNfe(null);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao excluir nota fiscal.';
      toast.error(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Salvar Conversao Manual de Embalagem por Item ────────────────────────────────
  const handleSaveConversion = async () => {
    if (!conversionItem) return;
    setConversionLoading(true);
    try {
      const origQCom = conversionItem.qCom && Number(conversionItem.qCom) > 0 
        ? Number(conversionItem.qCom) 
        : Number(conversionItem.quantidade);
        
      const origVUnCom = conversionItem.vUnCom && Number(conversionItem.vUnCom) > 0 
        ? Number(conversionItem.vUnCom) 
        : Number(conversionItem.custoUnitario);

      const origUCom = conversionItem.uCom || conversionItem.unidade;

      await api.patch(`/v1/fiscal/import/items/${conversionItem.id}`, {
        quantidade:    adjustedQty,
        custoUnitario: adjustedCost,
        unidade:       conversionUnit,
        qCom:          origQCom,
        vUnCom:        origVUnCom,
        uCom:          origUCom,
      });

      toast.success('Conversão aplicada com sucesso!');

      // Atualizar localmente
      setNfeItens(prev => prev.map(item => {
        if (item.id === conversionItem.id) {
          return { 
            ...item, 
            quantidade: adjustedQty, 
            custoUnitario: adjustedCost, 
            unidade: conversionUnit,
            qCom: origQCom,
            vUnCom: origVUnCom,
            uCom: origUCom,
          };
        }
        return item;
      }));

      setConversionItem(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao aplicar conversão.';
      toast.error(msg);
    } finally {
      setConversionLoading(false);
    }
  };

  // ── Abrir Cadastro Rapido de Produto ───────────────────────────────────────────
  const openQuickCreate = (item: NfeItem) => {
    let cleanedName = item.descricao.toUpperCase();
    
    // Simplificar e limpar palavras ruidosas
    cleanedName = cleanedName.replace(/\b(LT\d+|CX|C\/\d+|FD|PACK|FI|FL|MAINLINE|MAIN|VD|GFA|C\b)\b/g, ' ');
    cleanedName = cleanedName.replace(/[./\-(),]/g, ' ');
    cleanedName = cleanedName.split(/\s+/).map(w => w.trim()).filter(w => w.length > 0).join(' ');

    // Colocar em capitalização legível (ex: Coca Cola Lata 350ml)
    cleanedName = cleanedName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    setQuickCreateItem(item);
    setQuickCreateName(cleanedName);
    setQuickCreatePriceSell('');
    setQuickCreateBarcode(item.cEANTrib && item.cEANTrib !== 'SEM GTIN' && item.cEANTrib.trim() !== '' ? item.cEANTrib : item.codigoBarras || '');
    setQuickCreateNcm(item.ncm || '');
    setQuickCreateCest(item.cest || '');
    
    if (categoriesList.length > 0) {
      setQuickCreateCategoryId(categoriesList[0].id);
    } else {
      setQuickCreateCategoryId('');
    }
  };

  // ── Enviar Cadastro Rapido de Produto ──────────────────────────────────────────
  const handleQuickCreateProduct = async () => {
    if (!quickCreateItem) return;
    if (!quickCreateName.trim()) {
      toast.error('Nome do produto é obrigatório.');
      return;
    }
    if (!quickCreateCategoryId) {
      toast.error('Selecione uma categoria.');
      return;
    }
    const sellPrice = parseFloat(quickCreatePriceSell) || 0;
    if (!isStockist && (isNaN(sellPrice) || sellPrice <= 0)) {
      toast.error('Informe um preço de venda maior que zero.');
      return;
    }

    setQuickCreateLoading(true);
    try {
      // 1. Criar o produto no catálogo geral
      const resNewProduct = await api.post('/products', {
        name:       quickCreateName,
        priceSell:  sellPrice,
        priceCost:  Number(quickCreateItem.custoUnitario),
        barcode:    quickCreateBarcode.trim() || null,
        ncm:        quickCreateNcm.trim() || null,
        cest:       quickCreateCest.trim() || null,
        categoryId: quickCreateCategoryId,
        stock:      0,
        unit:       quickCreateItem.unidade || 'UN',
      });

      const newProduct = resNewProduct.data;
      toast.success(`Produto "${newProduct.name}" cadastrado!`);

      // 2. Vincular o item da NF-e ao novo produto
      await api.patch(`/v1/fiscal/import/items/${quickCreateItem.id}`, {
        productId: newProduct.id,
      });

      // 3. Atualizar estados locais
      setNfeItens(prev => prev.map(item => {
        if (item.id === quickCreateItem.id) {
          return { ...item, productId: newProduct.id, product: newProduct };
        }
        return item;
      }));

      setProductsList(prev => [...prev, newProduct]);
      setQuickCreateItem(null);
      toast.success('Item conciliado com o novo produto!');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao realizar cadastro rápido.';
      toast.error(msg);
    } finally {
      setQuickCreateLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Sincronização SEFAZ (DF-e) ──────────────────────────────────────────────
  const handleSyncDfe = async () => {
    setSyncing(true);
    setSyncStats(null);
    setShowDiag(false);
    try {
      const response = await api.post('/v1/fiscal/import/sync-dfe');
      setSyncStats(response.data);
      setShowDiag(true);
      const diag = response.data.diagnostico;
      const hasError = diag?.erro || diag?.statusInterno?.includes('ERRO');
      if (hasError) {
        toast.error(`DF-e: ${diag?.erro?.tipo || 'Erro'} — ${diag?.erro?.mensagem || 'Verifique o diagnóstico'}`);
      } else {
        toast.success(
          `DF-e Sincronizado: ${response.data.novos} novas, ${response.data.duplicados} duplicadas em ${response.data.tempo}s`
        );
      }
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Falha ao conectar na SEFAZ.';
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  // ── Upload Manual de XML ────────────────────────────────────────────────────
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validação de extensão
    if (!file.name.endsWith('.xml')) {
      toast.error('Por favor, envie apenas arquivos XML válidos.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/v1/fiscal/import/upload-xml', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Nota ${res.data.numero} enviada e processada com sucesso!`);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Falha ao processar arquivo XML.';
      toast.error(msg);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  // ── Abrir Detalhes para Conciliar ──────────────────────────────────────────
  const openReconciliation = async (nfe: NfeEntrada) => {
    setSelectedNfe(nfe);
    setLoadingDetails(true);
    setSearchProductQuery('');
    setLinkingItemId(null);
    try {
      const res = await api.get(`/v1/fiscal/import/nfe/${nfe.id}`);
      setNfeItens(res.data.itens || []);
      // Atualiza nota selecionada com dados atualizados do banco
      setSelectedNfe(res.data);
    } catch {
      toast.error('Erro ao buscar detalhes da NF-e.');
      setSelectedNfe(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  // ── Vincular / Desvincular Produto Manualmente ──────────────────────────────
  const handleLinkProduct = async (itemId: string, productId: string | null) => {
    setLinkingLoading(true);
    try {
      await api.patch(`/v1/fiscal/import/items/${itemId}`, { productId });
      if (productId) {
        toast.success('Produto vinculado com sucesso!');
      } else {
        toast.success('Vínculo removido. O item agora está sem produto associado.');
      }
      
      // Atualizar localmente
      const linkedProduct = productId ? productsList.find(p => p.id === productId) : null;
      setNfeItens(prev => prev.map(item => {
        if (item.id === itemId) {
          return { ...item, productId, product: linkedProduct || null };
        }
        return item;
      }));

      // Recarregar os detalhes da nota para atualizar o status global dela
      if (selectedNfe) {
        const res = await api.get(`/v1/fiscal/import/nfe/${selectedNfe.id}`);
        setSelectedNfe(res.data);
      }

      setLinkingItemId(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao atualizar vínculo do produto.';
      toast.error(msg);
    } finally {
      setLinkingLoading(false);
    }
  };

  // ── Confirmar Importação de Estoque ────────────────────────────────────────
  const handleConfirmImport = async () => {
    if (!selectedNfe) return;
    
    // Pegar apenas itens selecionados que estão vinculados
    const itensSelecionados = nfeItens
      .filter(item => item.productId !== null)
      .map(item => item.id);

    if (itensSelecionados.length === 0) {
      toast.error('Nenhum item da nota possui produto vinculado para importar.');
      return;
    }

    setConfirmingImport(true);
    try {
      await api.post(`/v1/fiscal/import/nfe/${selectedNfe.id}/confirm`, {
        itensSelecionados
      });
      toast.success('Entrada de estoque realizada com sucesso!');
      setSelectedNfe(null);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Falha ao processar entrada de estoque.';
      toast.error(msg);
    } finally {
      setConfirmingImport(false);
    }
  };

  // ── Reprocessar XML Bruto ──────────────────────────────────────────────────
  const handleReprocessXml = async () => {
    if (!selectedNfe) return;
    setLoadingDetails(true);
    try {
      const res = await api.post(`/v1/fiscal/import/nfe/${selectedNfe.id}/reprocess`);
      setNfeItens(res.data.itens || []);
      setSelectedNfe(res.data);
      toast.success('XML original reprocessado com sucesso!');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Falha ao reprocessar XML.';
      toast.error(msg);
    } finally {
      setLoadingDetails(false);
    }
  };

  // ── Filtragem Local de Produtos para Busca Manual ──────────────────────────
  const filteredSearchProducts = useMemo(() => {
    if (!searchProductQuery.trim()) return productsList.slice(0, 10);
    const query = searchProductQuery.toLowerCase().trim();

    // Se for código de barras numérico exato de 8+ dígitos, busca direto
    if (/^\d{8,14}$/.test(query)) {
      const barcodeMatch = productsList.filter(p => p.barcode && p.barcode.includes(query));
      if (barcodeMatch.length > 0) return barcodeMatch.slice(0, 10);
    }

    const getSearchKeywords = (str: string) => {
      let clean = str.replace(/[-./(),]/g, ' ');
      // Separar números de letras (ex: "1litro" -> "1 litro", "350ml" -> "350 ml")
      clean = clean.replace(/(\d+)([a-zA-Z]+)/g, '$1 $2');
      clean = clean.replace(/([a-zA-Z]+)(\d+)/g, '$1 $2');
      return clean.split(/\s+/).map(w => w.trim()).filter(w => w.length >= 2);
    };

    const keywords = getSearchKeywords(query);

    if (keywords.length === 0) {
      return productsList.filter(p => 
        p.name.toLowerCase().includes(query) || 
        (p.barcode && p.barcode.includes(query)) ||
        (p.shortCode && p.shortCode.includes(query))
      ).slice(0, 10);
    }

    return productsList.filter(p => {
      const nameNorm = p.name.toLowerCase().replace(/[-./(),]/g, ' ');
      const barcodeNorm = p.barcode ? p.barcode.toLowerCase() : '';
      const shortCodeNorm = p.shortCode ? p.shortCode.toLowerCase() : '';

      return keywords.every(kw => 
        nameNorm.includes(kw) || 
        barcodeNorm.includes(kw) || 
        shortCodeNorm.includes(kw)
      );
    }).slice(0, 10);
  }, [productsList, searchProductQuery]);

  // Checar se todos os itens estão conciliados para poder importar tudo
  const todosItensConciliados = useMemo(() => {
    if (nfeItens.length === 0) return false;
    return nfeItens.every(item => item.productId !== null);
  }, [nfeItens]);

  // Helper para Badge de status
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      RECEBIDA: 'bg-surface text-muted border-line',
      PROCESSANDO: 'bg-support text-brand border-brand animate-pulse',
      AGUARDANDO_CONCILIACAO: 'bg-support text-brand border-brand',
      PRONTA_IMPORTAR: 'bg-support text-brand border-brand font-black',
      IMPORTANDO: 'bg-support text-brand border-brand animate-pulse',
      IMPORTADA: 'bg-brand text-on-brand border-transparent',
      CANCELADA: 'bg-page/50 text-muted border-line line-through',
      ERRO: 'bg-support text-brand border-brand'
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${styles[status] || styles.RECEBIDA}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 pb-16">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Link to="/dashboard/inventory" className="text-muted hover:text-brand flex items-center gap-2 text-sm font-semibold mb-2 transition-colors">
            <ArrowLeft size={16} /> Voltar ao Controle de Estoque
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-ink flex items-center gap-3">
            <FileSpreadsheet className="text-brand" size={32} /> Entrada por XML (DF-e Sefaz)
          </h1>
          <p className="text-muted text-sm mt-1">
            Receba suas mercadorias direto do XML da SEFAZ ou por envio manual. Concilie códigos e dê entrada auditável.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Upload Manual */}
          <label className={`cursor-pointer bg-brand hover:bg-brand text-on-brand px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition active:scale-95 text-sm shadow-lg shadow-line hover:text-on-brand ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <PdvLojistaLoader mode="loader" compact size={18} label="Processando XML" /> : <Upload size={18} />}
            <span>{uploading ? 'Processando...' : 'Upload XML'}</span>
            <input type="file" accept=".xml" onChange={handleFileUpload} className="hidden" disabled={uploading} />
          </label>

          {/* Sync DFE (Exibido apenas quando possui Certificado A1) */}
          {hasCert !== false && (
            <button
              onClick={handleSyncDfe}
              disabled={syncing}
              className="bg-brand hover:bg-brand disabled:bg-brand disabled:cursor-not-allowed text-on-brand px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition active:scale-95 text-sm shadow-lg shadow-line hover:text-on-brand"
            >
              {syncing ? <PdvLojistaLoader mode="loader" compact size={18} label="Buscando na SEFAZ" /> : <RefreshCw size={18} />}
              {syncing ? 'Sincronizando SEFAZ...' : 'Buscar na SEFAZ (DF-e)'}
            </button>
          )}
        </div>
      </div>

      {hasCert === false && (
        <div className="bg-support border border-brand rounded-2xl p-4 flex items-center gap-3 text-brand text-xs sm:text-sm font-medium animate-in fade-in duration-300">
          <FileSpreadsheet size={22} className="shrink-0 text-brand" />
          <div>
            <span className="font-bold block text-ink text-sm">Modo de Entrada Manual por XML Ativo:</span>
            <span>Faça o upload do arquivo <code>.XML</code> da nota fornecido pela distribuidora ou fornecedor. O sistema fará a leitura automática de produtos, fornecedor, códigos EAN/NCM e impostos para você conciliar e dar entrada no estoque sem precisar de certificado digital A1.</span>
          </div>
        </div>
      )}

      {/* KPI Panel */}
      <div className={`grid grid-cols-2 ${hasCert !== false ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-4`}>
        <div className="bg-page/50 border border-line p-4 rounded-2xl">
          <p className="text-muted text-xs font-bold uppercase tracking-wider mb-1">Notas Pendentes</p>
          <p className="text-2xl font-black text-ink">{kpis.totalPendentes}</p>
        </div>
        {hasCert !== false ? (
          <>
            <div className="bg-page/50 border border-line p-4 rounded-2xl">
              <p className="text-muted text-xs font-bold uppercase tracking-wider mb-1">Falhas no Parser</p>
              <p className="text-2xl font-black text-brand">{kpis.totalErros}</p>
            </div>
            <div className="bg-page/50 border border-line p-4 rounded-2xl">
              <p className="text-muted text-xs font-bold uppercase tracking-wider mb-1">Último NSU SEFAZ</p>
              <p className="text-2xl font-black text-brand">{kpis.ultNSU}</p>
            </div>
            <div className="bg-page/50 border border-line p-4 rounded-2xl">
              <p className="text-muted text-xs font-bold uppercase tracking-wider mb-1">Última Busca SEFAZ</p>
              <p className="text-2xl font-black text-brand">{kpis.ultConsulta}</p>
            </div>
          </>
        ) : (
          <div className="bg-page/50 border border-line p-4 rounded-2xl">
            <p className="text-muted text-xs font-bold uppercase tracking-wider mb-1">Notas Importadas</p>
            <p className="text-2xl font-black text-brand">{historico.length}</p>
          </div>
        )}
      </div>

      {/* Sync stats feedback + Diagnóstico */}
      {syncStats && (() => {
        const diag = syncStats.diagnostico;
        const hasError = diag?.erro || diag?.statusInterno?.includes('ERRO');
        const borderColor = hasError ? 'border-brand' : 'border-brand';
        const bgColor = hasError ? 'bg-support' : 'bg-support';
        return (
        <div className={`${bgColor} border ${borderColor} rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-1`}>
          {/* Resumo compacto */}
          <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h4 className={`${hasError ? 'text-brand' : 'text-brand'} font-bold text-sm`}>
                {hasError ? ' Sincronização com Erro' : ' Resumo da Última Sincronização'}
              </h4>
              <p className="text-xs text-muted mt-0.5">
                {syncStats.correlationId && <span className="text-muted mr-2 font-mono text-[10px]">{syncStats.correlationId}</span>}
                Consulta realizada diretamente nos servidores da SEFAZ.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-brand font-bold">+{syncStats.novos} novas</span>
              <span className="text-muted">{syncStats.duplicados} duplicadas</span>
              <span className="text-muted">{syncStats.tempo}s</span>
              
              <button 
                onClick={() => setShowDiag(!showDiag)}
                className="bg-surface hover:bg-support text-muted px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <Terminal size={13} />
                {showDiag ? 'Ocultar Diagnóstico' : 'Ver Diagnóstico Técnico'}
              </button>
            </div>
          </div>

          {/* Painel de Diagnóstico Avançado */}
          {showDiag && diag && (
            <div className="p-4 border-t border-line bg-page/70 text-xs space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Certificado */}
                <div className="bg-page/70 border border-line rounded-xl p-3">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2"> Certificado A1</p>
                  {diag.certificado ? (
                    <div className="space-y-1 text-xs">
                      <p className={`font-bold ${diag.certificado.valido ? 'text-brand' : 'text-brand'}`}>
                        {diag.certificado.valido ? ' Válido' : ' Inválido / Expirado'}
                      </p>
                      <p className="text-muted font-mono truncate">{diag.certificado.titular}</p>
                      <p className="text-muted">{diag.certificado.diasRestantes} dias restantes</p>
                      <p className="text-muted text-[10px]">Emissora: {diag.certificado.emissora}</p>
                    </div>
                  ) : <p className="text-muted text-xs">Sem informação</p>}
                </div>

                {/* Ambiente */}
                <div className="bg-page/70 border border-line rounded-xl p-3">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2"> Configuração</p>
                  {diag.configuracao ? (
                    <div className="space-y-1 text-xs">
                      <p className={`font-bold ${diag.configuracao.ambienteCod === 1 ? 'text-brand' : 'text-brand'}`}>
                        {diag.configuracao.ambiente === 'PRODUCAO' ? ' Produção' : ' Homologação'}
                      </p>
                      <p className="text-muted">CNPJ: {diag.configuracao.cnpj}</p>
                      <p className="text-muted">UF: {diag.configuracao.uf}</p>
                      <p className="text-muted">Modelo: {diag.configuracao.modelo}</p>
                      <p className="text-muted">NSU enviado: {diag.configuracao.ultNSU}</p>
                    </div>
                  ) : <p className="text-muted text-xs">Sem informação</p>}
                </div>

                {/* Comunicação */}
                <div className="bg-page/70 border border-line rounded-xl p-3">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2"> Comunicação</p>
                  {diag.requisicao ? (
                    <div className="space-y-1 text-xs">
                      <p className="text-brand font-bold"> Conexão Estabelecida</p>
                      <p className="text-muted">Tentativas: {diag.requisicao.tentativas}</p>
                      <p className="text-muted">Tempo: {diag.requisicao.tempoMs}ms</p>
                    </div>
                  ) : (
                    <p className={`text-xs font-bold ${diag.erro ? 'text-brand' : 'text-muted'}`}>
                      {diag.erro ? ' Falha na conexão' : 'Sem informação'}
                    </p>
                  )}
                </div>

                {/* Resultado SEFAZ */}
                <div className="bg-page/70 border border-line rounded-xl p-3">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2"> Resposta SEFAZ</p>
                  {diag.resultado ? (
                    <div className="space-y-1 text-xs">
                      <p className={`font-bold ${
                        diag.resultado.cStat === '138' ? 'text-brand' :
                        diag.resultado.cStat === '137' ? 'text-brand' :
                        'text-brand'
                      }`}>
                        cStat: {diag.resultado.cStat}
                      </p>
                      <p className="text-muted">{diag.resultado.xMotivo}</p>
                    </div>
                  ) : <p className="text-muted text-xs">Sem informação</p>}
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* Tabs */}
      <div className="flex gap-2 bg-page p-1.5 rounded-2xl border border-line">
        <button
          onClick={() => setActiveTab('pendentes')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black tracking-wider uppercase transition flex items-center justify-center gap-2 ${activeTab === 'pendentes' ? 'bg-page text-ink shadow-md border border-line' : 'text-muted hover:text-muted'}`}
        >
          <FileSpreadsheet size={14} className={activeTab === 'pendentes' ? 'text-brand' : ''} />
          Fila de Importação ({pendentes.length})
        </button>
        <button
          onClick={() => setActiveTab('historico')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black tracking-wider uppercase transition flex items-center justify-center gap-2 ${activeTab === 'historico' ? 'bg-page text-ink shadow-md border border-line' : 'text-muted hover:text-muted'}`}
        >
          <CheckCircle2 size={14} className={activeTab === 'historico' ? 'text-brand' : ''} />
          Histórico / Importadas ({historico.length})
        </button>
      </div>

      {/* Grid de notas importadas/pendentes */}
      <div className="bg-page border border-line rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-line bg-page flex justify-between items-center">
          <h2 className="font-bold text-ink text-lg">
            {activeTab === 'pendentes' ? `Notas Pendentes de Importação (${pendentes.length})` : `Histórico de Notas Importadas (${historico.length})`}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <PdvLojistaLoader mode="loader" size={48} label="Carregando notas de importação..." />
          </div>
        ) : activeTab === 'pendentes' ? (
          pendentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted">
              <FileSpreadsheet size={48} className="mb-4 opacity-25 text-brand" />
              <p className="text-lg font-bold">Nenhuma nota fiscal na fila de entrada.</p>
              <p className="text-sm mt-1 opacity-70">
                {hasCert !== false ? 'Busque na SEFAZ ou faça o upload manual de um XML.' : 'Faça o upload manual de um arquivo XML para iniciar a conciliação.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-muted text-xs uppercase font-bold bg-page">
                    <th className="px-6 py-4">Nota / Série</th>
                    <th className="px-6 py-4">Fornecedor</th>
                    <th className="px-6 py-4">Emissão</th>
                    <th className="px-6 py-4">Valor Total</th>
                    <th className="px-6 py-4">Itens</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pendentes.map(nfe => (
                    <tr key={nfe.id} className="hover:bg-surface transition-colors">
                      <td className="px-6 py-4 font-mono">
                        <p className="text-ink font-bold text-sm">Nº {nfe.numero}</p>
                        <p className="text-muted text-xs mt-0.5">Série {nfe.serie} • NSU: {nfe.nsu || 'n/a'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-ink font-bold text-sm truncate max-w-[220px]" data-tooltip={nfe.nomeFornecedor}>{nfe.nomeFornecedor}</p>
                        <p className="text-muted text-xs mt-0.5">{nfe.cnpjFornecedor.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted">
                        <span className="flex items-center gap-1.5" data-tooltip="Data de Emissão pelo Fornecedor">
                          <Calendar size={14} className="text-muted" />
                          {new Date(nfe.dataEmissao).toLocaleDateString('pt-BR')}
                        </span>
                        {nfe.createdAt && (
                          <span className="flex items-center gap-1.5 text-[11px] text-brand font-semibold mt-1" data-tooltip="Data e Hora em que a nota chegou na Fila de Importação">
                            <Clock size={12} className="text-brand shrink-0" />
                            Recebida: {new Date(nfe.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-brand">
                        {Number(nfe.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted font-bold">
                        {nfe.quantItens} un.
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(nfe.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openReconciliation(nfe)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 shadow-sm ${
                              nfe.status === 'PRONTA_IMPORTAR'
                                ? 'bg-brand hover:bg-brand text-on-brand hover:text-on-brand'
                                : 'bg-surface hover:bg-support text-ink border border-line'
                            }`}
                          >
                            {nfe.status === 'PRONTA_IMPORTAR' ? 'Importar Notas' : 'Conciliar XML'}
                          </button>
                          <button
                            onClick={() => {
                              setRevertStockOnDelete(false);
                              setDeletingNfe(nfe);
                            }}
                            className="p-2 bg-support hover:bg-support text-brand hover:text-brand border border-brand rounded-xl transition cursor-pointer"
                            data-tooltip="Excluir Nota"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted">
              <CheckCircle2 size={48} className="mb-4 opacity-25 text-brand" />
              <p className="text-lg font-bold">Nenhum histórico de importação.</p>
              <p className="text-sm mt-1 opacity-70">Notas finalizadas ou canceladas aparecerão aqui.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-muted text-xs uppercase font-bold bg-page">
                    <th className="px-6 py-4">Nota / Série</th>
                    <th className="px-6 py-4">Fornecedor</th>
                    <th className="px-6 py-4">Emissão</th>
                    <th className="px-6 py-4">Valor Total</th>
                    <th className="px-6 py-4">Itens</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {historico.map(nfe => (
                    <tr key={nfe.id} className="hover:bg-surface transition-colors">
                      <td className="px-6 py-4 font-mono">
                        <p className="text-ink font-bold text-sm">Nº {nfe.numero}</p>
                        <p className="text-muted text-xs mt-0.5">Série {nfe.serie} • NSU: {nfe.nsu || 'n/a'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-ink font-bold text-sm truncate max-w-[220px]" data-tooltip={nfe.nomeFornecedor}>{nfe.nomeFornecedor}</p>
                        <p className="text-muted text-xs mt-0.5">{nfe.cnpjFornecedor.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted">
                        <span className="flex items-center gap-1.5" data-tooltip="Data de Emissão da Nota pelo Fornecedor">
                          <Calendar size={14} className="text-muted" />
                          {new Date(nfe.dataEmissao).toLocaleDateString('pt-BR')}
                        </span>
                        {nfe.importadaEm && (
                          <span className="flex items-center gap-1.5 text-[11px] text-brand font-semibold mt-1" data-tooltip="Data e Hora de Entrada e Integração no Estoque">
                            <Clock size={12} className="text-brand shrink-0" />
                            Entrada: {new Date(nfe.importadaEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-brand">
                        {Number(nfe.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted font-bold">
                        {nfe.quantItens} un.
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(nfe.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openReconciliation(nfe)}
                            className="px-3 py-2 bg-surface hover:bg-support text-muted hover:text-ink rounded-xl text-xs font-bold transition border border-line active:scale-95"
                          >
                            Visualizar
                          </button>
                          <button
                            onClick={() => {
                              setRevertStockOnDelete(true);
                              setDeletingNfe(nfe);
                            }}
                            className="p-2 bg-support hover:bg-support text-brand hover:text-brand border border-brand rounded-xl transition cursor-pointer"
                            data-tooltip="Excluir Nota e Estornar Estoque"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* MODAL FULLSCREEN DE CONCILIAÇÃO & IMPORTAÇÃO */}
      {selectedNfe && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex justify-center items-center p-4 overflow-y-auto">
          <div className="bg-page border border-line rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Header Modal */}
            <div className="px-6 py-5 border-b border-line bg-page/60 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black text-ink">Conciliação de Compra — Nota {selectedNfe.numero}</h3>
                  {getStatusBadge(selectedNfe.status)}
                </div>
                <p className="text-xs text-muted mt-1 font-mono break-all max-w-[500px] md:max-w-none">Chave: {selectedNfe.chave}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReprocessXml}
                  className="bg-surface hover:bg-support border border-line text-muted hover:text-ink px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  data-tooltip="Reprocessa o XML original do disco para limpar erros"
                >
                  <RefreshCw size={14} /> Reprocessar XML
                </button>
                <button
                  onClick={() => setSelectedNfe(null)}
                  className="text-muted hover:text-ink p-2 rounded-xl hover:bg-surface transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Info Summary Bar */}
            <div className="px-6 py-4 bg-page border-b border-line grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-brand shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted text-[10px] uppercase font-bold">Fornecedor</p>
                  <p className="text-ink font-bold truncate">{selectedNfe.nomeFornecedor}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-brand shrink-0" />
                <div>
                  <p className="text-muted text-[10px] uppercase font-bold">Valor da Nota</p>
                  <p className="text-brand font-black">{Number(selectedNfe.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Package size={16} className="text-brand shrink-0" />
                <div>
                  <p className="text-muted text-[10px] uppercase font-bold">Itens Totais</p>
                  <p className="text-ink font-bold">{selectedNfe.quantItens} produtos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Database size={16} className="text-brand shrink-0" />
                <div>
                  <p className="text-muted text-[10px] uppercase font-bold">Vínculo de Cadastro</p>
                  {selectedNfe.supplierId ? (
                    <span className="text-brand font-bold text-xs">Fornecedor Cadastrado</span>
                  ) : (
                    <span className="text-brand font-bold text-xs">Fornecedor Novo (Será cadastrado)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Itens List & Match */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-page">
              {loadingDetails ? (
                <div className="flex justify-center items-center py-20">
                  <PdvLojistaLoader mode="loader" size={48} label="Carregando itens da nota..." />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-muted text-xs font-semibold mb-2">Relacione cada item da nota a um produto do seu catálogo:</p>
                  {nfeItens.map((item, index) => {
                    const isMatched = item.productId !== null;
                    return (
                      <div key={item.id} className={`p-4 rounded-2xl border transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isMatched ? 'bg-page border-line' : 'bg-support border-brand'}`}>
                        
                        {/* Detalhes do item da nota */}
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] text-muted font-bold font-mono">ITEM #{index + 1}</span>
                          <h4 className="text-ink font-bold text-sm truncate" data-tooltip={item.descricao}>{item.descricao}</h4>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted mt-1 font-mono">
                            <span>Código Forn: <strong className="text-muted">{item.codigoFornecedor || 'n/a'}</strong></span>
                            {item.codigoBarras && <span>EAN: <strong className="text-muted">{item.codigoBarras}</strong></span>}
                            {item.cEANTrib && item.cEANTrib !== item.codigoBarras && <span>EAN Trib: <strong className="text-muted">{item.cEANTrib}</strong></span>}
                            <span>NCM: <strong className="text-muted">{item.ncm || 'n/a'}</strong></span>
                            
                            {item.qCom && item.uCom && Number(item.qCom) !== Number(item.quantidade) ? (
                              <span>Comprado: <strong className="text-brand">{Number(item.qCom)} {item.uCom} ({Number(item.quantidade)} {item.unidade})</strong></span>
                            ) : (
                              <span>Qtd: <strong className="text-muted">{Number(item.quantidade)} {item.unidade}</strong></span>
                            )}
                            
                            {item.vUnCom && Number(item.vUnCom) !== Number(item.custoUnitario) ? (
                              <span>Custo: <strong className="text-brand">R$ {Number(item.custoUnitario).toFixed(2)} / {item.unidade} <span className="text-muted text-[10px]">(R$ {Number(item.vUnCom).toFixed(2)} / {item.uCom})</span></strong></span>
                            ) : (
                              <span>Custo Unit: <strong className="text-brand">R$ {Number(item.custoUnitario).toFixed(2)}</strong></span>
                            )}
                          </div>
                        </div>

                        {/* Status do Match & Vinculo */}
                        <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-3 shrink-0">
                          
                          {/* Destino (Produto local) */}
                          <div className="min-w-0 text-left md:text-right">
                            <p className="text-muted text-[10px] uppercase font-bold">Vincular a:</p>
                            {isMatched ? (
                              <p className="text-brand font-bold text-sm truncate max-w-[200px]" data-tooltip={item.product?.name}>
                                {item.product?.name}
                              </p>
                            ) : (
                              <p className="text-brand font-bold text-sm flex items-center gap-1">
                                <AlertTriangle size={14} /> Produto não cadastrado
                              </p>
                            )}
                          </div>

                          {/* Ações */}
                          <div className="flex gap-2">
                            {selectedNfe.status !== 'IMPORTADA' && selectedNfe.status !== 'CANCELADA' && (
                              <button
                                onClick={() => {
                                  const currentFactor = item.qCom && item.quantidade && Number(item.qCom) > 0 
                                    ? Math.round(Number(item.quantidade) / Number(item.qCom)) 
                                    : 1;
                                  setConversionItem(item);
                                  setConversionFactor(currentFactor);
                                  setConversionUnit(item.unidade || 'UN');
                                  setAdjustedQty(Number(item.quantidade));
                                  setAdjustedCost(Number(item.custoUnitario));
                                }}
                                className="px-3 py-2 bg-page hover:bg-surface border border-line text-brand hover:text-brand rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                              >
                                Converter
                              </button>
                            )}

                            {!isMatched && selectedNfe.status !== 'IMPORTADA' && selectedNfe.status !== 'CANCELADA' && (
                              <button
                                onClick={() => openQuickCreate(item)}
                                className="px-3 py-2 bg-support hover:bg-support border border-brand text-brand rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                              >
                                Cadastrar
                              </button>
                            )}

                            {isMatched && selectedNfe.status !== 'IMPORTADA' && selectedNfe.status !== 'CANCELADA' && (
                              <button
                                onClick={() => handleLinkProduct(item.id, null)}
                                className="px-3 py-2 bg-support hover:bg-support border border-brand text-brand rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                                data-tooltip="Remover vínculo e deixar sem produto"
                              >
                                <Link2Off size={14} /> Desvincular
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setLinkingItem(item);
                                const cleanSuggestion = (desc: string) => {
                                  let clean = desc.toUpperCase();
                                  clean = clean.replace(/\b(LT\d+|CX|C\/\d+|FD|PACK|FI|FL|MAINLINE|MAIN|VD|GFA|C|PET)\b/g, ' ');
                                  clean = clean.replace(/[./\-(),]/g, ' ');
                                  return clean.split(/\s+/).map(w => w.trim()).filter(w => w.length > 0).slice(0, 3).join(' ');
                                };
                                const searchSuggestion = isMatched && item.product?.name
                                  ? item.product.name
                                  : cleanSuggestion(item.descricao);
                                setSearchProductQuery(searchSuggestion);
                              }}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${isMatched ? 'bg-page hover:bg-surface border-line text-muted' : 'bg-support hover:bg-support border-brand text-brand'}`}
                            >
                              {isMatched ? 'Alterar' : 'Vincular'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-5 border-t border-line bg-page/60 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-muted text-xs text-center md:text-left">
                {todosItensConciliados ? (
                  <span className="text-brand font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> Todos os itens da nota foram devidamente conciliados e associados!
                  </span>
                ) : (
                  <span className="text-brand font-bold flex items-center gap-1.5">
                    <AlertTriangle size={16} /> Vincule todos os itens marcados em vermelho para liberar a importação total de estoque.
                  </span>
                )}
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button
                  onClick={() => setSelectedNfe(null)}
                  className="w-full md:w-auto bg-page hover:bg-surface border border-line text-muted hover:text-ink px-5 py-3 rounded-xl font-bold transition text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={confirmingImport || nfeItens.filter(item => item.productId !== null).length === 0}
                  className="w-full md:w-auto bg-brand hover:bg-brand disabled:opacity-40 disabled:cursor-not-allowed text-on-brand px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition text-sm shadow-lg shadow-line active:scale-95 hover:text-on-brand"
                >
                  {confirmingImport ? <PdvLojistaLoader mode="loader" compact size={18} label="Confirmando entrada" /> : <CheckCircle2 size={18} />}
                  {confirmingImport ? 'Confirmando...' : 'Confirmar Entrada no Estoque'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Vinculação Manual (Overlay) */}
      {linkingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4 overflow-y-auto animate-[fadeIn_0.2s_ease]">
          <div className="bg-page border border-line rounded-3xl p-6 w-full max-w-xl shadow-2xl relative text-left">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-black text-ink flex items-center gap-2">
                  <Database className="text-brand" size={20} /> Vincular Produto ao Catálogo
                </h3>
                <p className="text-xs text-muted mt-1">Associe o item da nota fiscal a um produto local cadastrado.</p>
              </div>
              <button 
                onClick={() => setLinkingItem(null)} 
                className="bg-surface hover:bg-support text-muted hover:text-ink p-2 rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* XML Item Card */}
            <div className="bg-page/80 border border-line rounded-2xl p-4 mb-4">
              <span className="text-[10px] text-muted font-bold font-mono uppercase">Item da Nota Fiscal:</span>
              <h4 className="text-ink font-bold text-sm mt-0.5">{linkingItem.descricao}</h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted mt-2 font-mono">
                {linkingItem.codigoBarras && <span>EAN XML: <strong>{linkingItem.codigoBarras}</strong></span>}
                {linkingItem.cEANTrib && linkingItem.cEANTrib !== linkingItem.codigoBarras && <span>EAN Trib: <strong>{linkingItem.cEANTrib}</strong></span>}
                <span>NCM: <strong>{linkingItem.ncm || 'n/a'}</strong></span>
                <span>Forn. Cód: <strong>{linkingItem.codigoFornecedor || 'n/a'}</strong></span>
              </div>
            </div>

            {/* Search input */}
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-3.5 text-muted" size={16} />
              <input
                type="text"
                placeholder="Busque por nome do produto, código ou EAN..."
                value={searchProductQuery}
                onChange={e => setSearchProductQuery(e.target.value)}
                className="w-full bg-page border border-line rounded-2xl pl-10 pr-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand transition-colors focus:ring-1 focus:ring-brand"
                autoFocus
              />
            </div>

            {/* Results list */}
            <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar pr-1 mb-6">
              {filteredSearchProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    handleLinkProduct(linkingItem.id, p.id);
                    setLinkingItem(null);
                  }}
                  disabled={linkingLoading}
                  className="w-full text-left px-4 py-3 hover:bg-surface/50 border border-transparent hover:border-line rounded-2xl transition flex justify-between items-center group"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-muted group-hover:text-brand transition-colors truncate">{p.name}</span>
                    <span className="text-xs text-muted font-mono mt-0.5">
                      Cód: #{p.shortCode} {p.barcode ? `| EAN: ${p.barcode}` : ''}
                    </span>
                  </div>
                  {!isStockist && (
                    <div className="flex flex-col items-end whitespace-nowrap ml-4">
                      <span className="text-[10px] text-muted font-medium">Preço Venda</span>
                      <span className="text-sm text-brand font-black">
                        R$ {Number(p.priceSell || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </button>
              ))}
              {filteredSearchProducts.length === 0 && (
                <div className="text-center py-6">
                  <AlertTriangle className="mx-auto text-brand mb-2" size={24} />
                  <p className="text-xs text-muted font-bold">Nenhum produto correspondente no catálogo.</p>
                  <p className="text-[11px] text-muted mt-0.5">Refine sua pesquisa ou crie o produto no estoque.</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center border-t border-line pt-4">
              {linkingItem.productId ? (
                <button
                  onClick={() => {
                    handleLinkProduct(linkingItem.id, null);
                    setLinkingItem(null);
                  }}
                  className="bg-support hover:bg-support border border-brand text-brand px-4 py-2.5 rounded-xl font-bold transition text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Link2Off size={14} /> Remover Vínculo (Deixar sem Produto)
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => setLinkingItem(null)}
                className="bg-surface hover:bg-support text-muted px-5 py-2.5 rounded-xl font-bold transition text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingNfe && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease]">
          <div className="bg-page border border-line rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-left">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-ink flex items-center gap-2">
                <AlertTriangle className="text-brand" size={22} /> Excluir Importação
              </h3>
              <button 
                onClick={() => setDeletingNfe(null)} 
                className="bg-surface hover:bg-support text-muted hover:text-ink p-2 rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted">
                Tem certeza que deseja excluir a nota fiscal <strong className="text-ink">Nº {deletingNfe.numero}</strong> do fornecedor <strong className="text-ink">{deletingNfe.nomeFornecedor}</strong>?
              </p>

              {deletingNfe.status === 'IMPORTADA' ? (
                <div className="bg-support border border-brand rounded-2xl p-4 space-y-3">
                  <RetailSwitch
                    checked={revertStockOnDelete}
                    onCheckedChange={(checked) => setRevertStockOnDelete(checked)}
                    label="Estornar/Remover os itens do estoque físico"
                    description="Se ativo, as quantidades adicionadas por esta nota serão subtraídas do estoque dos produtos correspondentes. As alterações cadastrais de EAN, NCM e CEST feitas no catálogo permanecerão intactas."
                    size="sm"
                  />
                </div>
              ) : (
                <p className="text-xs text-muted bg-page p-4 border border-line rounded-2xl leading-relaxed">
                  Como esta nota ainda não foi finalizada (status {deletingNfe.status}), nenhum produto foi adicionado ao estoque físico. O registro da nota e os itens salvos serão deletados permanentemente.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-line pt-4 mt-6">
              <button
                onClick={() => setDeletingNfe(null)}
                className="bg-surface hover:bg-support text-muted px-5 py-2.5 rounded-xl font-bold transition text-xs"
                disabled={deleteLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteNfe}
                className="bg-brand hover:bg-brand disabled:opacity-40 text-on-brand px-5 py-2.5 rounded-xl font-bold transition text-xs flex items-center gap-1.5 hover:text-on-brand"
                disabled={deleteLoading}
              >
                {deleteLoading && <PdvLojistaLoader mode="loader" compact size={16} label="Excluindo nota" />}
                {deleteLoading ? 'Excluindo...' : 'Excluir Registro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Conversão Manual de Embalagem */}
      {conversionItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease]">
          <div className="bg-page border border-line rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-left">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-ink flex items-center gap-2">
                <Package className="text-brand" size={22} /> Configurar Embalagem / Conversão
              </h3>
              <button 
                onClick={() => setConversionItem(null)} 
                className="bg-surface hover:bg-support text-muted hover:text-ink p-2 rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Resumo do Item original */}
              <div className="bg-page/80 border border-line rounded-2xl p-4">
                <span className="text-[10px] text-muted font-bold font-mono uppercase">Item Original da Nota:</span>
                <h4 className="text-ink font-bold text-sm mt-0.5 truncate">{conversionItem.descricao}</h4>
                <p className="text-xs text-muted mt-2 font-mono">
                  Qtd Comercial: <strong className="text-muted">
                    {Number(conversionItem.qCom || conversionItem.quantidade)} {conversionItem.uCom || conversionItem.unidade}
                  </strong>
                  <br />
                  Custo Comercial: <strong className="text-muted">
                    R$ {Number(conversionItem.vUnCom || conversionItem.custoUnitario).toFixed(2)} / {conversionItem.uCom || conversionItem.unidade}
                  </strong>
                </p>
              </div>

              {/* Fator de conversão */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
                  Fator de Conversão (Qtd de Itens por Embalagem)
                </label>
                <input
                  type="number"
                  min="1"
                  value={conversionFactor}
                  onChange={(e) => {
                    const factor = Math.max(1, parseInt(e.target.value) || 1);
                    setConversionFactor(factor);
                    const origQty = conversionItem.qCom && Number(conversionItem.qCom) > 0 
                      ? Number(conversionItem.qCom) 
                      : Number(conversionItem.quantidade);
                    const origQtyVal = origQty * factor;
                    setAdjustedQty(origQtyVal);
                    if (origQtyVal > 0) {
                      setAdjustedCost(Number((Number(conversionItem.custoTotal) / origQtyVal).toFixed(4)));
                    }
                  }}
                  className="w-full bg-page border border-line rounded-xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
                />
                <p className="text-[10px] text-muted mt-1">Ex: Caixa de cerveja com 23 unidades = fator 23. Fardo de refrigerante com 6 latas = fator 6.</p>
              </div>

              {/* Unidade de estoque */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
                  Unidade de Venda / Estoque Individual
                </label>
                <RetailSelect
                  value={conversionUnit}
                  onChange={(e) => setConversionUnit(e.target.value.toUpperCase())}
                >
                  <option value="UN">UN - Unidade</option>
                  <option value="LAT">LAT - Lata</option>
                  <option value="GFA">GFA - Garrafa</option>
                  <option value="PCT">PCT - Pacote</option>
                  <option value="KG">KG - Quilograma</option>
                  <option value="L">L - Litro</option>
                  <option value="ML">ML - Mililitro</option>
                </RetailSelect>
              </div>

              {/* Quantidade Efetiva Recebida e Custo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
                    Qtd Efetiva Entrada
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={adjustedQty}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setAdjustedQty(val);
                      if (val > 0) {
                        setAdjustedCost(Number((Number(conversionItem.custoTotal) / val).toFixed(4)));
                      }
                    }}
                    className="w-full bg-page border border-line rounded-xl px-4 py-2.5 text-sm text-brand focus:outline-none focus:border-brand transition-colors font-bold"
                  />
                  <p className="text-[9px] text-muted mt-1">Insira a quantidade física contada.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
                    Custo Unit. Entrada
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={adjustedCost}
                    onChange={(e) => setAdjustedCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-page border border-line rounded-xl px-4 py-2.5 text-sm text-brand focus:outline-none focus:border-brand transition-colors font-bold"
                  />
                  <p className="text-[9px] text-muted mt-1">Custo unitário recalculado.</p>
                </div>
              </div>

              {/* Preview em tempo real */}
              <div className="bg-support border border-brand rounded-2xl p-4 space-y-2">
                <span className="text-[9px] text-brand font-bold tracking-wider uppercase font-mono font-black">Resumo da Entrada (Conferência):</span>
                <p className="text-xs text-muted leading-relaxed font-semibold">
                  • Entrada no Estoque: <strong className="text-brand">
                    {adjustedQty} {conversionUnit}
                  </strong>
                </p>
                <p className="text-xs text-muted leading-relaxed font-semibold">
                  • Valor Unitário do Lote: <strong className="text-ink">
                    R$ {Number(adjustedCost || 0).toFixed(2)}
                  </strong> / {conversionUnit}
                </p>
                <p className="text-xs text-muted leading-relaxed font-semibold">
                  • Valor de Custo Total do Item: <strong className="text-brand text-ink">
                    R$ {Number(adjustedQty * adjustedCost || 0).toFixed(2)}
                  </strong> (Ref: XML R$ {Number(conversionItem.custoTotal).toFixed(2)})
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-line pt-4 mt-6">
              <button
                onClick={() => setConversionItem(null)}
                className="bg-surface hover:bg-support text-muted px-5 py-2.5 rounded-xl font-bold transition text-xs"
                disabled={conversionLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConversion}
                className="bg-brand hover:bg-brand disabled:opacity-40 text-on-brand px-5 py-2.5 rounded-xl font-bold transition text-xs flex items-center gap-1.5 hover:text-on-brand"
                disabled={conversionLoading}
              >
                {conversionLoading && <PdvLojistaLoader mode="loader" compact size={16} label="Aplicando conversão" />}
                {conversionLoading ? 'Aplicando...' : 'Aplicar Conversão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro Rápido de Produto */}
      {quickCreateItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease]">
          <div className="bg-page border border-line rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-left">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-ink flex items-center gap-2">
                <Plus className="text-brand" size={22} /> Cadastro Rápido de Produto
              </h3>
              <button 
                onClick={() => setQuickCreateItem(null)} 
                className="bg-surface hover:bg-support text-muted hover:text-ink p-2 rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-page/80 border border-line p-4 rounded-2xl text-xs text-muted font-mono space-y-1">
                <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Item da Nota:</span>
                <p className="text-ink font-bold font-sans text-sm mb-2">{quickCreateItem.descricao}</p>
                <p>NCM: <strong className="text-muted">{quickCreateItem.ncm || 'n/a'}</strong></p>
                <p>Código Forn: <strong className="text-muted">{quickCreateItem.codigoFornecedor || 'n/a'}</strong></p>
                <p>Custo Unit. Nota: <strong className="text-muted font-bold text-brand">R$ {Number(quickCreateItem.custoUnitario).toFixed(2)} / {quickCreateItem.unidade}</strong></p>
              </div>

              {/* Nome do produto */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
                  Nome do Produto no Catálogo
                </label>
                <input
                  type="text"
                  value={quickCreateName}
                  onChange={(e) => setQuickCreateName(e.target.value)}
                  className="w-full bg-page border border-line rounded-xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors font-bold"
                  placeholder="Nome do produto"
                />
              </div>

              {/* Preço de Venda */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
                  Preço de Venda (Varejo)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quickCreatePriceSell}
                  onChange={(e) => !isStockist && setQuickCreatePriceSell(e.target.value)}
                  disabled={isStockist}
                  className={`w-full bg-page border border-line rounded-xl px-4 py-2.5 text-sm ${isStockist ? 'text-muted cursor-not-allowed' : 'text-brand focus:outline-none focus:border-brand'} transition-colors font-bold`}
                  placeholder={isStockist ? 'R$ 0,00 (Bloqueado)' : 'R$ 0,00'}
                />
                {isStockist && <p className="text-[10px] text-brand mt-1"> Estoquista não altera preço de venda</p>}
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
                  Categoria
                </label>
                <RetailSelect
                  value={quickCreateCategoryId}
                  onChange={(e) => setQuickCreateCategoryId(e.target.value)}
                  placeholder="Selecione uma Categoria"
                >
                  <option value="" disabled>Selecione uma Categoria</option>
                  {categoriesList.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </RetailSelect>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Código de barras */}
                <div>
                  <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
                    EAN/Código Barras
                  </label>
                  <input
                    type="text"
                    value={quickCreateBarcode}
                    onChange={(e) => setQuickCreateBarcode(e.target.value)}
                    className="w-full bg-page border border-line rounded-xl px-4 py-2 text-xs text-muted focus:outline-none focus:border-brand transition-colors font-mono"
                    placeholder="Sem código"
                  />
                </div>

                {/* NCM */}
                <div>
                  <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
                    NCM
                  </label>
                  <input
                    type="text"
                    value={quickCreateNcm}
                    onChange={(e) => setQuickCreateNcm(e.target.value)}
                    className="w-full bg-page border border-line rounded-xl px-4 py-2 text-xs text-muted focus:outline-none focus:border-brand transition-colors font-mono"
                    placeholder="NCM"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-line pt-4 mt-6">
              <button
                onClick={() => setQuickCreateItem(null)}
                className="bg-surface hover:bg-support text-muted px-5 py-2.5 rounded-xl font-bold transition text-xs"
                disabled={quickCreateLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleQuickCreateProduct}
                className="bg-brand hover:bg-brand disabled:opacity-40 text-on-brand px-5 py-2.5 rounded-xl font-bold transition text-xs flex items-center gap-1.5 hover:text-on-brand"
                disabled={quickCreateLoading}
              >
                {quickCreateLoading && <PdvLojistaLoader mode="loader" compact size={16} label="Confirmando cadastro" />}
                {quickCreateLoading ? 'Cadastrando...' : 'Confirmar Cadastro'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
