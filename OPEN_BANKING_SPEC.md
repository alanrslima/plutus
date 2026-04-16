# Open Banking Integration — Specification Document

## 1. Visão Geral

O Plutos integra com o **Open Finance Brasil** (anteriormente Open Banking Brasil) via agregador **Pluggy**, que abstrai a complexidade das APIs de múltiplas instituições financeiras.

**Pluggy** é uma plataforma de agregação financeira para América Latina, homologada pelo Banco Central do Brasil, que oferece:
- Conexão com +200 bancos e corretoras brasileiras
- SDK para auth flow (Pluggy Connect Widget)
- Webhooks para sincronização automática
- Ambiente sandbox gratuito para desenvolvimento

**Site:** https://pluggy.ai  
**Docs:** https://docs.pluggy.ai

---

## 2. Fluxo de Autenticação

```
Usuário                Plutos Frontend         Plutos Backend          Pluggy API
  |                         |                       |                       |
  |-- Clica "Conectar" ---->|                       |                       |
  |                         |-- POST /open-banking/connect-token ---------->|
  |                         |<-- connectToken --------------------------------|
  |                         |                       |                       |
  |<-- Abre Pluggy Widget --|                       |                       |
  |   (modal com lista      |                       |                       |
  |    de bancos)           |                       |                       |
  |-- Seleciona banco ------>|                       |                       |
  |-- Insere credenciais --> (widget gerencia diretamente com Pluggy)        |
  |                         |                       |                       |
  |<-- Widget retorna -------|                       |                       |
  |   itemId                |                       |                       |
  |                         |-- POST /open-banking/connect  --------------->|
  |                         |   { itemId }          |                       |
  |                         |                       |-- Busca contas ------>|
  |                         |                       |<-- accounts[] ---------|
  |                         |                       |                       |
  |                         |                       |-- Salva no banco      |
  |                         |<-- connections[] ------|                       |
  |<-- Lista conexões -------|                       |                       |
```

---

## 3. Modelos de Dados

### 3.1 BankConnection (nova entidade)

Representa uma conexão com uma instituição financeira via Pluggy.

```
BankConnection {
  id                String   (UUID, PK)
  userId            String   (FK → User)
  itemId            String   (ID do Item na Pluggy — único por conexão)
  institutionName   String   (ex: "Nubank", "Bradesco")
  institutionLogo   String?  (URL da logo da instituição)
  status            Enum     (ACTIVE | UPDATING | ERROR | DISCONNECTED)
  lastSyncAt        DateTime?
  createdAt         DateTime
  updatedAt         DateTime
}
```

### 3.2 LinkedAccount (nova entidade)

Representa uma conta bancária vinculada dentro de uma conexão.

```
LinkedAccount {
  id                String   (UUID, PK)
  connectionId      String   (FK → BankConnection, cascade delete)
  userId            String   (FK → User)
  pluggyAccountId   String   (ID da conta na Pluggy)
  accountId         String?  (FK → Account — conta local vinculada)
  name              String   (ex: "Conta Corrente", "Conta Poupança")
  type              Enum     (BANK | CREDIT | INVESTMENT | LOAN)
  number            String?  (número mascarado da conta, ex: "****1234")
  balance           Decimal  (15,2)
  currencyCode      String   (padrão "BRL")
  autoSync          Boolean  (sincronização automática habilitada)
  lastSyncAt        DateTime?
  createdAt         DateTime
  updatedAt         DateTime
}
```

### 3.3 SyncLog (nova entidade)

Registra o histórico de sincronizações para auditoria e debug.

```
SyncLog {
  id                String   (UUID, PK)
  linkedAccountId   String   (FK → LinkedAccount)
  userId            String   (FK → User)
  status            Enum     (SUCCESS | PARTIAL | FAILED)
  transactionCount  Int      (número de transações importadas)
  errorMessage      String?
  startedAt         DateTime
  completedAt       DateTime?
}
```

---

## 4. API Endpoints (Backend)

### POST `/open-banking/connect-token`
Gera um `connectToken` temporário para inicializar o Pluggy Connect Widget.

**Auth:** JWT requerido  
**Request body:** `{}`  
**Response:**
```json
{
  "connectToken": "eyJ..."
}
```

---

### POST `/open-banking/connect`
Registra uma nova conexão após o usuário autenticar pelo widget.

**Auth:** JWT requerido  
**Request body:**
```json
{
  "itemId": "string"
}
```
**Response:**
```json
{
  "connection": {
    "id": "uuid",
    "itemId": "string",
    "institutionName": "Nubank",
    "institutionLogo": "https://...",
    "status": "ACTIVE",
    "accounts": [
      {
        "id": "uuid",
        "pluggyAccountId": "string",
        "name": "Conta Corrente",
        "type": "BANK",
        "number": "****1234",
        "balance": 1500.00,
        "autoSync": true
      }
    ]
  }
}
```

---

### GET `/open-banking/connections`
Lista todas as conexões ativas do usuário.

**Auth:** JWT requerido  
**Response:**
```json
{
  "connections": [
    {
      "id": "uuid",
      "institutionName": "Nubank",
      "institutionLogo": "https://...",
      "status": "ACTIVE",
      "lastSyncAt": "2026-04-15T10:00:00Z",
      "accounts": [...]
    }
  ]
}
```

---

### DELETE `/open-banking/connections/:id`
Remove uma conexão e todas as contas vinculadas.

**Auth:** JWT requerido  
**Response:** `204 No Content`

---

### POST `/open-banking/connections/:id/sync`
Dispara sincronização manual de uma conexão.

**Auth:** JWT requerido  
**Response:**
```json
{
  "syncLog": {
    "id": "uuid",
    "status": "SUCCESS",
    "transactionCount": 47,
    "startedAt": "2026-04-15T10:00:00Z",
    "completedAt": "2026-04-15T10:00:05Z"
  }
}
```

---

### PATCH `/open-banking/linked-accounts/:id`
Atualiza configurações de uma conta vinculada (ex: link com conta local, autoSync).

**Auth:** JWT requerido  
**Request body:**
```json
{
  "accountId": "uuid-conta-local",
  "autoSync": true
}
```
**Response:** LinkedAccount atualizada

---

### POST `/open-banking/webhook`
Endpoint para receber notificações da Pluggy (novas transações, mudança de status).

**Auth:** Verificação por header `x-pluggy-signature` (HMAC SHA-256)  
**Sem JWT** (chamado pela Pluggy, não pelo usuário)

---

## 5. Lógica de Sincronização de Transações

### Regras de importação
1. Busca transações via `GET /items/{itemId}/transactions` na Pluggy API
2. **Deduplicação:** usa o campo `pluggyTransactionId` para evitar duplicatas
3. **Mapeamento de tipo:**
   - Transação Pluggy `DEBIT` → Transaction local `expense`
   - Transação Pluggy `CREDIT` → Transaction local `income`
4. **Categorização automática:** usa o campo `category` da Pluggy para tentar mapear para uma categoria local existente (por nome); se não encontrar, importa sem categoria
5. **Conta de destino:** as transações são importadas na conta local vinculada (`accountId` da LinkedAccount); se não houver vínculo, cria uma conta local automaticamente
6. **Janela de sincronização:** sincroniza os últimos 90 dias por padrão; sincronizações subsequentes apenas desde `lastSyncAt`

### Campo adicional em Transaction
Adicionar campo `pluggyTransactionId String? @unique` para controle de deduplicação.

---

## 6. Variáveis de Ambiente (Backend)

```env
# Pluggy API
PLUGGY_CLIENT_ID="..."
PLUGGY_CLIENT_SECRET="..."
PLUGGY_WEBHOOK_SECRET="..."
```

---

## 7. Frontend — Páginas e Componentes

### `/open-banking` — Página de Open Banking

**Layout:**
- Header: "Open Banking" + botão "Conectar banco"
- Cards de conexões existentes (banco, logo, status, última sync)
- Cada card tem: botão "Sincronizar", botão "Gerenciar contas", botão "Desconectar"

### `/open-banking/connections/:id` — Detalhe da Conexão

- Lista de contas vinculadas
- Para cada conta: nome, tipo, número mascarado, saldo, toggle autoSync
- Seletor de conta local para vincular

### Componente `PluggyConnectWidget`

Carrega o SDK `@pluggy/connect-sdk-js` (via CDN) e abre o modal do Pluggy Connect. Após autenticação do usuário, chama o callback com o `itemId`.

---

## 8. Segurança

| Aspecto | Abordagem |
|---|---|
| Credenciais bancárias | Nunca passam pelo backend do Plutos — ficam no widget Pluggy (iFrame seguro) |
| Tokens Pluggy | Armazenados no banco criptografados (campo não exposto via API) |
| Webhook signature | Verificação HMAC SHA-256 com `PLUGGY_WEBHOOK_SECRET` antes de processar |
| Rate limiting | `express-rate-limit` nos endpoints de sync para evitar abuso |
| Escopo de acesso | Apenas `READ` — nunca iniciamos pagamentos |

---

## 9. Dependências a Adicionar

### Backend
```json
{
  "pluggy-sdk": "^1.x",
  "express-rate-limit": "^7.x",
  "crypto": "(nativo do Node.js)"
}
```

### Frontend
```json
{
  "@pluggy/connect-sdk-js": "^3.x"
}
```

---

## 10. Diagrama de Entidades (ER)

```
User
  |
  |-- 1:N --> BankConnection (itemId, institutionName, status)
                  |
                  |-- 1:N --> LinkedAccount (pluggyAccountId, balance, autoSync)
                                  |
                                  |-- N:1 --> Account (conta local vinculada, opcional)
                                  |
                                  |-- 1:N --> SyncLog (histórico de syncs)
                                  |
                                  |-- (importa) --> Transaction (pluggyTransactionId)
```

---

## 11. Estratégia de Rollout

1. **Fase 1 — Infraestrutura** (backend): Migrations Prisma, entidades de domínio, interfaces de repositório
2. **Fase 2 — Backend Core**: Implementar repositórios Prisma, serviço Pluggy, use cases, controller e rotas
3. **Fase 3 — Frontend**: Hook `useOpenBanking`, página de Open Banking, widget de conexão
4. **Fase 4 — Sincronização**: Lógica de importação de transações, deduplicação, webhook
5. **Fase 5 — Testes e Ajustes**: Testar no sandbox da Pluggy, ajustes de UX
