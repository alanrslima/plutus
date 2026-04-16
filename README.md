# 💰 Plutos — Personal Finance Management

A personal finance management system with support for accounts, categories, installment transactions, transfers, and reports.

## Stack

| Layer | Technologies |
|---|---|
| Backend | Node.js, TypeScript, Express, Clean Architecture |
| Frontend | React, TypeScript, Vite, shadcn/ui, Tailwind CSS |
| Database | PostgreSQL, Prisma ORM |
| Auth | JWT |

## Features

- **Authentication** — register and login with JWT
- **Accounts** — balance updated automatically on every transaction
- **Categories** — tied to a type (income, expense, transfer)
- **Transactions** — income, expenses, and transfers between accounts
- **Installments** — splits an amount into N monthly installments with rounding adjustment on the last one
- **Transfers** — atomic operation that debits the source and credits the destination account
- **Reports** — monthly summary, spending by category, and balance by account with charts

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)

## Getting Started

### 1. Database

```bash
cd backend
docker-compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # adjust variables if needed
npm install
npm run db:migrate     # creates the tables
npm run dev            # http://localhost:3333
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

The frontend proxies `/api/*` automatically to `http://localhost:3333`.

## Environment Variables

**`backend/.env`**

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/plutos` | PostgreSQL connection string |
| `JWT_SECRET` | — | Secret key used to sign tokens |
| `JWT_EXPIRES_IN` | `7d` | Token expiration time |
| `PORT` | `3333` | API server port |

## API Reference

### Auth
```
POST /auth/register
POST /auth/login
```

### Resources (require Bearer token)
```
GET|POST        /accounts
PUT|DELETE      /accounts/:id

GET|POST        /categories
PUT|DELETE      /categories/:id

GET|POST        /transactions
PUT|DELETE      /transactions/:id

GET /reports/summary/monthly?year=2026
GET /reports/summary/category
GET /reports/summary/account
```

## Project Structure

```
ai-version/
├── docker-compose.yml
├── backend/
│   ├── prisma/schema.prisma
│   └── src/
│       ├── domain/          # Entities and repository interfaces
│       ├── application/     # Use cases (business logic)
│       ├── infra/           # Prisma repository implementations
│       ├── interfaces/      # Express controllers, routes, and middlewares
│       └── server.ts
└── frontend/
    └── src/
        ├── hooks/           # useAuth, useAccounts, useCategories, useTransactions, useReports
        ├── services/        # Axios client with JWT interceptor
        ├── components/      # UI (shadcn) and layout (Sidebar, AppLayout)
        └── pages/           # auth, dashboard, accounts, categories, transactions, reports
```

## Future Improvements

- Open Banking integration
- Bank statement import
- AI-based automatic categorization
- Financial goals
- Notifications system
