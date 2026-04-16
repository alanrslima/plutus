-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_account_id_fkey";

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
