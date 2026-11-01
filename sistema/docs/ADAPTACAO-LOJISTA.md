# Adaptação do PDV Adega para PDV Lojista

## Decisões de produto

Público: lojas independentes de centro comercial com alto giro de camisetas, calçados, bonés, relógios e acessórios. Direção aprovada: simples, confiável, fácil de usar, roxo e branco.

O usuário confirmou controle por **tamanho e cor**, **trocas de mercadoria** e **crédito para o cliente**.

## Catálogo e grade

`RetailGroup` representa um agrupamento comercial como “Camiseta Peruana”. Mantém nome, foto, preço de venda, custo das novas entradas, categoria e configurações fiscais do grupo. `Product` continua sendo a mercadoria vendável, agora com `retailGroupId`, `size`, `color` e chave de unicidade normalizada para a grade.

Exemplo: “Camiseta Peruana” pode conter M/Preta com 5 unidades e G/Branca com 7. O caixa mostra um cartão do grupo e solicita a variação. O leitor de código identifica diretamente a variação quando existe um código cadastrado. Estampas não exigem cadastro individual.

O preço e a foto são propagados às variações em transação. Um campo de versão impede salvar um editor desatualizado sobre uma alteração de outro terminal. Entradas acrescentam estoque por variação e criam lote/log; não substituem o saldo que apareceu na abertura do formulário. Ao arquivar o grupo, as variações mantêm seu estado individual e o grupo deixa de ser vendido.

Itens importados sem grupo podem ser organizados a partir da lista “Ver itens importados sem grupo”. A organização reutiliza o ID e os lotes do produto, preservando estoque e histórico. Essa lista traz até 200 resultados e aceita filtro por nome.

Unidade comercial e tamanho são conceitos separados. A grade aceita P/M/G/GG, numeração de calçados e outros rótulos. A unidade vendável é UN; as APIs de cadastro comum também aceitam PAR/CX/PCT/KIT. Conceitos de litros, ml, ingredientes e preparo são recusados no cadastro lojista.

## Troca e crédito

`RetailReturn`/`RetailReturnItem` registram a venda de origem, itens, quantidades, motivo, usuário e decisão de retorno ao estoque. `StoreCredit` mantém o saldo por cliente. `StoreCreditUse` registra a utilização do crédito em uma venda e eventual restituição no cancelamento.

- A troca exige uma venda concluída e um cliente cadastrado na mesma loja.
- A quantidade devolvida anteriormente reduz o que ainda pode ser trocado.
- O valor considera os preços da venda original e seu desconto, com rateio em centavos. Acréscimos não viram crédito de mercadoria; itens gratuitos não recebem resíduos de arredondamento.
- Somente peças marcadas como vendáveis retornam ao estoque, com novo lote e log.
- A mesma chave de solicitação recupera a mesma troca. Conteúdo diferente com a mesma chave é recusado.
- A tentativa é preservada no navegador antes do envio para recuperar uma resposta perdida.
- O crédito é validado por titular e consumido por atualização condicional de saldo na mesma transação da venda. Pode ser combinado com Pix, dinheiro, cartão e métodos comuns cadastrados.
- Crédito não é aceito como pagamento iniciado offline. Uma venda já enviada cuja resposta se perdeu é recuperada pela identificação original.
- Cancelar uma venda que usou crédito restitui o saldo com registro de auditoria. Uma venda que já gerou troca não pode ser cancelada e devolver o estoque de novo.
- Trocas são restritas a perfis de administração; estoquista pode manter a grade, mas não emitir crédito.
- O módulo **Clientes e insights** (`/dashboard/customers`), integrado em sub-abas com **Trocas e créditos**, consolida a carteira de clientes da loja, indicadores RFM (VIPs, ativos 30d, sumidos +60d, créditos em aberto), cadastro completo (`cpfCnpj`, `address`, `reference`) e o **Raio-X 360º** individual com DNA de tamanhos/cores comprados, histórico de compras, extrato de créditos e início rápido de troca.
- O módulo **Vitrine Digital e TV** (`/vitrine` e `/vitrine/aparencia`, controlado pela flag `modulos.vitrineDigital` no `/sys-init`) adapta o antigo reprodutor de TV para o varejo de moda/calçados/acessórios: permite montar programação com slides individuais de grupos/produtos (exibindo pílulas de tamanhos e cores com estoque disponível em tempo real, preço normal, preço promocional e selo de campanha) e grades de coleção de 2 a 6 peças, pré-visualizar em 16:9 ao vivo e transmitir em qualquer Smart TV ou segundo monitor pela rota pública `/tv/:tvPublicId` (com polling ETag `304 Not Modified` e temas 100% restritos à paleta roxa, branca e neutra aprovada).

Este fluxo é o registro comercial de troca/crédito. Ele não cria automaticamente documento fiscal de devolução, nem foi homologado como fluxo fiscal de devolução. A emissão fiscal existente foi reaproveitada e precisa ser validada no ambiente próprio da empresa.

## Multi-tenant e estrutura reutilizada

Foram mantidos Heart/mestre, banco por tenant, contexto assíncrono por requisição, pool de conexões, JWT, identificação do operador por PIN, caixa/fechamento, persistência durável de checkout, lotes, fornecedores, compras, contas a pagar, categorias, cadastros de equipe e integrações fiscais existentes.

A sessão e o banco IndexedDB têm nomes próprios do Lojista. O catálogo offline usa chave composta por tenant e ID do produto. O service worker não cacheia JSON autenticado por URL; esse cache poderia misturar respostas entre lojas no mesmo navegador. A identidade de loja retornada no login passa a usar o UUID do tenant.

Administradores de uma loja não podem listar todos os tenants SaaS nem editar os dados ou a logo de outra loja. A exclusão de tenant fica restrita ao superadministrador. A gestão por Sys-Init continua protegida por PIN configurado no ambiente, sem os PINs padrão herdados.

## Módulos e configurações retirados do fluxo

As rotas de cozinha/KDS, bar, carvoaria, garçom, comandas e mesas não pertencem ao aplicativo lojista. `ComandasModule` não é registrado na aplicação. Flags antigas desses módulos são neutralizadas e tokens de estação são recusados. As chamadas herdadas de sincronização de estoque com iFood são adaptadores sem envio externo, e o controlador dessas integrações não é registrado.

Código/tabelas legados necessários à compatibilidade de tipos e históricos permanecem na cópia, mas não são apresentados como recursos ativos do Lojista. Não houve remoção destrutiva de tabelas.

O provisionamento cria apenas categorias iniciais de loja. Não semeia cervejas, bebidas, cigarros, produtos de exemplo ou perfis fiscais da adega. Os grupos tributários devem ser configurados para cada empresa.

## Identidade visual

Fonte dos valores: `../../identidade/roxo-branco/paleta.json` no projeto principal. Tokens ativos do frontend: `frontend/src/brand-tokens.css`.

| Papel | Cor |
| --- | --- |
| Principal | #7C3AED |
| Interação principal | #6D28D9 |
| Branco | #FFFFFF |
| Fundo | #F8F7FC |
| Apoio | #F3E8FF |
| Texto | #272321 |
| Texto auxiliar | #665F70 |
| Bordas | #E5E1ED |

O build verifica cores literais e classes de cor nos arquivos fonte e recusa valores fora dessa paleta. Os avisos usam texto/ícones em roxo e neutros, sem uma cor externa para cada status. Login, caixa, gestão, resumo, grade, troca, logo, favicon e manifest PWA foram adaptados. Módulos administrativos pesados carregam sob demanda.

## Executar no ambiente próprio

Requisitos: Node.js 22.12 ou superior compatível, npm e MySQL 8. Configurar um banco Heart próprio do Lojista e credenciais adequadas para provisionar os bancos das novas lojas.

1. Em `backend/`, copiar `.env.example` para `.env` e preencher as URLs do ambiente do Lojista, `JWT_SECRET` e `SETUP_PIN`. O PIN do Sys-Init deve ter **4 a 10 caracteres**, conforme a capacidade da tela herdada.
2. Instalar as dependências separadamente em `backend/` e `frontend/` com `npm ci`.
3. Em `sistema/`, executar `npm run prisma:generate`. Esse comando gera clientes locais, sem atualizar bancos.
4. Em terminais separados, executar `npm run dev:api` e `npm run dev:web` em `sistema/`.
5. Backend local: `http://127.0.0.1:3530/api`. Frontend: `http://127.0.0.1:3531`.
6. No Sys-Init do novo ambiente, usar o PIN configurado. Para inicializar o Heart vazio, marcar “Incluir Heart” e acionar “Atualizar Bancos”; depois provisionar uma loja de homologação. Para bancos lojistas já existentes, selecionar as lojas próprias do Lojista e atualizar pelo painel.

Nenhum comando de migration, db push ou seed foi executado contra bancos nesta implementação. A aplicação dos schemas é feita pelo usuário pela interface Sys-Init, seguindo a regra do projeto. O serviço PHP fiscal continua disponível como código reaproveitado em `nfce-service/` e exige configuração própria antes dos testes de NFC-e.

## Validação e limites conhecidos

- Schemas Prisma validados e clientes gerados sem conexão com banco de clientes.
- Backend e frontend compilados localmente.
- Testes de regras do varejo e regressão de idempotência/atualizador de schemas executados; os números finais estão em `validacao/resultado-final.json`.
- Teste de navegador com API simulada: login, PIN, agrupamento, variação, pagamento misto com crédito, chave idempotente, cadastro de oito combinações, troca, resumo líquido de trocas, cache de dois tenants com o mesmo ID e layout móvel. Fixtures e relatório identificam explicitamente a simulação.
- Capturas em `validacao/`: login, caixa, catálogo, resumo e catálogo móvel, sempre com dados fictícios.
- MySQL real e Docker não foram usados: o serviço Docker Desktop não estava ativo nesta máquina. Não houve criação ou atualização de banco real nesta execução.
- Ainda falta homologar: provisionamento e atualização via Sys-Init em MySQL; concorrência real entre terminais; recebimento por XML com documentos da loja; cancelamento e relatórios de caixa; emissão fiscal; leitores/impressoras; fluxo fiscal de devolução.

As assinaturas SVG reutilizam a tipografia editável do estudo de marca. A conversão das letras em curvas continua sendo um acabamento do arquivo gráfico, sem relação com o funcionamento do sistema.
