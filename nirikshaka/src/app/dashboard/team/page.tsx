"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { getRelativeTime } from "@/lib/utils";
import { Crown, Shield, Code2, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { getTeamMembers } from "../actions";
import { removeTeamMember } from "./actions";
import { InviteDialog } from "./invite-dialog";
import type { TeamMember } from "@prisma/client";

const roleConfig: Record<string, { label: string; icon: any; color: "brand" | "info" | "success" | "default" }> = {
  owner: { label: "Owner", icon: Crown, color: "brand" },
  admin: { label: "Admin", icon: Shield, color: "info" },
  developer: { label: "Developer", icon: Code2, color: "success" },
  viewer: { label: "Viewer", icon: Eye, color: "default" },
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    getTeamMembers().then(data => {
      setMembers(data as any);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Remove ${memberName} from the team?`)) return;
    const result = await removeTeamMember(memberId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.success ?? "Member removed");
      load();
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage team members and permissions</p>
        </div>
        <InviteDialog onInvited={load} />
      </motion.div>

      <div className="card-premium overflow-hidden">
        <div className="divide-y divide-border">
          {members.length === 0 && !isLoading && (
            <div className="p-8 text-center text-muted-foreground">No team members found</div>
          )}
          {members.map((member: any, i) => {
            const role = roleConfig[member.role.toLowerCase()] || roleConfig.viewer;
            const RoleIcon = role.icon;
            
            // Generate initials for avatar
            const initials = member.user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2) || "U";
            
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center justify-between p-5 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center font-bold text-brand text-sm">
                    {initials}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{member.user?.name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{member.user?.email || "No email"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground">Joined</p>
                    <p className="text-xs font-medium">{getRelativeTime(member.joinedAt)}</p>
                  </div>
                  <Badge variant={role.color}>
                    <RoleIcon className="h-3 w-3" />
                    {role.label}
                  </Badge>
                  {member.role !== "OWNER" && (
                    <button
                      onClick={() => handleRemove(member.id, member.user?.name || member.user?.email || "this member")}
                      className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/50"
                      aria-label="Remove member"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
