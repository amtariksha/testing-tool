import React from "react";
import prisma from "@/lib/prisma";
import { LandingNav } from "@/components/landing/nav";
import { LandingFooter } from "@/components/landing/sections";

export const revalidate = 0; // Disable caching to ensure updates publish instantly

const defaultTerms = `# Terms of Service

Last Updated: June 5, 2026

Welcome to Nirikshaka! These Terms of Service ("Terms") govern your use of our application performance monitoring service, SDKs, and platform.

## 1. Acceptance of Terms
By creating an account, integrating our SDK, or accessing our dashboard, you agree to comply with and be bound by these Terms.

## 2. Platform Usage
Nirikshaka is provided free of charge for developer projects. You are responsible for maintaining the confidentiality of your API keys and account details.

## 3. Data Collection & Telemetry
Our SDKs collect telemetry, including crash reports, network latencies, UI error logs, and session journeys, purely for monitoring and debugging your applications.

## 4. Limitation of Liability
Nirikshaka is provided "as is" without any warranties. We are not liable for any service interruptions, data losses, or subsequent damages.`;

// Simple parser to format markdown-like text to HTML blocks for clean styling
function renderMarkdown(text: string) {
  return text.split("\n\n").map((paragraph, index) => {
    const trimmed = paragraph.trim();
    if (trimmed.startsWith("# ")) {
      return (
        <h1 key={index} className="text-3xl font-black text-white mt-8 mb-4 border-b border-zinc-800 pb-2">
          {trimmed.replace("# ", "")}
        </h1>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h2 key={index} className="text-xl font-bold text-emerald-400 mt-6 mb-3">
          {trimmed.replace("## ", "")}
        </h2>
      );
    }
    if (trimmed.startsWith("### ")) {
      return (
        <h3 key={index} className="text-lg font-bold text-zinc-100 mt-4 mb-2">
          {trimmed.replace("### ", "")}
        </h3>
      );
    }
    if (trimmed.startsWith("- ")) {
      return (
        <ul key={index} className="list-disc pl-5 space-y-1.5 text-zinc-350 text-sm my-3">
          {trimmed.split("\n").map((li, idx) => (
            <li key={idx}>{li.replace("- ", "")}</li>
          ))}
        </ul>
      );
    }
    // Return regular paragraph
    return (
      <p key={index} className="text-zinc-300 text-sm leading-relaxed mb-4 whitespace-pre-line">
        {paragraph}
      </p>
    );
  });
}

export default async function TermsPage() {
  let termsText = defaultTerms;
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "terms" },
    });
    if (config?.value) {
      termsText = config.value;
    }
  } catch (error) {
    console.error("Error reading terms config:", error);
  }

  return (
    <div className="min-h-screen bg-[#05070c] text-zinc-100 flex flex-col justify-between font-sans">
      <LandingNav />

      {/* Decorative gradient blur backdrop */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-24 z-10">
        <div className="bg-zinc-950/40 backdrop-blur-xl border border-zinc-800/80 p-8 sm:p-12 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          
          <div className="prose prose-invert max-w-none">
            {renderMarkdown(termsText)}
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
