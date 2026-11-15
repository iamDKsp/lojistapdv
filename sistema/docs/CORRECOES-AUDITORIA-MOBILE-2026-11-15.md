# Correções da Auditoria Mobile (Ondas 1 e 2) — 15/11/2026

Implementação das correções estruturais e responsivas priorizadas a partir da auditoria mobile (`AUDITORIA-MOBILE.md`), preservando integralmente o menu cápsula flutuante inferior estilo app nativo (`.retail-mobile-tabbar`), seu efeito glassmorphism, sua coreografia de auto-ocultação por rolagem (`mobileNavHidden`) e o bloqueio de zoom nativo configurado no shell.

## Decisões preservadas

- **Menu flutuante mobile intocado:** nenhuma alteração visual, estrutural ou comportamental em `.retail-mobile-tabbar`, `.retail-mobile-tab`, `.retail-mobile-bag-bar` ou `.retail-mobile-drawer`.
- **Bloqueio global de zoom mantido:** preservada a configuração existente em `frontend/index.html` e `frontend/src/main.tsx`.
- **Modo paisagem em smartphones:** a experiência mobile (incluindo o menu flutuante inferior e os cartões responsivos) passa a permanecer ativa também quando o aparelho touch é girado na horizontal (`@media (max-width: 768px), ((max-height: 500px) and (pointer: coarse))`), com proteção lateral de `env(safe-area-inset-left/right)` para Dynamic Island/notch.

## Alterações implementadas

### Onda 1 — Desbloqueios de ações, sobreposições e rodapés

1. **Folga inferior das telas administrativas e compactação da Loja Virtual (`management.css`, `RetailStorefrontPage.tsx`):**
   - Restaurado `padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px))` em `.retail-dashboard-frame .retail-content` no mobile para impedir que controles no final das páginas fiquem ocultos sob `.retail-mobile-tabbar`.
   - Compactado o cabeçalho compartilhado de `Loja Virtual` no mobile: URL pública e botões `Copiar`/`Abrir` em linha única com truncamento seguro e ações (`Pausar`, `Configurações`, `Rascunho`, `Publicar`) em grade `2 × 2`, eliminando a sobreposição sobre a barra `Editar` / `Prévia` da aba `Aparência` na primeira dobra (`375 × 667`, `390 × 844`, `430 × 932`).
2. **Eliminação do corte de `~14 px` nos rodapés de `RetailDialog` e modais administrativos (`retail.css`, `management.css`, `UserModal.tsx`, `OperatorsManagementModal.tsx`, `ExportXmlModal.tsx`, `AddPayableModal.tsx`):**
   - Convertido `.retail-dialog` mobile (e `> form:has(> .retail-dialog-body)`) para coluna flexível (`display: flex; flex-direction: column; overflow: hidden`) com altura limitada por `min(92dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 8px))`, cabeçalho e `.retail-dialog-footer` fixos (`flex-shrink: 0`) e rolagem única concentrada no corpo (`flex: 1 1 auto; min-height: 0; overflow-y: auto`), eliminando a constante mágica `calc(92dvh - 132px)` e a dupla barra de rolagem.
   - Alinhada a especificidade de `body:has(.retail-dashboard-frame) .retail-dialog > header` no mobile e padronizados os modais auxiliares (`z-[150]`, `max-h-[92dvh]`, `env(safe-area-inset-bottom)`).
3. **Cabeçalho e ações por toque em Tributação e Fornecedores (`tributacao/page.tsx`, `suppliers/page.tsx`):**
   - Reorganizado o topo de `Grupos Tributários` em grade responsiva (`Restaurar Padrões`, `Exportar XML` e `Novo Grupo` com `min-h-[44px]` e 100% visíveis desde `375 px`).
   - Removida a dependência exclusiva de hover (`opacity-0 group-hover:opacity-100` -> `opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100`) nos botões de editar/excluir em telas de toque, adicionando ícones acompanhados de texto nos estados `Ativo`/`Inativo`.

### Onda 2 — Adaptação das 4 tabelas prioritárias e trilhos horizontais

1. **Tabelas convertidas para cartões mobile sem rolagem horizontal (`RetailStorefrontPage.tsx`, `users/page.tsx`, `categories/page.tsx`, `payables/page.tsx`):**
   - `Loja Virtual → Produtos`: tabela adaptada com `retail-table-cards`, seleção unitária e em lote no mobile, chave `Visível`/`Oculto`, botão `Destaque`/`Normal` e ação `Personalizar`.
   - `Equipe`: cartões mobile com avatar, nome, e-mail, emblemas de função e status com ícone + texto (`Acesso Liberado` / `Acesso Bloqueado`) e botão de bloqueio/liberação em largura total, mantendo a tabela completa no desktop.
   - `Estoque → Categorias`: cartões mobile com ícone oficial, volume de grupos/variações, regra fiscal NFC-e, chave `Ativa no PDV`/`Inativa` e botões de edição/exclusão com área mínima de toque adequada.
   - `Financeiro → Contas a Pagar`: filtros de mês/ano + `Nova Conta` ajustados para `375 px`, pílulas de `Planejamento das contas fixas` com `flex-wrap`, estado vazio sem cabeçalho largo de tabela e cartões mobile com vencimento, recorrência, status (ícone + texto) e ações (`Baixar Conta`, `Editar`, `Excluir`).
2. **Centralização automática de abas e filtros horizontais (`RetailLayout.tsx`, `empresa/page.tsx`, `fiscal/gestao/page.tsx`):**
   - Adicionada rolagem horizontal suave (`scrollTo`) para manter a aba ou filtro ativo centralizado ao navegar entre sub-rotas (`Estoque`, `Loja Virtual`, `Configurações da Empresa` e filtro de status em `Gestão Fiscal`), separando o seletor `Todas Origens` em linha própria no mobile para evitar vazamento horizontal.

## Arquivos alterados

1. `frontend/src/retail/retail.css`
2. `frontend/src/retail/management.css`
3. `frontend/src/retail/RetailLayout.tsx`
4. `frontend/src/retail/RetailPosPage.tsx`
5. `frontend/src/retail/RetailStorefrontPage.tsx`
6. `frontend/src/app/dashboard/configuracoes/tributacao/page.tsx`
7. `frontend/src/app/dashboard/configuracoes/empresa/page.tsx`
8. `frontend/src/app/dashboard/fiscal/gestao/page.tsx`
9. `frontend/src/app/dashboard/suppliers/page.tsx`
10. `frontend/src/app/dashboard/users/page.tsx`
11. `frontend/src/app/dashboard/inventory/categories/page.tsx`
12. `frontend/src/app/dashboard/finance/payables/page.tsx`
13. `frontend/src/components/UserModal.tsx`
14. `frontend/src/components/OperatorsManagementModal.tsx`
15. `frontend/src/components/ExportXmlModal.tsx`
16. `frontend/src/components/AddPayableModal.tsx`

Nenhuma migração de banco, contrato de API, regra de autenticação, isolamento multi-tenant, transação de venda ou controle concorrente de estoque foi alterado.
