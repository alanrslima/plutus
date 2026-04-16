-- Drop the global unique constraint on external_id
DROP INDEX IF EXISTS "transactions_external_id_key";

-- Add a composite unique constraint scoped per user
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_external_id_key" UNIQUE ("user_id", "external_id");
