"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { getRelativeTime } from "@/lib/utils";
import { UserPlus, Crown, Shield, Code2, Eye } from "lucide-react";
import { toast } from "sonner";
import { getTeamMembers } from "../actions";
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

  useEffect(() => {
    getTeamMembers().then(data => {
      setMembers(data as any);
      setIsLoading(false);
    });
  }, []);

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
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => toast.success("Invite sent!")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black font-semibold text-sm"
        >
          <UserPlus className="h-4 w-4" />
          Invite Member
        </motion.button>
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
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
