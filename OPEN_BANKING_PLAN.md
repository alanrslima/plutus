# Open Banking — Plano de Implementação Detalhado

## Fases de Implementação

```
Fase 1: Infraestrutura DB         ← sequencial (base para tudo)
         ↓
Fase 2A: Backend — Domínio        ← paralela com Fase 2B (independentes)
Fase 2B: Backend — Infra/Serviços ← paralela com Fase 2A
         ↓
Fase 3:  Backend — Use Cases      ← sequencial (depende de 2A e 2B)
         ↓
Fase 4A: Backend — HTTP Layer     ← paralela com Fase 4B
Fase 4B: Frontend — Hook + Types  ← paralela com Fase 4A
         ↓
Fase 5:  Frontend — Páginas       ← sequencial (depende de 4B)
         ↓
Fase 6:  Webhook + Integração final ← sequencial (depende de tudo)
```

---

## Fase 1 — Infraestrutura de Banco de Dados

### 1.1 Atualizar `schema.prisma`

**Arquivo:** `backend/prisma/schema.prisma`

Adicionar:
- Enum `BankConnectionStatus` (`ACTIVE`, `UPDATING`, `ERROR`, `DISCONNECTED`)
- Enum `LinkedAccountType` (`BANK`, `CREDIT`, `INVESTMENT`, `LOAN`)
- Enum `SyncLogStatus` (`SUCCESS`, `PARTIAL`, `FAILED`)
- Model `BankConnection` com relação para User e LinkedAccount
- Model `LinkedAccount` com relação para BankConnection, User, Account
- Model `SyncLog` com relação para LinkedAccount
- Campo `pluggyTransactionId String? @unique` no model `Transaction`

### 1.2 Criar e rodar migration

```bash
cd backend && npm run db:migrate
```
> Nome da migration: `add_open_banking`

---

## Fase 2A — Backend: Camada de Domínio (paralela)

### 2A.1 Criar entidades de domínio

**Arquivo:** `backend/src/domain/entities/BankConnection.ts`
```typescript
export type BankConnectionStatus = 'ACTIVE' | 'UPDATING' | 'ERROR' | 'DISCONNECTED'

export interface BankConnection {
  id: string
  userId: string
  itemId: string
  institutionName: string
  institutionLogo?: string | null
  status: BankConnectionStatus
  lastSyncAt?: Date | null
  createdAt: Date
  updatedAt: Date
}
```

**Arquivo:** `backend/src/domain/entities/LinkedAccount.ts`
```typescript
export type LinkedAccountType = 'BANK' | 'CREDIT' | 'INVESTMENT' | 'LOAN'

export interface LinkedAccount {
  id: string
  connectionId: string
  userId: string
  pluggyAccountId: string
  accountId?: string | null
  name: string
  type: LinkedAccountType
  number?: string | null
  balance: number
  currencyCode: string
  autoSync: boolean
  lastSyncAt?: Date | null
  createdAt: Date
  updatedAt: Date
}
```

**Arquivo:** `backend/src/domain/entities/SyncLog.ts`
```typescript
export type SyncLogStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED'

export interface SyncLog {
  id: string
  linkedAccountId: string
  userId: string
  status: SyncLogStatus
  transactionCount: number
  errorMessage?: string | null
  startedAt: Date
  completedAt?: Date | null
}
```

### 2A.2 Criar interface de repositório

**Arquivo:** `backend/src/domain/repositories/IOpenBankingRepository.ts`
```typescript
import { BankConnection } from '../entities/BankConnection'
import { LinkedAccount } from '../entities/LinkedAccount'
import { SyncLog } from '../entities/SyncLog'

export interface CreateConnectionInput {
  userId: string
  itemId: string
  institutionName: string
  institutionLogo?: string
}

export interface CreateLinkedAccountInput {
  connectionId: string
  userId: string
  pluggyAccountId: string
  name: string
  type: LinkedAccountType
  number?: string
  balance: number
  currencyCode?: string
}

export interface IOpenBankingRepository {
  // Connections
  findConnectionById(id: string, userId: string): Promise<BankConnection | null>
  findConnectionByItemId(itemId: string): Promise<BankConnection | null>
  findAllConnectionsByUser(userId: string): Promise<BankConnection[]>
  createConnection(data: CreateConnectionInput): Promise<BankConnection>
  updateConnectionStatus(id: string, status: BankConnectionStatus, lastSyncAt?: Date): Promise<BankConnection>
  deleteConnection(id: string, userId: string): Promise<void>

  // Linked Accounts
  findLinkedAccountById(id: string, userId: string): Promise<LinkedAccount | null>
  findLinkedAccountsByConnection(connectionId: string): Promise<LinkedAccount[]>
  findLinkedAccountByPluggyId(pluggyAccountId: string): Promise<LinkedAccount | null>
  createLinkedAccounts(accounts: CreateLinkedAccountInput[]): Promise<LinkedAccount[]>
  updateLinkedAccount(id: string, userId: string, data: Partial<LinkedAccount>): Promise<LinkedAccount>

  // Sync Logs
  createSyncLog(data: Omit<SyncLog, 'id'>): Promise<SyncLog>
  updateSyncLog(id: string, data: Partial<SyncLog>): Promise<SyncLog>
  findSyncLogsByLinkedAccount(linkedAccountId: string): Promise<SyncLog[]>
}
```

---

## Fase 2B — Backend: Serviço Pluggy (paralela)

### 2B.1 Instalar SDK

```bash
cd backend && npm install pluggy-sdk express-rate-limit @types/express-rate-limit
```

### 2B.2 Criar serviço de integração com Pluggy

**Arquivo:** `backend/src/infra/services/PluggyService.ts`

Responsabilidades:
- Autenticar na Pluggy API (POST `/auth` com clientId/clientSecret, cachear apiKey por 2h)
- `createConnectToken(userId)` → string
- `getItem(itemId)` → dados da instituição + status
- `getAccounts(itemId)` → lista de contas da Pluggy
- `getTransactions(accountId, from?, to?)` → transações paginadas
- Refresh automático do apiKey quando expirar

**Arquivo:** `backend/src/infra/services/PluggyService.ts`
```typescript
import PluggyClient from 'pluggy-sdk'

export class PluggyService {
  private client: PluggyClient
  private apiKey: string | null = null
  private apiKeyExpiresAt: Date | null = null

  constructor(
    private clientId: string,
    private clientSecret: string
  ) {
    this.client = new PluggyClient({ clientId, clientSecret })
  }

  private async ensureApiKey(): Promise<void> { ... }
  async createConnectToken(options?: object): Promise<string> { ... }
  async getItem(itemId: string): Promise<PluggyItem> { ... }
  async getAccounts(itemId: string): Promise<PluggyAccount[]> { ... }
  async getTransactions(accountId: string, from?: Date, to?: Date): Promise<PluggyTransaction[]> { ... }
}
```

---

## Fase 3 — Backend: Use Cases

**Arquivo:** `backend/src/application/use-cases/open-banking/OpenBankingUseCase.ts`

Depende de:
- `IOpenBankingRepository` (da Fase 2A)
- `PluggyService` (da Fase 2B)
- `IAccountRepository` (existente)
- `ITransactionRepository` (existente)
- `ICategoryRepository` (existente)

### Métodos do Use Case:

**`createConnectToken(userId)`**
1. Chama `pluggyService.createConnectToken()`
2. Retorna o token

**`connectBank(userId, itemId)`**
1. Chama `pluggyService.getItem(itemId)` para obter dados da instituição
2. Cria `BankConnection` no banco via repositório
3. Chama `pluggyService.getAccounts(itemId)` para listar contas
4. Cria `LinkedAccount` para cada conta retornada
5. Retorna connection com accounts

**`listConnections(userId)`**
1. Busca todas as conexões do usuário
2. Para cada conexão, busca as linked accounts
3. Retorna lista completa

**`deleteConnection(userId, connectionId)`**
1. Verifica ownership
2. Deleta no banco (cascade deleta linked accounts e sync logs)

**`syncConnection(userId, connectionId)`**
1. Busca a conexão e suas linked accounts
2. Para cada linked account:
   a. Cria SyncLog com status `STARTED`
   b. Chama `pluggyService.getTransactions(pluggyAccountId, lastSyncAt)`
   c. Para cada transação Pluggy:
      - Verifica deduplicação por `pluggyTransactionId`
      - Mapeia tipo (DEBIT → expense, CREDIT → income)
      - Tenta mapear categoria pelo nome
      - Cria Transaction no banco (se linked account tiver `accountId` vinculada)
      - Atualiza saldo da conta local
   d. Atualiza `lastSyncAt` da linked account
   e. Atualiza SyncLog com resultado
3. Atualiza `lastSyncAt` da BankConnection
4. Retorna resumo da sync

**`updateLinkedAccount(userId, linkedAccountId, data)`**
1. Verifica ownership
2. Se `accountId` muda, valida que a conta local pertence ao usuário
3. Atualiza linked account

---

## Fase 4A — Backend: HTTP Layer (paralela)

### 4A.1 Controller

**Arquivo:** `backend/src/interfaces/controllers/OpenBankingController.ts`

Métodos (todos com Zod validation):
- `createConnectToken(req, res, next)` — POST /open-banking/connect-token
- `connectBank(req, res, next)` — POST /open-banking/connect
- `listConnections(req, res, next)` — GET /open-banking/connections
- `deleteConnection(req, res, next)` — DELETE /open-banking/connections/:id
- `syncConnection(req, res, next)` — POST /open-banking/connections/:id/sync
- `updateLinkedAccount(req, res, next)` — PATCH /open-banking/linked-accounts/:id
- `webhook(req, res, next)` — POST /open-banking/webhook (sem auth JWT, valida HMAC)

### 4A.2 Rotas

**Arquivo:** `backend/src/interfaces/routes/openBanking.routes.ts`

```typescript
router.post('/connect-token', authMiddleware, controller.createConnectToken)
router.post('/connect', authMiddleware, controller.connectBank)
router.get('/connections', authMiddleware, controller.listConnections)
router.delete('/connections/:id', authMiddleware, controller.deleteConnection)
router.post('/connections/:id/sync', authMiddleware, controller.syncConnection)
router.patch('/linked-accounts/:id', authMiddleware, controller.updateLinkedAccount)
router.post('/webhook', controller.webhook) // sem authMiddleware — usa HMAC
```

### 4A.3 Rate Limiting

Aplicar `express-rate-limit` no endpoint de sync: máximo 5 syncs por minuto por usuário.

### 4A.4 Montar rotas no server.ts

Adicionar `app.use('/open-banking', openBankingRoutes)` em `server.ts`.

---

## Fase 4B — Frontend: Types e Hook (paralela)

### 4B.1 Adicionar tipos

**Arquivo:** `frontend/src/types/index.ts` (adicionar ao existente)

```typescript
export type BankConnectionStatus = 'ACTIVE' | 'UPDATING' | 'ERROR' | 'DISCONNECTED'
export type LinkedAccountType = 'BANK' | 'CREDIT' | 'INVESTMENT' | 'LOAN'
export type SyncLogStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED'

export interface BankConnection {
  id: string
  itemId: string
  institutionName: string
  institutionLogo?: string | null
  status: BankConnectionStatus
  lastSyncAt?: string | null
  accounts: LinkedAccount[]
}

export interface LinkedAccount {
  id: string
  connectionId: string
  pluggyAccountId: string
  accountId?: string | null
  name: string
  type: LinkedAccountType
  number?: string | null
  balance: number
  currencyCode: string
  autoSync: boolean
  lastSyncAt?: string | null
}

export interface SyncResult {
  id: string
  status: SyncLogStatus
  transactionCount: number
  errorMessage?: string | null
  startedAt: string
  completedAt?: string | null
}
```

### 4B.2 Criar hook

**Arquivo:** `frontend/src/hooks/useOpenBanking.ts`

```typescript
export function useConnections() { ... }           // GET /open-banking/connections
export function useConnectBank() { ... }           // POST /open-banking/connect
export function useCreateConnectToken() { ... }   // POST /open-banking/connect-token
export function useDeleteConnection() { ... }     // DELETE /open-banking/connections/:id
export function useSyncConnection() { ... }       // POST /open-banking/connections/:id/sync
export function useUpdateLinkedAccount() { ... }  // PATCH /open-banking/linked-accounts/:id
```

Todas as mutations invalidam `['open-banking', 'connections']` e as de sync invalidam também `['transactions']`, `['accounts']`.

---

## Fase 5 — Frontend: Páginas

### 5.1 Página principal Open Banking

**Arquivo:** `frontend/src/pages/open-banking/OpenBankingPage.tsx`

Layout:
- Hero section com título, descrição e botão "Conectar banco" (abre widget)
- Grid de cards por conexão:
  - Logo + nome da instituição
  - Badge de status (ACTIVE=verde, ERROR=vermelho, UPDATING=amarelo)
  - Data da última sincronização
  - Lista resumida de contas (nome + saldo)
  - Botão "Sincronizar agora"
  - Botão "Gerenciar" → abre modal de detalhes
  - Botão "Desconectar" → alert dialog de confirmação

### 5.2 Modal de detalhes da conexão

**Arquivo:** `frontend/src/pages/open-banking/ConnectionDetailDialog.tsx`

- Header com nome do banco
- Para cada LinkedAccount:
  - Nome, tipo (badge), número mascarado, saldo
  - Toggle autoSync
  - Select para vincular conta local (dropdown com contas existentes do usuário)

### 5.3 Componente Pluggy Widget

**Arquivo:** `frontend/src/components/PluggyConnectWidget.tsx`

Carrega o Pluggy Connect SDK, cria o widget, expõe callbacks `onSuccess(itemId)` e `onError(error)`.

### 5.4 Adicionar rota e navegação

- `App.tsx`: adicionar rota `/open-banking` → `OpenBankingPage` (privada)
- `Sidebar.tsx`: adicionar item "Open Banking" com ícone de banco

---

## Fase 6 — Webhook e Integração Final

### 6.1 Handler de webhook

No `OpenBankingController.webhook`:
1. Verificar header `x-pluggy-signature` com HMAC SHA-256 usando `PLUGGY_WEBHOOK_SECRET`
2. Parsear evento (`item.updated`, `item.error`, etc.)
3. Para `item.updated`: disparar sync automática das contas da conexão
4. Para `item.error`: atualizar status da conexão para `ERROR`
5. Retornar 200 imediatamente (processar assincronamente)

### 6.2 Repositório Prisma

**Arquivo:** `backend/src/infra/database/repositories/PrismaOpenBankingRepository.ts`

Implementação concreta de `IOpenBankingRepository` usando Prisma client.

---

## Checklist de Implementação

### Backend
- [ ] 1.1 Atualizar schema.prisma
- [ ] 1.2 Rodar migration
- [ ] 2A.1 Entidades de domínio (BankConnection, LinkedAccount, SyncLog)
- [ ] 2A.2 Interface IOpenBankingRepository
- [ ] 2B.1 Instalar pluggy-sdk e express-rate-limit
- [ ] 2B.2 Criar PluggyService
- [ ] 2C PrismaOpenBankingRepository
- [ ] 3. OpenBankingUseCase (createConnectToken, connectBank, listConnections, deleteConnection, syncConnection, updateLinkedAccount)
- [ ] 4A.1 OpenBankingController
- [ ] 4A.2 openBanking.routes.ts
- [ ] 4A.3 Rate limiting no sync
- [ ] 4A.4 Montar rotas no server.ts
- [ ] 6.1 Webhook handler com verificação HMAC

### Frontend
- [ ] 4B.1 Tipos Open Banking em types/index.ts
- [ ] 4B.2 Hook useOpenBanking.ts
- [ ] 5.1 OpenBankingPage.tsx
- [ ] 5.2 ConnectionDetailDialog.tsx
- [ ] 5.3 PluggyConnectWidget.tsx
- [ ] 5.4 Rota /open-banking e item no Sidebar

### Infraestrutura
- [ ] Adicionar variáveis de ambiente ao .env.example
