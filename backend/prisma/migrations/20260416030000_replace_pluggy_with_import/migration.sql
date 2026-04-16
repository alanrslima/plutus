-- Drop Pluggy tables (cascade handles foreign keys)
DROP TABLE IF EXISTS "sync_logs";
DROP TABLE IF EXISTS "linked_accounts";
DROP TABLE IF EXISTS "bank_connections";

-- Drop Pluggy enums
DROP TYPE IF EXISTS "SyncLogStatus";
DROP TYPE IF EXISTS "LinkedAccountType";
DROP TYPE IF EXISTS "BankConnectionStatus";

-- Rename pluggy_transaction_id → external_id
ALTER TABLE "transactions" RENAME COLUMN "pluggy_transaction_id" TO "external_id";
ALTER INDEX IF EXISTS "transactions_pluggy_transaction_id_key" RENAME TO "transactions_external_id_key";

-- New enums
CREATE TYPE "FileType" AS ENUM ('OFX', 'CSV');
CREATE TYPE "ImportStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- New table
CREATE TABLE "import_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_type" "FileType" NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_history_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "import_history" ADD CONSTRAINT "import_history_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_history" ADD CONSTRAINT "import_history_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
