-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER');

-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('WEB', 'ANDROID', 'IOS', 'FLUTTER', 'REACT_NATIVE');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('PRODUCTION', 'STAGING', 'DEVELOPMENT');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "APIKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'ERROR', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "UIErrorType" AS ENUM ('COMPONENT_CRASH', 'BUTTON_FAILURE', 'RUNTIME_ERROR', 'RENDER_ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'DEVELOPER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "role" "TeamMemberRole" NOT NULL DEFAULT 'DEVELOPER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "environment" "Environment" NOT NULL DEFAULT 'PRODUCTION',
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teamId" TEXT NOT NULL,
    "enableCrashReporting" BOOLEAN NOT NULL DEFAULT true,
    "enableNetworkTracking" BOOLEAN NOT NULL DEFAULT true,
    "enableUIErrorTracking" BOOLEAN NOT NULL DEFAULT true,
    "enableBreadcrumbs" BOOLEAN NOT NULL DEFAULT true,
    "enableLifecycleTracking" BOOLEAN NOT NULL DEFAULT true,
    "enableJourneyTracking" BOOLEAN NOT NULL DEFAULT true,
    "enableScreenshotDetection" BOOLEAN NOT NULL DEFAULT true,
    "monthlyEventLimit" INTEGER NOT NULL DEFAULT 100000,
    "monthlyEventCount" INTEGER NOT NULL DEFAULT 0,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "fcmServiceAccount" TEXT,
    "fcmProjectName" TEXT,
    "apnsKeyId" TEXT,
    "apnsTeamId" TEXT,
    "apnsBundleId" TEXT,
    "apnsPrivateKey" TEXT,
    "apnsUseSandbox" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnCriticalCrash" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnErrorSpike" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnSDKInstall" BOOLEAN NOT NULL DEFAULT false,
    "notifyWeeklySummary" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnApiDown" BOOLEAN NOT NULL DEFAULT true,
    "webhookUrl" TEXT,
    "webhookEvents" TEXT DEFAULT 'crash.critical,error.spike',

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" "APIKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "projectId" TEXT NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_requests" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "requestSize" INTEGER NOT NULL,
    "responseSize" INTEGER NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "headers" JSONB NOT NULL,
    "requestBody" TEXT,
    "responseBody" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "apiKeyId" TEXT,

    CONSTRAINT "api_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crash_logs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stackTrace" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "platform" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "device" TEXT,
    "os" TEXT,
    "osVersion" TEXT,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "screenshotUrl" TEXT,
    "stepsToReproduce" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "crash_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ui_errors" (
    "id" TEXT NOT NULL,
    "type" "UIErrorType" NOT NULL,
    "component" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "browser" TEXT,
    "browserVersion" TEXT,
    "os" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "screenshotUrl" TEXT,
    "stepsToReproduce" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ui_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sdk_installations" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "sdkVersion" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "deviceId" TEXT,
    "installDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "sdk_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_journeys" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "appUserId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "userMobile" TEXT,
    "uniqueId" TEXT,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "os" TEXT,
    "osVersion" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "screenCount" INTEGER NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "suggestions" JSONB,
    "pushToken" TEXT,
    "pushTokenUpdatedAt" TIMESTAMP(3),
    "projectId" TEXT NOT NULL,

    CONSTRAINT "user_journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "journeyId" TEXT NOT NULL,

    CONSTRAINT "journey_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_userId_teamId_key" ON "team_members"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_requests_projectId_timestamp_idx" ON "api_requests"("projectId", "timestamp");

-- CreateIndex
CREATE INDEX "api_requests_status_idx" ON "api_requests"("status");

-- CreateIndex
CREATE INDEX "crash_logs_projectId_timestamp_idx" ON "crash_logs"("projectId", "timestamp");

-- CreateIndex
CREATE INDEX "crash_logs_severity_resolved_idx" ON "crash_logs"("severity", "resolved");

-- CreateIndex
CREATE INDEX "ui_errors_projectId_timestamp_idx" ON "ui_errors"("projectId", "timestamp");

-- CreateIndex
CREATE INDEX "sdk_installations_projectId_platform_idx" ON "sdk_installations"("projectId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "user_journeys_sessionId_key" ON "user_journeys"("sessionId");

-- CreateIndex
CREATE INDEX "user_journeys_projectId_startedAt_idx" ON "user_journeys"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "user_journeys_deviceId_idx" ON "user_journeys"("deviceId");

-- CreateIndex
CREATE INDEX "user_journeys_appUserId_idx" ON "user_journeys"("appUserId");

-- CreateIndex
CREATE INDEX "user_journeys_userEmail_idx" ON "user_journeys"("userEmail");

-- CreateIndex
CREATE INDEX "user_journeys_uniqueId_idx" ON "user_journeys"("uniqueId");

-- CreateIndex
CREATE INDEX "journey_events_journeyId_timestamp_idx" ON "journey_events"("journeyId", "timestamp");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_requests" ADD CONSTRAINT "api_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_requests" ADD CONSTRAINT "api_requests_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crash_logs" ADD CONSTRAINT "crash_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ui_errors" ADD CONSTRAINT "ui_errors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sdk_installations" ADD CONSTRAINT "sdk_installations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_journeys" ADD CONSTRAINT "user_journeys_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_events" ADD CONSTRAINT "journey_events_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "user_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

