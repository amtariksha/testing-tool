-- CreateTable
CREATE TABLE "test_strategies" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "appModelId" TEXT NOT NULL,
    "strategy" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_strategies_projectId_createdAt_idx" ON "test_strategies"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "test_strategies_appModelId_idx" ON "test_strategies"("appModelId");

