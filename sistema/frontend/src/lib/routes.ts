/**
 * Mapa canônico de rotas do PDV Lojista (boas práticas REST/Web em português)
 * e tabela de redirecionamentos retrocompatíveis (/dashboard/* e aliases sem hífen).
 */

export const ROUTES = {
  pos: "/",
  login: "/login",
  sysInit: "/sys-init",

  inicio: {
    visaoGeral: "/inicio",
    historicoCaixas: "/inicio/historico-de-caixas",
    relatorios: "/inicio/relatorios",
    operacoes: "/inicio/operacoes",
  },

  estoque: {
    mercadorias: "/estoque",
    contagem: "/estoque/contagem",
    categorias: "/estoque/categorias",
    entradaManual: "/estoque/entrada-manual",
    entradaXml: "/estoque/entrada-xml",
    entradaXmlPendentes: "/estoque/entrada-xml/pendentes",
    entradaXmlHistorico: "/estoque/entrada-xml/historico",
  },

  financeiro: {
    contasAPagar: "/financeiro/contas-a-pagar",
    contasAPagarFixas: "/financeiro/contas-a-pagar/fixas",
    contasAPagarVariaveis: "/financeiro/contas-a-pagar/variaveis",
    pedidosDeCompra: "/financeiro/pedidos-de-compra",
    fornecedores: "/financeiro/fornecedores",
  },

  equipe: "/equipe",

  clientes: {
    lista: "/clientes",
    trocas: "/clientes/trocas",
  },

  crediario: {
    contas: "/crediario",
    parcelas: "/crediario/parcelas",
    whatsapp: "/crediario/whatsapp",
  },

  configuracoes: {
    empresa: "/configuracoes/empresa",
    empresaDados: "/configuracoes/empresa/dados",
    empresaEndereco: "/configuracoes/empresa/endereco",
    empresaNfce: "/configuracoes/empresa/nfce",
    empresaCertificado: "/configuracoes/empresa/certificado",
    pagamentos: "/configuracoes/pagamentos",
    tributacao: "/configuracoes/tributacao",
    nfce: "/configuracoes/nfce",
  },

  grupoPortal: {
    visaoGeral: "/grupo-portal/visao-geral",
    previsao: "/grupo-portal/previsao",
    estoque: "/grupo-portal/estoque",
    produtos: "/grupo-portal/produtos",
    produtosCriar: "/grupo-portal/produtos/criar",
    transferencias: "/grupo-portal/transferencias",
  },
} as const;

export const LEGACY_AND_ALIAS_REDIRECTS: ReadonlyArray<{
  from: string;
  to: string;
}> = [
  // Frente de caixa aliases
  { from: "/pdv", to: ROUTES.pos },
  { from: "/caixa", to: ROUTES.pos },

  // Módulo Início (legado /dashboard/* + aliases sem hífen)
  { from: "/dashboard", to: ROUTES.inicio.visaoGeral },
  { from: "/inicio/visao-geral", to: ROUTES.inicio.visaoGeral },
  { from: "/inicio/visaogeral", to: ROUTES.inicio.visaoGeral },
  { from: "/dashboard/registers", to: ROUTES.inicio.historicoCaixas },
  { from: "/inicio/historicodecaixas", to: ROUTES.inicio.historicoCaixas },
  { from: "/inicio/caixas", to: ROUTES.inicio.historicoCaixas },
  { from: "/dashboard/reports", to: ROUTES.inicio.relatorios },
  { from: "/inicio/relatorios-de-vendas", to: ROUTES.inicio.relatorios },
  { from: "/inicio/relatoriosdevendas", to: ROUTES.inicio.relatorios },
  { from: "/dashboard/operations", to: ROUTES.inicio.operacoes },
  { from: "/inicio/operacoes-locais", to: ROUTES.inicio.operacoes },
  { from: "/inicio/operacoeslocais", to: ROUTES.inicio.operacoes },

  // Módulo Estoque (legado /dashboard/inventory/* + aliases sem hífen)
  { from: "/dashboard/inventory", to: ROUTES.estoque.mercadorias },
  { from: "/estoque/mercadorias", to: ROUTES.estoque.mercadorias },
  { from: "/estoque/mercadorias-e-grades", to: ROUTES.estoque.mercadorias },
  { from: "/estoque/mercadoriasegrades", to: ROUTES.estoque.mercadorias },
  { from: "/dashboard/inventory/stock-count", to: ROUTES.estoque.contagem },
  { from: "/estoque/contagem-de-estoque", to: ROUTES.estoque.contagem },
  { from: "/estoque/contagemdeestoque", to: ROUTES.estoque.contagem },
  { from: "/estoque/balanco", to: ROUTES.estoque.contagem },
  { from: "/dashboard/inventory/categories", to: ROUTES.estoque.categorias },
  { from: "/dashboard/inventory/stock-entry", to: ROUTES.estoque.entradaManual },
  { from: "/estoque/entradamanual", to: ROUTES.estoque.entradaManual },
  {
    from: "/dashboard/inventory/purchases/imports",
    to: ROUTES.estoque.entradaXml,
  },
  { from: "/estoque/entradaxml", to: ROUTES.estoque.entradaXml },
  {
    from: "/estoque/entradaxml/pendentes",
    to: ROUTES.estoque.entradaXmlPendentes,
  },
  {
    from: "/estoque/entradaxml/historico",
    to: ROUTES.estoque.entradaXmlHistorico,
  },

  // Módulo Financeiro e Compras (legado + aliases)
  { from: "/financeiro", to: ROUTES.financeiro.contasAPagar },
  { from: "/dashboard/finance/payables", to: ROUTES.financeiro.contasAPagar },
  { from: "/financeiro/contasapagar", to: ROUTES.financeiro.contasAPagar },
  {
    from: "/financeiro/contasapagar/fixas",
    to: ROUTES.financeiro.contasAPagarFixas,
  },
  {
    from: "/financeiro/contasapagar/variaveis",
    to: ROUTES.financeiro.contasAPagarVariaveis,
  },
  {
    from: "/dashboard/purchase-orders",
    to: ROUTES.financeiro.pedidosDeCompra,
  },
  {
    from: "/financeiro/pedidosdecompra",
    to: ROUTES.financeiro.pedidosDeCompra,
  },
  { from: "/dashboard/suppliers", to: ROUTES.financeiro.fornecedores },

  // Módulo Equipe
  { from: "/dashboard/equipe", to: ROUTES.equipe },
  { from: "/dashboard/users", to: ROUTES.equipe },

  // Módulo Clientes e Trocas
  { from: "/dashboard/customers", to: ROUTES.clientes.lista },
  { from: "/clientes/insights", to: ROUTES.clientes.lista },
  { from: "/dashboard/returns", to: ROUTES.clientes.trocas },
  { from: "/clientes/trocas-e-creditos", to: ROUTES.clientes.trocas },
  { from: "/clientes/trocasecreditos", to: ROUTES.clientes.trocas },
  { from: "/trocas", to: ROUTES.clientes.trocas },

  // Módulo Crediário
  { from: "/dashboard/crediario", to: ROUTES.crediario.contas },
  { from: "/crediario/contas", to: ROUTES.crediario.contas },
  { from: "/crediario/contasdeclientes", to: ROUTES.crediario.contas },
  { from: "/dashboard/crediario/parcelas", to: ROUTES.crediario.parcelas },
  { from: "/crediario/parcelasevencimentos", to: ROUTES.crediario.parcelas },
  { from: "/dashboard/crediario/whatsapp", to: ROUTES.crediario.whatsapp },

  // Módulo Configurações e Fiscal
  { from: "/configuracoes", to: ROUTES.configuracoes.empresa },
  { from: "/dashboard/configuracoes", to: ROUTES.configuracoes.empresa },
  {
    from: "/dashboard/configuracoes/empresa",
    to: ROUTES.configuracoes.empresa,
  },
  {
    from: "/dashboard/configuracoes/payment-methods",
    to: ROUTES.configuracoes.pagamentos,
  },
  {
    from: "/configuracoes/formas-de-pagamento",
    to: ROUTES.configuracoes.pagamentos,
  },
  {
    from: "/configuracoes/formasdepagamento",
    to: ROUTES.configuracoes.pagamentos,
  },
  {
    from: "/dashboard/configuracoes/tributacao",
    to: ROUTES.configuracoes.tributacao,
  },
  { from: "/dashboard/fiscal/gestao", to: ROUTES.configuracoes.nfce },
  { from: "/fiscal/gestao", to: ROUTES.configuracoes.nfce },
  { from: "/fiscal/nfce", to: ROUTES.configuracoes.nfce },
  { from: "/configuracoes/gestao-nfce", to: ROUTES.configuracoes.nfce },
  { from: "/configuracoes/gestaonfce", to: ROUTES.configuracoes.nfce },
  { from: "/dashboard/audit", to: ROUTES.configuracoes.empresa },

  // Portal do Grupo
  { from: "/grupo-portal", to: ROUTES.grupoPortal.visaoGeral },
  { from: "/grupo-portal/dashboard", to: ROUTES.grupoPortal.visaoGeral },
  { from: "/grupo-portal/visaogeral", to: ROUTES.grupoPortal.visaoGeral },
  { from: "/grupo-portal/forecast", to: ROUTES.grupoPortal.previsao },
  { from: "/grupo-portal/previsaodecompras", to: ROUTES.grupoPortal.previsao },
];
