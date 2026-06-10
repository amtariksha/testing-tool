"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Code2, Copy, Check, Zap, Shield, ChevronDown, Terminal, Network, UserCheck, Wifi, Activity, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const tabs = ["Flutter SDK", "Android SDK", "iOS SDK", "Web SDK"] as const;
type Tab = (typeof tabs)[number];

const sdkDocs: Record<Tab, { install: string; init: string; usage: string; language: string; highlight?: string }> = {
  "Flutter SDK": {
    language: "yaml",
    install: `# 📦 pubspec.yaml
dependencies:
  flutter:
    sdk: flutter

  # Option A: Local Plugin Dependency
  nirikshaka:
    path: ./nirikshaka_plugin

  # Option B: Single-file drop-in utility
  # No pubspec entry needed! Copy nirikshaka.dart to lib/

  # Required for HTTP tracking
  dio: ^5.4.0
  pretty_dio_logger: ^1.4.0`,
    init: `import 'package:flutter/material.dart';
import 'package:nirikshaka/nirikshaka.dart'; // Or relative path if Option B

// Init once. Track everything.
void main() {
  Nirikshaka.init(
    config: NirikshakaConfig(
      apiKey: 'eqk_live_YOUR_KEY',
      projectId: 'your-project-id',
      environment: Environment.production, // Or Environment.development
      apiUrl: 'http://localhost:3001/api', // MANDATORY for local/custom hosting
      enableScreenshotDetection: true,     // Detects system screenshots & auto-uploads
      enablePrettyDioLogger: true,         // Logs internal SDK uploads to console
    ),
    appRunner: () => runApp(const MyApp()),
  );
}

// Optional: Track screen transitions in the user journey dashboard
MaterialApp(
  navigatorObservers: [NirikshakaNavigatorObserver()],
);`,
    usage: `// ✅ Crashes & UI Errors — Tracked automatically
// Uncaught exceptions and RenderFlex layout overflows auto-captured

// ✅ Screenshot Capture — Tracked automatically
// Detects system screenshots, captures viewport, and uploads to dashboard

// ✅ Navigation — Tracked automatically via MaterialApp observer
// Screen transitions logged as timeline breadcrumbs

// ✅ HTTP Requests: Option 1 — Dio Interceptor (Recommended)
// Automatically track requests, statuses, payloads, and durations:
final dio = Dio();
dio.interceptors.add(NirikshakaDioInterceptor());
// Optional: Add pretty console logs:
dio.interceptors.add(PrettyDioLogger(requestHeader: true, requestBody: true));

// ✅ HTTP Requests: Option 2 — NirikshakaHttpClient (for http package)
final client = NirikshakaHttpClient();
final res = await client.get(Uri.parse('https://api.example.com/users'));

// ✅ Identify Users & Custom Events
Nirikshaka.setUser(
  userId: 'user_99201',
  name: 'John Doe',
  email: 'john@example.com',
);
Nirikshaka.trackJourneyEvent('button_tap', 'Upgrade Plan Button');`,
    highlight: "Zero-code crash, UI error, network, and screenshot tracking",
  },
  "Android SDK": {
    language: "gradle",
    install: `// build.gradle (app)
dependencies {
    implementation 'io.nirikshaka:android:2.0.0'
}`,
    init: `// Application.kt — One call, everything is auto-tracked
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        Nirikshaka.init(
            context = this,
            config = NirikshakaConfig(
                apiKey = "eqk_and_prod_YOUR_KEY",
                projectId = "your-project-id",
                environment = Environment.PRODUCTION,
                appVersion = BuildConfig.VERSION_NAME
            )
        )
        // ✅ Crashes, ANRs, network, lifecycle — all automatic
    }
}`,
    usage: `// ✅ Crashes & ANRs — Tracked automatically
// Thread.setDefaultUncaughtExceptionHandler is hooked

// ✅ Network — Use NirikshakaHttpInterceptor with OkHttp
val client = OkHttpClient.Builder()
    .addInterceptor(Nirikshaka.networkInterceptor())
    .build()

// ✅ Lifecycle — Tracked automatically
// App foreground/background transitions

// Optional: Manual tracking
Nirikshaka.trackCrash(throwable, context = mapOf("screen" to "Home"))
Nirikshaka.addBreadcrumb("user_completed_checkout")`,
    highlight: "Auto crash, ANR, network, and lifecycle tracking",
  },
  "iOS SDK": {
    language: "swift",
    install: `# Swift Package Manager
dependencies: [
    .package(url: "https://github.com/nirikshaka/ios-sdk", from: "2.0.0")
]

# Or CocoaPods
pod 'Nirikshaka', '~> 2.0'`,
    init: `// AppDelegate.swift — One call, everything is auto-tracked
import Nirikshaka

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions opts: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        Nirikshaka.start(
            apiKey: "eqk_ios_prod_YOUR_KEY",
            projectId: "your-project-id",
            environment: .production
        )
        // ✅ Crashes, network, lifecycle — all automatic
        return true
    }
}`,
    usage: `// ✅ Crashes — Tracked automatically
// NSException handler + signal handler installed

// ✅ Network — Auto-instrumented via URLSession swizzling
// All URLSession requests tracked automatically

// ✅ Lifecycle — Tracked automatically
// App state transitions logged as breadcrumbs

// Optional: Manual tracking
Nirikshaka.trackCrash(exception: error, context: ["screen": "Home"])
Nirikshaka.addBreadcrumb("user_opened_settings")`,
    highlight: "Auto crash, network, and lifecycle tracking",
  },
  "Web SDK": {
    language: "bash",
    install: `npm install @nirikshaka/sdk
# or
yarn add @nirikshaka/sdk`,
    init: `import { Nirikshaka } from '@nirikshaka/sdk';

// One call — crashes, errors, and network auto-tracked
Nirikshaka.init({
  apiKey: 'eqk_web_prod_YOUR_KEY',
  projectId: 'your-project-id',
  environment: 'production',
  version: '1.0.0',
});
// ✅ window.onerror + unhandledrejection hooked
// ✅ fetch/XHR intercepted for network tracking
// ✅ Performance metrics (LCP, FID, CLS) auto-captured`,
    usage: `// ✅ JS Errors — Tracked automatically
// window.onerror and unhandledrejection

// ✅ Network — Tracked automatically
// fetch() and XMLHttpRequest intercepted

// ✅ Performance — Tracked automatically
// Core Web Vitals (LCP, FID, CLS)

// Optional: Manual tracking
Nirikshaka.trackError(error, { component: 'CheckoutForm' });
Nirikshaka.addBreadcrumb('page_viewed', { path: '/checkout' });`,
    highlight: "Auto error, network, and performance tracking",
  },
};

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-muted/30 border border-border rounded-xl p-4 overflow-x-auto text-sm font-mono text-muted-foreground leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-muted/80 border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:border-brand/50 hover:text-brand"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

const deepGuides = [
  {
    title: "Screenshot Detection Setup (Android & iOS)",
    icon: Camera,
    description: "Configure system screenshot detection permissions for automated dashboard uploads.",
    content: `To enable the SDK to automatically detect system screenshots, capture the current screen view, and upload it to the Nirikshaka dashboard, follow these platform setups.

**1. Enable in Flutter configuration:**
Ensure \`enableScreenshotDetection\` is set to true in your configuration:
\`\`\`dart
Nirikshaka.init(
  config: NirikshakaConfig(
    ...
    enableScreenshotDetection: true,
  ),
  appRunner: () => runApp(const MyApp()),
);
\`\`\`

**2. Android Configuration:**
Add the required permissions in your \`android/app/src/main/AndroidManifest.xml\` file. Depending on target Android versions, declare these permissions:
\`\`\`xml
<!-- For Android 12 and below (API <= 32) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />

<!-- For Android 13 (API 33) -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />

<!-- For Android 14+ (API 34+) -->
<uses-permission android:name="android.permission.DETECT_SCREEN_CAPTURE" />
\`\`\`

*Note: The SDK automatically requests the appropriate storage/photos permission at runtime when initializing on Android 13 and below, and uses the native ScreenCaptureCallback on Android 14+.*

**3. iOS Configuration:**
No plist or manifest permissions are required for iOS! The iOS SDK automatically hooks into \`UIApplication.userDidTakeScreenshotNotification\` to handle everything seamlessly.`
  },
  {
    title: "Local Wi-Fi Development Setup",
    icon: Terminal,
    description: "Connect your physical mobile device to a locally running Nirikshaka server on the same Wi-Fi.",
    content: `When running the Nirikshaka server locally and testing on a physical mobile device, **do not use localhost or 127.0.0.1** in the \`apiUrl\`. You must use your computer's local IP address.

**How to find your local IP:**
• **Mac/Linux:** Run \`ipconfig getifaddr en0\` or \`ifconfig | grep "inet "\`
• **Windows:** Run \`ipconfig\`

Set the \`apiUrl\` in \`NirikshakaConfig\` to:
\`\`\`dart
apiUrl: 'http://<YOUR_LOCAL_IP>:3001/api'
\`\`\``
  },
  {
    title: "Advanced Dio Network Interception",
    icon: Network,
    description: "Capture HTTP request/response payloads, status codes, and latency with Dio.",
    content: `Add \`NirikshakaDioInterceptor\` to auto-track network requests. You can also chain it with \`PrettyDioLogger\` to print beautiful log statements in your debug console.

\`\`\`dart
import 'package:dio/dio.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';
import 'package:nirikshaka/nirikshaka.dart';

final dio = Dio();

void setupDio() {
  // 1. Add NirikshakaDioInterceptor to log requests to dashboard
  dio.interceptors.add(NirikshakaDioInterceptor());

  // 2. Add console logger for localized debugging (optional)
  dio.interceptors.add(
    PrettyDioLogger(
      requestHeader: true,
      requestBody: true,
      responseBody: true,
      error: true,
      compact: true,
    ),
  );
}
\`\`\``
  },
  {
    title: "User Identity Integration",
    icon: UserCheck,
    description: "Tie anonymous user journeys and crashes to actual registered users.",
    content: `Call \`setUser\` after login to link the timeline events to a specific user. Call \`clearUser\` on logout.

\`\`\`dart
// Identify user
Nirikshaka.setUser(
  userId: 'user_99201', // Backend identifier
  name: 'John Doe',
  email: 'john@example.com',
  mobile: '+1234567890',
);

// Clear on logout
Nirikshaka.clearUser();
\`\`\``
  },
  {
    title: "Custom Journey Logging",
    icon: Activity,
    description: "Track custom touchpoints, button clicks, and funnel progress.",
    content: `Log custom events to see how users navigate critical funnels in your app:

\`\`\`dart
Nirikshaka.trackJourneyEvent(
  'button_tap',
  'Upgrade Plan Button',
  data: {
    'selected_plan': 'pro_annual',
    'price': 99.99,
  },
);
\`\`\``
  },
  {
    title: "Connectivity Diagnostics",
    icon: Wifi,
    description: "Verify that the mobile app is successfully communicating with the Nirikshaka server.",
    content: `Use the built-in test utility to diagnose network issues or incorrect IP configurations:

\`\`\`dart
final isConnected = await Nirikshaka.testConnection();
if (isConnected) {
  print('✅ Successfully connected to Nirikshaka server!');
} else {
  print('❌ Connection failed. Check server status and local IP.');
}
\`\`\``
  }
];

function formatLine(line: string) {
  const parts = line.split("**");
  return parts.map((part, idx) => {
    if (idx % 2 === 1) {
      return <strong key={idx} className="text-foreground font-semibold">{part}</strong>;
    }
    const codeParts = part.split("`");
    return codeParts.map((subPart, subIdx) => {
      if (subIdx % 2 === 1) {
        return <code key={subIdx} className="bg-muted px-1.5 py-0.5 rounded text-xs text-brand font-mono">{subPart}</code>;
      }
      return subPart;
    });
  });
}

function renderGuideContent(content: string, codeBlockRenderer: (code: string, lang: string) => React.ReactNode) {
  const parts = content.split("```");
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      const lines = part.split("\n");
      const language = lines[0].trim();
      const code = lines.slice(1).join("\n").trim();
      return (
        <div key={index} className="my-2">
          {codeBlockRenderer(code, language)}
        </div>
      );
    }
    return (
      <div key={index} className="whitespace-pre-line text-xs md:text-sm text-muted-foreground leading-relaxed my-1">
        {part.split("\n").map((line, lineIdx) => {
          if (line.trim().startsWith("• ")) {
            return (
              <li key={lineIdx} className="ml-4 list-disc my-1">
                {formatLine(line.substring(line.indexOf("• ") + 2))}
              </li>
            );
          }
          return <p key={lineIdx} className="my-1">{formatLine(line)}</p>;
        })}
      </div>
    );
  });
}

export default function SDKsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Flutter SDK");
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null);
  const docs = sdkDocs[activeTab];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">SDK Integration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Init once. Track everything. Zero extra code.
          </p>
        </div>
      </motion.div>

      {/* Philosophy Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-premium p-4 border-brand/20 bg-brand/5"
      >
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-xl bg-brand/20 flex items-center justify-center flex-shrink-0">
            <Zap className="h-4 w-4 text-brand" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">SDK v2.0 — Auto-Instrumentation</p>
            <p className="text-xs text-muted-foreground mt-1">
              Just call <code className="text-brand font-mono">init()</code> and everything is captured automatically — crashes, network requests, UI errors, navigation, and lifecycle events. No manual tracking code needed.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl border border-border w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab
                ? "bg-brand text-black shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Docs */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Highlight */}
        {docs.highlight && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 w-fit">
            <Shield className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs font-medium text-green-400">{docs.highlight}</span>
          </div>
        )}

        {/* Installation */}
        <div className="card-premium p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-full bg-brand text-black text-xs font-bold flex items-center justify-center">1</div>
            <h3 className="font-semibold text-foreground">Install</h3>
          </div>
          <CodeBlock code={docs.install} language={docs.language} />
        </div>

        {/* Initialization */}
        <div className="card-premium p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-full bg-brand text-black text-xs font-bold flex items-center justify-center">2</div>
            <h3 className="font-semibold text-foreground">Initialize — That&apos;s It!</h3>
          </div>
          <CodeBlock code={docs.init} language="typescript" />
        </div>

        {/* What's Auto vs Optional */}
        <div className="card-premium p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-full bg-brand text-black text-xs font-bold flex items-center justify-center">3</div>
            <h3 className="font-semibold text-foreground">What&apos;s Tracked</h3>
          </div>
          <CodeBlock code={docs.usage} language="typescript" />
        </div>

        {/* Auto vs Manual Methods */}
        <div className="card-premium p-5">
          <h3 className="font-semibold text-foreground mb-4">Auto vs Manual</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { method: "Crashes", desc: "Unhandled exceptions auto-captured", auto: true },
              { method: "UI Errors", desc: "Render/layout errors auto-detected", auto: true },
              { method: "Network", desc: "Dio interceptor or NirikshakaHttpClient", auto: true },
              { method: "Navigation", desc: "Screen changes via NavigatorObserver", auto: true },
              { method: "Screenshots", desc: "User screenshots auto-detected & captured", auto: true },
              { method: "Lifecycle", desc: "App foreground/background states", auto: true },
              { method: "Breadcrumbs", desc: "Navigation + lifecycle auto-logged", auto: true },
              { method: "trackCrash()", desc: "Manually report a caught error", auto: false },
              { method: "addBreadcrumb()", desc: "Add custom breadcrumb trail", auto: false },
            ].map((item) => (
              <div key={item.method} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border border-border">
                <span className={cn(
                  "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5",
                  item.auto ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
                )}>
                  {item.auto ? "AUTO" : "MANUAL"}
                </span>
                <div className="min-w-0">
                  <code className="text-brand text-sm font-mono">{item.method}</code>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deep Implementation Guide */}
        <div className="card-premium p-5 mt-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Deep Implementation Guide</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Advanced integration configurations, networking recipes, and testing utilities.
            </p>
          </div>

          <div className="space-y-3">
            {deepGuides.map((guide, idx) => {
              const Icon = guide.icon;
              const isExpanded = expandedGuide === idx;
              return (
                <div
                  key={guide.title}
                  className={cn(
                    "border rounded-xl transition-all overflow-hidden",
                    isExpanded
                      ? "border-brand/40 bg-brand/5 shadow-sm"
                      : "border-border bg-muted/10 hover:border-border/40"
                  )}
                >
                  <button
                    onClick={() => setExpandedGuide(isExpanded ? null : idx)}
                    className="w-full flex items-center justify-between p-4 text-left focus:outline-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                        isExpanded ? "bg-brand/20 text-brand" : "bg-muted text-muted-foreground"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{guide.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{guide.description}</p>
                      </div>
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      isExpanded && "transform rotate-180 text-brand"
                    )} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-4 pb-4 pt-2 border-t border-border/40 text-sm text-muted-foreground space-y-3 leading-relaxed">
                          {renderGuideContent(guide.content, (code, lang) => (
                            <CodeBlock code={code} language={lang} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
