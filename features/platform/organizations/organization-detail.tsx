"use client";

import { UserCheckIcon, UserMinusIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  archiveMembership,
  restoreMembership,
  setMembershipRole,
  updateOrganization,
  type PlatformActionResult,
} from "@/actions/platform";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlatformUser } from "@/lib/platform/users";
import type { OrganizationSummary } from "@/services/platform/organization-admin-service";
import type { Role } from "@/types";

import { ROLE_LABELS } from "../roles";
import { AddUserDialog } from "../users/add-user-dialog";

/** Una persona del equipo, con su correo: lo que *Usuarios y roles* no puede mostrar. */
type TeamMember = {
  userId: string;
  email: string;
  membershipId: string;
  displayName: string | null;
  role: Role;
  archivedAt: string | null;
};

export function teamOf(organizationId: string, users: PlatformUser[]): TeamMember[] {
  return users
    .flatMap((user) =>
      user.memberships
        .filter((m) => m.organizationId === organizationId)
        .map((m) => ({
          userId: user.id,
          email: user.email,
          membershipId: m.membershipId,
          displayName: m.displayName,
          role: m.role,
          archivedAt: m.archivedAt,
        })),
    )
    // Primero quien tiene acceso; después, quien lo perdió.
    .sort((a, b) => Number(Boolean(a.archivedAt)) - Number(Boolean(b.archivedAt)));
}

const selectClass = "h-8 rounded-lg border bg-background px-2 text-sm";

/**
 * Detalle de una organización desde la plataforma (KAM-26): sus datos y su
 * equipo con correo, en una tabla. «Agregar usuario» abre el mismo diálogo
 * que en *Usuarios*, con esta organización ya elegida. Todo lo que se hace
 * aquí queda en la bitácora de la organización marcado como del
 * administrador de la plataforma.
 */
export function OrganizationDetail({
  organization,
  members,
}: {
  organization: OrganizationSummary;
  /** Las cuentas con membresía (activa o archivada) en esta organización. */
  members: PlatformUser[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const team = useMemo(() => teamOf(organization.id, members), [organization.id, members]);
  const hasOwner = team.some((m) => !m.archivedAt && m.role === "owner");

  function run(action: () => Promise<PlatformActionResult>, done?: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
      else if (done) setNotice(done);
    });
  }

  function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run(
      () =>
        updateOrganization({
          organizationId: organization.id,
          name: String(data.get("name") ?? ""),
          currency: String(data.get("currency") ?? ""),
          timezone: String(data.get("timezone") ?? ""),
        }),
      "Cambios guardados.",
    );
  }

  const target = (member: TeamMember) => ({
    organizationId: organization.id,
    membershipId: member.membershipId,
  });

  const columns: DataTableColumn<TeamMember>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (member) => member.displayName ?? <span className="text-muted-foreground">Sin nombre</span>,
    },
    {
      key: "email",
      header: "Correo",
      cell: (member) => <span className="break-all">{member.email}</span>,
    },
    {
      key: "role",
      header: "Rol",
      className: "w-44",
      cell: (member) =>
        member.archivedAt ? (
          ROLE_LABELS[member.role]
        ) : (
          <select
            aria-label={`Rol de ${member.email}`}
            value={member.role}
            disabled={pending}
            onChange={(event) =>
              run(() => setMembershipRole({ ...target(member), role: event.target.value as Role }))
            }
            className={selectClass}
          >
            <option value="assistant">{ROLE_LABELS.assistant}</option>
            <option value="owner">{ROLE_LABELS.owner}</option>
          </select>
        ),
    },
    {
      key: "access",
      header: "Acceso",
      className: "w-28",
      cell: (member) =>
        member.archivedAt ? (
          <Badge variant="outline">Sin acceso</Badge>
        ) : (
          <Badge variant="secondary">Activo</Badge>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-8 md:max-w-4xl">
      <section aria-labelledby="organization-data">
        <h2 id="organization-data" className="text-lg font-medium">
          Datos
        </h2>
        <form onSubmit={onSave} className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="detail-name">Nombre</Label>
            <Input id="detail-name" name="name" defaultValue={organization.name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-currency">Moneda</Label>
            <Input
              id="detail-currency"
              name="currency"
              defaultValue={organization.currency}
              maxLength={3}
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="detail-timezone">Zona horaria</Label>
            <Input
              id="detail-timezone"
              name="timezone"
              defaultValue={organization.timezone}
              required
            />
          </div>
          <div>
            <Button type="submit" disabled={pending}>
              Guardar
            </Button>
          </div>
        </form>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <section aria-labelledby="organization-team" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="organization-team" className="text-lg font-medium">
            Equipo
          </h2>
          {/* Sin dueño activo, lo primero que le falta es su dueña. */}
          <AddUserDialog
            organization={{ id: organization.id, name: organization.name }}
            defaultRole={hasOwner ? "assistant" : "owner"}
          />
        </div>

        <DataTable
          rows={team}
          columns={columns}
          getRowKey={(member) => member.membershipId}
          caption={`Equipo de ${organization.name}`}
          testId="platform-member-list"
          rowTestId="platform-member"
          rowActionsLabel={(member) => `Acciones de ${member.email}`}
          rowActions={(member) =>
            member.archivedAt
              ? [
                  {
                    label: "Devolver acceso",
                    icon: UserCheckIcon,
                    onSelect: () => run(() => restoreMembership(target(member))),
                  },
                ]
              : [
                  {
                    label: "Quitar acceso",
                    icon: UserMinusIcon,
                    destructive: true,
                    onSelect: () => run(() => archiveMembership(target(member))),
                  },
                ]
          }
          empty={
            <p className="text-sm text-muted-foreground">
              Todavía no tiene a nadie. Usa «Agregar usuario».
            </p>
          }
        />
      </section>
    </div>
  );
}
