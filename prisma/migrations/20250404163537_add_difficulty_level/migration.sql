-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'FOR_EVERYONE');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "difficulty" "DifficultyLevel" NOT NULL DEFAULT 'FOR_EVERYONE';
