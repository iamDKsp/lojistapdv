# Redesenho da gestão — 08/11/2026

Implementação local da direção aprovada: aumentar espaço útil, reduzir ornamentação e organizar os módulos administrativos. Login, frente de caixa e navegação lateral foram preservados.

## Alterações

- Cabeçalho compacto com identificação da loja, área atual e menu de usuário. Operações locais, empresa e equipe continuam acessíveis nesse menu; troca de loja, rede, modo caixa e saída continuam disponíveis conforme permissões existentes.
- Uma única linha de abas por módulo, com indicação discreta da seção ativa. Loja virtual e TV deixam de repetir a navegação dentro do conteúdo; pendências da loja virtual continuam com atalhos contextuais.
- Títulos, filtros, ações, tabelas, campos e diálogos administrativos compartilham espaçamento e hierarquia mais compactos. Indicadores do resumo e financeiro passam a priorizar comparação entre valores.
- Ranking comercial com superfícies claras, valores legíveis e menos sombras, brilhos e elementos ornamentais. Calendário mantém a indicação de seleção sem deslocar células.
- Transições de conteúdo por opacidade em 120 ms; diálogos em 140 ms. Removidos movimentos de cartões, saltos no hover e blur dos diálogos administrativos. Respeitada a preferência por movimento reduzido.
- Navegação por teclado com foco visível e atalho para o conteúdo; abas com rolagem horizontal em larguras menores; controles por toque mantêm alvo mínimo de 44 px nas classes compartilhadas.

## Escopo técnico

Quatro arquivos de produção alterados:

1. `frontend/src/retail/RetailLayout.tsx`
2. `frontend/src/retail/management.css`
3. `frontend/src/retail/RetailStorefrontPage.tsx`
4. `frontend/src/retail/RetailVitrinePage.tsx`

CSS restrito ao frame administrativo e aos seus diálogos. Não foram alterados autenticação, backend, modelos de IA, contratos de API, transações, regras de estoque nem dependências. Atualizações recentes encontradas no projeto foram incorporadas à base de revisão e preservadas ao aplicar as mudanças visuais.

## Verificação e limites

- Build de produção, TypeScript e verificação dos 100 arquivos da paleta aprovados.
- Comparação de SHA-256 e AST do TypeScript confirmou que os elementos JSX da lateral, navegação móvel e ramo da rota de PDV permanecem iguais à base. Os demais arquivos de origem permanecem iguais à base atualizada.
- O resumo administrativo foi inspecionado visualmente no navegador em 1280 × 720 durante a preparação. A conexão de controle do navegador falhou antes de concluir as demais telas e a verificação em celular. A versão final e os ajustes posteriores do ranking ainda precisam de revisão visual no navegador.
- A prévia local usa dados fictícios e recusa gravações. Não comprova integração com APIs nem funcionamento completo de todos os módulos.
- Há aviso de bundle principal acima de 500 kB e base Browserslist desatualizada. O redesenho não resolve a divisão do JavaScript em partes menores.
- A redução de efeitos elimina trabalho visual desnecessário, mas não foi medido ganho de FPS, latência ou tempo de carregamento. Não há alegação de melhoria quantitativa de performance.

## Revisão pendente antes da publicação

Conferir desktop e celular nos módulos Resumo, Estoque, Financeiro, Clientes, Crediário, Inteligência, Equipe, Configurações, Fiscal, Loja virtual e TV. Conferir especialmente o menu do perfil em contas com múltiplas lojas, os diálogos e gavetas, a legibilidade do ranking e as ações de salvar/publicar dos editores. Fazer uma conferência visual de login e PDV para confirmar o isolamento dos estilos.

As mudanças estão no código local; esta tarefa não publica a aplicação.
