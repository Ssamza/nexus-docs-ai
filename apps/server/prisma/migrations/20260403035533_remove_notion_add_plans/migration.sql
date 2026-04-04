/*
  Warnings:

  - You are about to drop the column `notionConnectionId` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `notionPageId` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the `NotionConnection` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[clerkId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clerkId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'REGISTERED', 'PREMIUM');

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_notionConnectionId_fkey";

-- DropForeignKey
ALTER TABLE "NotionConnection" DROP CONSTRAINT "NotionConnection_userId_fkey";

-- DropIndex
DROP INDEX "Document_userId_notionPageId_key";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "notionConnectionId",
DROP COLUMN "notionPageId",
ADD COLUMN     "fileKey" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "isPublicKnowledge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mimeType" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DocumentChunk" ADD COLUMN     "pageNumber" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clerkId" TEXT NOT NULL,
ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'FREE';

-- DropTable
DROP TABLE "NotionConnection";

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "Document_isPublicKnowledge_idx" ON "Document"("isPublicKnowledge");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");
