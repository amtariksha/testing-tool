/// Auto-tracked Dio Interceptor.
///
/// Add this interceptor to your `Dio` client to automatically log
/// all HTTP requests to the Nirikshaka dashboard and record them as journey events.
///
/// ```dart
/// final dio = Dio();
/// dio.interceptors.add(NirikshakaDioInterceptor());
/// ```
library;

import 'dart:convert';
import 'package:dio/dio.dart';
import 'core.dart';

/// Dio interceptor that auto-tracks all network requests.
class NirikshakaDioInterceptor extends Interceptor {
  // Store request start times to calculate latency
  final _stopwatches = <RequestOptions, Stopwatch>{};

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    _stopwatches[options] = Stopwatch()..start();
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final stopwatch = _stopwatches.remove(response.requestOptions);
    Duration duration = Duration.zero;
    if (stopwatch != null) {
      stopwatch.stop();
      duration = stopwatch.elapsed;
    }

    _autoTrack(response.requestOptions, response, duration);
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final stopwatch = _stopwatches.remove(err.requestOptions);
    Duration duration = Duration.zero;
    if (stopwatch != null) {
      stopwatch.stop();
      duration = stopwatch.elapsed;
    }

    _autoTrackError(err.requestOptions, err, duration);
    handler.next(err);
  }

  void _autoTrack(
    RequestOptions options,
    Response response,
    Duration duration,
  ) {
    try {
      final path = options.uri.path.isEmpty ? '/' : options.uri.path;
      final method = options.method;
      final statusCode = response.statusCode ?? 200;

      // Extract request body safely
      dynamic reqBody;
      try {
        if (options.data != null) {
          if (options.data is Map || options.data is List) {
            reqBody = options.data;
          } else if (options.data is String) {
            try {
              reqBody = jsonDecode(options.data as String);
            } catch (_) {
              reqBody = options.data;
            }
          } else if (options.data is FormData) {
            final formDataMap = <String, String>{};
            for (final field in (options.data as FormData).fields) {
              formDataMap[field.key] = field.value;
            }
            reqBody = {
              'fields': formDataMap,
              'files': (options.data as FormData).files.map((f) => f.key).toList(),
            };
          } else {
            reqBody = options.data.toString();
          }
        }
      } catch (_) {}

      // Extract response body safely
      dynamic resBody;
      try {
        if (response.data != null) {
          if (response.data is Map || response.data is List) {
            resBody = response.data;
          } else if (response.data is String) {
            try {
              resBody = jsonDecode(response.data as String);
            } catch (_) {
              resBody = response.data;
            }
          } else {
            resBody = response.data.toString();
          }
        }
      } catch (_) {}

      // Track API request in Nirikshaka
      Nirikshaka.trackAPI(
        method: method,
        path: path,
        statusCode: statusCode,
        duration: duration,
        requestSize: _estimateRequestSize(options),
        responseSize: _estimateResponseSize(response),
      );

      // Track journey event
      try {
        final jt = Nirikshaka.instance.journeyTracker;
        if (jt != null) {
          jt.addEvent(
            'api_call',
            '$method $path',
            data: {
              'method': method,
              'url': options.uri.toString(),
              'statusCode': statusCode,
              if (reqBody != null) 'requestBody': reqBody,
              if (resBody != null) 'responseBody': resBody,
            },
            durationMs: duration.inMilliseconds,
          );
        }
      } catch (_) {}
    } catch (_) {
      // Don't let tracking errors crash the application
    }
  }

  void _autoTrackError(
    RequestOptions options,
    DioException err,
    Duration duration,
  ) {
    try {
      final path = options.uri.path.isEmpty ? '/' : options.uri.path;
      final method = options.method;
      final statusCode = err.response?.statusCode ?? 0;

      // Extract request body safely
      dynamic reqBody;
      try {
        if (options.data != null) {
          if (options.data is Map || options.data is List) {
            reqBody = options.data;
          } else if (options.data is String) {
            try {
              reqBody = jsonDecode(options.data as String);
            } catch (_) {
              reqBody = options.data;
            }
          } else if (options.data is FormData) {
            final formDataMap = <String, String>{};
            for (final field in (options.data as FormData).fields) {
              formDataMap[field.key] = field.value;
            }
            reqBody = {
              'fields': formDataMap,
              'files': (options.data as FormData).files.map((f) => f.key).toList(),
            };
          } else {
            reqBody = options.data.toString();
          }
        }
      } catch (_) {}

      // Extract response body from error safely
      dynamic resBody;
      if (err.response != null) {
        try {
          if (err.response!.data != null) {
            if (err.response!.data is Map || err.response!.data is List) {
              resBody = err.response!.data;
            } else if (err.response!.data is String) {
              try {
                resBody = jsonDecode(err.response!.data as String);
              } catch (_) {
                resBody = err.response!.data;
              }
            } else {
              resBody = err.response!.data.toString();
            }
          }
        } catch (_) {}
      }

      // Track API request in Nirikshaka
      Nirikshaka.trackAPI(
        method: method,
        path: path,
        statusCode: statusCode,
        duration: duration,
        requestSize: _estimateRequestSize(options),
        responseSize: err.response != null ? _estimateResponseSize(err.response!) : 0,
      );

      // Track journey event
      try {
        final jt = Nirikshaka.instance.journeyTracker;
        if (jt != null) {
          jt.addEvent(
            'api_call',
            '$method $path',
            data: {
              'method': method,
              'url': options.uri.toString(),
              'statusCode': statusCode,
              'error': err.message ?? err.toString(),
              if (reqBody != null) 'requestBody': reqBody,
              if (resBody != null) 'responseBody': resBody,
            },
            durationMs: duration.inMilliseconds,
          );
        }
      } catch (_) {}
    } catch (_) {
      // Don't let tracking errors crash the application
    }
  }

  int _estimateRequestSize(RequestOptions options) {
    try {
      if (options.data == null) return 0;
      if (options.data is String) {
        return (options.data as String).length;
      }
      if (options.data is Map || options.data is List) {
        return jsonEncode(options.data).length;
      }
      if (options.data is FormData) {
        return (options.data as FormData).length;
      }
    } catch (_) {}
    return 0;
  }

  int _estimateResponseSize(Response response) {
    try {
      final contentLengthHeader = response.headers.value('content-length');
      if (contentLengthHeader != null) {
        return int.tryParse(contentLengthHeader) ?? 0;
      }
      if (response.data == null) return 0;
      if (response.data is String) {
        return (response.data as String).length;
      }
      if (response.data is Map || response.data is List) {
        return jsonEncode(response.data).length;
      }
    } catch (_) {}
    return 0;
  }
}
