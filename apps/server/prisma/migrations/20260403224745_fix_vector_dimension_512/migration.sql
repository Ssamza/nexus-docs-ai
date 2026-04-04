-- Recreate embedding column with correct 512 dimensions (voyage-3-lite output)
ALTER TABLE "DocumentChunk" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "DocumentChunk" ADD COLUMN "embedding" vector(512);
