"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Key, Copy, RefreshCw, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import { getApiKeys } from "../actions";
import { Badge } from "@/components/ui/badge";
import { getRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function APIKeysPage() {
  const [search, setSearch] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [keys, setKeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getApiKeys().then((data) => {
      setKeys(data as any);
      setIsLoading(false);
    });
  }, []);

  const filtered = keys.filter(k => k.name.toLowerCase().includes(search.toLowerCase()));

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("API key copied to clipboard!");
  };

  const maskKey = (key: string) => {
    const prefix = key.substring(0, 12);
    const suffix = key.substring(key.length - 4);
    return `${prefix}${"•".repeat(20)}${suffix}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage SDK authentication keys
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => toast.success("New API key generated!", { description: "Key has been added to your project." })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black font-semibold text-sm hover:bg-brand/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Generate Key
        </motion.button>
      </motion.div>

      {/* Keys */}
      <div className="space-y-3">
        {filtered.map((apiKey, i) => (
          <motion.div
            key={apiKey.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={cn(
              "card-premium p-5",
              apiKey.status === "revoked" && "opacity-60"
            )}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Icon + Info */}
              <div className="flex items-start gap-4 flex-1">
                <div className={cn(
                  "p-2.5 rounded-xl border flex-shrink-0",
                  apiKey.status === "active"
                    ? "bg-brand/10 border-brand/20"
                    : "bg-muted/50 border-border"
                )}>
                  <Key className={cn("h-5 w-5", apiKey.status === "active" ? "text-brand" : "text-muted-foreground")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{apiKey.name}</h3>
                    <Badge variant={apiKey.status === "ACTIVE" ? "success" : "error"}>
                      {apiKey.status}
                    </Badge>
                    <Badge variant="default">{apiKey.project?.platform || "WEB"}</Badge>
                  </div>

                  {/* Key Display */}
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-border mb-3">
                    <code className="text-xs font-mono text-muted-foreground flex-1 truncate">
                      {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                    </code>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleVisibility(apiKey.id)}
                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {visibleKeys.has(apiKey.id) ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => copyKey(apiKey.key)}
                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-brand"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                    <span>Project: <span className="text-foreground">{apiKey.project?.name || "Unknown"}</span></span>
                    <span>Requests: <span className="text-foreground font-medium">{(apiKey._count?.apiRequests || 0).toLocaleString()}</span></span>
                    <span>Last used: <span className="text-foreground">{getRelativeTime(apiKey.lastUsed)}</span></span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-shrink-0">
                {apiKey.status === "active" && (
                  <>
                    <button
                      onClick={() => toast.success("Key regenerated!")}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:border-brand/50 hover:text-brand transition-all"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Regenerate
                    </button>
                    <button
                      onClick={() => toast.error("Key revoked")}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                      Revoke
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* SDK Usage */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card-premium p-5"
      >
        <h3 className="font-semibold text-foreground mb-4">Quick SDK Setup</h3>
        <div className="bg-muted/30 rounded-xl p-4 border border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">JavaScript / TypeScript</p>
          <pre className="text-sm font-mono text-brand overflow-x-auto">
{`import { Nirikshaka } from '@nirikshaka/sdk';

Nirikshaka.init({
  apiKey: 'eqk_web_prod_8Kx9mN2p...',
  project: 'your-project-id',
  environment: 'production',
});`}
          </pre>
        </div>
      </motion.div>
    </div>
  );
}
