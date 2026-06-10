/// User journey tracking module.
///
/// Manages session identity, event buffering, and batch uploads.
/// Journey events are buffered in memory and flushed periodically
/// or when the app goes to background.
library;

import 'dart:async';
import 'dart:math';
import 'package:dio/dio.dart';
import 'core.dart';
import 'config.dart';

/// Manages journey event collection and batch sending.
class JourneyTracker {
  final NirikshakaConfig _config;
  final String Function() _resolveUrl;
  final Map<String, dynamic> Function() _getDeviceContext;

  // ─── User Identity ────────────────────────────────────
  String? userName;
  String? userEmail;
  String? userMobile;
  String? appUserId;
  String? uniqueId;

  // ─── Session ──────────────────────────────────────────
  String sessionId;
  final String deviceId;
  DateTime sessionStartTime;
  String? currentScreen;

  // ─── Event Buffer ─────────────────────────────────────
  final List<Map<String, dynamic>> _eventBuffer = [];
  Timer? _batchTimer;

  JourneyTracker({
    required NirikshakaConfig config,
    required String Function() resolveUrl,
    required Map<String, dynamic> Function() getDeviceContext,
  })  : _config = config,
         _resolveUrl = resolveUrl,
         _getDeviceContext = getDeviceContext,
         sessionId = _generateId('ses'),
         deviceId = _generateId('dev'),
         sessionStartTime = DateTime.now();

  /// Start the periodic batch timer.
  void startBatchTimer() {
    _batchTimer?.cancel();
    _batchTimer = Timer.periodic(
      Duration(seconds: _config.journeyBatchIntervalSeconds),
      (_) => flush(endSession: false),
    );
  }

  /// Stop the batch timer.
  void stopBatchTimer() {
    _batchTimer?.cancel();
    _batchTimer = null;
  }

  /// Add a journey event to the buffer.
  void addEvent(
    String type,
    String name, {
    dynamic data,
    int? durationMs,
  }) {
    if (type == 'screen_view') {
      currentScreen = name;
    }

    _eventBuffer.add({
      'type': type,
      'name': name,
      'data': data,
      'timestamp': DateTime.now().toUtc().toIso8601String(),
      'duration': durationMs,
      'screen': currentScreen,
    });

    Nirikshaka.log('📍 Journey: $type — $name');

    // Auto-flush if buffer gets large
    if (_eventBuffer.length >= 50) {
      flush(endSession: false);
    }
  }

  /// Start a new session (e.g., on app resume).
  void startNewSession() {
    sessionId = _generateId('ses');
    sessionStartTime = DateTime.now();
    currentScreen = null;
    startBatchTimer();
  }

  /// Flush buffered events to the server.
  Future<void> flush({required bool endSession, bool forceSend = false}) async {
    if (_eventBuffer.isEmpty && !endSession && !forceSend) return;

    final events = List<Map<String, dynamic>>.from(_eventBuffer);
    _eventBuffer.clear();

    try {
      final url = _resolveUrl();

      final body = {
        'sessionId': sessionId,
        'deviceId': deviceId,
        'appUserId': appUserId,
        'userName': userName,
        'userEmail': userEmail,
        'userMobile': userMobile,
        'uniqueId': uniqueId,
        'events': events,
        'endSession': endSession,
        'context': _getDeviceContext(),
        if (Nirikshaka.pushToken != null) 'pushToken': Nirikshaka.pushToken,
      };

      final response = await Nirikshaka.dio.post(
        '$url/track/journey',
        data: body,
      );

      if (response.statusCode == 200) {
        Nirikshaka.log(
            '✅ Nirikshaka: Journey batch sent (${events.length} events${endSession ? ", session ended" : ""})');
      } else {
        final bodyStr = response.data?.toString() ?? '';
        if (response.statusCode == 401) {
          Nirikshaka.log('❌ Nirikshaka: Authentication Failed (401) for journey batch tracking.\n'
              '   Please verify your NirikshakaConfig:\n'
              '   - Project ID: "${_config.projectId}"\n'
              '   - API Key: "${_config.apiKey}"\n'
              '   - Server response: $bodyStr');
        } else {
          Nirikshaka.log(
              '⚠️ Nirikshaka: Journey batch failed (${response.statusCode}) - $bodyStr');
        }
        _eventBuffer.insertAll(0, events);
      }
    } catch (e) {
      if (e is DioException) {
        final errorMsg = e.response?.data?.toString() ?? e.message ?? e.toString();
        Nirikshaka.log('❌ Nirikshaka: Journey batch network error (${e.type}) - $errorMsg');
      } else {
        Nirikshaka.log('❌ Nirikshaka: Journey batch error - $e');
      }
      _eventBuffer.insertAll(0, events);
    }
  }

  /// Generate a unique prefixed ID.
  static String _generateId(String prefix) {
    final rand = Random();
    final timestamp = DateTime.now().millisecondsSinceEpoch.toRadixString(36);
    final random =
        List.generate(8, (_) => rand.nextInt(36).toRadixString(36)).join();
    return '${prefix}_${timestamp}_$random';
  }
}
