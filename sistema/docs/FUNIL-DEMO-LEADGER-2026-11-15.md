# Funil de Demonstração Automatizado (PDV Lojista + Teltech Leadger)

Data: 2026-11-15

## Visão Geral

Toda vez que um visitante acessa a **Loja Demonstração** gratuita do **PDV Lojista** informando nome e WhatsApp (`captureDemoLead`), o backend salva/atualiza o `Lead` no banco Heart e enfileira imediatamente no `webhook_outbox` um evento assinado `lead.demo_accessed` (Envelope v1 HMAC-SHA256) destinado ao **Teltech Leadger**.

O **Teltech Leadger** atua como central unificada de WhatsApp (Baileys) e CRM de prospecção para todos os produtos da Teltech:

- Dispara automaticamente uma **régua comercial provocante de 7 etapas** (mais gatilho de retorno após 24h+) para `pdv_lojista`, ou uma régua SaaS de 4 etapas + retorno para outros sistemas integrados.
- Agenda envios respeitando horário comercial (`America/Sao_Paulo`, 08:30–20:00) e *jitter* anti-bloqueio.
- Pausa automaticamente os próximos disparos assim que o lead responde no WhatsApp (`lead_replied`), quando o operador envia mensagem manual pelo celular ou painel (`operator_manual_chat`), quando o lead solicita parada (`opt_out`), ou quando o cliente é sincronizado como pagante ativo (`client.upsert` / `base.upsert`).

---

## Arquitetura & Fluxo

1. **Captura no PDV Lojista (`POST /auth/demo-login`)**:
   - `TenantsService.captureDemoLead()` cria ou incrementa `accessCount` na tabela `leads` (Heart DB).
   - Aciona de forma não-bloqueante `LeadgerWebhookService.enqueueDemoLeadEvent()`, gravando na tabela `webhook_outbox` (`eventType = "lead.demo_accessed"`, `tenantId = null`) e disparando o POST assinado para `POST /api/webhooks/inbound/:source`.
2. **Orquestração & Régua no Teltech Leadger**:
   - Tabelas criadas automaticamente/migradas: `demo_leads`, `lead_cadence_steps` e vínculo `demo_lead_id` / `cadence_step` em `whatsapp_messages`.
   - As mensagens futuras ficam agendadas em `demo_leads.next_step_at` e só entram em `whatsapp_messages` no momento exato do envio (*just-in-time*), mantendo o chat ao vivo limpo.
   - Painel completo em `/funil-demo` (**Funil Demo** na barra lateral do Leadger):
     - Filtro por produto (`pdv_lojista`, outros produtos conectados ou todos).
     - Barra de progresso por lead, histórico expansível de mensagens enviadas, atalho direto para abrir a conversa no **Monitoramento**, botões **Enviar Agora**, **Pausar/Retomar**, **Converter** e **Testar / Novo Lead**.
     - Aba **Régua Provocante** para editar textos, atrasos, janelas de horário e pré-visualizar cada etapa por produto.
3. **Acompanhamento Simplificado no `/sys-init` do PDV Lojista**:
   - Na aba **Leads Demo** (`LeadsPanel.tsx`), cada card exibe o resumo da régua vinda do endpoint assinado `GET /api/webhooks/inbound/:source/leads-summary` combinada com o status local da fila `webhook_outbox`:
     - Quantidade de mensagens enviadas (`X/7 enviadas`), horário do próximo disparo, ou motivo de pausa (`Respondeu no WhatsApp`, `Atendimento humano`, `Convertido`).
     - Botões **Sincronizar Leads c/ Leadger** (lote) e **Enviar / Atualizar** (individual).

---

## Configuração de Variáveis de Ambiente

### 1. No PDV Lojista (`sistema/backend/.env`)

```env
LEADGER_SOURCE=pdv_lojista
LEADGER_WEBHOOK_URL=https://SEU-DOMINIO-LEADGER/api/webhooks/inbound/pdv_lojista
LEADGER_WEBHOOK_SECRET=SEU_SEGREDO_COM_NO_MINIMO_32_CARACTERES
```

> **Importante**: O contrato de segurança do Teltech Leadger exige que `LEADGER_WEBHOOK_SECRET` tenha **no mínimo 32 caracteres**.

### 2. No Teltech Leadger (`INBOUND_WEBHOOK_INTEGRATIONS`)

O JSON `INBOUND_WEBHOOK_INTEGRATIONS` no servidor do Teltech Leadger deve conter a entrada correspondente com o mesmo `source` e `secret` (para eventos `lead.demo_accessed`, `accountId` pode ser `null` caso ainda não haja conta financeira vinculada, ou o UUID da conta financeira para conciliar também `base.upsert` / `invoice.upsert`):

```json
[
  {
    "source": "pdv_lojista",
    "name": "PDV Lojista",
    "secret": "SEU_SEGREDO_COM_NO_MINIMO_32_CARACTERES",
    "workspaceId": "UUID_DO_WORKSPACE",
    "projectId": "UUID_DO_PROJETO",
    "accountId": "UUID_DA_CONTA_OU_NULL"
  }
]
```

---

## Contrato do Evento `lead.demo_accessed` (Envelope v1)

Headers enviados pelo PDV Lojista:
- `X-Leadger-Timestamp`: epoch em segundos
- `X-Leadger-Signature`: `sha256=<HMAC_SHA256(secret, timestamp + "." + source + "." + rawBody)>`

Payload JSON:

```json
{
  "schemaVersion": 1,
  "eventId": "evt_lead_<uuid>_v1_<rand>",
  "eventType": "lead.demo_accessed",
  "occurredAt": "2026-11-15T14:00:00.000Z",
  "data": {
    "externalId": "lead-<uuid>",
    "version": 1,
    "name": "Maria Silva",
    "phone": "+5511999998888",
    "email": null,
    "accessCount": 1,
    "isFirstAccess": true,
    "previousAccessAt": null,
    "sourceLabel": "PDV Lojista",
    "notes": null
  }
}
```
