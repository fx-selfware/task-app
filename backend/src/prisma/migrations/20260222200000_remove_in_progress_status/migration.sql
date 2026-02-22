-- Convert any IN_PROGRESS tasks to TODO
UPDATE "Task" SET "status" = 'TODO' WHERE "status" = 'IN_PROGRESS';

-- Recreate the enum without IN_PROGRESS
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'DONE');
ALTER TABLE "Task"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "TaskStatus"
    USING "status"::text::"TaskStatus",
  ALTER COLUMN "status" SET DEFAULT 'TODO'::"TaskStatus";
DROP TYPE "TaskStatus_old";
