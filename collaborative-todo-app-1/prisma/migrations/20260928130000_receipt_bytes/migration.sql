-- AlterTable
ALTER TABLE "PaymentSubmission" ADD COLUMN     "receiptBytes" BYTEA,
ADD COLUMN     "receiptMimeType" TEXT;
