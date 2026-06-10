/// Configuration for the Nirikshaka SDK.
///
/// All tracking features are enabled by default.
/// Disable individual features via constructor parameters.
library;

/// App environment enum.
enum Environment { development, staging, production }

/// Error severity levels.
enum Severity {
  info,
  warning,
  error,
  critical;

  /// Convert to API-compatible uppercase string.
  String toApiValue() => name.toUpperCase();
}

/// Configuration object for [Nirikshaka.init].
///
/// ```dart
/// final config = NirikshakaConfig(
///   apiKey: 'eqk_live_xxxxx',
///   projectId: 'clxxxxxxx',
///   appVersion: '2.0.0',
///   enableJourneyTracking: true,
/// );
/// ```
class NirikshakaConfig {
  /// Your project's API key from the Nirikshaka dashboard.
  final String apiKey;

  /// Your project ID from the Nirikshaka dashboard.
  final String projectId;

  /// Current app environment.
  final Environment environment;

  /// Current app version string.
  final String appVersion;

  /// Nirikshaka server URL. Defaults to localhost for development.
  final String apiUrl;

  /// Enable automatic crash reporting. Default: `true`.
  bool enableCrashReporting;

  /// Enable automatic HTTP request tracking via [NirikshakaHttpClient]. Default: `true`.
  bool enableNetworkTracking;

  /// Enable automatic UI error detection (render overflows, etc.). Default: `true`.
  bool enableUIErrorTracking;

  /// Enable breadcrumb trail for crash context. Default: `true`.
  bool enableBreadcrumbs;

  /// Enable app lifecycle state tracking. Default: `true`.
  bool enableLifecycleTracking;

  /// Enable user journey tracking (screen views, taps, session recording). Default: `true`.
  bool enableJourneyTracking;

  /// Enable automatic screenshot detection. Default: `true`.
  bool enableScreenshotDetection;

  /// Enable suspension status. Default: `false`.
  bool isSuspended;

  /// Interval in seconds between journey event batch uploads. Default: `30`.
  final int journeyBatchIntervalSeconds;

  /// Enable pretty logging of SDK-internal network requests. Default: `false`.
  final bool enablePrettyDioLogger;

  /// Enable console debug logs. Default: `false`.
  final bool isDebug;

  NirikshakaConfig({
    required this.apiKey,
    required this.projectId,
    this.environment = Environment.production,
    this.appVersion = '1.0.0',
    this.apiUrl = 'http://localhost:3001/api',
    this.enableCrashReporting = true,
    this.enableNetworkTracking = true,
    this.enableUIErrorTracking = true,
    this.enableBreadcrumbs = true,
    this.enableLifecycleTracking = true,
    this.enableJourneyTracking = true,
    this.enableScreenshotDetection = true,
    this.isSuspended = false,
    this.journeyBatchIntervalSeconds = 30,
    this.enablePrettyDioLogger = false,
    this.isDebug = false,
  });
}
