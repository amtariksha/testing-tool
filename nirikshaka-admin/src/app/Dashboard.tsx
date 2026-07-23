"use client";

import React, { useState, useEffect } from "react";
import { 
  getCompanies,
  createCompany,
  getProjects, 
  toggleFeature, 
  updateQuota, 
  toggleSuspension, 
  createProject, 
  getStats,
  verifyAdminPin,
  checkAdminSession,
  getUsers,
  updateUserRole,
  pruneTelemetryData,
  manuallySetTier,
  getSystemConfig,
  updateSystemConfig
} from "./actions";
import { 
  Settings, 
  Activity, 
  ShieldAlert, 
  Layers, 
  Smartphone, 
  Monitor, 
  Play, 
  StopCircle, 
  Save, 
  Plus, 
  Check, 
  Copy, 
  RefreshCw, 
  Ban, 
  AlertTriangle, 
  TrendingUp, 
  Sparkles,
  Search,
  Key,
  ShieldCheck,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Database,
  Globe,
  Radio,
  Cpu,
  Users,
  FileText,
  BookOpen,
  Terminal,
  Network,
  UserCheck,
  Wifi,
  Camera,
  Code2,
  ChevronDown
} from "lucide-react";

// Platform Icon mapping
const getPlatformIcon = (platform: string) => {
  switch (platform.toUpperCase()) {
    case "WEB":
      return <Globe className="w-4 h-4 text-sky-400" />;
    case "ANDROID":
      return <Smartphone className="w-4 h-4 text-emerald-400" />;
    case "IOS":
      return <Smartphone className="w-4 h-4 text-rose-400" />;
    case "FLUTTER":
      return <Smartphone className="w-4 h-4 text-blue-400" />;
    case "REACT_NATIVE":
      return <Smartphone className="w-4 h-4 text-indigo-400" />;
    default:
      return <Layers className="w-4 h-4 text-zinc-400" />;
  }
};

export default function DashboardClient() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [passcodeLoading, setPasscodeLoading] = useState(false);
  const [passcodeError, setPasscodeError] = useState("");
  const [isShaking, setIsShaking] = useState(false);

  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({
    totalProjects: 0,
    activeProjects: 0,
    suspendedProjects: 0,
    totalCrashes: 0,
    totalUIErrors: 0,
    totalAPIRequests: 0,
    totalJourneys: 0,
    totalCompanies: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form states - Company
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyOwnerEmail, setNewCompanyOwnerEmail] = useState("");
  const [newCompanyOwnerName, setNewCompanyOwnerName] = useState("");

  // Form states - Project
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPackage, setNewProjectPackage] = useState("");
  const [newProjectPlatform, setNewProjectPlatform] = useState("FLUTTER");
  const [newProjectLimit, setNewProjectLimit] = useState(100000);

  // New SaaS states
  const [users, setUsers] = useState<any[]>([]);
  const [pruneDays, setPruneDays] = useState<number>(30);
  const [pruning, setPruning] = useState(false);
  const [searchUserQuery, setSearchUserQuery] = useState("");

  // Navigation state
  const [activeTab, setActiveTab] = useState<"projects" | "onboard" | "users" | "stats" | "configs" | "manuals">("projects");

  // Legal configs states
  const [termsText, setTermsText] = useState("");
  const [privacyText, setPrivacyText] = useState("");
  const [configsLoading, setConfigsLoading] = useState(false);

  // Flat helper arrays & selected item lookup
  const allProjects = companies.flatMap(c => c.projects || []);
  const selectedProject = allProjects.find(p => p.id === selectedProjectId) || null;
  const selectedCompany = companies.find(c => c.id === selectedCompanyId) || null;
  const selectedProjectCompany = selectedProjectId 
    ? companies.find(c => c.projects?.some((p: any) => p.id === selectedProjectId)) 
    : selectedCompany;

  const [limitInput, setLimitInput] = useState<number>(100000);

  // Check authentication on load — the httpOnly session cookie is the truth
  // (server actions verify it independently on every call).
  useEffect(() => {
    checkAdminSession()
      .then((res) => setIsAuthenticated(res.authenticated))
      .finally(() => setAuthChecking(false));
  }, []);

  // Fetch companies, stats, and users once authenticated
  const fetchData = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const companiesRes = await getCompanies();
      const statsRes = await getStats();
      const usersRes = await getUsers();
      const termsRes = await getSystemConfig("terms");
      const privacyRes = await getSystemConfig("privacy");
      
      if (companiesRes.success && companiesRes.data) {
        setCompanies(companiesRes.data);
      }
      
      if (statsRes.success && statsRes.stats) {
        setStats(statsRes.stats);
      }

      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data);
      }

      if (termsRes.success && termsRes.data !== undefined) {
        setTermsText(termsRes.data);
      }

      if (privacyRes.success && privacyRes.data !== undefined) {
        setPrivacyText(privacyRes.data);
      }
    } catch (err) {
      console.error(err);
      showFeedback("Failed to reload database records.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedProject) {
      setLimitInput(selectedProject.monthlyEventLimit);
    }
  }, [selectedProjectId, selectedProject]);

  const showFeedback = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const handleKeyPress = async (num: string) => {
    if (passcode.length >= 6 || passcodeLoading) return;
    const newPasscode = passcode + num;
    setPasscode(newPasscode);
    
    if (newPasscode.length === 6) {
      setPasscodeLoading(true);
      try {
        const res = await verifyAdminPin(newPasscode);
        if (res.success) {
          setIsAuthenticated(true);
          setPasscode("");
        } else {
          setIsShaking(true);
          setPasscodeError(res.error || "ACCESS DENIED");
          setTimeout(() => {
            setIsShaking(false);
            setPasscode("");
            setPasscodeError("");
          }, 1500);
        }
      } catch (err) {
        setPasscodeError("Authentication system offline");
        setIsShaking(true);
        setTimeout(() => {
          setIsShaking(false);
          setPasscode("");
          setPasscodeError("");
        }, 1500);
      } finally {
        setPasscodeLoading(false);
      }
    }
  };

  const handleBackspace = () => {
    if (passcodeLoading) return;
    setPasscode(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (passcodeLoading) return;
    setPasscode("");
    setPasscodeError("");
  };

  // Listen to physical keyboard events for code entry
  useEffect(() => {
    if (isAuthenticated || authChecking) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape") {
        handleClear();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [passcode, isAuthenticated, authChecking]);

  const handleToggleFeature = async (projectId: string, featureKey: string, currentValue: boolean) => {
    const actionKey = `${projectId}-${featureKey}`;
    setActionLoading(actionKey);
    try {
      const res = await toggleFeature(projectId, featureKey, !currentValue);
      if (res.success) {
        setCompanies(prev => prev.map(c => ({
          ...c,
          projects: c.projects ? c.projects.map((p: any) => p.id === projectId ? { ...p, [featureKey]: !currentValue } : p) : []
        })));
        showFeedback(`Toggled ${featureKey.replace("enable", "")} configuration successfully!`);
      } else {
        showFeedback(res.error || "Failed to update feature flag", "error");
      }
    } catch (e) {
      showFeedback("Error updating feature flag", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleSuspension = async (projectId: string, currentSuspended: boolean) => {
    const actionKey = `${projectId}-suspension`;
    setActionLoading(actionKey);
    try {
      const res = await toggleSuspension(projectId, !currentSuspended);
      if (res.success) {
        setCompanies(prev => prev.map(c => ({
          ...c,
          projects: c.projects ? c.projects.map((p: any) => p.id === projectId ? { ...p, isSuspended: !currentSuspended } : p) : []
        })));
        showFeedback(
          !currentSuspended 
            ? "Project suspended. SDK Ingestion blocked." 
            : "Project activated. Ingestion resumed."
        );
        // Refresh stats
        const statsRes = await getStats();
        if (statsRes.success && statsRes.stats) setStats(statsRes.stats);
      } else {
        showFeedback(res.error || "Failed to toggle suspension", "error");
      }
    } catch (e) {
      showFeedback("Error updating suspension state", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    setActionLoading("quota-update");
    try {
      const res = await updateQuota(selectedProjectId, limitInput);
      if (res.success) {
        setCompanies(prev => prev.map(c => ({
          ...c,
          projects: c.projects ? c.projects.map((p: any) => p.id === selectedProjectId ? { ...p, monthlyEventLimit: limitInput } : p) : []
        })));
        showFeedback("Project monthly event limit updated!");
      } else {
        showFeedback(res.error || "Failed to update quota limit", "error");
      }
    } catch (e) {
      showFeedback("Error updating quota limit", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetTierManually = async (projectId: string, tier: 'starter' | 'growth' | 'enterprise') => {
    const actionKey = `${projectId}-settier`;
    setActionLoading(actionKey);
    try {
      const res = await manuallySetTier(projectId, tier);
      if (res.success && res.data) {
        setCompanies(prev => prev.map(c => ({
          ...c,
          projects: c.projects ? c.projects.map((p: any) => p.id === projectId ? { ...p, monthlyEventLimit: res.data.monthlyEventLimit } : p) : []
        })));
        if (projectId === selectedProjectId) {
          setLimitInput(res.data.monthlyEventLimit);
        }
        showFeedback(`Manually adjusted project to ${tier.toUpperCase()} tier.`);
      } else {
        showFeedback(res.error || "Failed to adjust billing tier", "error");
      }
    } catch (e) {
      showFeedback("Error adjusting billing tier", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: any) => {
    const actionKey = `${userId}-updaterole`;
    setActionLoading(actionKey);
    try {
      const res = await updateUserRole(userId, newRole);
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        showFeedback("User global access level updated.");
      } else {
        showFeedback(res.error || "Failed to update role", "error");
      }
    } catch (e) {
      showFeedback("Error updating user role", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePruneTelemetry = async () => {
    if (pruneDays <= 0) {
      showFeedback("Please specify a valid number of days.", "error");
      return;
    }
    setPruning(true);
    try {
      const res = await pruneTelemetryData(pruneDays);
      if (res.success) {
        showFeedback(res.message || "Telemetry logs pruned successfully!");
        // Refresh stats & companies counts
        const statsRes = await getStats();
        if (statsRes.success && statsRes.stats) setStats(statsRes.stats);
        const companiesRes = await getCompanies();
        if (companiesRes.success && companiesRes.data) setCompanies(companiesRes.data);
      } else {
        showFeedback(res.error || "Failed to prune telemetry", "error");
      }
    } catch (e) {
      showFeedback("Error pruning telemetry logs", "error");
    } finally {
      setPruning(false);
    }
  };

  const handleUpdateConfig = async (key: string, value: string) => {
    setConfigsLoading(true);
    try {
      const res = await updateSystemConfig(key, value);
      if (res.success) {
        showFeedback(`${key === "terms" ? "Terms of Service" : "Privacy Policy"} updated and published!`, "success");
      } else {
        showFeedback(res.error || "Failed to update configuration.", "error");
      }
    } catch (err: any) {
      showFeedback(err.message || "Failed to save configuration.", "error");
    } finally {
      setConfigsLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newCompanyOwnerEmail.trim()) {
      showFeedback("Company Name and Owner Email are required", "error");
      return;
    }
    setActionLoading("create-company");
    try {
      const res = await createCompany(
        newCompanyName,
        newCompanyOwnerEmail,
        newCompanyOwnerName
      );
      if (res.success && res.data) {
        showFeedback(`Company "${newCompanyName}" registered successfully!`);
        setNewCompanyName("");
        setNewCompanyOwnerEmail("");
        setNewCompanyOwnerName("");
        await fetchData();
        setActiveTab("projects"); // Switch to companies view
        setSelectedCompanyId(res.data.id);
        setSelectedProjectId(null);
      } else {
        showFeedback(res.error || "Failed to onboard company", "error");
      }
    } catch (e) {
      showFeedback("Error onboarding company", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) {
      showFeedback("A company must be selected to add a project", "error");
      return;
    }
    if (!newProjectName.trim() || !newProjectPackage.trim()) {
      showFeedback("Name and package identifier are required", "error");
      return;
    }
    setActionLoading("create-project");
    try {
      const res = await createProject(
        selectedCompanyId,
        newProjectName,
        newProjectPackage,
        newProjectPlatform as any,
        newProjectLimit
      );
      if (res.success && res.data) {
        showFeedback(`Project "${newProjectName}" registered successfully!`);
        setNewProjectName("");
        setNewProjectPackage("");
        setNewProjectLimit(100000);
        await fetchData();
        setSelectedProjectId(res.data.id);
      } else {
        showFeedback(res.error || "Failed to register project", "error");
      }
    } catch (e) {
      showFeedback("Error registering project app", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    showFeedback("API key copied to clipboard!");
  };

  const handleLogout = () => {
    // Cookie expires on its own (8h); local state reset shows the PIN screen.
    setIsAuthenticated(false);
    setPasscode("");
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.owner && c.owner.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.owner && c.owner.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (authChecking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // --- PASSCODE GATEWAY PAGE (AUTHENTICATION) ---
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center relative overflow-hidden font-mono select-none">
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            15%, 45%, 75% { transform: translateX(-6px); }
            30%, 60%, 90% { transform: translateX(6px); }
          }
          .animate-shake {
            animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
          }
        `}</style>
        
        {/* Glow backdrop behind the login console card */}
        <div className="absolute w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" />

        <div className={`w-full max-w-sm px-6 py-8 rounded-3xl bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/80 shadow-2xl flex flex-col items-center gap-6 transition-all duration-300 relative ${isShaking ? "animate-shake border-red-500/50" : ""}`}>
          
          {/* Logo & Brand */}
          <div className="flex flex-col items-center gap-2">
            <img src="/logo.png" alt="Nirikshaka Logo" className="h-12 w-12 object-contain animate-pulse" />
            <div className="text-center mt-2">
              <h1 className="text-xl font-bold tracking-widest text-zinc-50 font-black uppercase">
                Nirikshaka
              </h1>
              <p className="text-[10px] text-zinc-500 font-semibold tracking-widest uppercase mt-0.5">Admin Console Auth</p>
            </div>
          </div>

          {/* Passcode input grid */}
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex gap-2.5 justify-center w-full">
              {Array.from({ length: 6 }).map((_, idx) => {
                const char = passcode[idx] || "";
                const isActive = idx === passcode.length;
                return (
                  <div
                    key={idx}
                    className={`w-11 h-13 rounded-xl border flex items-center justify-center text-xl font-bold transition-all duration-200 ${
                      char 
                        ? "border-emerald-500/80 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)] bg-emerald-955/20 scale-[1.02]" 
                        : isActive 
                          ? "border-emerald-400 bg-zinc-900/90 shadow-[0_0_15px_rgba(16,185,129,0.25)] scale-[1.05]" 
                          : "border-zinc-800 bg-zinc-955/30"
                    }`}
                  >
                    {char ? "•" : ""}
                  </div>
                );
              })}
            </div>

            {/* Error or Status message */}
            <div className="h-5 flex items-center justify-center text-center">
              {passcodeError ? (
                <span className="text-red-400 text-xs font-bold tracking-wider uppercase animate-pulse">{passcodeError}</span>
              ) : passcodeLoading ? (
                <span className="text-emerald-400 text-xs font-bold tracking-wider uppercase animate-pulse flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> VERIFYING ACCESS...
                </span>
              ) : (
                <span className="text-zinc-650 text-[10px] uppercase font-semibold tracking-wider">Enter secure passcode</span>
              )}
            </div>
          </div>


          {/* Terminal notification footer */}
          <div className="border-t border-zinc-850 pt-4 mt-2 flex items-center justify-center gap-1.5 text-[9px] text-zinc-550 uppercase tracking-widest font-semibold w-full text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Protected Terminal. Operations are monitored.
          </div>
        </div>
      </main>
    );
  }

  // --- MAIN PROFESSIONAL WORKSPACE ---
  return (
    <main className="flex-1 bg-zinc-950 text-zinc-100 flex min-h-screen relative overflow-hidden font-sans">
      {/* Animated gradient mesh background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />

      {/* Side Navigation Sidebar */}
      <aside className="w-64 border-r border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md flex flex-col justify-between shrink-0 sticky top-0 h-screen z-20">
        <div className="flex flex-col gap-6 p-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Nirikshaka Logo" className="h-9 w-9 object-contain" />
            <div>
              <h1 className="text-base font-bold tracking-wider">
                <span className="text-zinc-50">Nirikshaka</span>
              </h1>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">SaaS Console</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1.5 mt-4">
            <button
              onClick={() => { setActiveTab("projects"); setSelectedProjectId(null); setSelectedCompanyId(null); }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition duration-155 ${
                activeTab === "projects"
                  ? "bg-emerald-955/30 text-emerald-400 border border-emerald-800/40"
                  : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <Layers className="w-4 h-4" />
              All Projects
            </button>

            <button
              onClick={() => { setActiveTab("onboard"); setSelectedProjectId(null); setSelectedCompanyId(null); }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition duration-155 ${
                activeTab === "onboard"
                  ? "bg-emerald-955/30 text-emerald-400 border border-emerald-800/40"
                  : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <Plus className="w-4 h-4" />
              Onboard Project
            </button>

            <button
              onClick={() => { setActiveTab("stats"); setSelectedProjectId(null); setSelectedCompanyId(null); }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition duration-155 ${
                activeTab === "stats"
                  ? "bg-emerald-955/30 text-emerald-400 border border-emerald-800/40"
                  : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <Database className="w-4 h-4" />
              System Stats
            </button>

            <button
              onClick={() => { setActiveTab("users"); setSelectedProjectId(null); setSelectedCompanyId(null); }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition duration-155 ${
                activeTab === "users"
                  ? "bg-emerald-955/30 text-emerald-400 border border-emerald-800/40"
                  : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <Users className="w-4 h-4" />
              User Directory
            </button>

            <button
              onClick={() => { setActiveTab("configs"); setSelectedProjectId(null); setSelectedCompanyId(null); }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition duration-155 ${
                activeTab === "configs"
                  ? "bg-emerald-955/30 text-emerald-400 border border-emerald-800/40"
                  : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <FileText className="w-4 h-4" />
              Legal Documents
            </button>

            <button
              onClick={() => { setActiveTab("manuals"); setSelectedProjectId(null); setSelectedCompanyId(null); }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition duration-155 ${
                activeTab === "manuals"
                  ? "bg-emerald-955/30 text-emerald-400 border border-emerald-800/40"
                  : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              SDK Manuals
            </button>
          </nav>
        </div>

        {/* User context & logout */}
        <div className="p-6 border-t border-zinc-900 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
              <Cpu className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-zinc-300 truncate">Nirikshaka Root Admin</span>
              <span className="text-[9px] text-zinc-550 font-semibold uppercase tracking-wider">Level 1 Clearance</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-red-950/20 border border-zinc-800 hover:border-red-900/40 hover:text-red-400 text-zinc-400 rounded-lg text-[10px] font-bold tracking-wider uppercase transition duration-150"
          >
            <LogOut className="w-3 h-3" />
            Lock Terminal
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col overflow-y-auto max-h-screen">
        {/* Header */}
        <header className="border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md sticky top-0 z-10 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <span 
              className="cursor-pointer hover:text-zinc-200 transition"
              onClick={() => {
                setSelectedCompanyId(null);
                setSelectedProjectId(null);
                setActiveTab("projects");
              }}
            >
              SaaS Control
            </span>
            {selectedProject ? (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-650" />
                {selectedProjectCompany && (
                  <>
                    <span 
                      className="cursor-pointer hover:text-zinc-200 transition"
                      onClick={() => {
                        setSelectedProjectId(null);
                      }}
                    >
                      {selectedProjectCompany.name}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-650" />
                  </>
                )}
                <span className="text-zinc-100 font-bold">Project: {selectedProject.name}</span>
              </>
            ) : selectedCompany ? (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-650" />
                <span className="text-zinc-100 font-bold">{selectedCompany.name}</span>
              </>
            ) : (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-650" />
                <span className="text-zinc-100 font-bold uppercase tracking-wider text-[10px]">
                  {activeTab === "projects" ? "All Companies" : activeTab === "onboard" ? "Onboard Company" : activeTab === "users" ? "User Directory" : activeTab === "configs" ? "Legal Configuration" : activeTab === "manuals" ? "SDK Integration Manuals" : "System Analytics Dashboard"}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            {feedback && (
              <div className={`px-4 py-2 rounded-xl border text-xs font-semibold animate-fade-in shadow-lg ${
                feedback.type === "success" 
                  ? "bg-emerald-955/30 border-emerald-800/40 text-emerald-400"
                  : "bg-rose-955/30 border-rose-800/40 text-rose-400"
              }`}>
                {feedback.message}
              </div>
            )}

            <button 
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-50 transition text-[10px] font-bold tracking-wide disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Sync DB State
            </button>
          </div>
        </header>

        {/* Workspace body */}
        <div className="p-8 max-w-6xl w-full mx-auto flex flex-col gap-8 flex-1">
          
          {/* PROJECT DETAIL VIEW (When a project is selected) */}
          {selectedProjectId && selectedProject ? (
            <div className="flex flex-col gap-6">
              
              {/* Back navigation */}
              <div>
                <button
                  onClick={() => setSelectedProjectId(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition text-[10px] font-bold tracking-wider uppercase"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to All Projects
                </button>
              </div>

              {/* Detail panels */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Project properties and quotas */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                  
                  {/* General Config Card */}
                  <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 flex flex-col gap-5">
                    <div className="flex items-start justify-between pb-4 border-b border-zinc-800/60">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-805 flex items-center justify-center">
                          {getPlatformIcon(selectedProject.platform)}
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-zinc-100">{selectedProject.name}</h2>
                          <p className="text-xs text-zinc-500 font-mono mt-0.5">{selectedProject.packageName}</p>
                        </div>
                      </div>

                      {/* Suspension Status Action */}
                      <button
                        onClick={() => handleToggleSuspension(selectedProject.id, selectedProject.isSuspended)}
                        disabled={actionLoading === `${selectedProject.id}-suspension`}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 transition duration-150 ${
                          selectedProject.isSuspended
                            ? "bg-emerald-955/20 border-emerald-800/40 text-emerald-400 hover:bg-emerald-955/40"
                            : "bg-rose-955/20 border-rose-800/40 text-rose-400 hover:bg-rose-955/40"
                        }`}
                      >
                        {actionLoading === `${selectedProject.id}-suspension` ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : selectedProject.isSuspended ? (
                          <>
                            <Play className="w-3 h-3" />
                            Resume App
                          </>
                        ) : (
                          <>
                            <Ban className="w-3 h-3" />
                            Suspend App
                          </>
                        )}
                      </button>
                    </div>

                    {/* Suspension Banner Warning */}
                    {selectedProject.isSuspended && (
                      <div className="p-4 rounded-xl border border-rose-955/40 bg-rose-955/10 text-rose-400 flex gap-3 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                        <div>
                          <span className="font-bold">Project Suspended</span>
                          <p className="text-rose-500/80 mt-1">This application's API endpoints are currently blocking all incoming crash logs, journeys, and error captures.</p>
                        </div>
                      </div>
                    )}

                    {/* API Key box */}
                    {selectedProject.apiKeys && selectedProject.apiKeys.length > 0 && (
                      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">SDK Authorization Key</span>
                          <code className="text-xs text-zinc-200 font-mono break-all">{selectedProject.apiKeys[0].key}</code>
                        </div>
                        <button
                          onClick={() => handleCopyKey(selectedProject.apiKeys[0].key)}
                          className="p-2 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                          title="Copy API Key"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Event quota gauges */}
                    <div className="flex flex-col gap-2.5">
                      <div className="flex justify-between text-xs text-zinc-400 font-semibold uppercase">
                        <span>Ingestion Quota Consumption</span>
                        <span>
                          {selectedProject.monthlyEventCount.toLocaleString()} / {selectedProject.monthlyEventLimit.toLocaleString()} (
                          {Math.round((selectedProject.monthlyEventCount / selectedProject.monthlyEventLimit) * 100)}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-zinc-950 border border-zinc-800/80 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${Math.min(100, (selectedProject.monthlyEventCount / selectedProject.monthlyEventLimit) * 100)}%` }}
                          className={`h-full rounded-full transition-all duration-500 ${
                            selectedProject.isSuspended 
                              ? "bg-zinc-700" 
                              : (selectedProject.monthlyEventCount / selectedProject.monthlyEventLimit) >= 0.9 
                                ? "bg-gradient-to-r from-amber-500 to-rose-500" 
                                : "bg-gradient-to-r from-emerald-500 to-teal-500"
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quota Management card */}
                  <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 flex flex-col gap-4">
                    <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Configure Limits</h3>
                    <form onSubmit={handleUpdateLimit} className="flex gap-3">
                      <input
                        type="number"
                        value={limitInput}
                        onChange={(e) => setLimitInput(Number(e.target.value))}
                        className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
                      />
                      <button
                        type="submit"
                        disabled={actionLoading === "quota-update"}
                        className="px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-50 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
                      >
                        {actionLoading === "quota-update" ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Update Quota Limit
                      </button>
                    </form>
                  </div>

                  {/* Manual Billing Tier Allocation */}
                  <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Allocate SaaS Subscription Tier</h3>
                      <p className="text-[10px] text-zinc-500">Manually override database ingestion limits based on free subscription tiers.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { tier: "starter", label: "Starter", limit: "10,000" },
                        { tier: "growth", label: "Growth", limit: "100,000" },
                        { tier: "enterprise", label: "Enterprise", limit: "1,000,000" },
                      ].map((preset) => {
                        const isCurrent = 
                          (preset.tier === "starter" && selectedProject.monthlyEventLimit === 10000) ||
                          (preset.tier === "growth" && selectedProject.monthlyEventLimit === 100000) ||
                          (preset.tier === "enterprise" && selectedProject.monthlyEventLimit === 1000000);
                        const isLoading = actionLoading === `${selectedProject.id}-settier`;

                        return (
                          <button
                            key={preset.tier}
                            type="button"
                            disabled={isLoading || selectedProject.isSuspended}
                            onClick={() => handleSetTierManually(selectedProject.id, preset.tier as any)}
                            className={`px-3 py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition duration-150 ${
                              isCurrent
                                ? "bg-emerald-955/20 border-emerald-500/60 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)] bg-emerald-950/20"
                                : "bg-zinc-950/40 border-zinc-800/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                            }`}
                          >
                            <span className="text-xs font-bold">{preset.label}</span>
                            <span className="text-[9px] opacity-75 font-mono">{preset.limit} events</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* SDK Toggles Switchboard */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
                      <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Dynamic SDK Features</h3>
                      <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-500 font-bold">LIVE ON/OFF</span>
                    </div>

                    <div className="flex flex-col border border-zinc-800/80 rounded-xl bg-zinc-950/20 divide-y divide-zinc-800/80">
                      {[
                        { key: "enableCrashReporting", label: "Crash Reporting", desc: "Saves uncaught exceptions" },
                        { key: "enableUIErrorTracking", label: "UI Layout Track", desc: "Render library overflow bugs" },
                        { key: "enableNetworkTracking", label: "Network Log", desc: "HTTP latency & sizes" },
                        { key: "enableBreadcrumbs", label: "Breadcrumb Trails", desc: "Session navigation trails" },
                        { key: "enableLifecycleTracking", label: "Lifecycle State", desc: "Background state transitions" },
                        { key: "enableJourneyTracking", label: "User Journeys", desc: "Interactive flows sessions" },
                        { key: "enableScreenshotDetection", label: "Screenshot Capture", desc: "Assets on screenshot event" },
                      ].map((feature) => {
                        const isEnabled = selectedProject[feature.key] === true;
                        const isLoading = actionLoading === `${selectedProject.id}-${feature.key}`;

                        return (
                          <div key={feature.key} className="p-4 flex items-center justify-between gap-4 hover:bg-zinc-900/10 transition">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-zinc-200">{feature.label}</span>
                              <span className="text-[9px] text-zinc-500 leading-normal">{feature.desc}</span>
                            </div>

                            <button
                              onClick={() => handleToggleFeature(selectedProject.id, feature.key, isEnabled)}
                              disabled={isLoading || selectedProject.isSuspended}
                              className={`w-10 h-5.5 rounded-full p-0.5 transition duration-300 relative focus:outline-none shrink-0 ${
                                selectedProject.isSuspended
                                  ? "bg-zinc-900 border border-zinc-850 cursor-not-allowed"
                                  : isEnabled
                                    ? "bg-emerald-600 shadow shadow-emerald-600/20"
                                    : "bg-zinc-800"
                              }`}
                            >
                              <div
                                className={`w-4.5 h-4.5 rounded-full bg-white shadow transform transition duration-300 flex items-center justify-center ${
                                  isEnabled ? "translate-x-4.5" : "translate-x-0"
                                }`}
                              >
                                {isLoading && (
                                  <div className="w-2 h-2 border border-zinc-400 border-t-transparent rounded-full animate-spin" />
                                )}
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            // --- ALL OTHER VIEWS ---
            <>
              {/* ALL COMPANIES / COMPANY DETAIL VIEW */}
              {activeTab === "projects" && (
                <div className="flex flex-col gap-6">
                  {selectedCompanyId && selectedCompany ? (
                    // --- COMPANY DETAIL VIEW ---
                    <div className="flex flex-col gap-6">
                      {/* Back to all companies navigation */}
                      <div>
                        <button
                          onClick={() => setSelectedCompanyId(null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition text-[10px] font-bold tracking-wider uppercase"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Back to All Companies
                        </button>
                      </div>

                      {/* Company Info Panel */}
                      <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 flex flex-col gap-4">
                        <div className="flex items-start justify-between pb-3 border-b border-zinc-800/60">
                          <div>
                            <h2 className="text-base font-bold text-zinc-100">{selectedCompany.name}</h2>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5">Slug: {selectedCompany.slug}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase bg-emerald-955/30 border border-emerald-800/40 text-emerald-400">
                            Registered Company
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Owner Account</span>
                            <span className="text-zinc-300 font-semibold">{selectedCompany.owner?.name || "N/A"}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Owner Email</span>
                            <span className="text-zinc-300 font-mono">{selectedCompany.owner?.email || "N/A"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Projects Section */}
                      <div className="flex flex-col gap-4 mt-2">
                        <h3 className="text-sm font-bold text-zinc-200">Company Projects</h3>
                        
                        {!selectedCompany.projects || selectedCompany.projects.length === 0 ? (
                          <div className="py-12 text-center border border-dashed border-zinc-855 rounded-2xl bg-zinc-900/10 text-zinc-500 flex flex-col items-center justify-center gap-3">
                            <Ban className="w-5 h-5 text-zinc-700" />
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">No Projects Found</p>
                              <p className="text-[10px] text-zinc-500 mt-1">This company has not created any project integrations yet.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {selectedCompany.projects.map((project: any) => {
                              const eventPercent = Math.min(100, Math.round((project.monthlyEventCount / project.monthlyEventLimit) * 100));
                              return (
                                <div
                                  key={project.id}
                                  className="bg-zinc-900/25 border border-zinc-855 hover:border-zinc-800 rounded-2xl p-5 flex flex-col justify-between gap-5 transition duration-200 group hover:scale-[1.01] hover:shadow-lg hover:shadow-zinc-950/40 relative overflow-hidden"
                                >
                                  {/* Accent indicator line on top */}
                                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                                    project.isSuspended 
                                      ? "bg-rose-500/50" 
                                      : "bg-gradient-to-r from-emerald-500 to-teal-500"
                                  }`} />

                                  <div className="flex flex-col gap-3">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-zinc-955 border border-zinc-855 flex items-center justify-center">
                                          {getPlatformIcon(project.platform)}
                                        </div>
                                        <div>
                                          <h4 className="text-xs font-bold text-zinc-200 group-hover:text-zinc-50 transition">{project.name}</h4>
                                          <p className="text-[9px] text-zinc-550 font-mono mt-0.5 truncate max-w-[150px]">{project.packageName}</p>
                                        </div>
                                      </div>

                                      <div className="flex">
                                        {project.isSuspended ? (
                                          <span className="px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase bg-rose-955/30 border border-rose-800/40 text-rose-400">
                                            Suspended
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase bg-emerald-955/30 border border-emerald-800/40 text-emerald-400">
                                            Active
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Progress metrics */}
                                    <div className="flex flex-col gap-1 mt-1">
                                      <div className="flex justify-between text-[9px] text-zinc-500 font-bold uppercase">
                                        <span>Quota Consumption</span>
                                        <span>{project.monthlyEventCount.toLocaleString()} / {project.monthlyEventLimit.toLocaleString()}</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-zinc-950 border border-zinc-855/80 rounded-full overflow-hidden">
                                        <div 
                                          style={{ width: `${eventPercent}%` }}
                                          className={`h-full rounded-full ${
                                            project.isSuspended 
                                              ? "bg-zinc-700" 
                                              : eventPercent >= 90 
                                                ? "bg-gradient-to-r from-amber-500 to-rose-500" 
                                                : "bg-gradient-to-r from-emerald-500 to-teal-500"
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Actions block */}
                                  <div className="border-t border-zinc-900 pt-4 flex items-center justify-between gap-4 mt-2">
                                    <div className="flex items-center gap-1.5 text-[8px] text-zinc-555 font-bold uppercase">
                                      <span className={project.enableCrashReporting ? "text-emerald-400" : ""}>Crash</span>
                                      <span>•</span>
                                      <span className={project.enableUIErrorTracking ? "text-emerald-400" : ""}>UI</span>
                                      <span>•</span>
                                      <span className={project.enableNetworkTracking ? "text-emerald-400" : ""}>Net</span>
                                      <span>•</span>
                                      <span className={project.enableJourneyTracking ? "text-emerald-400" : ""}>Flow</span>
                                    </div>

                                    <button
                                      onClick={() => setSelectedProjectId(project.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-855 hover:border-zinc-700 rounded-lg text-[9px] font-bold tracking-wider uppercase text-zinc-300 hover:text-zinc-50 transition"
                                    >
                                      Manage Project
                                      <ChevronRight className="w-3 h-3 text-zinc-500" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Register New Project inside Company Form */}
                      <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 mt-4 flex flex-col gap-5 max-w-2xl font-sans">
                        <div>
                          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                            <Plus className="w-4.5 h-4.5 text-emerald-400" />
                            Register New Project under Company
                          </h3>
                          <p className="text-xs text-zinc-500 mt-1">Add a project integration specifically for {selectedCompany.name}.</p>
                        </div>

                        <form onSubmit={handleCreateProject} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Project Name</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Nirikshaka Production Customer App"
                              value={newProjectName}
                              onChange={(e) => setNewProjectName(e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-zinc-700"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Package / Bundle ID</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. com.nirikshaka.production"
                              value={newProjectPackage}
                              onChange={(e) => setNewProjectPackage(e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-955/60 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-zinc-750"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Platform SDK</label>
                            <select
                              value={newProjectPlatform}
                              onChange={(e) => setNewProjectPlatform(e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-955/60 text-xs text-zinc-300 focus:outline-none focus:border-zinc-750"
                            >
                              <option value="FLUTTER">Flutter SDK</option>
                              <option value="ANDROID">Android Native</option>
                              <option value="IOS">iOS Native</option>
                              <option value="WEB">Web App</option>
                              <option value="REACT_NATIVE">React Native</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Monthly Event Limit</label>
                            <input
                              type="number"
                              required
                              value={newProjectLimit}
                              onChange={(e) => setNewProjectLimit(Number(e.target.value))}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-955/60 text-xs text-zinc-100 focus:outline-none focus:border-zinc-750"
                            />
                          </div>

                          <div className="sm:col-span-2 flex justify-end mt-2 pt-4 border-t border-zinc-900">
                            <button
                              type="submit"
                              disabled={actionLoading === "create-project"}
                              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-lg text-xs font-bold tracking-wide flex items-center gap-2 shadow-lg shadow-emerald-950/30 hover:scale-[1.02] active:scale-[0.98] transition duration-150 disabled:opacity-50"
                            >
                              {actionLoading === "create-project" ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Create Project App
                            </button>
                          </div>
                        </form>
                      </div>

                    </div>
                  ) : (
                    // --- ALL COMPANIES VIEW ---
                    <div className="flex flex-col gap-6">
                      
                      {/* Grid summary cards */}
                      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-zinc-700/80 transition duration-300">
                          <div className="flex flex-col gap-1 z-10">
                            <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">Active Companies</span>
                            <span className="text-2xl font-black text-emerald-400 mt-0.5">{stats.totalCompanies}</span>
                            <span className="text-[9px] text-zinc-500 mt-1 font-medium">Registered SaaS Clients</span>
                          </div>
                          <div className="w-11 h-11 rounded-xl bg-emerald-955/30 border border-emerald-800/40 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition z-10">
                            <Globe className="w-4.5 h-4.5" />
                          </div>
                        </div>

                        <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-zinc-700/80 transition duration-300">
                          <div className="flex flex-col gap-1 z-10">
                            <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">Total Projects</span>
                            <span className="text-2xl font-black text-sky-400 mt-0.5">{stats.totalProjects}</span>
                            <span className="text-[9px] text-zinc-500 mt-1 font-medium">Across all clients</span>
                          </div>
                          <div className="w-11 h-11 rounded-xl bg-sky-955/30 border border-sky-800/40 flex items-center justify-center text-sky-400 group-hover:scale-110 transition z-10">
                            <Layers className="w-4.5 h-4.5" />
                          </div>
                        </div>

                        <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-zinc-700/80 transition duration-300">
                          <div className="flex flex-col gap-1 z-10">
                            <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">Crashes Logged</span>
                            <span className="text-2xl font-black text-rose-400 mt-0.5">{stats.totalCrashes}</span>
                            <span className="text-[9px] text-zinc-500 mt-1 font-medium">Critical crash instances</span>
                          </div>
                          <div className="w-11 h-11 rounded-xl bg-rose-955/30 border border-rose-800/40 flex items-center justify-center text-rose-400 group-hover:scale-110 transition z-10">
                            <ShieldAlert className="w-4.5 h-4.5" />
                          </div>
                        </div>

                        <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-zinc-700/80 transition duration-300">
                          <div className="flex flex-col gap-1 z-10">
                            <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">User Journeys</span>
                            <span className="text-2xl font-black text-blue-400 mt-0.5">{stats.totalJourneys}</span>
                            <span className="text-[9px] text-zinc-500 mt-1 font-medium">Total interactive sessions</span>
                          </div>
                          <div className="w-11 h-11 rounded-xl bg-blue-955/30 border border-blue-800/40 flex items-center justify-center text-blue-400 group-hover:scale-110 transition z-10">
                            <Activity className="w-4.5 h-4.5" />
                          </div>
                        </div>
                      </section>

                      {/* Header Search & Filtering */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/20 border border-zinc-855 p-4 rounded-2xl backdrop-blur-sm">
                        <div>
                          <h2 className="text-sm font-bold text-zinc-200">Registered SaaS Companies</h2>
                          <p className="text-[11px] text-zinc-555 mt-0.5">Control live feature flags and event quotas for Nirikshaka integrations.</p>
                        </div>

                        <div className="relative max-w-xs w-full">
                          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search company or owner details..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-700"
                          />
                        </div>
                      </div>

                      {/* Companies Grid */}
                      {loading && companies.length === 0 ? (
                        <div className="py-24 text-center text-zinc-555 flex flex-col items-center justify-center gap-3">
                          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                          <span className="text-xs font-bold tracking-wider uppercase text-zinc-600">Retrieving DB companies...</span>
                        </div>
                      ) : filteredCompanies.length === 0 ? (
                        <div className="py-20 text-center border border-dashed border-zinc-855 rounded-2xl bg-zinc-900/10 text-zinc-500 flex flex-col items-center justify-center gap-3">
                          <Ban className="w-6 h-6 text-zinc-700" />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">No Companies Onboarded</p>
                            <p className="text-[10px] text-zinc-500 mt-1">To get started, click "Onboard Company" in the side navigation menu.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {filteredCompanies.map((company) => {
                            const projectCount = company.projects?.length || 0;
                            const totalEventsSum = company.projects?.reduce((acc: number, p: any) => acc + p.monthlyEventCount, 0) || 0;
                            
                            return (
                              <div
                                key={company.id}
                                className="bg-zinc-900/25 border border-zinc-855 hover:border-zinc-800 rounded-2xl p-5 flex flex-col justify-between gap-5 transition duration-200 group hover:scale-[1.01] hover:shadow-lg hover:shadow-zinc-950/40 relative overflow-hidden"
                              >
                                {/* Accent indicator line on top */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />

                                <div className="flex flex-col gap-3">
                                  <div className="flex items-start justify-between gap-4">
                                    <div>
                                      <h3 className="text-xs font-bold text-zinc-200 group-hover:text-zinc-50 transition">{company.name}</h3>
                                      <p className="text-[9px] text-zinc-500 font-mono mt-1">Slug: {company.slug}</p>
                                    </div>
                                    <span className="px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase bg-emerald-955/20 border border-emerald-800/40 text-emerald-400">
                                      {projectCount} {projectCount === 1 ? "Project" : "Projects"}
                                    </span>
                                  </div>

                                  <div className="flex flex-col gap-2 mt-1 text-[11px]">
                                    <div className="flex justify-between border-b border-zinc-900/40 pb-1.5">
                                      <span className="text-zinc-500">Owner</span>
                                      <span className="text-zinc-350 font-semibold">{company.owner?.name || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-zinc-900/40 pb-1.5">
                                      <span className="text-zinc-500">Owner Email</span>
                                      <span className="text-zinc-350 font-mono">{company.owner?.email || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Event Volume (Sum)</span>
                                      <span className="text-emerald-400 font-bold font-mono">{totalEventsSum.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="border-t border-zinc-900 pt-4 flex items-center justify-end mt-2">
                                  <button
                                    onClick={() => {
                                      setSelectedCompanyId(company.id);
                                      setSelectedProjectId(null);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-855 hover:border-zinc-700 rounded-lg text-[9px] font-bold tracking-wider uppercase text-zinc-300 hover:text-zinc-50 transition"
                                  >
                                    Manage Company
                                    <ChevronRight className="w-3 h-3 text-zinc-500" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )}

              {/* ONBOARD COMPANY VIEW */}
              {activeTab === "onboard" && (
                <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 rounded-3xl p-8 max-w-2xl mx-auto w-full flex flex-col gap-6 shadow-xl relative overflow-hidden font-sans">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />

                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-emerald-400" />
                      Onboard New Company
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Register a new client company workspace. This automatically generates their tenant profile, database bounds, and registers the initial owner account.</p>
                  </div>

                  <form onSubmit={handleCreateCompany} className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Company Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. EassyLife Technologies Ltd."
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-955/60 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-750"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Owner Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Jane Doe"
                        value={newCompanyOwnerName}
                        onChange={(e) => setNewCompanyOwnerName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-955/60 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-750"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Owner Email Address</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. jane@example.com"
                        value={newCompanyOwnerEmail}
                        onChange={(e) => setNewCompanyOwnerEmail(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-955/60 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-750"
                      />
                    </div>

                    <div className="sm:col-span-2 flex justify-end mt-4 pt-4 border-t border-zinc-900">
                      <button
                        type="submit"
                        disabled={actionLoading === "create-company"}
                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold tracking-wide flex items-center gap-2 shadow-lg shadow-emerald-950/30 hover:scale-[1.02] active:scale-[0.98] transition duration-150 disabled:opacity-50"
                      >
                        {actionLoading === "create-company" ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Onboard Company
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* USER DIRECTORY VIEW */}
              {activeTab === "users" && (
                <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 rounded-3xl p-8 max-w-5xl mx-auto w-full flex flex-col gap-6 shadow-xl relative overflow-hidden font-sans animate-fade-in">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-400" />
                        SaaS User Directory
                      </h3>
                      <p className="text-xs text-zinc-555 mt-1">Manage global user roles and assign administrative capabilities across client teams.</p>
                    </div>

                    <div className="relative max-w-xs w-full">
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchUserQuery}
                        onChange={(e) => setSearchUserQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-700"
                      />
                    </div>
                  </div>

                  <div className="border border-zinc-855 rounded-2xl bg-zinc-950/20 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-900 bg-zinc-950/50 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                            <th className="px-5 py-3.5">Name</th>
                            <th className="px-5 py-3.5">Email</th>
                            <th className="px-5 py-3.5">Company Team</th>
                            <th className="px-5 py-3.5">Joined At</th>
                            <th className="px-5 py-3.5">Global Role</th>
                            <th className="px-5 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900 text-xs text-zinc-300">
                          {users
                            .filter(u => 
                              u.name.toLowerCase().includes(searchUserQuery.toLowerCase()) || 
                              u.email.toLowerCase().includes(searchUserQuery.toLowerCase())
                            )
                            .map((user) => (
                              <tr key={user.id} className="hover:bg-zinc-900/10 transition">
                                <td className="px-5 py-3.5 font-semibold text-zinc-200">{user.name}</td>
                                <td className="px-5 py-3.5 font-mono text-zinc-400">{user.email}</td>
                                <td className="px-5 py-3.5">
                                  {user.teams && user.teams.length > 0 ? (
                                    <div className="flex flex-col gap-0.5">
                                      {user.teams.map((tm: any) => (
                                        <span key={tm.id} className="text-zinc-350">{tm.team.name} <span className="text-[10px] text-zinc-550">({tm.role})</span></span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-zinc-600 font-medium">No company linked</span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-zinc-555">{new Date(user.createdAt).toLocaleDateString()}</td>
                                <td className="px-5 py-3.5">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    user.role === 'SUPERADMIN' ? 'bg-purple-955/20 border border-purple-800/40 text-purple-400' :
                                    user.role === 'ADMIN' ? 'bg-sky-955/20 border border-sky-800/40 text-sky-400' :
                                    user.role === 'OWNER' ? 'bg-emerald-955/20 border border-emerald-800/40 text-emerald-400' :
                                    'bg-zinc-800 border border-zinc-700 text-zinc-400'
                                  }`}>
                                    {user.role}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  <select
                                    value={user.role}
                                    disabled={actionLoading === `${user.id}-updaterole`}
                                    onChange={(e) => handleUpdateUserRole(user.id, e.target.value as any)}
                                    className="px-2 py-1 text-[10px] font-bold uppercase rounded border border-zinc-800 bg-zinc-950 text-zinc-400 focus:outline-none focus:border-zinc-700"
                                  >
                                    <option value="DEVELOPER">Developer</option>
                                    <option value="ADMIN">Admin</option>
                                    <option value="OWNER">Owner</option>
                                    <option value="SUPERADMIN">Superadmin</option>
                                    <option value="VIEWER">Viewer</option>
                                  </select>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* LEGAL CONFIGURATION VIEW */}
              {activeTab === "configs" && (
                <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 rounded-3xl p-8 max-w-5xl mx-auto w-full flex flex-col gap-6 shadow-xl relative overflow-hidden font-sans animate-fade-in">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />

                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-400" />
                      Manage Legal Documents
                    </h3>
                    <p className="text-xs text-zinc-555 mt-1">Configure the Terms of Service and Privacy Policy text displayed publicly on the SaaS web application.</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-2">
                    {/* Terms of Service Box */}
                    <div className="border border-zinc-800 rounded-2xl p-6 bg-zinc-950/20 flex flex-col gap-4">
                      <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
                        <span className="text-xs text-zinc-350 font-bold uppercase tracking-wider">Terms of Service</span>
                        <span className="text-[10px] text-zinc-550 font-mono">Markdown supported</span>
                      </div>
                      
                      <textarea
                        rows={16}
                        value={termsText}
                        onChange={(e) => setTermsText(e.target.value)}
                        className="w-full p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 font-mono resize-y leading-relaxed"
                        placeholder="Type terms markdown here..."
                      />

                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          disabled={configsLoading}
                          onClick={() => handleUpdateConfig("terms", termsText)}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-lg text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-lg transition duration-150 disabled:opacity-50"
                        >
                          {configsLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          Publish Terms
                        </button>
                      </div>
                    </div>

                    {/* Privacy Policy Box */}
                    <div className="border border-zinc-805 rounded-2xl p-6 bg-zinc-950/20 flex flex-col gap-4">
                      <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
                        <span className="text-xs text-zinc-350 font-bold uppercase tracking-wider">Privacy Policy</span>
                        <span className="text-[10px] text-zinc-550 font-mono">Markdown supported</span>
                      </div>
                      
                      <textarea
                        rows={16}
                        value={privacyText}
                        onChange={(e) => setPrivacyText(e.target.value)}
                        className="w-full p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 font-mono resize-y leading-relaxed"
                        placeholder="Type privacy markdown here..."
                      />

                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          disabled={configsLoading}
                          onClick={() => handleUpdateConfig("privacy", privacyText)}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-lg text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-lg transition duration-150 disabled:opacity-50"
                        >
                          {configsLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          Publish Privacy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "manuals" && (
                <SDKsManualView />
              )}

              {/* SYSTEM STATS VIEW */}
              {activeTab === "stats" && (
                <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 rounded-3xl p-8 max-w-4xl mx-auto w-full flex flex-col gap-8 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                  
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <Database className="w-5 h-5 text-emerald-400" />
                      Platform Statistics Overview
                    </h3>
                    <p className="text-xs text-zinc-555 mt-1 leading-relaxed">Aggregated real-time metrics across all registered companies and projects.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Database Health Info */}
                    <div className="border border-zinc-800 rounded-2xl p-6 bg-zinc-950/20 flex flex-col gap-4">
                      <h4 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Workspace Summary</h4>
                      
                      <div className="flex flex-col gap-3.5 mt-2">
                        <div className="flex justify-between text-xs border-b border-zinc-900 pb-2">
                          <span className="text-zinc-500">Total Registered Companies</span>
                          <span className="font-mono text-zinc-200">{stats.totalCompanies}</span>
                        </div>
                        <div className="flex justify-between text-xs border-b border-zinc-900 pb-2">
                          <span className="text-zinc-500">Total Registered Projects</span>
                          <span className="font-mono text-zinc-200">{stats.totalProjects}</span>
                        </div>
                        <div className="flex justify-between text-xs border-b border-zinc-900 pb-2">
                          <span className="text-zinc-500">Active Ingestions</span>
                          <span className="font-mono text-emerald-400 font-bold">{stats.activeProjects}</span>
                        </div>
                        <div className="flex justify-between text-xs border-b border-zinc-900 pb-2">
                          <span className="text-zinc-500">Suspended Ingestions</span>
                          <span className="font-mono text-rose-400 font-bold">{stats.suspendedProjects}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">PostgreSQL SaaS Adapter</span>
                          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            ONLINE
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Telemetry aggregate info */}
                    <div className="border border-zinc-805 rounded-2xl p-6 bg-zinc-950/20 flex flex-col gap-4">
                      <h4 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Ingested Telemetry Events</h4>
                      
                      <div className="flex flex-col gap-3.5 mt-2">
                        <div className="flex justify-between text-xs border-b border-zinc-900 pb-2">
                          <span className="text-zinc-500">Uncaught Crashes</span>
                          <span className="font-mono text-rose-400 font-bold">{stats.totalCrashes}</span>
                        </div>
                        <div className="flex justify-between text-xs border-b border-zinc-900 pb-2">
                          <span className="text-zinc-500">UI Overflow Errors</span>
                          <span className="font-mono text-amber-400 font-bold">{stats.totalUIErrors}</span>
                        </div>
                        <div className="flex justify-between text-xs border-b border-zinc-900 pb-2">
                          <span className="text-zinc-500">HTTP API Network Calls</span>
                          <span className="font-mono text-sky-400 font-bold">{stats.totalAPIRequests}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">User Flow Journeys</span>
                          <span className="font-mono text-blue-400 font-bold">{stats.totalJourneys}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Database Maintenance and Pruning */}
                  <div className="border border-zinc-800 rounded-2xl p-6 bg-zinc-950/20 flex flex-col gap-5">
                    <div>
                      <h4 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Database Maintenance & Telemetry Pruning</h4>
                      <p className="text-[10px] text-zinc-500 mt-1">Safely prune historical logs (crashes, journeys, events, API calls) older than a specified number of days to keep database storage lightweight and efficient.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end gap-4">
                      <div className="flex flex-col gap-1.5 flex-1 max-w-xs">
                        <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Prune data older than (days)</label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={pruneDays}
                          onChange={(e) => setPruneDays(Number(e.target.value))}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700 font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handlePruneTelemetry}
                        disabled={pruning || pruneDays <= 0}
                        className="px-5 py-2.5 bg-gradient-to-r from-red-700 to-rose-600 hover:from-red-600 hover:to-rose-500 text-white rounded-xl text-xs font-bold tracking-wide flex items-center gap-2 shadow-lg shadow-red-950/30 hover:scale-[1.02] active:scale-[0.98] transition duration-150 disabled:opacity-50"
                      >
                        {pruning ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                        Prune Telemetry Logs
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </>
          )}

        </div>
      </div>
    </main>
  );
}

const sdkDocs = {
  "Flutter SDK": {
    language: "yaml",
    install: `# 📦 pubspec.yaml
dependencies:
  flutter:
    sdk: flutter

  # Option A: Local Plugin Dependency
  nirikshaka:
    path: ./nirikshaka_plugin

  # Option B: Single-file drop-in utility
  # No pubspec entry needed! Copy nirikshaka.dart to lib/

  # Required for HTTP tracking
  dio: ^5.4.0
  pretty_dio_logger: ^1.4.0`,
    init: `import 'package:flutter/material.dart';
import 'package:nirikshaka/nirikshaka.dart'; // Or relative path if Option B

// Init once. Track everything.
void main() {
  Nirikshaka.init(
    config: NirikshakaConfig(
      apiKey: 'eqk_live_YOUR_KEY',
      projectId: 'your-project-id',
      environment: Environment.production, // Or Environment.development
      apiUrl: 'http://localhost:3001/api', // MANDATORY for local/custom hosting
      enableScreenshotDetection: true,     // Detects system screenshots & auto-uploads
      enablePrettyDioLogger: true,         // Logs internal SDK uploads to console
    ),
    appRunner: () => runApp(const MyApp()),
  );
}

// Optional: Track screen transitions in the user journey dashboard
MaterialApp(
  navigatorObservers: [NirikshakaNavigatorObserver()],
);`,
    usage: `// ✅ Crashes & UI Errors — Tracked automatically
// Uncaught exceptions and RenderFlex layout overflows auto-captured

// ✅ Screenshot Capture — Tracked automatically
// Detects system screenshots, captures viewport, and uploads to dashboard

// ✅ Navigation — Tracked automatically via MaterialApp observer
// Screen transitions logged as timeline breadcrumbs

// ✅ HTTP Requests: Option 1 — Dio Interceptor (Recommended)
// Automatically track requests, statuses, payloads, and durations:
final dio = Dio();
dio.interceptors.add(NirikshakaDioInterceptor());
// Optional: Add pretty console logs:
dio.interceptors.add(PrettyDioLogger(requestHeader: true, requestBody: true));

// ✅ HTTP Requests: Option 2 — NirikshakaHttpClient (for http package)
final client = NirikshakaHttpClient();
final res = await client.get(Uri.parse('https://api.example.com/users'));

// ✅ Identify Users & Custom Events
Nirikshaka.setUser(
  userId: 'user_99201',
  name: 'John Doe',
  email: 'john@example.com',
);
Nirikshaka.trackJourneyEvent('button_tap', 'Upgrade Plan Button');`,
    highlight: "Zero-code crash, UI error, network, and screenshot tracking",
  },
  "Android SDK": {
    language: "gradle",
    install: `// build.gradle (app)
dependencies {
    implementation 'io.nirikshaka:android:2.0.0'
}`,
    init: `// Application.kt — One call, everything is auto-tracked
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        Nirikshaka.init(
            context = this,
            config = NirikshakaConfig(
                apiKey = "eqk_and_prod_YOUR_KEY",
                projectId = "your-project-id",
                environment = Environment.PRODUCTION,
                appVersion = BuildConfig.VERSION_NAME
            )
        )
        // ✅ Crashes, ANRs, network, lifecycle — all automatic
    }
}`,
    usage: `// ✅ Crashes & ANRs — Tracked automatically
// Thread.setDefaultUncaughtExceptionHandler is hooked

// ✅ Network — Use NirikshakaHttpInterceptor with OkHttp
val client = OkHttpClient.Builder()
    .addInterceptor(Nirikshaka.networkInterceptor())
    .build()

// ✅ Lifecycle — Tracked automatically
// App foreground/background transitions

// Optional: Manual tracking
Nirikshaka.trackCrash(throwable, context = mapOf("screen" to "Home"))
Nirikshaka.addBreadcrumb("user_completed_checkout")`,
    highlight: "Auto crash, ANR, network, and lifecycle tracking",
  },
  "iOS SDK": {
    language: "swift",
    install: `# Swift Package Manager
dependencies: [
    .package(url: "https://github.com/nirikshaka/ios-sdk", from: "2.0.0")
]

# Or CocoaPods
pod 'Nirikshaka', '~> 2.0'`,
    init: `// AppDelegate.swift — One call, everything is auto-tracked
import Nirikshaka

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions opts: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        Nirikshaka.start(
            apiKey: "eqk_ios_prod_YOUR_KEY",
            projectId: "your-project-id",
            environment: .production
        )
        // ✅ Crashes, network, lifecycle — all automatic
        return true
    }
}`,
    usage: `// ✅ Crashes — Tracked automatically
// NSException handler + signal handler installed

// ✅ Network — Auto-instrumented via URLSession swizzling
// All URLSession requests tracked automatically

// ✅ Lifecycle — Tracked automatically
// App state transitions logged as breadcrumbs

// Optional: Manual tracking
Nirikshaka.trackCrash(exception: error, context: ["screen": "Home"])
Nirikshaka.addBreadcrumb("user_opened_settings")`,
    highlight: "Auto crash, network, and lifecycle tracking",
  },
  "Web SDK": {
    language: "bash",
    install: `npm install @nirikshaka/sdk
# or
yarn add @nirikshaka/sdk`,
    init: `import { Nirikshaka } from '@nirikshaka/sdk';

// One call — crashes, errors, and network auto-tracked
Nirikshaka.init({
  apiKey: 'eqk_web_prod_YOUR_KEY',
  projectId: 'your-project-id',
  environment: 'production',
  version: '1.0.0',
});
// ✅ window.onerror + unhandledrejection hooked
// ✅ fetch/XHR intercepted for network tracking
// ✅ Performance metrics (LCP, FID, CLS) auto-captured`,
    usage: `// ✅ JS Errors — Tracked automatically
// window.onerror and unhandledrejection

// ✅ Network — Tracked automatically
// fetch() and XMLHttpRequest intercepted

// ✅ Performance — Tracked automatically
// Core Web Vitals (LCP, FID, CLS)

// Optional: Manual tracking
Nirikshaka.trackError(error, { component: 'CheckoutForm' });
Nirikshaka.addBreadcrumb('page_viewed', { path: '/checkout' });`,
    highlight: "Auto error, network, and performance tracking",
  },
} as const;

type SdkTab = keyof typeof sdkDocs;

const deepGuides = [
  {
    title: "Screenshot Detection Setup (Android & iOS)",
    icon: Camera,
    description: "Configure system screenshot detection permissions for automated dashboard uploads.",
    content: `To enable the SDK to automatically detect system screenshots, capture the current screen view, and upload it to the Nirikshaka dashboard, follow these platform setups.

**1. Enable in Flutter configuration:**
Ensure \`enableScreenshotDetection\` is set to true in your configuration:
\`\`\`dart
Nirikshaka.init(
  config: NirikshakaConfig(
    ...
    enableScreenshotDetection: true,
  ),
  appRunner: () => runApp(const MyApp()),
);
\`\`\`

**2. Android Configuration:**
Add the required permissions in your \`android/app/src/main/AndroidManifest.xml\` file. Depending on target Android versions, declare these permissions:
\`\`\`xml
<!-- For Android 12 and below (API <= 32) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />

<!-- For Android 13 (API 33) -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />

<!-- For Android 14+ (API 34+) -->
<uses-permission android:name="android.permission.DETECT_SCREEN_CAPTURE" />
\`\`\`

*Note: The SDK automatically requests the appropriate storage/photos permission at runtime when initializing on Android 13 and below, and uses the native ScreenCaptureCallback on Android 14+.*

**3. iOS Configuration:**
No plist or manifest permissions are required for iOS! The iOS SDK automatically hooks into \`UIApplication.userDidTakeScreenshotNotification\` to handle everything seamlessly.`
  },
  {
    title: "Local Wi-Fi Development Setup",
    icon: Terminal,
    description: "Connect your physical mobile device to a locally running Nirikshaka server on the same Wi-Fi.",
    content: `When running the Nirikshaka server locally and testing on a physical mobile device, **do not use localhost or 127.0.0.1** in the \`apiUrl\`. You must use your computer's local IP address.

**How to find your local IP:**
• **Mac/Linux:** Run \`ipconfig getifaddr en0\` or \`ifconfig | grep "inet "\`
• **Windows:** Run \`ipconfig\`

Set the \`apiUrl\` in \`NirikshakaConfig\` to:
\`\`\`dart
apiUrl: 'http://<YOUR_LOCAL_IP>:3001/api'
\`\`\``
  },
  {
    title: "Advanced Dio Network Interception",
    icon: Network,
    description: "Capture HTTP request/response payloads, status codes, and latency with Dio.",
    content: `Add \`NirikshakaDioInterceptor\` to auto-track network requests. You can also chain it with \`PrettyDioLogger\` to print beautiful log statements in your debug console.

\`\`\`dart
import 'package:dio/dio.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.react';
import 'package:nirikshaka/nirikshaka.dart';

final dio = Dio();

void setupDio() {
  // 1. Add NirikshakaDioInterceptor to log requests to dashboard
  dio.interceptors.add(NirikshakaDioInterceptor());

  // 2. Add console logger for localized debugging (optional)
  dio.interceptors.add(
    PrettyDioLogger(
      requestHeader: true,
      requestBody: true,
      responseBody: true,
      error: true,
      compact: true,
    ),
  );
}
\`\`\``
  },
  {
    title: "User Identity Integration",
    icon: UserCheck,
    description: "Tie anonymous user journeys and crashes to actual registered users.",
    content: `Call \`setUser\` after login to link the timeline events to a specific user. Call \`clearUser\` on logout.

\`\`\`dart
// Identify user
Nirikshaka.setUser(
  userId: 'user_99201', // Backend identifier
  name: 'John Doe',
  email: 'john@example.com',
  mobile: '+1234567890',
);

// Clear on logout
Nirikshaka.clearUser();
\`\`\``
  },
  {
    title: "Custom Journey Logging",
    icon: Activity,
    description: "Track custom touchpoints, button clicks, and funnel progress.",
    content: `Log custom events to see how users navigate critical funnels in your app:

\`\`\`dart
Nirikshaka.trackJourneyEvent(
  'button_tap',
  'Upgrade Plan Button',
  data: {
    'selected_plan': 'pro_annual',
    'price': 99.99,
  },
);
\`\`\``
  },
  {
    title: "Connectivity Diagnostics",
    icon: Wifi,
    description: "Verify that the mobile app is successfully communicating with the Nirikshaka server.",
    content: `Use the built-in test utility to diagnose network issues or incorrect IP configurations:

\`\`\`dart
final isConnected = await Nirikshaka.testConnection();
if (isConnected) {
  print('✅ Successfully connected to Nirikshaka server!');
} else {
  print('❌ Connection failed. Check server status and local IP.');
}
\`\`\``
  }
];

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2050);
  };

  return (
    <div className="relative group">
      <pre className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 overflow-x-auto text-xs font-mono text-zinc-350 leading-relaxed max-h-[350px]">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-850 opacity-0 group-hover:opacity-100 transition-opacity hover:border-emerald-500/50 hover:text-emerald-400"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-zinc-400" />
        )}
      </button>
    </div>
  );
}

function formatLine(line: string) {
  const parts = line.split("**");
  return parts.map((part, idx) => {
    if (idx % 2 === 1) {
      return <strong key={idx} className="text-zinc-100 font-semibold">{part}</strong>;
    }
    const codeParts = part.split("`");
    return codeParts.map((subPart, subIdx) => {
      if (subIdx % 2 === 1) {
        return <code key={subIdx} className="bg-zinc-900/60 border border-zinc-800/80 px-1.5 py-0.5 rounded text-[10px] text-emerald-400 font-mono">{subPart}</code>;
      }
      return subPart;
    });
  });
}

function renderGuideContent(content: string, codeBlockRenderer: (code: string, lang: string) => React.ReactNode) {
  const parts = content.split("```");
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      const lines = part.split("\n");
      const language = lines[0].trim();
      const code = lines.slice(1).join("\n").trim();
      return (
        <div key={index} className="my-2">
          {codeBlockRenderer(code, language)}
        </div>
      );
    }
    return (
      <div key={index} className="whitespace-pre-line text-xs text-zinc-400 leading-relaxed my-1 font-sans">
        {part.split("\n").map((line, lineIdx) => {
          if (line.trim().startsWith("• ")) {
            return (
              <li key={lineIdx} className="ml-4 list-disc my-1">
                {formatLine(line.substring(line.indexOf("• ") + 2))}
              </li>
            );
          }
          return <p key={lineIdx} className="my-1">{formatLine(line)}</p>;
        })}
      </div>
    );
  });
}

function SDKsManualView() {
  const [activeSdkTab, setActiveSdkTab] = useState<SdkTab>("Flutter SDK");
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null);
  const docs = sdkDocs[activeSdkTab];

  return (
    <div className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/60 rounded-3xl p-8 max-w-5xl mx-auto w-full flex flex-col gap-6 shadow-xl relative overflow-hidden font-sans animate-fade-in">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            SDK Integration Manuals
          </h3>
          <p className="text-xs text-zinc-500 mt-1">Select an SDK tab below to view installation, initialization, and usage guidelines.</p>
        </div>
        
        {/* Active Badge */}
        {docs.highlight && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            {docs.highlight}
          </div>
        )}
      </div>

      {/* Philosophy Banner */}
      <div className="border border-emerald-950/40 bg-emerald-950/10 rounded-2xl p-4 flex gap-3 items-start mt-1">
        <div className="h-7 w-7 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-xs font-bold text-zinc-200">SDK v2.0 — Autonomic Diagnostics</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Simply execute <code className="text-emerald-400 font-mono">init()</code> to capture uncaught crashes, layout errors, UI screenshots, Dio network requests, navigation transitions, and lifecycle events automatically.
          </p>
        </div>
      </div>

      {/* Platform Tabs Selector */}
      <div className="flex gap-1.5 p-1 bg-zinc-950/40 rounded-xl border border-zinc-800/60 w-fit mt-2">
        {(Object.keys(sdkDocs) as SdkTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveSdkTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition duration-150 ${
              activeSdkTab === tab
                ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md animate-fade-in"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* SDK Documentation Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        {/* 1. Installation */}
        <div className="border border-zinc-800 rounded-2xl p-5 bg-zinc-950/20 flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-900">
            <span className="h-5 w-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-bold flex items-center justify-center">1</span>
            <span className="text-xs text-zinc-300 font-bold uppercase tracking-wider">Installation</span>
          </div>
          <CodeBlock code={docs.install} language={docs.language} />
        </div>

        {/* 2. Initialization */}
        <div className="border border-zinc-800 rounded-2xl p-5 bg-zinc-950/20 flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-900">
            <span className="h-5 w-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-bold flex items-center justify-center">2</span>
            <span className="text-xs text-zinc-300 font-bold uppercase tracking-wider">Initialization</span>
          </div>
          <CodeBlock code={docs.init} language={docs.language} />
        </div>
      </div>

      {/* 3. Automatic features vs Manual calls */}
      <div className="border border-zinc-800 rounded-2xl p-5 bg-zinc-950/20 flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-900">
          <span className="h-5 w-5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-bold flex items-center justify-center">3</span>
          <span className="text-xs text-zinc-300 font-bold uppercase tracking-wider">Capabilities & Diagnostics</span>
        </div>
        <CodeBlock code={docs.usage} language={docs.language} />
      </div>

      {/* Deep Guides Accordion */}
      <div className="flex flex-col gap-4 mt-4">
        <div>
          <h4 className="text-xs text-zinc-300 font-bold uppercase tracking-wider">Deep Implementation Guides</h4>
          <p className="text-[10px] text-zinc-500 mt-1">Configure advanced platform hooks, system permissions, and local developer diagnostics.</p>
        </div>

        <div className="flex flex-col gap-2">
          {deepGuides.map((guide, idx) => {
            const Icon = guide.icon;
            const isExpanded = expandedGuide === idx;
            return (
              <div
                key={guide.title}
                className={`border rounded-xl transition duration-150 overflow-hidden ${
                  isExpanded 
                    ? "border-emerald-800/60 bg-emerald-950/5" 
                    : "border-zinc-800 bg-zinc-950/10 hover:border-zinc-700/60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedGuide(isExpanded ? null : idx)}
                  className="w-full flex items-center justify-between p-4 text-left focus:outline-none font-sans"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition duration-150 ${
                      isExpanded ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-900 text-zinc-400"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">{guide.title}</h4>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{guide.description}</p>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-150 ${
                    isExpanded ? "transform rotate-180 text-emerald-400" : ""
                  }`} />
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-zinc-900 text-xs text-zinc-400 space-y-3 leading-relaxed">
                    {renderGuideContent(guide.content, (code, lang) => (
                      <CodeBlock code={code} language={lang} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
