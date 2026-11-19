-- CreateEnum
CREATE TYPE "AmortizationType" AS ENUM ('fixed', 'sac', 'price');

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "amortization_type" "AmortizationType" NOT NULL DEFAULT 'fixed',
ADD COLUMN     "interest_rate" DECIMAL(10,8);
