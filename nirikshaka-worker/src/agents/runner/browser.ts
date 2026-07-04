import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

/**
 * Playwright lifecycle — the ONLY file that imports playwright's runtime.
 * Every context carries x-nirikshaka-test-session so target apps (or their
 * SDK) can attribute telemetry to the run (doc §5.4 prereq).
 */

export const DEFAULT_ACTION_TIMEOUT_MS = 10_000;

export interface BrowserSession {
  browser: Browser;
  newRunContext(runId: string): Promise<{ context: BrowserContext; page: Page }>;
  closeAll(): Promise<void>;
}

export async function launchBrowser(headless: boolean): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless });
  const contexts: BrowserContext[] = [];

  return {
    browser,
    async newRunContext(runId: string) {
      const context = await browser.newContext({
        viewport: { width: 1366, height: 900 },
        extraHTTPHeaders: { "x-nirikshaka-test-session": runId },
      });
      context.setDefaultTimeout(DEFAULT_ACTION_TIMEOUT_MS);
      contexts.push(context);
      const page = await context.newPage();
      return { context, page };
    },
    async closeAll() {
      for (const context of contexts) {
        await context.close().catch(() => {});
      }
      await browser.close().catch(() => {});
    },
  };
}
