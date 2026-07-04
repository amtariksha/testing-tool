"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { Feature } from "../types";

interface FeatureEditDialogProps {
  feature: Feature;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: {
    name?: string;
    roles?: string[];
    screens?: string[];
    apis?: string[];
    states?: string[];
  }) => void;
}

function toList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function FeatureEditDialog({ feature, open, onOpenChange, onSave }: FeatureEditDialogProps) {
  const [name, setName] = useState(feature.name);
  const [roles, setRoles] = useState(feature.roles.join(", "));
  const [screens, setScreens] = useState(feature.screens.join(", "));
  const [apis, setApis] = useState(feature.apis.join(", "));
  const [states, setStates] = useState(feature.states.join(", "));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 space-y-3">
          <Dialog.Title className="font-semibold">Edit feature</Dialog.Title>
          <Dialog.Description className="text-xs text-muted-foreground">
            Corrections are saved into the model and marked as human-edited. Lists are
            comma-separated.
          </Dialog.Description>
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Roles" value={roles} onChange={setRoles} />
          <Field label="Screens" value={screens} onChange={setScreens} />
          <Field label="APIs" value={apis} onChange={setApis} />
          <Field label="States" value={states} onChange={setStates} />
          <div className="flex justify-end gap-2 pt-2">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-card">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={() => {
                onSave({
                  name: name.trim() || undefined,
                  roles: toList(roles),
                  screens: toList(screens),
                  apis: toList(apis),
                  states: toList(states),
                });
                onOpenChange(false);
              }}
              className="px-4 py-2 text-sm font-semibold rounded-xl brand-gradient text-black hover:opacity-90"
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
      />
    </label>
  );
}
