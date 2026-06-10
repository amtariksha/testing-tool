/// Navigator observer for automatic screen tracking.
///
/// Captures route changes as both breadcrumbs (for crash context)
/// and journey events (for user journey analysis).
///
/// ```dart
/// MaterialApp(
///   navigatorObservers: [NirikshakaNavigatorObserver()],
/// );
/// ```
library;

import 'package:flutter/material.dart';
import 'core.dart';

/// Automatically tracks navigation events as breadcrumbs and journey events.
class NirikshakaNavigatorObserver extends NavigatorObserver {
  String _getRouteName(Route? route) {
    if (route == null) return '';
    
    // 1. Try settings name first if it's a descriptive custom name
    final name = route.settings.name;
    if (name != null && 
        name.isNotEmpty && 
        !name.contains('PageBased') && 
        !name.contains('PageRoute')) {
      return name;
    }
    
    // 2. Try to dynamically resolve GoRouter path if available
    try {
      if (route.navigator != null) {
        final context = route.navigator!.context;
        dynamic goRouter;
        
        context.visitAncestorElements((element) {
          final typeString = element.widget.runtimeType.toString();
          if (typeString.contains('InheritedGoRouter')) {
            try {
              final dynamic inheritedWidget = element.widget;
              goRouter = inheritedWidget.goRouter;
              if (goRouter != null) return false; // Stop search
            } catch (_) {}
          }
          return true;
        });
        
        if (goRouter != null) {
          final dynamic config = goRouter.routerDelegate.currentConfiguration;
          String? loc;
          try {
            loc = config.last.matchedLocation;
          } catch (_) {}
          try {
            loc ??= config.uri.toString();
          } catch (_) {}
          if (loc != null && loc.isNotEmpty) {
            return loc;
          }
        }
      }
    } catch (_) {}
    
    // 3. Fallback to settings name or runtime type
    return name ?? route.runtimeType.toString();
  }

  @override
  void didPush(Route route, Route? previousRoute) {
    _logNav('push', route, previousRoute);
  }

  @override
  void didPop(Route route, Route? previousRoute) {
    _logNav('pop', route, previousRoute);
  }

  @override
  void didReplace({Route? newRoute, Route? oldRoute}) {
    _logNav('replace', newRoute, oldRoute);
  }

  @override
  void didRemove(Route route, Route? previousRoute) {
    _logNav('remove', route, previousRoute);
  }

  void _logNav(String action, Route? to, Route? from) {
    final toName = _getRouteName(to);
    final fromName = _getRouteName(from);

    // Capture route arguments and query parameters
    final argumentsData = <String, dynamic>{};
    try {
      // 1. Visit ancestor elements to find GoRouter and fetch queryParams/pathParams
      if (to != null && to.navigator != null) {
        final context = to.navigator!.context;
        dynamic goRouter;
        context.visitAncestorElements((element) {
          final typeString = element.widget.runtimeType.toString();
          if (typeString.contains('InheritedGoRouter')) {
            try {
              final dynamic inheritedWidget = element.widget;
              goRouter = inheritedWidget.goRouter;
              if (goRouter != null) return false; // Stop search
            } catch (_) {}
          }
          return true;
        });

        if (goRouter != null) {
          final dynamic config = goRouter.routerDelegate.currentConfiguration;
          if (config != null) {
            // Extract query parameters
            if (config.uri != null && config.uri.queryParameters.isNotEmpty) {
              config.uri.queryParameters.forEach((key, value) {
                argumentsData[key] = value;
              });
            }
            // Extract path parameters
            if (config.pathParameters != null && config.pathParameters.isNotEmpty) {
              config.pathParameters.forEach((key, value) {
                argumentsData[key] = value;
              });
            }
          }
        }
      }
    } catch (_) {}

    try {
      // 2. Query parameters from the route path (e.g. /select-service?id=123) as fallback
      if (toName.startsWith('/')) {
        final uri = Uri.parse(toName);
        if (uri.queryParameters.isNotEmpty) {
          uri.queryParameters.forEach((key, value) {
            argumentsData[key] ??= value;
          });
        }
      }
    } catch (_) {}

    try {
      // 3. Direct arguments passed to the route settings as fallback
      if (to != null && to.settings.arguments != null) {
        final args = to.settings.arguments;
        if (args is Map) {
          args.forEach((key, val) {
            argumentsData[key.toString()] ??= val?.toString();
          });
        } else {
          argumentsData['extra'] ??= args.toString();
        }
      }
    } catch (_) {}

    // Breadcrumb for crash context
    Nirikshaka.addBreadcrumb('navigation_$action', {
      'to': toName,
      'from': fromName,
      if (argumentsData.isNotEmpty) 'arguments': argumentsData,
    });

    // Journey event for user flow analysis
    try {
      final jt = Nirikshaka.instance.journeyTracker;
      if (jt != null) {
        jt.addEvent(
          action == 'push' ? 'screen_view' : 'navigation_$action',
          toName,
          data: {
            'action': action,
            'from': fromName,
            'to': toName,
            if (argumentsData.isNotEmpty) 'arguments': argumentsData,
          },
        );
      }
    } catch (_) {
      // SDK not initialized yet, skip journey tracking
    }
  }
}
