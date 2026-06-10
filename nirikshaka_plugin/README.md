# Nirikshaka Flutter SDK

**Init once, track everything.** Auto-capture crashes, UI errors, API requests, and user journeys with AI-powered analysis.

[![pub package](https://img.shields.io/pub/v/nirikshaka.svg)](https://pub.dev/packages/nirikshaka)

## Features

- 🔥 **Crash Reporting** — Automatic crash detection with stack traces and breadcrumbs
- 🖥️ **UI Error Tracking** — Detect render overflows, component failures, and runtime errors
- 📡 **API Monitoring** — Auto-track HTTP requests with latency, status codes, and error rates
- 📍 **User Journey Tracking** — Record screen views, button taps, and navigation flow
- 🤖 **AI Analysis** — Get AI-powered summaries of what users are looking for and UX improvement suggestions
- 👤 **User Identity** — Attach name, email, and mobile to journey sessions

## Quick Start

### 1. Install

```bash
flutter pub add nirikshaka
```

### 2. Initialize

```dart
import 'package:nirikshaka/nirikshaka.dart';

void main() {
  Nirikshaka.init(
    config: NirikshakaConfig(
      apiKey: 'eqk_live_xxxxxxxxxxxxx',
      projectId: 'clxxxxxxxxxxxxxxxxx',
      apiUrl: 'https://your-nirikshaka-server.com/api',
      appVersion: '1.0.0',
    ),
    appRunner: () => runApp(const MyApp()),
  );
}
```

### 3. Add Navigator Observer (Recommended)

```dart
MaterialApp(
  navigatorObservers: [NirikshakaNavigatorObserver()],
  // ...
);
```

### 4. Set User Identity (Optional)

```dart
// After login
Nirikshaka.setUser(
  name: "John Doe",
  email: "john@example.com",
  mobile: "+1234567890",
  userId: "user_123",
);

// On logout
Nirikshaka.clearUser();
```

### 5. Track Custom Events (Optional)

```dart
// Track button taps, form submissions, etc.
Nirikshaka.trackJourneyEvent(
  'button_tap',
  'Add to Cart',
  data: {'productId': '123', 'price': 29.99},
);
```

### 6. Auto-Tracked HTTP (Optional)

```dart
// Replace http.Client() with NirikshakaHttpClient()
final client = NirikshakaHttpClient();
final response = await client.get(Uri.parse("https://api.example.com/users"));
// ^ Automatically logged to Nirikshaka dashboard
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `apiKey` | **required** | Your project API key |
| `projectId` | **required** | Your project ID |
| `apiUrl` | `http://localhost:3001/api` | Nirikshaka server URL |
| `appVersion` | `1.0.0` | Your app version |
| `environment` | `production` | `development`, `staging`, or `production` |
| `enableCrashReporting` | `true` | Auto-capture crashes |
| `enableUIErrorTracking` | `true` | Auto-detect render errors |
| `enableNetworkTracking` | `true` | Track HTTP via NirikshakaHttpClient |
| `enableBreadcrumbs` | `true` | Record navigation breadcrumbs |
| `enableLifecycleTracking` | `true` | Track app lifecycle |
| `enableJourneyTracking` | `true` | Record user journeys |
| `journeyBatchIntervalSeconds` | `30` | Journey event batch interval |

## How Journey Tracking Works

1. **Session Start**: A new session is created when the app launches
2. **Auto-Capture**: Screen views, navigation events, and lifecycle changes are recorded automatically
3. **Batched Upload**: Events are buffered and sent every 30 seconds (configurable)
4. **Session End**: When the app goes to background, the session ends and all buffered events are flushed
5. **AI Analysis**: View user journeys in the dashboard and get AI-powered insights

## License

MIT License — see [LICENSE](LICENSE) for details.
