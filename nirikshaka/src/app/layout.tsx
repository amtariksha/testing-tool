import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Nirikshaka — Real-time App Monitoring Platform",
  description:
    "Monitor API logs, crash reports, UI errors, and SDK activity in real-time. The modern alternative to Sentry, Datadog, and Firebase Crashlytics for startups.",
  keywords: "api monitoring, crash analytics, error tracking, sdk monitoring, real-time dashboard",
  authors: [{ name: "Nirikshaka Team" }],
  openGraph: {
    title: "Nirikshaka — Real-time App Monitoring Platform",
    description: "Monitor API logs, crash reports, UI errors, and SDK activity in real-time.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "hsl(222 47% 6%)",
                border: "1px solid hsl(217.2 32.6% 14%)",
                color: "hsl(210 40% 98%)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
