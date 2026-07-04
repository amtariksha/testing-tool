import { Prisma, type PrismaClient } from "@prisma/client";
import type { ResolvedSelector } from "./targeting";

/**
 * LocatorCache access (doc §5.3): zero-LLM fast path on hit, write-through on
 * recovery success. selector Json stores a ResolvedSelector.
 */

export async function lookupCached(
  prisma: PrismaClient,
  projectId: string,
  key: string,
  platform: string
): Promise<ResolvedSelector | null> {
  const row = await prisma.locatorCache.findUnique({
    where: { projectId_semanticKey_platform: { projectId, semanticKey: key, platform } },
  });
  if (!row) return null;
  return row.selector as unknown as ResolvedSelector;
}

export async function recordHit(
  prisma: PrismaClient,
  projectId: string,
  key: string,
  platform: string
): Promise<void> {
  await prisma.locatorCache.update({
    where: { projectId_semanticKey_platform: { projectId, semanticKey: key, platform } },
    data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
  });
}

export async function upsertLocator(
  prisma: PrismaClient,
  projectId: string,
  key: string,
  platform: string,
  selector: ResolvedSelector,
  confidence: number
): Promise<void> {
  const decimalConfidence = new Prisma.Decimal(Math.min(1, Math.max(0, confidence)).toFixed(2));
  await prisma.locatorCache.upsert({
    where: { projectId_semanticKey_platform: { projectId, semanticKey: key, platform } },
    create: {
      projectId,
      semanticKey: key,
      platform,
      selector: selector as unknown as Prisma.InputJsonValue,
      confidence: decimalConfidence,
      hitCount: 0,
    },
    update: {
      selector: selector as unknown as Prisma.InputJsonValue,
      confidence: decimalConfidence,
      lastHitAt: new Date(),
    },
  });
}
