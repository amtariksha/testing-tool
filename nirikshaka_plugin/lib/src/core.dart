/// Core Nirikshaka SDK class.
///
/// Initialize with [Nirikshaka.init] and optionally set user identity
/// with [Nirikshaka.setUser].
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:dio/dio.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';
import 'package:screenshot_callback/screenshot_callback.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:device_info_plus/device_info_plus.dart';

import 'config.dart';
import 'journey_tracker.dart';

/// The main Nirikshaka SDK class.
///
/// Usage:
/// ```dart
/// void main() {
///   Nirikshaka.init(
///     config: NirikshakaConfig(apiKey: "...", projectId: "..."),
///     appRunner: () => runApp(const MyApp()),
///   );
/// }
/// ```
class Nirikshaka with WidgetsBindingObserver {
  static Nirikshaka? _instance;
  NirikshakaConfig? _config;
  FlutterExceptionHandler? _originalOnError;
  bool _initialized = false;
  static Dio? _dioClient;
  static String? _pushToken;

  /// Gets the currently registered push token.
  static String? get pushToken => _pushToken;

  /// Internal Dio client used by the SDK.
  static Dio get dio {
    if (_dioClient == null) {
      final inst = instance;
      _dioClient = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        validateStatus: (status) => true,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': inst._config?.apiKey,
        },
      ));

      if (inst._config?.enablePrettyDioLogger == true) {
        _dioClient!.interceptors.add(PrettyDioLogger(
          requestHeader: true,
          requestBody: true,
          responseBody: true,
          responseHeader: false,
          error: true,
          compact: true,
        ));
      }
    }
    return _dioClient!;
  }

  /// Journey tracker instance (public for observer access).
  JourneyTracker? journeyTracker;

  /// Global key to capture app screenshot dynamically on screenshot events
  static final GlobalKey repaintBoundaryKey = GlobalKey();

  ScreenshotCallback? _screenshotCallback;

  Nirikshaka._();

  // ─── INIT ─────────────────────────────────────────────

  /// Initialize Nirikshaka SDK. Call this once in your `main()` function.
  static void init({
    required NirikshakaConfig config,
    required void Function() appRunner,
  }) {
    _instance ??= Nirikshaka._();
    final inst = _instance!;
    inst._config = config;
    _dioClient = null;

    // Initialize custom binding to automatically wrap root widget in RepaintBoundary
    NirikshakaBinding.ensureInitialized();

    if (inst._initialized) {
      log('⚠️ Nirikshaka: Already initialized, skipping.');
      appRunner();
      return;
    }

    // ── Config validation ──
    // If config is invalid, log an error but STILL run the app normally
    if (config.projectId.trim().isEmpty || config.apiKey.trim().isEmpty) {
      debugPrint('');
      debugPrint('┌────────────────────────────────────────┐');
      debugPrint('│  ❌ Nirikshaka: CONFIGURATION ERROR       │');
      debugPrint('├────────────────────────────────────────┤');
      if (config.projectId.trim().isEmpty) {
        debugPrint('│  ⚠️  projectId is empty!               │');
      }
      if (config.apiKey.trim().isEmpty) {
        debugPrint('│  ⚠️  apiKey is empty!                  │');
      }
      debugPrint('│                                        │');
      debugPrint('│  SDK will NOT track any data.           │');
      debugPrint('│  Please set valid projectId & apiKey.   │');
      debugPrint('└────────────────────────────────────────┘');
      debugPrint('');

      // Run the app without SDK tracking
      appRunner();
      return;
    }

    inst._initialized = true;

    // Initialize journey tracker
    if (config.enableJourneyTracking) {
      inst.journeyTracker = JourneyTracker(
        config: config,
        resolveUrl: inst._resolveUrl,
        getDeviceContext: inst._getDeviceContext,
      );
    }

    log('');
    log('┌────────────────────────────────────────┐');
    log('│  🚀 Nirikshaka Flutter SDK v2.1.0         │');
    log('│  "Init once, track everything."        │');
    log('├────────────────────────────────────────┤');
    log('│  Project : ${_truncate(config.projectId, 12)}...  │');
    log('│  API Key : ${_truncate(config.apiKey, 12)}...     │');
    log('│  Server  : ${config.apiUrl}');
    log('│  Env     : ${config.environment.name}');
    log('│                                        │');
    log('│  ✅ Crash Reporting  : ${config.enableCrashReporting ? "ON" : "OFF"}           │');
    log('│  ✅ UI Error Track   : ${config.enableUIErrorTracking ? "ON" : "OFF"}           │');
    log('│  ✅ Network Tracking : ${config.enableNetworkTracking ? "ON" : "OFF"}           │');
    log('│  ✅ Breadcrumbs      : ${config.enableBreadcrumbs ? "ON" : "OFF"}           │');
    log('│  ✅ Lifecycle Track  : ${config.enableLifecycleTracking ? "ON" : "OFF"}           │');
    log('│  ✅ Journey Tracking : ${config.enableJourneyTracking ? "ON" : "OFF"}           │');
    log('└────────────────────────────────────────┘');
    log('');

    // Hook into Flutter framework errors
    if (config.enableCrashReporting || config.enableUIErrorTracking) {
      inst._originalOnError = FlutterError.onError;
      FlutterError.onError = (FlutterErrorDetails details) {
        inst._handleFlutterError(details);
        inst._originalOnError?.call(details);
      };
    }

    // Hook into platform-level async errors
    if (config.enableCrashReporting) {
      ui.PlatformDispatcher.instance.onError = (error, stack) {
        inst._handleAsyncError(error, stack);
        return true;
      };
    }

    // Lifecycle observer
    if (config.enableLifecycleTracking || config.enableJourneyTracking) {
      WidgetsBinding.instance.addObserver(inst);
    }

    // Start journey tracking
    if (config.enableJourneyTracking) {
      inst.journeyTracker!.startBatchTimer();
      inst.journeyTracker!.addEvent('app_lifecycle', 'App Started', data: {
        'state': 'started',
        'environment': config.environment.name,
      });
    }

    // Screenshot detection
    if (config.enableScreenshotDetection) {
      Future.delayed(const Duration(seconds: 2), () {
        if (inst._config?.enableScreenshotDetection == true) {
          inst._initScreenshotDetection();
        }
      });
    }

    // Fetch remote configuration asynchronously
    inst._fetchRemoteConfig();

    // Wrap appRunner in a guarded zone
    runZonedGuarded(
      () {
        appRunner();
      },
      (error, stackTrace) {
        if (config.enableCrashReporting) {
          inst._handleZoneError(error, stackTrace);
        }
      },
    );
  }

  /// Safely truncate a string to [maxLen] characters.
  static String _truncate(String value, int maxLen) {
    if (value.length <= maxLen) return value;
    return value.substring(0, maxLen);
  }

  /// Get the singleton SDK instance.
  static Nirikshaka get instance {
    if (_instance?._config == null) {
      throw Exception('Nirikshaka not initialized. Call Nirikshaka.init() first.');
    }
    return _instance!;
  }

  /// Get the current config (read-only).
  NirikshakaConfig? get config => _config;

  // ─── USER IDENTITY ────────────────────────────────────

  /// Set user identity for journey tracking.
  ///
  /// Call after login or when user info becomes available.
  /// ```dart
  /// Nirikshaka.setUser(
  ///   name: "John Doe",
  ///   email: "john@example.com",
  ///   mobile: "+1234567890",
  ///   userId: "user_123",
  /// );
  /// ```
  static void setUser({
    String? name,
    String? email,
    String? mobile,
    String? userId,
    String? uniqueId,
  }) {
    final inst = Nirikshaka.instance;
    final jt = inst.journeyTracker;
    if (jt != null) {
      if (name != null) jt.userName = name;
      if (email != null) jt.userEmail = email;
      if (mobile != null) jt.userMobile = mobile;
      if (userId != null) jt.appUserId = userId;
      if (uniqueId != null) jt.uniqueId = uniqueId;
      jt.flush(endSession: false);
    }
    log('👤 Nirikshaka: User set — ${name ?? "unnamed"} (${email ?? "no email"})${mobile != null ? " ($mobile)" : ""}');
  }

  /// Clear user identity (call on logout).
  static void clearUser() {
    final jt = Nirikshaka.instance.journeyTracker;
    if (jt != null) {
      jt.userName = null;
      jt.userEmail = null;
      jt.userMobile = null;
      jt.appUserId = null;
      jt.uniqueId = null;
    }
    log('👤 Nirikshaka: User cleared');
  }

  /// Internal logger that honors config.isDebug.
  static void log(String message) {
    if (_instance?._config?.isDebug == true) {
      debugPrint(message);
    }
  }

  /// Manually track a screen view with optional key-value parameters.
  ///
  /// ```dart
  /// Nirikshaka.trackScreen('Home Screen', data: [
  ///   {'key': 'tab', 'value': 'home'}
  /// ]);
  /// ```
  static void trackScreen(
    String screenName, {
    dynamic data,
  }) {
    final jt = Nirikshaka.instance.journeyTracker;
    if (jt != null) {
      jt.addEvent('screen_view', screenName, data: data);
    }
  }

  // ─── JOURNEY EVENT SHORTCUT ───────────────────────────

  /// Track a custom journey event.
  ///
  /// ```dart
  /// Nirikshaka.trackJourneyEvent(
  ///   'button_tap',
  ///   'Add to Cart',
  ///   data: {'productId': '123', 'price': 29.99},
  /// );
  /// ```
  static void trackJourneyEvent(
    String type,
    String name, {
    dynamic data,
    int? durationMs,
  }) {
    final jt = Nirikshaka.instance.journeyTracker;
    if (jt != null) {
      jt.addEvent(type, name, data: data, durationMs: durationMs);
    }
  }

  /// Sets/registers the FCM push token for this device.
  static Future<void> setPushToken(String token) async {
    _pushToken = token;
    final inst = _instance;
    if (inst == null) {
      print('📸 Nirikshaka warning: setPushToken called before Nirikshaka is initialized.');
      return;
    }

    final jt = inst.journeyTracker;
    final deviceId = jt?.deviceId;
    final sessionId = jt?.sessionId;

    // Trigger an immediate journey flush so the pushToken is persisted in the
    // journey record on the backend.  This is the primary persistence path.
    if (jt != null) {
      try {
        await jt.flush(endSession: false, forceSend: true);
        print('📸 Nirikshaka: Push token synced via journey flush.');
      } catch (e) {
        print('📸 Nirikshaka warning: Journey flush for push token failed: $e');
      }
    }

    if (deviceId == null) {
      print('📸 Nirikshaka warning: setPushToken called but deviceId is not available.');
      return;
    }

    // Also call the dedicated push-token endpoint as a secondary path
    try {
      final apiUrl = inst._resolveUrl();
      final response = await dio.post(
        '$apiUrl/track/push-token',
        data: {
          'deviceId': deviceId,
          'sessionId': sessionId,
          'pushToken': token,
        },
      );

      if (response.statusCode == 200) {
        print('📸 Nirikshaka: Registered push notification token successfully!');
      } else {
        print('📸 Nirikshaka error: Failed to register push token (${response.statusCode}): ${response.data}');
      }
    } catch (e) {
      print('📸 Nirikshaka error: Failed to register push token: $e');
    }
  }

  // ─── ERROR HANDLERS ───────────────────────────────────

  void _handleFlutterError(FlutterErrorDetails details) {
    final isRenderError = details.library == 'rendering library' ||
        details.toString().contains('RenderFlex') ||
        details.toString().contains('RenderBox') ||
        details.toString().contains('overflow');

    if (isRenderError && _config!.enableUIErrorTracking) {
      log('🖥️ [AUTO] UI Render Error captured');
      _sendPayload('ui', {
        'type': 'RENDER_ERROR',
        'component': details.context?.toString() ?? 'Unknown Widget',
        'message': details.exceptionAsString(),
        'url': '/',
        'stepsToReproduce': _breadcrumbs.toList(),
      });
    } else if (_config!.enableCrashReporting) {
      log('🔥 [AUTO] Framework crash captured');
      _sendPayload('crash', {
        'title': details.exception.runtimeType.toString(),
        'message': details.exceptionAsString(),
        'stackTrace': details.stack?.toString() ?? '',
        'severity': 'ERROR',
        'stepsToReproduce': _breadcrumbs.toList(),
      });
    }
  }

  void _handleAsyncError(Object error, StackTrace stack) {
    log('🔥 [AUTO] Async error captured: $error');
    _sendPayload('crash', {
      'title': error.runtimeType.toString(),
      'message': error.toString(),
      'stackTrace': stack.toString(),
      'severity': 'CRITICAL',
      'stepsToReproduce': _breadcrumbs.toList(),
    });
    _breadcrumbs.clear();
  }

  void _handleZoneError(Object error, StackTrace stackTrace) {
    log('🔥 [AUTO] Uncaught zone error captured: $error');
    _sendPayload('crash', {
      'title': error.runtimeType.toString(),
      'message': error.toString(),
      'stackTrace': stackTrace.toString(),
      'severity': 'CRITICAL',
      'stepsToReproduce': _breadcrumbs.toList(),
    });
    _breadcrumbs.clear();
  }

  // ─── LIFECYCLE ────────────────────────────────────────

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_config?.enableBreadcrumbs == true) {
      addBreadcrumb('app_lifecycle', {'state': state.name});
    }

    if (_config?.enableJourneyTracking == true && journeyTracker != null) {
      switch (state) {
        case AppLifecycleState.paused:
        case AppLifecycleState.detached:
          journeyTracker!.addEvent('app_lifecycle', 'App Backgrounded',
              data: {'state': state.name});
          journeyTracker!.flush(endSession: true);
          journeyTracker!.stopBatchTimer();
          break;
        case AppLifecycleState.resumed:
          journeyTracker!.startNewSession();
          journeyTracker!.addEvent('app_lifecycle', 'App Resumed',
              data: {'state': state.name});
          break;
        default:
          break;
      }
    }
  }

  // ─── URL RESOLUTION ───────────────────────────────────

  String _resolveUrl() {
    String url = _config!.apiUrl;
    if (url.contains('localhost') &&
        !kIsWeb &&
        defaultTargetPlatform == TargetPlatform.android) {
      url = url.replaceAll('localhost', '10.0.2.2');
    }
    return url;
  }

  // ─── DEVICE CONTEXT ───────────────────────────────────

  Map<String, dynamic> _getDeviceContext() {
    String platform = 'unknown';
    String os = 'unknown';
    String osVersion = 'unknown';

    if (kIsWeb) {
      platform = 'web';
      os = 'browser';
    } else {
      try {
        os = Platform.operatingSystem;
        osVersion = Platform.operatingSystemVersion;
        platform = Platform.isAndroid
            ? 'android'
            : Platform.isIOS
                ? 'ios'
                : Platform.isMacOS
                    ? 'macos'
                    : Platform.isLinux
                        ? 'linux'
                        : 'unknown';
      } catch (_) {
        platform = defaultTargetPlatform.toString().split('.').last;
      }
    }

    return {
      'projectId': _config!.projectId,
      'environment': _config!.environment.name,
      'appVersion': _config!.appVersion,
      'platform': platform,
      'os': os,
      'osVersion': osVersion,
      'timestamp': DateTime.now().toUtc().toIso8601String(),
    };
  }

  // ─── SEND PAYLOAD ─────────────────────────────────────

  Future<Map<String, dynamic>> _sendPayload(
      String endpoint, Map<String, dynamic> payload) async {
    if (_config?.isSuspended == true) {
      log('⚠️ Nirikshaka: Ingestion blocked. Client project is suspended.');
      return {'error': 'Project suspended'};
    }
    try {
      final url = _resolveUrl();
      final body = {...payload, 'context': _getDeviceContext()};

      final response = await dio.post(
        '$url/track/$endpoint',
        data: body,
      );

      if (response.statusCode == 200) {
        log('✅ Nirikshaka: $endpoint sent');
        return response.data is Map<String, dynamic>
            ? response.data
            : jsonDecode(response.data.toString());
      } else {
        final bodyStr = response.data?.toString() ?? '';
        if (response.statusCode == 401) {
          log('❌ Nirikshaka: Authentication Failed (401) for endpoint "$endpoint".\n'
              '   Please verify your NirikshakaConfig:\n'
              '   - Project ID: "${_config?.projectId}"\n'
              '   - API Key: "${_config?.apiKey}"\n'
              '   - Server response: $bodyStr');
        } else {
          log('⚠️ Nirikshaka: $endpoint failed (${response.statusCode}) - $bodyStr');
        }
        return {'error': bodyStr, 'statusCode': response.statusCode};
      }
    } catch (e) {
      if (e is DioException) {
        final errorMsg = e.response?.data?.toString() ?? e.message ?? e.toString();
        log('❌ Nirikshaka: $endpoint network error (${e.type}) - $errorMsg');
      } else {
        log('❌ Nirikshaka: $endpoint error - $e');
      }
      return {'error': e.toString()};
    }
  }

  // ─── BREADCRUMBS ──────────────────────────────────────

  final List<Map<String, dynamic>> _breadcrumbs = [];

  /// Add a breadcrumb for crash context.
  static void addBreadcrumb(String action, [Map<String, dynamic>? data]) {
    final inst = Nirikshaka.instance;
    if (inst._breadcrumbs.length >= 30) {
      inst._breadcrumbs.removeAt(0);
    }
    inst._breadcrumbs.add({
      'action': action,
      'data': data,
      'timestamp': DateTime.now().toUtc().toIso8601String(),
    });
    if (inst._config?.enableBreadcrumbs == true) {
      log('🍞 Breadcrumb: $action');
    }
  }

  /// Get current breadcrumbs (unmodifiable).
  static List<Map<String, dynamic>> get breadcrumbs =>
      List.unmodifiable(Nirikshaka.instance._breadcrumbs);

  /// Clear all breadcrumbs.
  static void clearBreadcrumbs() {
    Nirikshaka.instance._breadcrumbs.clear();
  }

  // ─── SCREENSHOT UPLOAD ────────────────────────────────

  Future<String?> uploadScreenshot(Uint8List bytes) async {
    try {
      final url = _resolveUrl();
      final response = await dio.post(
        '$url/track/upload',
        data: {
          'base64Image': base64Encode(bytes),
          'filename':
              'screenshot_${DateTime.now().millisecondsSinceEpoch}.png'
        },
      );

      if (response.statusCode == 200) {
        final data = response.data is Map<String, dynamic>
            ? response.data
            : jsonDecode(response.data.toString());
        return data['url'] as String?;
      }
      return null;
    } catch (e) {
      log('❌ Nirikshaka: Screenshot upload error - $e');
      return null;
    }
  }

  // ─── CONNECTION TEST ──────────────────────────────────

  /// Test the connection to the Nirikshaka server.
  static Future<bool> testConnection() async {
    try {
      final inst = Nirikshaka.instance;
      final url = inst._resolveUrl();
      final response = await dio.post(
        '$url/track/api',
        data: {
          'method': 'PING',
          'path': '/sdk/connection-test',
          'status': 200,
          'duration': 0,
          'requestSize': 0,
          'responseSize': 0,
        },
      );
      if (response.statusCode == 200) {
        log('✅ Nirikshaka: Connection OK');
        return true;
      } else {
        final bodyStr = response.data?.toString() ?? '';
        if (response.statusCode == 401) {
          log('❌ Nirikshaka: Connection auth test failed (401 - Unauthorized).\n'
              '   Please verify your NirikshakaConfig:\n'
              '   - Project ID: "${inst._config?.projectId}"\n'
              '   - API Key: "${inst._config?.apiKey}"\n'
              '   - Server response: $bodyStr');
        } else {
          log('⚠️ Nirikshaka: Connection failed (${response.statusCode}) - $bodyStr');
        }
        return false;
      }
    } catch (e) {
      if (e is DioException) {
        final errorMsg = e.response?.data?.toString() ?? e.message ?? e.toString();
        log('❌ Nirikshaka: Connection test network error (${e.type}) - $errorMsg');
      } else {
        log('❌ Nirikshaka: Connection test failed - $e');
      }
      return false;
    }
  }

  // ─── MANUAL TRACKING ──────────────────────────────────

  /// Manually track an API request.
  static Future<void> trackAPI({
    required String method,
    required String path,
    required int statusCode,
    required Duration duration,
    int? requestSize,
    int? responseSize,
    Map<String, String>? headers,
  }) async {
    await instance._sendPayload('api', {
      'method': method,
      'path': path,
      'status': statusCode,
      'duration': duration.inMilliseconds,
      'requestSize': requestSize ?? 0,
      'responseSize': responseSize ?? 0,
      'headers': headers ?? {},
    });
  }

  /// Manually track a UI error.
  static Future<void> trackUIError({
    required String type,
    required String component,
    required String message,
    String? url,
    Uint8List? screenshotBytes,
  }) async {
    String? screenshotUrl;
    if (screenshotBytes != null) {
      screenshotUrl = await instance.uploadScreenshot(screenshotBytes);
    }
    await instance._sendPayload('ui', {
      'type': type,
      'component': component,
      'message': message,
      'url': url ?? '/',
      'stepsToReproduce': instance._breadcrumbs.toList(),
      'screenshotUrl': screenshotUrl,
    });
  }

  /// Manually track a crash/error.
  static Future<void> trackCrash({
    required dynamic error,
    StackTrace? stackTrace,
    Map<String, dynamic>? extraContext,
    Severity severity = Severity.critical,
    Uint8List? screenshotBytes,
  }) async {
    String? screenshotUrl;
    if (screenshotBytes != null) {
      screenshotUrl = await instance.uploadScreenshot(screenshotBytes);
    }
    await instance._sendPayload('crash', {
      'title': error.runtimeType.toString(),
      'message': error.toString(),
      'stackTrace': stackTrace?.toString() ?? '',
      'severity': severity.toApiValue(),
      'extraContext': extraContext,
      'stepsToReproduce': instance._breadcrumbs.toList(),
      'screenshotUrl': screenshotUrl,
    });
    instance._breadcrumbs.clear();
  }

  void _initScreenshotDetection() async {
    try {
      debugPrint('📸 Nirikshaka debug: _initScreenshotDetection called!');
      if (_config?.enableScreenshotDetection != true || _config?.isSuspended == true) {
        debugPrint('📸 Nirikshaka debug: Screenshot detection disabled remotely. Skipping.');
        return;
      }

      if (Platform.isAndroid) {
        debugPrint('📸 Nirikshaka debug: Device is Android. Fetching androidInfo...');
        final androidInfo = await DeviceInfoPlugin().androidInfo;
        final sdkInt = androidInfo.version.sdkInt;
        debugPrint('📸 Nirikshaka debug: Android SDK version = $sdkInt');

        if (sdkInt >= 33) {
          debugPrint('📸 Nirikshaka debug: Checking Permission.photos status...');
          final status = await Permission.photos.status;
          debugPrint('📸 Nirikshaka debug: Permission.photos status = $status');
          if (!status.isGranted) {
            debugPrint('📸 Nirikshaka debug: Requesting Permission.photos...');
            final requestStatus = await Permission.photos.request();
            debugPrint('📸 Nirikshaka debug: Request result = $requestStatus');
            if (!requestStatus.isGranted) {
              debugPrint('⚠️ Nirikshaka: Photos permission denied. Screenshot callback will not be initialized.');
              return;
            }
          }
        } else {
          debugPrint('📸 Nirikshaka debug: Checking Permission.storage status...');
          final status = await Permission.storage.status;
          debugPrint('📸 Nirikshaka debug: Permission.storage status = $status');
          if (!status.isGranted) {
            debugPrint('📸 Nirikshaka debug: Requesting Permission.storage...');
            final requestStatus = await Permission.storage.request();
            debugPrint('📸 Nirikshaka debug: Request result = $requestStatus');
            if (!requestStatus.isGranted) {
              debugPrint('⚠️ Nirikshaka: Storage permission denied. Screenshot callback will not be initialized.');
              return;
            }
          }
        }
      }

      // Helper method to handle screenshot capture and upload
      Future<void> handleScreenshot() async {
        debugPrint('📸 Nirikshaka: Screenshot capture process started...');
        String? screenshotUrl;
        try {
          final bytes = await captureScreen();
          if (bytes != null) {
            screenshotUrl = await uploadScreenshot(bytes);
            log('📸 Nirikshaka: Screenshot captured and uploaded: $screenshotUrl');
          }
        } catch (e) {
          log('⚠️ Nirikshaka: Failed to capture/upload screenshot: $e');
        }

        // Track as a journey event
        if (_config?.enableJourneyTracking == true && journeyTracker != null) {
          journeyTracker!.addEvent(
            'screenshot',
            'User Took Screenshot',
            data: {
              'timestamp': DateTime.now().toUtc().toIso8601String(),
              'message': 'System screenshot detected',
              if (screenshotUrl != null) 'screenshotUrl': screenshotUrl,
            },
          );
          // Flush immediately so the screenshot event appears on the dashboard timeline right away
          journeyTracker!.flush(endSession: false);
        }
      }

      // Native MethodChannel listener for Android
      if (Platform.isAndroid) {
        debugPrint('📸 Nirikshaka debug: Registering native Android screenshot MethodChannel listener...');
        const MethodChannel('nirikshaka_native').setMethodCallHandler((call) async {
          if (call.method == 'onScreenshotDetected') {
            debugPrint('📸 Nirikshaka: Native screenshot event triggered!');
            await handleScreenshot();
          }
        });
      }

      debugPrint('📸 Nirikshaka debug: Instantiating ScreenshotCallback...');
      _screenshotCallback = ScreenshotCallback();
      
      debugPrint('📸 Nirikshaka debug: Initializing ScreenshotCallback observer...');
      _screenshotCallback!.initialize();
      
      debugPrint('📸 Nirikshaka debug: Registering screenshot listener...');
      _screenshotCallback!.addListener(() async {
        debugPrint('📸 Nirikshaka debug: Screenshot event triggered!');
        log('📸 Nirikshaka: User took a screenshot of the app!');
        await handleScreenshot();
      });
      debugPrint('📸 Nirikshaka debug: ScreenshotCallback initialized and registered successfully!');
    } catch (e) {
      debugPrint('❌ Nirikshaka: Failed to initialize screenshot callback: $e');
      log('❌ Nirikshaka: Failed to initialize screenshot callback: $e');
    }
  }

  Future<void> _fetchRemoteConfig() async {
    try {
      final url = _resolveUrl();
      debugPrint('📸 Nirikshaka: Fetching remote configuration from $url/project/config...');
      final response = await dio.get(
        '$url/project/config',
        queryParameters: {'projectId': _config?.projectId},
      );

      if (response.statusCode == 200) {
        final data = response.data is Map<String, dynamic>
            ? response.data
            : jsonDecode(response.data.toString());

        if (data['success'] == true) {
          final oldScreenshot = _config?.enableScreenshotDetection ?? false;

          _config?.enableCrashReporting = data['enableCrashReporting'] ?? true;
          _config?.enableNetworkTracking = data['enableNetworkTracking'] ?? true;
          _config?.enableUIErrorTracking = data['enableUIErrorTracking'] ?? true;
          _config?.enableBreadcrumbs = data['enableBreadcrumbs'] ?? true;
          _config?.enableLifecycleTracking = data['enableLifecycleTracking'] ?? true;
          _config?.enableJourneyTracking = data['enableJourneyTracking'] ?? true;
          _config?.enableScreenshotDetection = data['enableScreenshotDetection'] ?? true;
          _config?.isSuspended = data['isSuspended'] ?? false;

          debugPrint('📸 Nirikshaka: Remote configuration updated successfully:');
          debugPrint('   - Crash Reporting      : ${_config?.enableCrashReporting}');
          debugPrint('   - Network Tracking     : ${_config?.enableNetworkTracking}');
          debugPrint('   - UI Error Tracking    : ${_config?.enableUIErrorTracking}');
          debugPrint('   - Screenshot Detection : ${_config?.enableScreenshotDetection}');
          debugPrint('   - User Journeys        : ${_config?.enableJourneyTracking}');
          debugPrint('   - Suspended            : ${_config?.isSuspended}');

          // Handle suspension globally
          if (_config?.isSuspended == true) {
            debugPrint('⚠️ Nirikshaka: Client project is suspended globally. Ingestion is disabled.');
            _config?.enableCrashReporting = false;
            _config?.enableNetworkTracking = false;
            _config?.enableUIErrorTracking = false;
            _config?.enableBreadcrumbs = false;
            _config?.enableLifecycleTracking = false;
            _config?.enableJourneyTracking = false;
            _config?.enableScreenshotDetection = false;
          }

          // Handle screenshot callback toggling dynamically
          final newScreenshot = _config?.enableScreenshotDetection ?? false;
          if (oldScreenshot && !newScreenshot) {
            // Discard/disable screenshot callback listener if it exists
            debugPrint('📸 Nirikshaka: Screenshot detection disabled by remote. Disposing callback...');
            _screenshotCallback?.dispose();
            _screenshotCallback = null;
          } else if (!oldScreenshot && newScreenshot) {
            debugPrint('📸 Nirikshaka: Screenshot detection enabled by remote. Initializing callback...');
            _initScreenshotDetection();
          }

          // Handle journey tracker toggling dynamically
          final newJourney = _config?.enableJourneyTracking ?? false;
          if (newJourney && journeyTracker == null) {
            journeyTracker = JourneyTracker(
              config: _config!,
              resolveUrl: _resolveUrl,
              getDeviceContext: _getDeviceContext,
            );
            journeyTracker!.startBatchTimer();
          } else if (!newJourney && journeyTracker != null) {
            journeyTracker!.stopBatchTimer();
            journeyTracker = null;
          }
        }
      } else {
        debugPrint('⚠️ Nirikshaka: Failed to fetch remote configuration (${response.statusCode})');
      }
    } catch (e) {
      debugPrint('❌ Nirikshaka: Remote configuration fetch error: $e');
    }
  }

  /// Safely captures the screen using the RepaintBoundary wrapper.
  static Future<Uint8List?> captureScreen() async {
    try {
      final boundary = repaintBoundaryKey.currentContext
          ?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) {
        debugPrint('⚠️ Nirikshaka: RepaintBoundary key context not found. Wrap root app widget in RepaintBoundary(key: Nirikshaka.repaintBoundaryKey).');
        return null;
      }
      final image = await boundary.toImage(pixelRatio: 2.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      return byteData?.buffer.asUint8List();
    } catch (e) {
      debugPrint('⚠️ Nirikshaka: Failed to capture screen: $e');
      return null;
    }
  }
}

/// Custom WidgetsFlutterBinding to automatically inject a RepaintBoundary at the root of the widget tree.
class NirikshakaBinding extends WidgetsFlutterBinding {
  /// Ensures the NirikshakaBinding is initialized as the global WidgetsBinding.
  static WidgetsBinding ensureInitialized() {
    try {
      return WidgetsBinding.instance;
    } catch (_) {
      NirikshakaBinding();
      return WidgetsBinding.instance;
    }
  }

  bool _hasRepaintBoundaryKey(Widget widget) {
    if (widget.key == Nirikshaka.repaintBoundaryKey) {
      return true;
    }
    if (widget is ProxyWidget) {
      return _hasRepaintBoundaryKey(widget.child);
    }
    try {
      final dynamic dynamicWidget = widget;
      final child = dynamicWidget.child;
      if (child is Widget) {
        return _hasRepaintBoundaryKey(child);
      }
    } catch (_) {}
    return false;
  }

  @override
  Widget wrapWithDefaultView(Widget rootWidget) {
    final hasBoundary = _hasRepaintBoundaryKey(rootWidget);
    return super.wrapWithDefaultView(
      hasBoundary
          ? rootWidget
          : RepaintBoundary(
              key: Nirikshaka.repaintBoundaryKey,
              child: rootWidget,
            ),
    );
  }
}
