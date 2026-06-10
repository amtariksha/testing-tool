/// Nirikshaka Flutter SDK
///
/// Auto-capture crashes, UI errors, API requests, and user journeys.
///
/// ## Quick Start
///
/// ```dart
/// import 'package:nirikshaka/nirikshaka.dart';
///
/// void main() {
///   Nirikshaka.init(
///     config: NirikshakaConfig(
///       apiKey: 'your-api-key',
///       projectId: 'your-project-id',
///     ),
///     appRunner: () => runApp(const MyApp()),
///   );
/// }
/// ```
library;

export 'src/config.dart';
export 'src/core.dart';
export 'src/journey_tracker.dart';
export 'src/navigator_observer.dart';
export 'src/dio_interceptor.dart';
