-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'FOR_EVERYONE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "level_enum" "DifficultyLevel";

-- Update the new column based on existing data
UPDATE "User" SET "level_enum" = 
  CASE 
    WHEN "level" = 'BEGINNER' THEN 'BEGINNER'::"DifficultyLevel"
    WHEN "level" = 'INTERMEDIATE' THEN 'INTERMEDIATE'::"DifficultyLevel"
    WHEN "level" = 'ADVANCED' THEN 'ADVANCED'::"DifficultyLevel"
    WHEN "level" = 'FOR_EVERYONE' THEN 'FOR_EVERYONE'::"DifficultyLevel"
    ELSE NULL
  END
WHERE "level" IS NOT NULL;

-- Drop the old column if it exists
ALTER TABLE "User" DROP COLUMN IF EXISTS "level";

-- Rename the new column
ALTER TABLE "User" RENAME COLUMN "level_enum" TO "level"; 