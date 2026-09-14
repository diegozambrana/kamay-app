"use client";

import { UserPlusIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { addUserToOrganization, type AddUserResult } from "@/actions/platform";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrganizationOption } from "@/services/platform/platform-service";
import type { Role } from "@/types";

import { ROLE_LABELS } from "../roles";

const selectClass = "h-8 w-full rounded-lg border bg-background px-2 text-sm";

type Outcome = Exclude<AddUserResult, { error: string }>;

function describe(outcome: Outcome, organizationName: string): string {
  switch (outcome.kind) {
    case "created":
      return `${outcome.email} ya es parte de ${organizationName}.`;
    case "restored":
      return `${outcome.email} vuelve a tener acceso a ${organizationName}.`;
    case "already_member":
      return `${outcome.email} ya pertenecía a ${organizationName}; no se cambió nada.`;
    case "invited":
      return `${outcome.email} todavía no tiene cuenta: se creó una invitación a ${organizationName}.`;
  }
}

/**
 * «Agregar usuario» (KAM-26): correo, organización y rol. Si la cuenta
 * existe se la agrega; si no, se la invita y el enlace se muestra una sola
 * vez (spec `platform-administration` → *A platform admin adds a user to an
 * organization from the platform views*).
 *
 * Desde *Usuarios* se elige la organización; desde el detalle de una, viene
 * dada (`organization`) y no se puede cambiar.
 */
export function AddUserDialog({
  organizations = [],
  organization,
  defaultRole = "assistant",
}: {
  /** Las organizaciones que se ofrecen (con tope), cuando se elige. */
  organizations?: OrganizationOption[];
  /** La organización fija, cuando se abre desde su detalle. */
  organization?: OrganizationOption;
  defaultRole?: Role;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ result: Outcome; organizationName: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function reset() {
    setError(null);
    setOutcome(null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const organizationId = organization?.id ?? String(data.get("organizationId") ?? "");
    const organizationName =
      organization?.name ?? organizations.find((o) => o.id === organizationId)?.name ?? "";
    reset();

    if (!organizationId) {
      setError("Elige una organización");
      return;
    }

    startTransition(async () => {
      const result = await addUserToOrganization({
        organizationId,
        email: String(data.get("email") ?? ""),
        role: String(data.get("role") ?? defaultRole) as Role,
        displayName: String(data.get("displayName") ?? ""),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOutcome({ result, organizationName });
      if (result.kind !== "already_member") form.reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon aria-hidden />
          Agregar usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar usuario</DialogTitle>
          <DialogDescription>
            Si la cuenta ya existe, entra a la organización con el rol elegido. Si no, se
            crea una invitación y el enlace se muestra una sola vez.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-user-email">Correo</Label>
            <Input id="add-user-email" name="email" type="email" autoComplete="off" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-user-organization">Organización</Label>
            {organization ? (
              <p id="add-user-organization" className="text-sm font-medium">
                {organization.name}
              </p>
            ) : (
              <select
                id="add-user-organization"
                name="organizationId"
                defaultValue=""
                className={selectClass}
                required
              >
                <option value="" disabled>
                  Elige una organización
                </option>
                {organizations.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-user-role">Rol</Label>
              <select
                id="add-user-role"
                name="role"
                defaultValue={defaultRole}
                className={selectClass}
              >
                <option value="assistant">{ROLE_LABELS.assistant}</option>
                <option value="owner">{ROLE_LABELS.owner}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-user-name">Nombre visible</Label>
              <Input id="add-user-name" name="displayName" placeholder="Opcional" />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {outcome && (
            <div role="status" data-testid="add-user-result" className="space-y-2 text-sm">
              <p>{describe(outcome.result, outcome.organizationName)}</p>
              {outcome.result.kind === "invited" && (
                <div data-testid="invite-url" className="rounded-lg border bg-muted/40 p-3">
                  <p className="mb-2 font-medium">
                    Copia este enlace y envíaselo. No se vuelve a mostrar.
                  </p>
                  <code className="block break-all text-xs">{outcome.result.inviteUrl}</code>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              Agregar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
