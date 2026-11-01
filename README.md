# PDV Lojista

Sistema de Ponto de Venda para lojas de calçados, camisetas, bonés, relógios e acessórios.

- **Aplicativo:** `sistema/` — React/Vite, NestJS e PostgreSQL/Prisma com um banco por tenant.
- **Identidade escolhida:** `identidade/roxo-branco/`.
- **Guia do sistema e execução:** `sistema/docs/ADAPTACAO-LOJISTA.md` e `sistema/docs/DEPLOY-RAILWAY-POSTGRESQL.md`.
- **Evidências locais:** `sistema/docs/validacao/` — capturas e teste de interface com dados fictícios e API simulada.

## Recursos principais

Grupos com foto e preço compartilhados; grade por tamanho/cor com saldo por variação; frente de caixa dedicada; trocas e crédito por cliente; resumo com vendas menos trocas e ranking por grupo; identidade roxa centralizada; sessões e caches isolados por tenant.
