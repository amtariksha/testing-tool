import React from "react";
import prisma from "@/lib/prisma";
import { LandingNav } from "@/components/landing/nav";
import { LandingFooter } from "@/components/landing/sections";

export const revalidate = 0; // Disable caching to ensure updates publish instantly

const defaultPrivacy = `# Privacy Policy

Last Updated: June 5, 2026

Your privacy is important to us. This Privacy Policy describes how Nirikshaka collects, uses, and safeguards the data captured by our SDK integrations.

## 1. Data Captured
When you integrate the Nirikshaka SDK into your application, it transmits telemetry events including:
- Non-critical UI logs & error messages
- Critical stack traces & crash dumps
- Latency and status metrics of API requests
- UI navigation flows & journey event trails

## 2. Purpose of Processing
This data is processed solely to compile your application health statistics, generate insights on the client dashboard, and assist you in debugging.

## 3. Storage & Security
We store all telemetry data in secure cloud databases. You can prune your historical telemetry data at any time from the administration panel.

## 4. Sharing
We do not sell, trade, or distribute your telemetry logs or user account details to any third-party marketing entities.`;

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

export default async function PrivacyPage() {
  let privacyText = defaultPrivacy;
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "privacy" },
    });
    if (config?.value) {
      privacyText = config.value;
    }
  } catch (error) {
    console.error("Error reading privacy config:", error);
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
            {renderMarkdown(privacyText)}
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
