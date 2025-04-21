/*
  Warnings:

  - Made the column `eventDate` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Made the column `startTime` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Made the column `venue` on table `Event` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "eventDate" SET NOT NULL,
ALTER COLUMN "startTime" SET NOT NULL,
ALTER COLUMN "venue" SET NOT NULL;
