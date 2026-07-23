"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { inviteTeamMember } from "./actions";

const ROLES = [
  { value: "DEVELOPER", label: "Developer" },
  { value: "ADMIN", label: "Admin" },
  { value: "VIEWER", label: "Viewer" },
] as const;

export function InviteDialog({ onInvited }: { onInvited: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "DEVELOPER" | "VIEWER">("DEVELOPER");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await inviteTeamMember({ email, name, role });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Invitation sent");
        setOpen(false);
        setEmail("");
        setName("");
        setRole("DEVELOPER");
        onInvited();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black font-semibold text-sm hover:opacity-90">
          <UserPlus className="h-4 w-4" />
          Invite Member
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md glass rounded-2xl p-6 space-y-4 bg-background border border-border">
          <Dialog.Title className="font-semibold text-lg">Invite a team member</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            They&apos;ll get an email to set their password and land in this workspace.
          </Dialog.Description>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-card">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={submit}
              disabled={busy || !email.trim() || !name.trim()}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-brand text-black disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send invite"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
