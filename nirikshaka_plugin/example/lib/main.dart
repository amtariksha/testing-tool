import 'package:flutter/material.dart';
import 'package:nirikshaka/nirikshaka.dart';

void main() {
  Nirikshaka.init(
    config: NirikshakaConfig(
      apiKey: 'eqk_live_your_api_key_here',
      projectId: 'your_project_id_here',
      apiUrl: 'https://your-nirikshaka-server.com/api',
      appVersion: '1.0.0',
      environment: Environment.production,
    ),
    appRunner: () => runApp(const MyApp()),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Nirikshaka Demo',
      // Add the navigator observer for automatic screen tracking
      navigatorObservers: [NirikshakaNavigatorObserver()],
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nirikshaka Demo')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Set user identity after login
            ElevatedButton(
              onPressed: () {
                Nirikshaka.setUser(
                  name: 'John Doe',
                  email: 'john@example.com',
                  mobile: '+1234567890',
                  userId: 'user_123',
                );
              },
              child: const Text('Set User'),
            ),
            const SizedBox(height: 16),

            // Track a custom event
            ElevatedButton(
              onPressed: () {
                Nirikshaka.trackJourneyEvent(
                  'button_tap',
                  'Subscribe Button',
                  data: {'plan': 'premium', 'price': 9.99},
                );
              },
              child: const Text('Track Event'),
            ),
            const SizedBox(height: 16),

            // Navigate to another screen (auto-tracked)
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    settings: const RouteSettings(name: '/profile'),
                    builder: (_) => const ProfileScreen(),
                  ),
                );
              },
              child: const Text('Go to Profile'),
            ),
            const SizedBox(height: 16),

            // Test connection
            ElevatedButton(
              onPressed: () async {
                final ok = await Nirikshaka.testConnection();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(ok ? '✅ Connected!' : '❌ Connection failed'),
                    ),
                  );
                }
              },
              child: const Text('Test Connection'),
            ),
          ],
        ),
      ),
    );
  }
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: const Center(child: Text('Profile Screen')),
    );
  }
}
