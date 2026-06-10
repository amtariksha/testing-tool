export type NirikshakaConfig = {
  apiKey: string;
  projectId: string;
  environment?: "development" | "staging" | "production";
  appVersion?: string;
  apiUrl?: string;
};

export class NirikshakaWebSDK {
  private static instance: NirikshakaWebSDK;
  private config: NirikshakaConfig | null = null;
  private readonly defaultApiUrl = "http://localhost:3001/api";

  private constructor() {}

  static init(config: NirikshakaConfig) {
    if (!NirikshakaWebSDK.instance) {
      NirikshakaWebSDK.instance = new NirikshakaWebSDK();
    }
    NirikshakaWebSDK.instance.config = {
      environment: "production",
      appVersion: "1.0.0",
      apiUrl: NirikshakaWebSDK.instance.defaultApiUrl,
      ...config,
    };
    console.log("Nirikshaka Web SDK Initialized:", NirikshakaWebSDK.instance.config.projectId);
  }

  private static getInst() {
    if (!NirikshakaWebSDK.instance?.config) {
      throw new Error("Nirikshaka Web SDK not initialized. Call init() first.");
    }
    return NirikshakaWebSDK.instance;
  }

  private async sendPayload(endpoint: string, payload: any) {
    const { apiUrl, apiKey, projectId, environment, appVersion } = this.config!;
    
    try {
      const response = await fetch(`${apiUrl}/track/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          ...payload,
          context: {
            projectId,
            environment,
            appVersion,
            platform: "web",
            url: typeof window !== "undefined" ? window.location.href : "server",
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "node",
            timestamp: new Date().toISOString(),
          }
        }),
      });

      if (!response.ok) {
        console.error(`Nirikshaka: Failed to send ${endpoint} log`, await response.text());
      }
    } catch (e) {
      console.error("Nirikshaka: Network error", e);
    }
  }

  static trackAPI(data: {
    method: string;
    path: string;
    status: number;
    duration: number;
    requestSize?: number;
    responseSize?: number;
    headers?: Record<string, string>;
  }) {
    NirikshakaWebSDK.getInst().sendPayload("api", data);
  }

  static trackCrash(error: Error, extraContext?: Record<string, any>) {
    NirikshakaWebSDK.getInst().sendPayload("crash", {
      title: error.name,
      message: error.message,
      stackTrace: error.stack,
      severity: "critical",
      extraContext,
    });
  }
}

export const Nirikshaka = NirikshakaWebSDK;
