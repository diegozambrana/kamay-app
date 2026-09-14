"use client";

import { useState, useTransition } from "react";

import {
  archiveMembership,
  assignMemberships,
  restoreMembership,
  setMembershipDisplayName,
  setMembershipRole,
  type PlatformActionResult,
} from "@/actions/platform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLATFORM_ADMIN_LABEL } from "@/lib/platform/labels";
import {
  type PlatformMembership,
  type PlatformUser,
  activeMemberships,
  defaultDisplayName,
  matchesName,
} from "@/lib/platform/users";
import type { AssignmentOutcome } from "@/services/platform/membership-admin-service";
import type { OrganizationOption } from "@/services/platform/platform-service";
import type { Role } from "@/types";

import { ROLE_LABELS } from "../roles";

const selectClass = "h-8 rounded-lg border bg-background px-2 text-sm";

const OUTCOME_TEXT: Record<AssignmentOutcome["status"], string> = {
  created: "agregada",
  restored: "acceso devuelto",
  already_member: "ya pertenecía",
  failed: "no se pudo agregar",
};

/**
 * Detalle de una cuenta desde la plataforma (KAM-26): asignarla a una o
 * varias organizaciones de una vez y ajustar cada membresía. El correo y la
 * condición de super admin son de solo lectura, y no hay control de
 * contraseña: esas cosas no se cambian desde aquí (la condición de super
 * admin, solo el operador).
 */
export function UserDetail({
  user,
  organizations,
  moreOrganizations = false,
}: {
  user: PlatformUser;
  /** Organizaciones vivas, con tope: de aquí se eligen las nuevas. */
  organizations: OrganizationOption[];
  /** Hay más organizaciones que las del tope. */
  moreOrganizations?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [chosen, setChosen] = useState<Record<string, Role>>({});
  const [displayName, setDisplayName] = useState(() => defaultDisplayName(user));
  const [filter, setFilter] = useState("");

  const nameById = new Map(organizations.map((o) => [o.id, o.name]));
  const current = new Set(activeMemberships(user).map((m) => m.organizationId));
  const assignable = organizations.filter((o) => !current.has(o.id));
  // Lo elegido no desaparece al cambiar el filtro.
  const available = assignable.filter((o) => o.id in chosen || matchesName(o.name, filter));

  function run(action: () => Promise<PlatformActionResult>) {
    setError(null);
    setReport(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  function toggle(organizationId: string, checked: boolean) {
    setChosen((previous) => {
      const next = { ...previous };
      if (checked) next[organizationId] = "assistant";
      else delete next[organizationId];
      return next;
    });
  }

  function onAssign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const assignments = Object.entries(chosen).map(([organizationId, role]) => ({
      organizationId,
      role,
      displayName,
    }));
    setError(null);
    setReport(null);
    startTransition(async () => {
      const result = await assignMemberships({ userId: user.id, assignments });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setReport(
        result.outcomes
          .map((o) => `${nameById.get(o.organizationId) ?? "Organización"}: ${OUTCOME_TEXT[o.status]}`)
          .join(" · "),
      );
      setChosen({});
    });
  }

  return (
    <div className="flex flex-col gap-8 md:max-w-3xl">
      <section aria-labelledby="account-data" className="flex flex-col gap-2">
        <h2 id="account-data" className="text-lg font-medium">
          Cuenta
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Correo</span>
          <span data-testid="user-email" className="break-all">
            {user.email}
          </span>
          {/* Solo lectura, a propósito: ninguna pantalla concede ni retira
              la condición de super admin (spec *No screen offers the grant*). */}
          {user.platformAdmin && (
            <Badge data-testid="platform-admin-badge" variant="secondary">
              {PLATFORM_ADMIN_LABEL}
            </Badge>
          )}
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {report && !error && (
        <p role="status" data-testid="assignment-report" className="text-sm text-muted-foreground">
          {report}
        </p>
      )}

      <section aria-labelledby="account-memberships">
        <h2 id="account-memberships" className="text-lg font-medium">
          Organizaciones
        </h2>
        {user.memberships.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No pertenece a ninguna organización.</p>
        ) : (
          <ul data-testid="user-memberships" className="mt-3 divide-y rounded-lg border">
            {user.memberships.map((membership) => (
              <MembershipRow
                key={membership.membershipId}
                membership={membership}
                pending={pending}
                run={run}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="account-assign">
        <h2 id="account-assign" className="text-lg font-medium">
          Asignar organizaciones
        </h2>
        {assignable.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Ya pertenece a todas las organizaciones.</p>
        ) : (
          <form onSubmit={onAssign} className="mt-3 flex flex-col gap-3">
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filtrar organizaciones"
              aria-label="Filtrar organizaciones"
              className="max-w-xs"
            />
            {moreOrganizations && (
              <p className="text-xs text-muted-foreground">
                Hay más organizaciones de las que se muestran aquí; la que falte se
                asigna desde su detalle en Organizaciones.
              </p>
            )}
            <ul className="divide-y rounded-lg border">
              {available.map((organization) => {
                const checked = organization.id in chosen;
                return (
                  <li key={organization.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <Checkbox
                      id={`assign-${organization.id}`}
                      checked={checked}
                      onCheckedChange={(value) => toggle(organization.id, value === true)}
                    />
                    <Label htmlFor={`assign-${organization.id}`} className="flex-1">
                      {organization.name}
                    </Label>
                    {checked && (
                      <select
                        aria-label={`Rol en ${organization.name}`}
                        value={chosen[organization.id]}
                        onChange={(event) =>
                          setChosen((previous) => ({
                            ...previous,
                            [organization.id]: event.target.value as Role,
                          }))
                        }
                        className={selectClass}
                      >
                        <option value="assistant">{ROLE_LABELS.assistant}</option>
                        <option value="owner">{ROLE_LABELS.owner}</option>
                      </select>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="assign-name">Nombre visible</Label>
                <Input
                  id="assign-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={pending || Object.keys(chosen).length === 0}>
                Asignar
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function MembershipRow({
  membership,
  pending,
  run,
}: {
  membership: PlatformMembership;
  pending: boolean;
  run: (action: () => Promise<PlatformActionResult>) => void;
}) {
  const target = {
    organizationId: membership.organizationId,
    membershipId: membership.membershipId,
  };
  const [name, setName] = useState(membership.displayName ?? "");

  return (
    <li data-testid="user-membership" className="flex flex-col gap-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 font-medium">{membership.organizationName}</span>
        {membership.archivedAt ? (
          <>
            <Badge variant="outline">Sin acceso</Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => restoreMembership(target))}
            >
              Devolver acceso
            </Button>
          </>
        ) : (
          <>
            <select
              aria-label={`Rol en ${membership.organizationName}`}
              value={membership.role}
              disabled={pending}
              onChange={(event) =>
                run(() => setMembershipRole({ ...target, role: event.target.value as Role }))
              }
              className={selectClass}
            >
              <option value="assistant">{ROLE_LABELS.assistant}</option>
              <option value="owner">{ROLE_LABELS.owner}</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => run(() => archiveMembership(target))}
            >
              Quitar acceso
            </Button>
          </>
        )}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => setMembershipDisplayName({ ...target, displayName: name }));
        }}
      >
        <div className="space-y-1">
          <Label htmlFor={`name-${membership.membershipId}`} className="text-xs text-muted-foreground">
            Nombre visible en {membership.organizationName}
          </Label>
          <Input
            id={`name-${membership.membershipId}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-8"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          Guardar nombre
        </Button>
      </form>
    </li>
  );
}
