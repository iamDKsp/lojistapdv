# Adaptação visual da gestão — 01/11/2026

Adaptação da direção visual validada em prévia ao sistema existente. A navegação da prévia não foi transportada para o produto.

## Escopo

- `frontend/src/retail/management.css` concentra a camada visual, importada após `retail.css`.
- Todo seletor de aparência fica dentro de `.retail-dashboard-frame`, ou de um diálogo quando essa área está montada. Login, PDV e loja pública não montam esse elemento.
- Menu lateral, menu móvel, subabas, destinos, permissões e atalhos continuam com seu código e CSS anteriores.
- Tipografia, superfícies, espaçamento, botões, campos e tabelas usam os tokens existentes. Nenhuma fonte externa ou dependência foi adicionada.
- O resumo conserva os seis indicadores e o ranking, com maior destaque para vendas concluídas. As ressalvas sobre lucro, caixa e trocas foram preservadas.
- Contas a pagar conserva filtros, planejamento recorrente, quatro indicadores, abas e todas as ações. Classes visuais nomeadas substituem a necessidade de alterar a lógica.
- Diálogos `RetailDialog` recebem a aparência somente na gestão, inclusive quando renderizados em portal. O componente compartilhado e seus comportamentos de fechamento, foco e gravação não foram alterados.
- A animação de entrada da gestão passa a usar apenas opacidade, evitando que um `transform` persistente desloque modais com posicionamento fixo.

## Limites

Não há alterações em APIs, banco, regras de negócio ou dados. O código de login, frente de caixa, rotas e menus não foi editado nesta adaptação. Não há implantação incluída.

## Verificação

- `npm --prefix frontend run build`: identidade visual, TypeScript e build aprovados.
- Revisão no navegador com componentes reais e adaptador local de dados fictícios. Nenhum backend foi contatado; gravações foram bloqueadas no adaptador de revisão.
- Desktop: resumo, estoque e contas a pagar; abertura e fechamento do formulário de grupo e do drawer financeiro. O drawer foi conferido com 720 px de altura, ocupando o viewport.
- Comparação com a camada CSS ligada/desligada: 19 elementos de menu/subabas com destinos, geometria e cores idênticos.
- Caixa: 198 elementos renderizados com cor, fundo, fonte, espaçamento, arredondamento, display e grade idênticos com a camada ligada/desligada. O catálogo vazio e a seleção de operador eram os estados da revisão; vendas reais não foram executadas.
- Celular de 390 × 844 px: conteúdo do resumo com largura útil e largura de rolagem iguais (362 px), formulário de grupo sem transbordamento horizontal (390 px). Navegação móvel original preservada.
- Login, PDV, RetailLayout, App, rotas e retail.css comparados byte a byte com as cópias anteriores ao trabalho.

A revisão usa amostras das telas para validar a camada compartilhada; não substitui homologação completa de cada operação de negócio. Não houve testes de gravação em banco nem implantação.
