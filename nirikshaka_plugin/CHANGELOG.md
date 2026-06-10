# Changelog

## 2.1.0

### Added
- **User Journey Tracking** — Auto-capture screen views, button taps, and navigation flow
- **User Identity** — `Nirikshaka.setUser()` to attach name, email, and mobile to sessions
- **Journey Event API** — `Nirikshaka.trackJourneyEvent()` for custom event tracking
- **Batched Upload** — Journey events buffered and sent every 30 seconds
- **Session Management** — Auto session start/end on app lifecycle changes

### Changed
- `NirikshakaNavigatorObserver` now records both breadcrumbs and journey events
- Modular package structure (config, core, journey_tracker, navigator_observer, http_client)

## 2.0.0

### Added
- Initial SDK with crash reporting, UI error tracking, API monitoring
- Auto-tracked HTTP client
- Breadcrumb trail for crash context
- Navigator observer for screen tracking
