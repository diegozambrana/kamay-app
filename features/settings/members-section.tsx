"use client";

import { useState, useTransition } from "react";

import {
  archiveMembership,
  changeMemberRole,
  inviteMember,
  revokeInvitation,
  setMemberLines,
  type MemberActionResult,
} from "@/actions/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { cn } from "@/lib/utils";
import type { BusinessLine, Invitation, MemberRow, Role } from "@/types";

const ROLE_LABELS: Record<Role, string> = {
  owner: "Dueña o dueño",
  assistant: "Ayudante",
};

/**
 * Sección Usuarios y roles de V15. El enlace de invitación se muestra una sola
 * vez, al crearla: en la base solo queda su hash, así que no hay forma de
 * recuperarlo después — hay que revocar e invitar de nuevo.
 */
export function MembersSection({
  members,
  invitations,
  lines,
  assignedLines,
}: {
  members: MemberRow[];
  invitations: Invitation[];
  lines: BusinessLine[];
  /** `membershipId → líneas declaradas`. Ausente o vacío = todas. */
  assignedLines: Record<string, string[]>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = members.filter((member) => !member.archivedAt);
  const archived = members.filter((member) => member.archivedAt);

  function run(action: () => Promise<MemberActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  function onInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(null);
    setInviteUrl(null);

    startTransition(async () => {
      const result = await inviteMember({
        email: String(data.get("email") ?? ""),
        role: String(data.get("role") ?? "assistant") as Role,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      setInviteUrl(result.inviteUrl);
      form.reset();
    });
  }

  return (
    <section>
      <h2 className="text-lg font-medium">Usuarios y roles</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Quién entra a esta organización y con qué permisos.
      </p>

      <form onSubmit={onInvite} className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Correo</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            placeholder="ayudante@ejemplo.com"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Rol</Label>
          <select
            id="invite-role"
            name="role"
            defaultValue="assistant"
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="assistant">{ROLE_LABELS.assistant}</option>
            <option value="owner">{ROLE_LABELS.owner}</option>
          </select>
        </div>

        <Button type="submit" disabled={pending}>
          Invitar
        </Button>
      </form>

      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {inviteUrl && (
        <div
          role="status"
          data-testid="invite-url"
          className="mb-6 rounded-lg border bg-muted/40 p-3 text-sm"
        >
          <p className="mb-2 font-medium">
            Copia este enlace y envíaselo. No se vuelve a mostrar.
          </p>
          <code className="block break-all text-xs">{inviteUrl}</code>
        </div>
      )}

      <h3 className="mb-2 text-sm font-medium text-muted-foreground">Equipo</h3>
      <ul data-testid="member-list" className="divide-y rounded-lg border">
        {active.map((member) => (
          <li key={member.id} className="flex flex-col gap-2 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm">
                {member.displayName ?? "Sin nombre"}
              </span>

              <select
                aria-label={`Rol de ${member.displayName ?? "la persona"}`}
                value={member.role}
                disabled={pending}
                onChange={(event) =>
                  run(() =>
                    changeMemberRole({
                      membershipId: member.id,
                      role: event.target.value as Role,
                    }),
                  )
                }
                className="h-7 rounded-lg border bg-background px-2 text-xs"
              >
                <option value="assistant">{ROLE_LABELS.assistant}</option>
                <option value="owner">{ROLE_LABELS.owner}</option>
              </select>

              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run(() => archiveMembership({ membershipId: member.id }))}
              >
                Archivar
              </Button>
            </div>

            {/* Las líneas solo restringen a quien no es dueño: quien manda ve
                todo por definición (matriz de acceso §16). */}
            {member.role === "assistant" && (
              <LinePicker
                member={member}
                lines={lines}
                assigned={assignedLines[member.id] ?? []}
                disabled={pending}
                onChange={(businessLineIds) =>
                  run(() => setMemberLines({ membershipId: member.id, businessLineIds }))
                }
              />
            )}
          </li>
        ))}
      </ul>

      {invitations.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Invitaciones pendientes
          </h3>
          <ul data-testid="invitation-list" className="divide-y rounded-lg border">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center gap-2 px-3 py-2"
              >
                <span className="flex-1 text-sm">{invitation.email}</span>
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABELS[invitation.role]} · vence el{" "}
                  {new Date(invitation.expiresAt).toLocaleDateString("es-BO")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(() => revokeInvitation({ invitationId: invitation.id }))
                  }
                >
                  Revocar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Sin acceso
          </h3>
          <ul className="divide-y rounded-lg border border-dashed">
            {archived.map((member) => (
              <li key={member.id} className="px-3 py-2 text-sm text-muted-foreground">
                {member.displayName ?? "Sin nombre"} · {ROLE_LABELS[member.role]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * Las líneas que alcanza un ayudante.
 *
 * Ninguna marcada significa **todas**, no ninguna: la asignación es una
 * restricción que se declara, y su ausencia no restringe nada (KAM-15, design
 * D4). El texto lo dice en la pantalla, porque una fila de casillas vacías se
 * lee al revés con toda naturalidad.
 */
function LinePicker({
  member,
  lines,
  assigned,
  disabled,
  onChange,
}: {
  member: MemberRow;
  lines: BusinessLine[];
  assigned: string[];
  disabled: boolean;
  onChange: (businessLineIds: string[]) => void;
}) {
  const name = member.displayName ?? "la persona";
  const restricted = assigned.length > 0;

  function toggle(lineId: string, checked: boolean) {
    onChange(
      checked ? [...assigned, lineId] : assigned.filter((id) => id !== lineId),
    );
  }

  return (
    <div data-testid="line-picker" className="flex flex-wrap items-center gap-2 pl-1">
      <span className="text-xs text-muted-foreground">Líneas:</span>

      {lines.map((line) => {
        const checked = assigned.includes(line.id);
        return (
          <label
            key={line.id}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs",
              checked && "border-transparent",
              checked && lineColorClasses(line.color).badge,
            )}
          >
            <input
              type="checkbox"
              aria-label={`${line.name} para ${name}`}
              checked={checked}
              disabled={disabled}
              onChange={(event) => toggle(line.id, event.target.checked)}
              className="size-3"
            />
            {line.name}
          </label>
        );
      })}

      <span className="text-xs text-muted-foreground">
        {restricted
          ? "Solo ve las tareas de estas líneas, la compartida y las asignadas a esta persona."
          : "Sin ninguna marcada, ve las tareas de todas las líneas."}
      </span>
    </div>
  );
}
