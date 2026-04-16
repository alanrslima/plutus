-- CreateEnum
CREATE TYPE "BankConnectionStatus" AS ENUM ('ACTIVE', 'UPDATING', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "LinkedAccountType" AS ENUM ('BANK', 'CREDIT', 'INVESTMENT', 'LOAN');

-- CreateEnum
CREATE TYPE "SyncLogStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "pluggy_transaction_id" TEXT;

-- CreateTable
CREATE TABLE "bank_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "institution_name" TEXT NOT NULL,
    "institution_logo" TEXT,
    "status" "BankConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linked_accounts" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pluggy_account_id" TEXT NOT NULL,
    "account_id" TEXT,
    "name" TEXT NOT NULL,
    "type" "LinkedAccountType" NOT NULL DEFAULT 'BANK',
    "number" TEXT,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'BRL',
    "auto_sync" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linked_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "linked_account_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "SyncLogStatus" NOT NULL,
    "transaction_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_connections_item_id_key" ON "bank_connections"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "linked_accounts_pluggy_account_id_key" ON "linked_accounts"("pluggy_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_pluggy_transaction_id_key" ON "transactions"("pluggy_transaction_id");

-- AddForeignKey
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linked_accounts" ADD CONSTRAINT "linked_accounts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "bank_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linked_accounts" ADD CONSTRAINT "linked_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linked_accounts" ADD CONSTRAINT "linked_accounts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "linked_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
