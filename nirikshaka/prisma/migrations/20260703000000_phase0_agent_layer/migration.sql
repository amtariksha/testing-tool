-- CreateEnum
CREATE TYPE "AppModelStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CONFIRMED', 'STALE');

-- CreateEnum
CREATE TYPE "TestCaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'QUARANTINED', 'RETIRED');

-- CreateTable
CREATE TABLE "app_models" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "AppModelStatus" NOT NULL DEFAULT 'DRAFT',
    "model" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "discrepancies" JSONB,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "suite" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "yaml" TEXT NOT NULL,
    "yamlHash" TEXT NOT NULL,
    "tags" TEXT[],
    "skipAgent" BOOLEAN NOT NULL DEFAULT false,
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "generatedFrom" JSONB,
    "status" "TestCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeRef" TEXT,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "totals" JSONB,
    "costUsd" DECIMAL(10,4),
    "gitSha" TEXT,
    "report" JSONB,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_results" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "usedFastPath" BOOLEAN NOT NULL DEFAULT true,
    "llmCalls" INTEGER NOT NULL DEFAULT 0,
    "llmCostUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "stepLog" JSONB NOT NULL DEFAULT '[]',
    "screenshots" JSONB NOT NULL DEFAULT '[]',
    "verdict" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "test_case_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locator_cache" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "semanticKey" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "selector" JSONB NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locator_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tasks" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "projectId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "claimedBy" TEXT,
    "claimedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "critiques" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "iteration" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "critiques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_heartbeats" (
    "id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "pid" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastBeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "agent_heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_models_projectId_status_idx" ON "app_models"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "app_models_projectId_version_key" ON "app_models"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "test_cases_projectId_externalId_key" ON "test_cases"("projectId", "externalId");

-- CreateIndex
CREATE INDEX "test_runs_projectId_startedAt_idx" ON "test_runs"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "test_case_results_runId_idx" ON "test_case_results"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "locator_cache_projectId_semanticKey_platform_key" ON "locator_cache"("projectId", "semanticKey", "platform");

-- CreateIndex
CREATE INDEX "agent_tasks_status_type_idx" ON "agent_tasks"("status", "type");

-- CreateIndex
CREATE INDEX "critiques_projectId_targetType_targetId_idx" ON "critiques"("projectId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_heartbeats_agent_key" ON "agent_heartbeats"("agent");

-- AddForeignKey
ALTER TABLE "app_models" ADD CONSTRAINT "app_models_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_results" ADD CONSTRAINT "test_case_results_runId_fkey" FOREIGN KEY ("runId") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_results" ADD CONSTRAINT "test_case_results_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

