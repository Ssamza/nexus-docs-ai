-- AlterTable
ALTER TABLE "User" ADD COLUMN     "promptsResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "promptsThisMonth" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "plan" SET DEFAULT 'REGISTERED';

-- CreateTable
CREATE TABLE "AnonUsage" (
    "id" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "promptsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "promptsResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnonUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnonUsage_anonId_key" ON "AnonUsage"("anonId");

-- CreateIndex
CREATE INDEX "AnonUsage_anonId_idx" ON "AnonUsage"("anonId");
