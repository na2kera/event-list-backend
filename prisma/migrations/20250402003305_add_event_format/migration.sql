-- CreateEnum
CREATE TYPE "EventFormat" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "format" "EventFormat" NOT NULL DEFAULT 'OFFLINE';
