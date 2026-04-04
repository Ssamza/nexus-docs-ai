-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "anonId" TEXT;

-- CreateIndex
CREATE INDEX "Document_anonId_idx" ON "Document"("anonId");
