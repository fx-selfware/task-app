-- AlterTable
ALTER TABLE "Task" ADD COLUMN "parentId" TEXT;

-- AlterTable
ALTER TABLE "TemplateTask" ADD COLUMN "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Task_parentId_order_idx" ON "Task"("parentId", "order");

-- CreateIndex
CREATE INDEX "TemplateTask_parentId_order_idx" ON "TemplateTask"("parentId", "order");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateTask" ADD CONSTRAINT "TemplateTask_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TemplateTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
