"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Globe, Smartphone, Apple, Cpu, Code2, Search, X, FolderOpen } from "lucide-react";
import { getProjects, createProject } from "../actions";
import type { Project } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const platformConfig = {
  WEB: { icon: Globe, color: "text-blue-400", bg: "bg-blue-500/10", label: "Web" },
  ANDROID: { icon: Smartphone, color: "text-green-400", bg: "bg-green-500/10", label: "Android" },
  IOS: { icon: Apple, color: "text-gray-400", bg: "bg-gray-500/10", label: "iOS" },
  FLUTTER: { icon: Cpu, color: "text-cyan-400", bg: "bg-cyan-500/10", label: "Flutter" },
  REACT_NATIVE: { icon: Code2, color: "text-purple-400", bg: "bg-purple-500/10", label: "React Native" },
};

const envConfig = {
  PRODUCTION: "bg-green-500/10 text-green-400 border-green-500/20",
  STAGING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  DEVELOPMENT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export default function ProjectsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    packageName: "",
    platform: "WEB",
    environment: "DEVELOPMENT",
  });

  const loadProjects = () => {
    getProjects().then((data) => {
      setProjects(data as any);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    
    try {
      const result = await createProject(formData);
      if (result.success) {
        toast.success("Project created successfully!");
        setIsModalOpen(false);
        setFormData({ name: "", packageName: "", platform: "WEB", environment: "DEVELOPMENT" });
        loadProjects(); // Refresh the list
      } else {
        toast.error(result.error || "Failed to create project");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.packageName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your monitored applications
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black font-semibold text-sm hover:bg-brand/90 transition-colors brand-glow-sm"
        >
          <Plus className="h-4 w-4" />
          New Project
        </motion.button>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 h-9 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-colors"
        />
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-10">
            <p className="text-muted-foreground animate-pulse">Loading projects...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">No projects found</h3>
            <p className="text-sm text-muted-foreground mb-4">Get started by creating your first project.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-brand/10 text-brand font-medium text-sm hover:bg-brand/20 transition-colors"
            >
              Create Project
            </button>
          </div>
        ) : filtered.map((project, i) => {
          const platform = platformConfig[project.platform as keyof typeof platformConfig] || platformConfig.WEB;
          const PlatformIcon = platform.icon;

          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="card-premium p-5 cursor-pointer"
              onClick={() => {
                router.push(`/dashboard/projects/${project.id}`);
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-xl border border-border", platform.bg)}>
                    <PlatformIcon className={cn("h-5 w-5", platform.color)} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{project.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{project.packageName}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full border",
                      envConfig[project.environment as keyof typeof envConfig] || envConfig.DEVELOPMENT
                    )}
                  >
                    {project.environment}
                  </span>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      project.status === "ACTIVE" ? "bg-green-400 shadow-[0_0_6px_#22c55e]" : "bg-gray-400"
                    )}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-muted/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Requests</p>
                  <p className="font-semibold text-foreground">{((project as any).requestCount || 0).toLocaleString()}</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Errors</p>
                  <p className={cn("font-semibold", (project as any).errorCount > 100 ? "text-red-400" : "text-foreground")}>
                    {(project as any).errorCount || 0}
                  </p>
                </div>
              </div>

              {/* Credentials */}
              <div className="space-y-2">
                {/* Project ID */}
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/30 border border-border">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-0.5">Project ID</span>
                    <code className="text-xs text-foreground font-mono truncate">
                      {project.id}
                    </code>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(project.id);
                      toast.success("Project ID copied!");
                    }}
                    className="text-xs text-brand hover:underline flex-shrink-0"
                  >
                    Copy
                  </button>
                </div>

                {/* API Key */}
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/30 border border-border">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-0.5">API Key</span>
                    <code className="text-xs text-foreground font-mono truncate">
                      {((project as any).apiKeys?.[0]?.key || "generate-new-key").substring(0, 28)}...
                    </code>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText((project as any).apiKeys?.[0]?.key || "");
                      toast.success("API key copied!");
                    }}
                    className="text-xs text-brand hover:underline flex-shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Create Project Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-bold text-foreground">Create New Project</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <form onSubmit={handleCreate} className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Project Name
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Acme Mobile App"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Package / Bundle ID
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. com.acme.app"
                    value={formData.packageName}
                    onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Platform
                    </label>
                    <select
                      value={formData.platform}
                      onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-colors appearance-none"
                    >
                      <option value="WEB">Web</option>
                      <option value="ANDROID">Android</option>
                      <option value="IOS">iOS</option>
                      <option value="FLUTTER">Flutter</option>
                      <option value="REACT_NATIVE">React Native</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Environment
                    </label>
                    <select
                      value={formData.environment}
                      onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-brand/50 transition-colors appearance-none"
                    >
                      <option value="DEVELOPMENT">Development</option>
                      <option value="STAGING">Staging</option>
                      <option value="PRODUCTION">Production</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 rounded-xl border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 px-4 py-2 rounded-xl bg-brand text-black font-semibold text-sm hover:bg-brand/90 transition-colors disabled:opacity-50"
                  >
                    {isCreating ? "Creating..." : "Create Project"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
