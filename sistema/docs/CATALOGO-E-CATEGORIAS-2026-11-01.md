# Catálogo de demonstração e categorias no cadastro

## Nova categoria sem sair do produto

Em **Catálogo e Estoque → Mercadorias e grades → Novo grupo** (ou ao editar um
grupo), o botão **Nova categoria** fica sempre disponível abaixo do seletor de
categoria. O cliente pode informar um nome e clicar em **Criar categoria**.

A categoria é criada para a loja autenticada, fica selecionada automaticamente
e os campos já preenchidos do produto são mantidos. Enter no nome da categoria
cria a categoria sem enviar o formulário do produto. Cancelar fecha somente a
criação da categoria. Um nome já presente na lista é selecionado sem duplicação.
A tela **Categorias** continua disponível para a administração das categorias.

## Foto por arquivo ou link

O envio de JPEG, PNG e WebP continua disponível. **Usar link de foto** permite
informar uma URL HTTP/HTTPS e conferir a prévia com **Aplicar foto**. O link só é
gravado quando o grupo é salvo. URLs inválidas ou contendo usuário e senha são
recusadas. O backend já aceitava URLs no campo `imageUrl`; não há mudança de
API nem migração de banco.

As imagens ilustrativas do catálogo desta demonstração ficam em
`frontend/public/demo-catalogo/fotos/`. As fontes de cada arquivo ficam em
`docs/catalogo-demo-fontes/`. Os preços, custos e saldos são exemplos fictícios.
Nenhum item é criado automaticamente no boot ou no deploy: os cadastros usam
o formulário normal da loja autenticada.

## Validação

- Build do frontend com TypeScript e verificação da paleta aprovada.
- Testes existentes de catálogo, estoque e isolamento por loja.
- Verificação da inicialização sem execução automática de migrações.
- Conferência visual dos arquivos de foto realizada. A conferência do formulário
  no catálogo está pendente: o controle do navegador desconectou durante a prévia.

## Estado da entrega

A publicação foi bloqueada pela revisão automática por exigir autorização
explícita para alterar o serviço em produção. O código e as imagens estão
preparados localmente; não estão publicados por esta alteração.

Os 12 acessórios previstos (quatro bonés, quatro relógios e quatro óculos) estão
descritos em `catalogo-demo-fontes/acessorios-pendentes.json`, com códigos, custos,
preços e saldos. Ainda precisam ser cadastrados na loja. As fotos dos 12 modelos
de roupa existentes também precisam ser aplicadas no formulário da loja.
