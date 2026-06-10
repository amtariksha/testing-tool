// ============================================================
// NIRIKSHAKA — MOCK DATA
// All mock data for prototype demonstration
// ============================================================

import { randomBetween } from "./utils";

// ─── TYPES ───────────────────────────────────────────────────

export type Project = {
  id: string;
  name: string;
  packageName: string;
  platform: "web" | "android" | "ios" | "flutter" | "react-native";
  environment: "production" | "staging" | "development";
  apiKey: string;
  status: "active" | "inactive";
  requestCount: number;
  errorCount: number;
  createdAt: string;
  lastActivity: string;
};

export type APIRequest = {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  status: number;
  duration: number;
  requestSize: number;
  responseSize: number;
  ip: string;
  userAgent: string;
  timestamp: string;
  projectId: string;
  headers: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
};

export type CrashLog = {
  id: string;
  title: string;
  message: string;
  stackTrace: string;
  severity: "critical" | "error" | "warning";
  platform: string;
  version: string;
  device: string;
  os: string;
  osVersion: string;
  userId?: string;
  sessionId: string;
  timestamp: string;
  projectId: string;
  count: number;
  resolved: boolean;
};

export type UIError = {
  id: string;
  type: "component_crash" | "button_failure" | "runtime_error" | "render_error";
  component: string;
  message: string;
  url: string;
  browser: string;
  browserVersion: string;
  os: string;
  timestamp: string;
  projectId: string;
  count: number;
  resolved: boolean;
};

export type APIKey = {
  id: string;
  name: string;
  key: string;
  projectId: string;
  projectName: string;
  platform: string;
  createdAt: string;
  lastUsed: string;
  status: "active" | "revoked";
  requestCount: number;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "developer" | "viewer";
  avatar: string;
  joinedAt: string;
  lastSeen: string;
};

export type MetricPoint = {
  time: string;
  value: number;
};

// ─── PROJECTS ────────────────────────────────────────────────

export const mockProjects: Project[] = [
  {
    id: "proj_001",
    name: "EassyLife Web",
    packageName: "com.eassylife.web",
    platform: "web",
    environment: "production",
    apiKey: "eqk_web_prod_8Kx9mN2pQ7rT4vW1yZ3aB6cD0eF5gH",
    status: "active",
    requestCount: 48291,
    errorCount: 127,
    createdAt: "2026-01-15T10:00:00Z",
    lastActivity: "2026-05-19T12:00:00Z",
  },
  {
    id: "proj_002",
    name: "EassyLife Android",
    packageName: "com.eassylife.android",
    platform: "android",
    environment: "production",
    apiKey: "eqk_and_prod_3Lm8nP5qR2sT9uV6wX0yZ7aB4cD1eF",
    status: "active",
    requestCount: 32847,
    errorCount: 89,
    createdAt: "2026-02-01T09:00:00Z",
    lastActivity: "2026-05-19T11:45:00Z",
  },
  {
    id: "proj_003",
    name: "EassyLife iOS",
    packageName: "com.eassylife.ios",
    platform: "ios",
    environment: "production",
    apiKey: "eqk_ios_prod_7Gh2jK5lM8nP1qR4sT6vW9xY0zA3bC",
    status: "active",
    requestCount: 28193,
    errorCount: 54,
    createdAt: "2026-02-01T09:00:00Z",
    lastActivity: "2026-05-19T11:30:00Z",
  },
  {
    id: "proj_004",
    name: "JSR Flutter App",
    packageName: "com.jsr.flutter",
    platform: "flutter",
    environment: "staging",
    apiKey: "eqk_flt_stg_2Cd5fG8hI1jK4lM7nO0pQ3rS6tU9vW",
    status: "active",
    requestCount: 8921,
    errorCount: 34,
    createdAt: "2026-03-10T14:00:00Z",
    lastActivity: "2026-05-19T10:00:00Z",
  },
  {
    id: "proj_005",
    name: "Mobile React Native",
    packageName: "com.eassylife.rn",
    platform: "react-native",
    environment: "development",
    apiKey: "eqk_rn_dev_9Wx2yZ5aB8cD1eF4gH7iJ0kL3mN6oP",
    status: "inactive",
    requestCount: 1243,
    errorCount: 12,
    createdAt: "2026-04-20T11:00:00Z",
    lastActivity: "2026-05-15T16:00:00Z",
  },
];

// ─── API REQUESTS ─────────────────────────────────────────────

const paths = [
  "/api/v1/auth/login",
  "/api/v1/users",
  "/api/v1/projects",
  "/api/v1/services",
  "/api/v1/orders",
  "/api/v1/payments",
  "/api/v1/notifications",
  "/api/v1/analytics",
  "/api/v1/providers",
  "/api/v1/categories",
];

const methods: APIRequest["method"][] = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const statuses = [200, 200, 200, 200, 201, 204, 400, 404, 422, 500];
const userAgents = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "EassyLife-Android/3.2.1",
  "EassyLife-iOS/3.2.1",
  "Flutter/3.19.0",
  "ReactNative/0.73.0",
];

export const mockAPIRequests: APIRequest[] = Array.from({ length: 50 }, (_, i) => ({
  id: `req_${String(i + 1).padStart(4, "0")}`,
  method: methods[i % methods.length],
  path: paths[i % paths.length],
  status: statuses[i % statuses.length],
  duration: 12 + ((i * 13) % 2800),
  requestSize: 128 + ((i * 47) % 4096),
  responseSize: 256 + ((i * 113) % 16384),
  ip: `192.168.${(i % 254) + 1}.${(i * 3 % 254) + 1}`,
  userAgent: userAgents[i % userAgents.length],
  timestamp: new Date(1716076800000 - (i * 3600000)).toISOString(),
  projectId: mockProjects[i % mockProjects.length].id,
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "X-API-Key": "eqk_web_prod_8Kx9mN2pQ7rT4vW1yZ3aB6cD0eF5gH",
    "Accept": "application/json",
    "User-Agent": userAgents[i % userAgents.length],
  },
  requestBody: '{"key": "value"}',
  responseBody: '{"success": true, "data": {}}',
}));

// ─── CRASH LOGS ───────────────────────────────────────────────

const crashTitles = [
  "NullPointerException in MainActivity",
  "Unhandled Promise Rejection",
  "Stack Overflow in RecyclerView",
  "EXC_BAD_ACCESS in AppDelegate",
  "Flutter RenderBox overflow",
  "OutOfMemoryError in ImageLoader",
  "NetworkException: Connection timeout",
  "ClassCastException in DataBinding",
  "IndexOutOfBoundsException in ListView",
  "IllegalStateException in Fragment",
];

const stackTraces = [
  `java.lang.NullPointerException: Attempt to invoke virtual method
  at com.eassylife.app.MainActivity.onCreate(MainActivity.java:42)
  at android.app.Activity.performCreate(Activity.java:7136)
  at android.app.Instrumentation.callActivityOnCreate(Instrumentation.java:1271)`,
  `Error: Cannot read property 'map' of undefined
  at Dashboard.renderItems (Dashboard.tsx:145:23)
  at Dashboard.render (Dashboard.tsx:189:12)
  at ReactCompositeComponent._renderValidatedComponent`,
  `flutter: ══╡ EXCEPTION CAUGHT BY WIDGETS LIBRARY ╞═══════════════
  The following RenderFlex overflow was thrown:
  A RenderFlex overflowed by 42 pixels on the right.
  RenderFlex#8f2c0 OVERFLOWING
    at _HomePageState.build (home_page.dart:87:12)`,
];

export const mockCrashLogs: CrashLog[] = Array.from({ length: 20 }, (_, i) => ({
  id: `crash_${String(i + 1).padStart(4, "0")}`,
  title: crashTitles[i % crashTitles.length],
  message: "Unexpected error occurred during operation",
  stackTrace: stackTraces[i % stackTraces.length],
  severity: (["critical", "error", "warning"] as const)[i % 3],
  platform: ["android", "ios", "web", "flutter"][i % 4],
  version: `3.${i % 5}.${i % 9}`,
  device: ["Samsung Galaxy S24", "iPhone 15 Pro", "Pixel 7", "OnePlus 12"][i % 4],
  os: ["Android 14", "iOS 17.4", "macOS 14.3"][i % 3],
  osVersion: `${12 + (i % 5)}.${i % 5}`,
  sessionId: `sess_abc${i}def`,
  timestamp: new Date(1716076800000 - (i * 86400000)).toISOString(),
  projectId: mockProjects[i % mockProjects.length].id,
  count: 1 + ((i * 17) % 342),
  resolved: i % 3 === 0,
}));

// ─── UI ERRORS ────────────────────────────────────────────────

const uiErrorTypes: UIError["type"][] = [
  "component_crash",
  "button_failure",
  "runtime_error",
  "render_error",
];

const components = [
  "BookingForm",
  "PaymentButton",
  "ServiceCard",
  "UserProfile",
  "DatePicker",
  "SearchBar",
  "ChatWindow",
  "NotificationBell",
  "OrderSummary",
  "MapComponent",
];

export const mockUIErrors: UIError[] = Array.from({ length: 20 }, (_, i) => ({
  id: `ui_${String(i + 1).padStart(4, "0")}`,
  type: uiErrorTypes[i % uiErrorTypes.length],
  component: components[i % components.length],
  message: [
    "Cannot read property 'onClick' of null",
    "Maximum update depth exceeded",
    "Invariant violation: rendered fewer hooks than expected",
    "TypeError: Cannot read properties of undefined",
    "React.createElement: type is invalid",
  ][i % 5],
  url: `https://app.eassylife.com/${["home", "booking", "profile", "services"][i % 4]}`,
  browser: ["Chrome 122", "Safari 17.4", "Firefox 124", "Edge 122"][i % 4],
  browserVersion: `${100 + (i % 25)}.0.${i * 111}.${i % 99}`,
  os: ["macOS", "Windows 11", "Ubuntu 22.04", "iOS 17"][i % 4],
  timestamp: new Date(1716076800000 - (i * 86400000)).toISOString(),
  projectId: mockProjects[i % mockProjects.length].id,
  count: 1 + ((i * 7) % 89),
  resolved: i % 4 === 0,
}));

// ─── API KEYS ─────────────────────────────────────────────────

export const mockAPIKeys: APIKey[] = [
  {
    id: "key_001",
    name: "Production Web Key",
    key: "eqk_web_prod_8Kx9mN2pQ7rT4vW1yZ3aB6cD0eF5gH",
    projectId: "proj_001",
    projectName: "EassyLife Web",
    platform: "web",
    createdAt: "2026-01-15T10:00:00Z",
    lastUsed: "2026-05-19T12:00:00Z",
    status: "active",
    requestCount: 48291,
  },
  {
    id: "key_002",
    name: "Android SDK Key",
    key: "eqk_and_prod_3Lm8nP5qR2sT9uV6wX0yZ7aB4cD1eF",
    projectId: "proj_002",
    projectName: "EassyLife Android",
    platform: "android",
    createdAt: "2026-02-01T09:00:00Z",
    lastUsed: "2026-05-19T11:45:00Z",
    status: "active",
    requestCount: 32847,
  },
  {
    id: "key_003",
    name: "iOS SDK Key",
    key: "eqk_ios_prod_7Gh2jK5lM8nP1qR4sT6vW9xY0zA3bC",
    projectId: "proj_003",
    projectName: "EassyLife iOS",
    platform: "ios",
    createdAt: "2026-02-01T09:00:00Z",
    lastUsed: "2026-05-19T11:30:00Z",
    status: "active",
    requestCount: 28193,
  },
  {
    id: "key_004",
    name: "Flutter Staging Key",
    key: "eqk_flt_stg_2Cd5fG8hI1jK4lM7nO0pQ3rS6tU9vW",
    projectId: "proj_004",
    projectName: "JSR Flutter App",
    platform: "flutter",
    createdAt: "2026-03-10T14:00:00Z",
    lastUsed: "2026-05-19T10:00:00Z",
    status: "active",
    requestCount: 8921,
  },
  {
    id: "key_005",
    name: "Old Development Key",
    key: "eqk_dev_old_1Ab4cD7eF0gH3iJ6kL9mN2oP5qR8sT",
    projectId: "proj_005",
    projectName: "Mobile React Native",
    platform: "react-native",
    createdAt: "2026-01-01T00:00:00Z",
    lastUsed: "2026-03-15T08:00:00Z",
    status: "revoked",
    requestCount: 1243,
  },
];

// ─── TEAM MEMBERS ─────────────────────────────────────────────

export const mockTeamMembers: TeamMember[] = [
  {
    id: "user_001",
    name: "John Doe",
    email: "john@example.com",
    role: "owner",
    avatar: "JD",
    joinedAt: "2026-01-01T00:00:00Z",
    lastSeen: "2026-05-19T12:00:00Z",
  },
  {
    id: "user_002",
    name: "Sarah Mitchell",
    email: "sarah@eassylife.com",
    role: "admin",
    avatar: "SM",
    joinedAt: "2026-01-15T10:00:00Z",
    lastSeen: "2026-05-19T11:00:00Z",
  },
  {
    id: "user_003",
    name: "James Chen",
    email: "james@eassylife.com",
    role: "developer",
    avatar: "JC",
    joinedAt: "2026-02-01T09:00:00Z",
    lastSeen: "2026-05-18T18:30:00Z",
  },
  {
    id: "user_004",
    name: "Priya Sharma",
    email: "priya@eassylife.com",
    role: "developer",
    avatar: "PS",
    joinedAt: "2026-03-01T09:00:00Z",
    lastSeen: "2026-05-19T09:00:00Z",
  },
  {
    id: "user_005",
    name: "Marcus Williams",
    email: "marcus@eassylife.com",
    role: "viewer",
    avatar: "MW",
    joinedAt: "2026-04-01T09:00:00Z",
    lastSeen: "2026-05-17T14:00:00Z",
  },
];

// ─── CHART DATA ───────────────────────────────────────────────

export function generateTimeSeriesData(
  hours: number = 24,
  baseValue: number = 100,
  variance: number = 50
): MetricPoint[] {
  const data: MetricPoint[] = [];
  const baseDate = new Date(1716076800000);
  for (let i = hours; i >= 0; i--) {
    const time = new Date(baseDate.getTime() - i * 3600000);
    data.push({
      time: time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      value: Math.max(0, baseValue + ((i * 13) % (variance * 2)) - variance),
    });
  }
  return data;
}

export const requestsChartData = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, "0")}:00`,
  requests: 800 + ((i * 113) % 2400),
  errors: 5 + ((i * 7) % 75),
  latency: 45 + ((i * 19) % 335),
}));

export const crashChartData = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(1716076800000);
  d.setDate(d.getDate() - (6 - i));
  return {
    date: d.toLocaleDateString("en-US", { weekday: "short" }),
    crashes: 5 + ((i * 7) % 40),
    resolved: 3 + ((i * 5) % 27),
  };
});

export const sdkActivityData = [
  { name: "Web SDK", value: 38, color: "#FFA300" },
  { name: "Android SDK", value: 28, color: "#FF6B00" },
  { name: "iOS SDK", value: 22, color: "#FFD700" },
  { name: "Flutter SDK", value: 12, color: "#FF8C00" },
];

export const performanceData = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  p50: 80 + ((i * 13) % 70),
  p95: 200 + ((i * 23) % 300),
  p99: 500 + ((i * 37) % 700),
}));

// ─── DASHBOARD STATS ──────────────────────────────────────────

export const dashboardStats = {
  totalRequests: { value: "2.4M", change: "+12.3%", positive: true },
  activeAPIs: { value: "47", change: "+3", positive: true },
  errorRate: { value: "0.8%", change: "-0.2%", positive: true },
  crashCount: { value: "284", change: "+18", positive: false },
  sdkInstalls: { value: "1,847", change: "+234", positive: true },
  avgLatency: { value: "142ms", change: "-23ms", positive: true },
  uptime: { value: "99.97%", change: "0.00%", positive: true },
  activeUsers: { value: "12,483", change: "+847", positive: true },
};
