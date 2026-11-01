# PDV Lojista

O aplicativo fica em `sistema/`. Os estudos de marca ficam em `identidade/`; a direção escolhida está em `identidade/roxo-branco`.

- Preservar o isolamento por banco de tenant, autenticação, transações, idempotência e estoque concorrente.
- Não executar `prisma migrate`, `prisma db push` nem seeds contra bancos de clientes. Gerar e validar clientes Prisma localmente é permitido. A aplicação de esquemas é feita pelo usuário pelo Sys-Init.
- Documentar alterações em `sistema/docs/`. A documentação antiga do Obsidian de outro usuário não pertence a este produto.
- Interface exclusivamente com tokens da paleta roxa, branca e neutra aprovada; não introduzir cores de status externas à paleta. Comunicar estado também por texto e ícones.
- Grupos compartilham foto e preço; tamanho e cor têm estoque próprio. Manter histórico de itens e preço das vendas.
- Módulos de cozinha, bar, carvoaria, garçom e mesas não fazem parte deste produto.
