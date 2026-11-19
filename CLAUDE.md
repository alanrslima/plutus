# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Plutos** is a personal financial management system with a Node.js/TypeScript backend and a React/TypeScript frontend.

## Development Commands

### Backend (`/backend`)

```bash
# Start database (required before running the API)
docker-compose up -d

# Run in dev mode (hot reload)
npm run dev              # http://localhost:3333

# Database
npm run db:migrate       # apply migrations (also generates Prisma client)
npm run db:generate      # regenerate Prisma client without migrating
npm run db:studio        # open Prisma Studio GUI

# Type check
npx tsc --noEmit
```

### Frontend (`/frontend`)

```bash
npm run dev              # http://localhost:5173 (proxies /api → localhost:3333)
npm run build            # tsc + vite build
npm run lint
```

## Architecture

### Backend — Clean Architecture

```
src/
  domain/         # Entities (TypeScript types) + repository interfaces (contracts)
  application/    # Use cases — all business logic lives here
  infra/          # Prisma client singleton + concrete repository implementations
  interfaces/     # Express controllers, routes, JWT middleware, error handler
  server.ts       # Entry point: wires Express, mounts all routes
```

**Data flow:** `routes → controller → use case → repository interface → Prisma repository`

Controllers are thin: they parse/validate with Zod, call the use case, and delegate errors to the global `errorHandler` middleware via `next(err)`.

Repository interfaces live in `domain/repositories/` and are implemented in `infra/database/repositories/`. Use cases depend only on the interfaces, never on Prisma directly.

### Frontend — React + Vite

```
src/
  hooks/          # One hook file per resource: useAccounts, useCategories, useTransactions, useReports, useAuth
  services/api.ts # Axios instance with JWT interceptor; auto-redirects to /login on 401
  types/index.ts  # Shared TypeScript types mirroring backend entities
  components/ui/  # shadcn/ui components (Button, Card, Dialog, Select, Badge, Toast, etc.)
  components/layout/ # Sidebar + AppLayout (wraps all authenticated pages via <Outlet>)
  pages/          # One folder per route: auth/, dashboard/, accounts/, categories/, transactions/, reports/
  App.tsx         # Router setup: public routes (login/register) + private routes under AppLayout
```

**Data fetching:** All server state uses `@tanstack/react-query`. Each resource hook (e.g. `useAccounts`) exports both query hooks and mutation hooks. Mutations invalidate related query keys including `['accounts']` and `['reports']` since transactions affect balances.

**Auth:** JWT stored in `localStorage` (`plutos:token`, `plutos:user`). `AuthProvider` (in `useAuth.tsx`) wraps the app and exposes `login`, `register`, `logout`. The Axios interceptor attaches the token to every request.

### Database

PostgreSQL via Prisma. All entities use UUID primary keys. Key design decisions:

- `Account.balance` is a `Decimal(15,2)` — always read as `number` via `.toNumber()` in the repository mapper.
- `Transaction.parentTransactionId` is a **self-referencing FK** to link installments. The first installment has no parent; installments 2–N reference the first installment's real DB id (the id must exist before the FK can be set — see `TransactionsUseCase`).
- Transfers generate **two** transactions per installment: one `expense` on the source account and one `income` on the destination account.
- `Category.type` is a Prisma enum (`income | expense | transfer`) — categories must match the transaction type they are used with.

### Key Business Rules (enforced in use cases)

- All balance mutations go through `IAccountRepository.updateBalance(id, delta)`.
- Installment amounts: `Math.floor((total / n) * 100) / 100` for installments 1..n-1; last installment absorbs rounding remainder.
- Raw SQL reports (`getMonthlySummary`, `getCategorySummary`) use `Prisma.sql` and `Prisma.empty` for conditional clauses — never nest `prisma.$queryRaw` inside another `$queryRaw`.

## Environment

Backend `.env` (copy from `.env.example`):
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/plutos"
JWT_SECRET="..."
JWT_EXPIRES_IN="7d"
PORT=3333
```

Frontend proxies `/api/*` → `http://localhost:3333/*` via `vite.config.ts`, so all API calls use `/api/...` paths.

---

## Coding Standards

### Error Handling

**Always throw `AppError`, never `throw new Error()`** in use cases and repositories.

```typescript
// WRONG — falls through to 500 in errorHandler
throw new Error('Account not found')

// CORRECT — errorHandler reads err.status directly
import { AppError } from '../../errors/AppError'
throw new AppError('Account not found', 404)
```

HTTP status guide:
- `400` — bad input / business rule violation
- `401` — JWT missing or invalid (session expired) — **never use for domain errors on authenticated routes**
- `403` — authenticated but not authorized
- `404` — resource not found
- `409` — conflict (e.g. duplicate email)
- `422` — semantically valid request that fails a domain rule on an authenticated route (e.g. wrong current password)

> **Critical — Axios interceptor rule:** The frontend interceptor (`services/api.ts`) redirects to `/login` on `401` **only for non-auth routes** (i.e. URLs that do not start with `/auth/`). Auth routes (`/auth/login`, `/auth/register`, `/auth/password`) are excluded from the redirect so that form errors surface normally.
> - Use `401` for unauthenticated requests on auth endpoints (correct HTTP semantics, interceptor ignores it).
> - Use `422` when the user IS authenticated via JWT but a domain rule fails (e.g. wrong current password) — keeps semantics clear and also avoids the redirect.

The `errorHandler` middleware has three branches only: `AppError` (uses `err.status`), `ZodError` (returns 400 with `message` from the first issue plus an `issues` array), and everything else (logs + returns 500). Never add a known-messages list back.

---

### Adding a New Backend Feature (checklist)

Follow this order — each layer depends only on the layer below it.

**1. Domain**
- Add entity type in `src/domain/entities/MyEntity.ts`
- Add repository interface in `src/domain/repositories/IMyEntityRepository.ts` with only the methods this feature needs

**2. Application**
- Create use case in `src/application/use-cases/my-entity/MyEntityUseCase.ts`
- Constructor receives only repository interfaces — never import Prisma or Express here
- Throw `AppError` with the correct HTTP status for every business error
- One use case class per resource is fine; split into separate files only when a single method grows beyond ~50 lines

**3. Infrastructure**
- Implement the repository interface in `src/infra/database/repositories/PrismaMyEntityRepository.ts`
- Map Prisma model → domain entity in every method (never return the raw Prisma object)
- `Decimal` fields: always call `.toNumber()` in the mapper

**4. Interface**
- Controller in `src/interfaces/controllers/MyEntityController.ts`:
  - Declare Zod schema at the top of the file (not inside the method)
  - Parse with `.parse()` — Zod errors bubble to `errorHandler` automatically
  - Call the use case, return the result, delegate errors via `next(err)` — nothing else
- Routes in `src/interfaces/routes/my-entity.routes.ts`:
  - Apply `authMiddleware` to every route that requires authentication
  - Mount in `server.ts`

**Template — controller method:**
```typescript
async create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = createSchema.parse(req.body)
    const result = await myEntityUseCase.create(req.userId!, data)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}
```

---

### Adding a New Frontend Feature (checklist)

**1. Types**
- Add the TypeScript interface to `src/types/index.ts` mirroring the backend entity

**2. Hook**
- Create `src/hooks/useMyEntity.ts` (or add to an existing hook file for the same resource)
- Use `useQuery` for reads and `useMutation` for writes — always from `@tanstack/react-query`
- Mutations must call `queryClient.invalidateQueries` for every key that can become stale (include `['reports']` and `['accounts']` when the feature affects balances)
- API calls go through the shared `api` axios instance from `src/services/api.ts` — never create a new axios instance

**3. Page**
- Create `src/pages/my-entity/MyEntityPage.tsx`
- Forms use `react-hook-form` + `zodResolver` — define the Zod schema at the top of the file
- Display field errors with `{errors.field && <p className="text-xs text-destructive">{errors.field.message}</p>}`
- Use `useToast` for success and error feedback — catch API errors and read `err?.response?.data?.message` before falling back to a generic string

**4. Routing**
- Register the route in `src/App.tsx` inside the `PrivateRoute` / `AppLayout` wrapper
- Add the nav item to `src/components/layout/Sidebar.tsx` if it needs a sidebar entry

---

### Security Rules

- Every route that returns or mutates user data **must** have `authMiddleware`; use `req.userId` (set by the middleware) to scope all queries — never trust a userId from the request body
- Input validation happens in the controller via Zod before anything reaches the use case
- Passwords are always hashed with `bcrypt` (salt rounds = 10) — never store or log plain-text passwords
- JWT is verified in `authMiddleware` only — use cases never touch JWT
- Never expose `passwordHash` in any API response

---

### TypeScript Rules

- `any` is forbidden — use `unknown` and narrow, or define a proper type
- Use `AuthRequest` (from `src/interfaces/middlewares/authMiddleware.ts`) for controller methods that need `req.userId`
- Repository interfaces live in `domain/` and must not import from `infra/` — dependency direction is always inward
- Run `npx tsc --noEmit` in both `backend/` and `frontend/` before considering a task done; fix all errors before finishing
