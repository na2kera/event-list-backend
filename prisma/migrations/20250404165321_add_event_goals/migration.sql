-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('IMPROVE_SKILLS', 'EXPERIENCE_TEAM_DEV', 'CREATE_PORTFOLIO');

-- CreateTable
CREATE TABLE "EventGoal" (
    "id" TEXT NOT NULL,
    "goalType" "GoalType" NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventGoal_eventId_idx" ON "EventGoal"("eventId");

-- AddForeignKey
ALTER TABLE "EventGoal" ADD CONSTRAINT "EventGoal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
