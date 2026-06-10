"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { User, Bell, Webhook, CreditCard, AlertTriangle, Save, Sparkles, RefreshCw, CheckCircle2, ChevronRight, BellRing } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getUser } from "@/app/auth/actions";
import {
  getProjects,
  upgradeProjectTierFree,
  saveProjectNotificationSettings,
  saveProjectWebhookSettings,
} from "@/app/dashboard/actions";
import { saveProjectFcmCredentials, saveProjectApnsCredentials } from "../journeys/actions";
import { useSearchParams } from "next/navigation";
import Script from "next/script";

const tabs = ["Profile", "Notifications", "Webhooks", "Push Notifications", "Billing & Plans", "Danger Zone"] as const;
type SettingsTab = (typeof tabs)[number];

function SettingsPageContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("Profile");
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);

  // FCM States
  const [fcmProjectName, setFcmProjectName] = useState("");
  const [fcmServiceAccount, setFcmServiceAccount] = useState("");

  // APNs States
  const [apnsKeyId, setApnsKeyId] = useState("");
  const [apnsTeamId, setApnsTeamId] = useState("");
  const [apnsBundleId, setApnsBundleId] = useState("");
  const [apnsPrivateKey, setApnsPrivateKey] = useState("");
  const [apnsUseSandbox, setApnsUseSandbox] = useState(false);
  const [savingApns, setSavingApns] = useState(false);

  // Notification States
  const [notifyOnCriticalCrash, setNotifyOnCriticalCrash] = useState(true);
  const [notifyOnErrorSpike, setNotifyOnErrorSpike] = useState(true);
  const [notifyOnSDKInstall, setNotifyOnSDKInstall] = useState(false);
  const [notifyWeeklySummary, setNotifyWeeklySummary] = useState(true);
  const [notifyOnApiDown, setNotifyOnApiDown] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Webhook States
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [savingWebhooks, setSavingWebhooks] = useState(false);

  const searchParams = useSearchParams();
  const urlProjectId = searchParams ? searchParams.get("projectId") : null;

  useEffect(() => {
    getUser().then(u => setUser(u));
    fetchProjectsList();
  }, []);

  // Update input states when project or projects list changes
  useEffect(() => {
    const proj = projects.find(p => p.id === selectedProjectId);
    if (proj) {
      setFcmProjectName(proj.fcmProjectName || "");
      setFcmServiceAccount(proj.fcmServiceAccount || "");

      setApnsKeyId(proj.apnsKeyId || "");
      setApnsTeamId(proj.apnsTeamId || "");
      setApnsBundleId(proj.apnsBundleId || "");
      setApnsPrivateKey(proj.apnsPrivateKey || "");
      setApnsUseSandbox(proj.apnsUseSandbox ?? false);
      
      setNotifyOnCriticalCrash(proj.notifyOnCriticalCrash ?? true);
      setNotifyOnErrorSpike(proj.notifyOnErrorSpike ?? true);
      setNotifyOnSDKInstall(proj.notifyOnSDKInstall ?? false);
      setNotifyWeeklySummary(proj.notifyWeeklySummary ?? true);
      setNotifyOnApiDown(proj.notifyOnApiDown ?? true);
      
      setWebhookUrl(proj.webhookUrl || "");
      setWebhookEvents(proj.webhookEvents ? proj.webhookEvents.split(",") : ["crash.critical", "error.spike", "api.down"]);
    } else {
      setFcmProjectName("");
      setFcmServiceAccount("");
      setApnsKeyId("");
      setApnsTeamId("");
      setApnsBundleId("");
      setApnsPrivateKey("");
      setApnsUseSandbox(false);
      setNotifyOnCriticalCrash(true);
      setNotifyOnErrorSpike(true);
      setNotifyOnSDKInstall(false);
      setNotifyWeeklySummary(true);
      setNotifyOnApiDown(true);
      setWebhookUrl("");
      setWebhookEvents([]);
    }
  }, [selectedProjectId, projects]);

  const fetchProjectsList = async () => {
    setLoadingProjects(true);
    try {
      const list = await getProjects();
      setProjects(list);
      if (list.length > 0) {
        const matchingProject = list.find(p => p.id === urlProjectId);
        if (matchingProject) {
          setSelectedProjectId(matchingProject.id);
        } else if (!selectedProjectId) {
          setSelectedProjectId(list[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProjects(false);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const handleUpgrade = async (tier: "growth" | "enterprise") => {
    if (!selectedProjectId) {
      toast.error("Please select a project first.");
      return;
    }
    setPaymentLoading(tier);
    try {
      const res = await upgradeProjectTierFree(selectedProjectId, tier);
      if (res.success) {
        toast.success(`Successfully upgraded to ${tier === "growth" ? "Growth" : "Enterprise"} Plan!`);
        fetchProjectsList();
      } else {
        throw new Error(res.error || "Failed to upgrade plan");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to upgrade plan");
    } finally {
      setPaymentLoading(null);
    }
  };

  const handleSaveNotifications = async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project first.");
      return;
    }
    setSavingNotifications(true);
    try {
      const res = await saveProjectNotificationSettings(selectedProjectId, {
        notifyOnCriticalCrash,
        notifyOnErrorSpike,
        notifyOnSDKInstall,
        notifyWeeklySummary,
        notifyOnApiDown,
      });
      if (res.success) {
        toast.success("Notification preferences saved successfully!");
        fetchProjectsList();
      } else {
        toast.error(res.error || "Failed to save notification preferences");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleSaveWebhooks = async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project first.");
      return;
    }
    setSavingWebhooks(true);
    try {
      const eventsStr = webhookEvents.join(",");
      const res = await saveProjectWebhookSettings(selectedProjectId, webhookUrl, eventsStr);
      if (res.success) {
        toast.success("Webhook settings saved successfully!");
        fetchProjectsList();
      } else {
        toast.error(res.error || "Failed to save webhook settings");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSavingWebhooks(false);
    }
  };

  const handleSaveApns = async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project first.");
      return;
    }
    setSavingApns(true);
    try {
      const res = await saveProjectApnsCredentials(
        selectedProjectId,
        apnsPrivateKey,
        apnsKeyId,
        apnsTeamId,
        apnsBundleId,
        apnsUseSandbox
      );
      if (res.success) {
        toast.success("APNs credentials saved successfully!");
        fetchProjectsList();
      } else {
        toast.error(res.error || "Failed to save APNs credentials");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSavingApns(false);
    }
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2);
  const email = user?.email || "No email";

  const getPlanTierName = (limit: number) => {
    if (limit <= 1000) return "Free Tier";
    if (limit <= 100000) return "Growth Tier";
    return "Enterprise Tier";
  };

  return (
    <div className="space-y-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your account, webhooks, and billing plans</p>
        </div>
        
        {activeTab !== "Profile" && projects.length > 0 && (
          <div className="flex items-center gap-2.5 bg-muted/40 px-3.5 py-2 rounded-xl border border-border/80">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Active Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:border-brand/50 text-foreground min-w-[150px] cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </motion.div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Nav */}
        <div className="w-full md:w-56 flex-shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {[
              { tab: "Profile" as const, icon: User },
              { tab: "Notifications" as const, icon: Bell },
              { tab: "Webhooks" as const, icon: Webhook },
              { tab: "Push Notifications" as const, icon: BellRing },
              { tab: "Billing & Plans" as const, icon: CreditCard },
              { tab: "Danger Zone" as const, icon: AlertTriangle },
            ].map(({ tab, icon: Icon }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap md:w-full",
                  activeTab === tab
                    ? tab === "Danger Zone"
                      ? "bg-rose-500/10 text-rose-400"
                      : "bg-brand/10 text-brand"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="card-premium p-6 space-y-6"
          >
            {activeTab === "Profile" && (
              <>
                <h2 className="font-semibold text-foreground">Profile Settings</h2>
                <div className="flex items-center gap-4 pb-5 border-b border-border">
                  <div className="h-16 w-16 rounded-2xl bg-brand text-black font-bold text-xl flex items-center justify-center">
                    {initials}
                  </div>
                  <div>
                    <p className="font-semibold">{displayName}</p>
                    <p className="text-sm text-muted-foreground">{email}</p>
                    <button className="text-xs text-brand mt-1 hover:underline">
                      Change avatar
                    </button>
                  </div>
                </div>
                <div key={user ? "profile-loaded" : "profile-loading"} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: "Full Name", value: displayName, type: "text" },
                    { label: "Email", value: email, type: "email" },
                    { label: "Company", value: "Nirikshaka", type: "text" },
                    { label: "Role", value: "Developer", type: "text" },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        {field.label}
                      </label>
                      <input
                        type={field.type}
                        defaultValue={field.value}
                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-colors"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => toast.success("Profile saved!")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black font-semibold text-sm hover:bg-brand/90 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </button>
              </>
            )}

            {activeTab === "Notifications" && (
              <>
                <div className="flex justify-between items-center border-b border-border pb-4">
                  <div>
                    <h2 className="font-semibold text-foreground">Notification Preferences</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Toggle alert preferences for the selected project workspace.</p>
                  </div>
                </div>

                {selectedProjectId ? (
                  <div className="space-y-4">
                    {[
                      { label: "Critical Crashes", desc: "Get notified for severity=critical crashes", value: notifyOnCriticalCrash, setter: setNotifyOnCriticalCrash },
                      { label: "API Error Spike", desc: "Alert when error rate exceeds threshold", value: notifyOnErrorSpike, setter: setNotifyOnErrorSpike },
                      { label: "New SDK Install", desc: "Notify on each new SDK installation", value: notifyOnSDKInstall, setter: setNotifyOnSDKInstall },
                      { label: "Weekly Summary", desc: "Receive weekly analytics digest", value: notifyWeeklySummary, setter: setNotifyWeeklySummary },
                      { label: "API Down Alerts", desc: "Notify when active API status goes offline", value: notifyOnApiDown, setter: setNotifyOnApiDown },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                        <div>
                          <p className="font-medium text-sm text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                        <button
                          onClick={() => item.setter(!item.value)}
                          className={cn(
                            "h-6 w-11 rounded-full border-2 transition-all relative cursor-pointer",
                            item.value ? "bg-brand border-brand" : "bg-muted border-border"
                          )}
                        >
                          <span className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all shadow-sm",
                            item.value ? "left-5" : "left-0.5"
                          )} />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={handleSaveNotifications}
                      disabled={savingNotifications}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black font-semibold text-sm disabled:opacity-50 hover:bg-brand/90 transition-colors"
                    >
                      {savingNotifications ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Notification Settings
                    </button>
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-border rounded-2xl text-muted-foreground text-sm">
                    No active project selected. Create a project to configure notifications.
                  </div>
                )}
              </>
            )}

            {activeTab === "Webhooks" && (
              <>
                <div className="border-b border-border pb-4">
                  <h2 className="font-semibold text-foreground">Webhooks</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Receive real-time event notifications to your webhook URL endpoint.</p>
                </div>

                {selectedProjectId ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Webhook URL</label>
                      <input
                        type="url"
                        placeholder="https://your-server.com/webhooks/nirikshaka"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 text-foreground"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Trigger Events</p>
                      <div className="grid grid-cols-2 gap-2">
                        {["crash.critical", "error.spike", "api.down", "sdk.install"].map((event) => {
                          const isChecked = webhookEvents.includes(event);
                          return (
                            <label key={event} className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg cursor-pointer border border-border/40 hover:border-brand/30 transition-colors">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setWebhookEvents(webhookEvents.filter(e => e !== event));
                                  } else {
                                    setWebhookEvents([...webhookEvents, event]);
                                  }
                                }}
                                className="accent-brand"
                              />
                              <code className="text-xs font-mono text-muted-foreground">{event}</code>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={handleSaveWebhooks}
                      disabled={savingWebhooks}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black font-semibold text-sm disabled:opacity-50 hover:bg-brand/90 transition-colors"
                    >
                      {savingWebhooks ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Webhook Settings
                    </button>
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-border rounded-2xl text-muted-foreground text-sm">
                    No active project selected. Create a project to configure webhooks.
                  </div>
                )}
              </>
            )}

            {activeTab === "Billing & Plans" && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-semibold text-foreground">SaaS Billing & Subscriptions</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Scale your project events limits and telemetry capabilities.</p>
                </div>

                {selectedProject && (
                  <div className="p-4 bg-muted/30 rounded-2xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold text-foreground">Active Project Workspace</span>
                      <p className="text-xs text-muted-foreground mt-1">{selectedProject.name} ({selectedProject.packageName})</p>
                    </div>
                    <div className="flex flex-col text-right sm:items-end">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Current Tier</span>
                      <span className="text-sm font-bold text-brand mt-0.5">{getPlanTierName(selectedProject.monthlyEventLimit)}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        Limit: {selectedProject.monthlyEventLimit.toLocaleString()} events ({selectedProject.monthlyEventCount.toLocaleString()} used)
                      </span>
                    </div>
                  </div>
                )}

                {/* Subscriptions Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Growth Plan Card */}
                  <div className="p-5 rounded-2xl border border-border bg-muted/10 relative overflow-hidden flex flex-col justify-between h-[340px]">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-lg text-foreground">Growth Plan</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">For active apps & growing startups</p>
                        </div>
                        <span className="px-2.5 py-1 text-[10px] font-bold bg-brand/10 border border-brand/20 text-brand rounded-full">Popular</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-foreground">$49</span>
                        <span className="text-xs text-muted-foreground">/ month / project</span>
                      </div>
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />
                          <span>100,000 monthly events limit</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />
                          <span>30-day raw data retention SLA</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />
                          <span>Dynamic target FCM notification campaigns</span>
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={() => handleUpgrade("growth")}
                      disabled={paymentLoading !== null || !selectedProjectId || selectedProject?.monthlyEventLimit === 100000}
                      className={cn(
                        "w-full py-2 rounded-xl text-xs font-bold tracking-wide flex items-center justify-center gap-2 transition duration-200 border",
                        selectedProject?.monthlyEventLimit === 100000
                          ? "bg-brand/10 border-brand/30 text-brand cursor-default"
                          : "bg-brand hover:bg-brand/90 border-transparent text-black active:scale-[0.98]"
                      )}
                    >
                      {paymentLoading === "growth" ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : selectedProject?.monthlyEventLimit === 100000 ? (
                        "Current Plan"
                      ) : (
                        "Upgrade to Growth"
                      )}
                    </button>
                  </div>

                  {/* Enterprise Plan Card */}
                  <div className="p-5 rounded-2xl border border-border bg-muted/10 relative overflow-hidden flex flex-col justify-between h-[340px]">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-bold text-lg text-foreground">Enterprise Plan</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">High volume tracking & advanced SLAs</p>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-foreground">$199</span>
                        <span className="text-xs text-muted-foreground">/ month / project</span>
                      </div>
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />
                          <span>1,000,000 monthly events limit</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />
                          <span>Priority ingestion & support SLA</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />
                          <span>Remote screenshot callback capture</span>
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={() => handleUpgrade("enterprise")}
                      disabled={paymentLoading !== null || !selectedProjectId || selectedProject?.monthlyEventLimit === 1000000}
                      className={cn(
                        "w-full py-2 rounded-xl text-xs font-bold tracking-wide flex items-center justify-center gap-2 transition duration-200 border",
                        selectedProject?.monthlyEventLimit === 1000000
                          ? "bg-brand/10 border-brand/30 text-brand cursor-default"
                          : "bg-brand hover:bg-brand/90 border-transparent text-black active:scale-[0.98]"
                      )}
                    >
                      {paymentLoading === "enterprise" ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : selectedProject?.monthlyEventLimit === 1000000 ? (
                        "Current Plan"
                      ) : (
                        "Upgrade to Enterprise"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "Push Notifications" && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-semibold text-foreground">Push Notification Channels</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Configure your project's Firebase Cloud Messaging (Android) and direct APNs (iOS) credentials.</p>
                </div>

                {selectedProject && (
                  <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                    <span className="text-xs font-semibold text-foreground">Active Project Workspace</span>
                    <p className="text-xs text-muted-foreground mt-1">{selectedProject.name} ({selectedProject.packageName})</p>
                  </div>
                )}

                {selectedProjectId ? (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* FCM Section */}
                    <div className="p-5 bg-muted/10 border border-border/80 rounded-2xl space-y-4 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-bold text-base text-foreground">Android Push (FCM)</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Deliver notifications via Firebase Cloud Messaging.</p>
                          </div>
                          <span className={cn(
                            "px-2.5 py-1 text-[10px] font-bold rounded-full border",
                            selectedProject?.fcmServiceAccount
                              ? "bg-brand/10 border-brand/20 text-brand"
                              : "bg-muted border-border text-muted-foreground"
                          )}>
                            {selectedProject?.fcmServiceAccount ? "Configured" : "Not Configured"}
                          </span>
                        </div>

                        <div className="border-t border-border/60 my-2" />

                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-muted-foreground">Firebase Project ID</label>
                          <input
                            type="text"
                            placeholder="e.g. my-app-project-id"
                            value={fcmProjectName}
                            onChange={(e) => setFcmProjectName(e.target.value)}
                            className="w-full px-3 py-2 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 text-foreground"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-muted-foreground">Firebase Service Account Private Key JSON</label>
                          <textarea
                            rows={8}
                            placeholder='{ "type": "service_account", "project_id": "...", "private_key": "...", ... }'
                            value={fcmServiceAccount}
                            onChange={(e) => setFcmServiceAccount(e.target.value)}
                            className="w-full px-3 py-2 bg-muted/30 border border-border rounded-xl text-xs font-mono focus:outline-none focus:border-brand/50 text-foreground resize-none"
                          />
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (!fcmProjectName || !fcmServiceAccount) {
                            toast.error("Please fill in all FCM fields");
                            return;
                          }
                          try {
                            const res = await saveProjectFcmCredentials(selectedProjectId, fcmServiceAccount, fcmProjectName);
                            if (res.success) {
                              toast.success("FCM credentials saved successfully!");
                              fetchProjectsList();
                            } else {
                              toast.error(res.error || "Failed to save credentials");
                            }
                          } catch (e: any) {
                            toast.error(e.message || "An error occurred");
                          }
                        }}
                        className="w-full py-2.5 rounded-xl bg-brand text-black font-semibold text-sm hover:bg-brand/90 transition-colors mt-4"
                      >
                        Save FCM Configuration
                      </button>
                    </div>

                    {/* APNs Section */}
                    <div className="p-5 bg-muted/10 border border-border/80 rounded-2xl space-y-4 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-bold text-base text-foreground">iOS Push (APNs Direct)</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Deliver notifications directly to Apple APNs servers.</p>
                          </div>
                          <span className={cn(
                            "px-2.5 py-1 text-[10px] font-bold rounded-full border",
                            selectedProject?.apnsPrivateKey
                              ? "bg-brand/10 border-brand/20 text-brand"
                              : "bg-muted border-border text-muted-foreground"
                          )}>
                            {selectedProject?.apnsPrivateKey ? "Configured" : "Not Configured"}
                          </span>
                        </div>

                        <div className="border-t border-border/60 my-2" />

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-muted-foreground">Key ID (10 chars)</label>
                            <input
                              type="text"
                              maxLength={10}
                              placeholder="e.g. ABC123DEFG"
                              value={apnsKeyId}
                              onChange={(e) => setApnsKeyId(e.target.value)}
                              className="w-full px-3 py-2 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 text-foreground"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-muted-foreground">Team ID (10 chars)</label>
                            <input
                              type="text"
                              maxLength={10}
                              placeholder="e.g. G234HJKA89"
                              value={apnsTeamId}
                              onChange={(e) => setApnsTeamId(e.target.value)}
                              className="w-full px-3 py-2 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 text-foreground"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-muted-foreground">App Bundle Identifier</label>
                          <input
                            type="text"
                            placeholder="e.g. com.eassylife.app"
                            value={apnsBundleId}
                            onChange={(e) => setApnsBundleId(e.target.value)}
                            className="w-full px-3 py-2 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 text-foreground"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-muted-foreground">APNs Auth Key (.p8 Private Key text)</label>
                          <textarea
                            rows={4}
                            placeholder="-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...\n-----END PRIVATE KEY-----"
                            value={apnsPrivateKey}
                            onChange={(e) => setApnsPrivateKey(e.target.value)}
                            className="w-full px-3 py-2 bg-muted/30 border border-border rounded-xl text-xs font-mono focus:outline-none focus:border-brand/50 text-foreground resize-none"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
                          <div>
                            <p className="font-medium text-xs text-foreground">Sandbox Environment</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Enable for Apple development/sandbox builds.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setApnsUseSandbox(!apnsUseSandbox)}
                            className={cn(
                              "h-6 w-11 rounded-full border-2 transition-all relative cursor-pointer",
                              apnsUseSandbox ? "bg-brand border-brand" : "bg-muted border-border"
                            )}
                          >
                            <span className={cn(
                              "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all shadow-sm",
                              apnsUseSandbox ? "left-5" : "left-0.5"
                            )} />
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handleSaveApns}
                        disabled={savingApns}
                        className="w-full py-2.5 rounded-xl bg-brand text-black font-semibold text-sm disabled:opacity-50 hover:bg-brand/90 transition-colors mt-4 flex items-center justify-center gap-2"
                      >
                        {savingApns ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save APNs Configuration"
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center border border-dashed border-border rounded-2xl text-muted-foreground text-sm">
                    No active project selected. Create a project to configure push channels.
                  </div>
                )}
              </div>
            )}

            {activeTab === "Danger Zone" && (
              <>
                <h2 className="font-semibold text-red-400">Danger Zone</h2>
                <p className="text-sm text-muted-foreground">These actions are irreversible. Please proceed carefully.</p>
                <div className="space-y-3">
                  {[
                    { title: "Delete All Logs", desc: "Permanently delete all API logs, crash logs, and UI errors", action: "Delete Logs" },
                    { title: "Reset API Keys", desc: "Revoke all existing API keys. Your SDKs will stop reporting.", action: "Reset Keys" },
                    { title: "Delete Account", desc: "Permanently delete your account and all associated data", action: "Delete Account" },
                  ].map((item) => (
                    <div key={item.title} className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                      <div>
                        <p className="font-medium text-sm text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => toast.error(`${item.title} action triggered — confirmation required`)}
                        className="px-3 py-1.5 text-xs font-semibold border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0"
                      >
                        {item.action}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center p-10">
        <p className="text-muted-foreground animate-pulse">Loading settings...</p>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
