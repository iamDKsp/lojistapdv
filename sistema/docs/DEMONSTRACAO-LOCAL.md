# Testar sem MySQL

Foi disponibilizado um modo local de demonstração porque o Docker Desktop não conseguiu disponibilizar o MySQL nesta máquina.

Esta demonstração usa a interface real com uma API local simulada e dados fictícios em `.local/demonstracao.json`. Não inicia a API NestJS nem acessa bancos de clientes. A faixa “Demonstração local” permanece visível na interface.

- Interface: http://127.0.0.1:3531
- API de demonstração: http://127.0.0.1:3530/api
- E-mail: `demo@lojista.local`
- Senha de demonstração: `Lojista123!`
- Operador: `Operador de demonstração`
- PIN de demonstração: `1234`
- Painel `/sys-init`: `http://127.0.0.1:3531/sys-init` (PIN padrão `teltech352` ou variável `SETUP_PIN`)

Ao clicar em **Loja Demonstração** na tela de login, o modal em 2 etapas pergunta *"Qual seu nome?"* e *"Qual seu WhatsApp?"*, registra o visitante sem duplicidade na aba **Leads** do `/sys-init` e abre o balcão já com produtos com fotos, caixa de teste aberto, contas a pagar alimentadas e estoque completo. Sempre que a sessão é encerrada ou outro visitante acessa a demonstração, os dados da loja voltam ao estado habitual (preservando os leads capturados).

Pode testar catálogo, criação/edição de grupos, grades, entradas de peças, financeiro (contas a pagar, fornecedores e pedidos de compra), vendas com pagamentos mistos, escolha de cliente, trocas e resgate de crédito. Há uma venda fictícia nº 1 para testar uma troca imediatamente. Os códigos de barras dos exemplos começam em 1000.

Os dados de teste ficam salvos entre reinicializações. Recursos fiscais, upload de fotos, compras e auditoria completa de caixa exigem a API real com MySQL. A demonstração não valida o comportamento transacional do banco ou uma operação real.

Para iniciar novamente:

1. Em `sistema/`, executar `node scripts/demo-local.cjs`.
2. Em outro terminal PowerShell, em `sistema/frontend/`, definir `$env:VITE_LOCAL_DEMO='true'` e executar `npm run dev -- --host 127.0.0.1 --port 3531 --strictPort`.

Para usar a API real, parar os dois processos da demonstração e seguir o guia `ADAPTACAO-LOJISTA.md`. Não iniciar as duas APIs simultaneamente na porta 3530.
