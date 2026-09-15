"use client";

import { BanIcon, PencilIcon, UserMinusIcon } from "lucide-react";

import { archiveMembership, revokeInvitation } from "@/actions/members";
import { useConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { useEntityDialog } from "@/components/shared/form-dialog";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/features/platform/roles";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { cn } from "@/lib/utils";
import type { BusinessLine, Invitation, MemberRow } from "@/types";

import { InviteDialog } from "./members/invite-dialog";
import { MemberDialog, memberName } from "./members/member-dialog";
import { SectionHeader } from "./section-header";

/**
 * Sección Usuarios y roles de V15, con el patrón del resto de la
 * configuración (spec `settings-interaction`): tres tablas —equipo,
 * invitaciones pendientes y sin acceso—, invitar y editar en un diálogo, y
 * quitar el acceso o revocar con confirmación.
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
  const edit = useEntityDialog<MemberRow>();
  const { ask, dialog } = useConfirmDialog();

  const active = members.filter((member) => !member.archivedAt);
  const archived = members.filter((member) => member.archivedAt);

  const roleColumn: DataTableColumn<MemberRow> = {
    key: "role",
    header: "Rol",
    className: "w-36",
    cell: (member) => <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>,
  };

  const nameColumn: DataTableColumn<MemberRow> = {
    key: "name",
    header: "Nombre",
    cell: (member) =>
      member.displayName ? (
        <span className="font-medium">{member.displayName}</span>
      ) : (
        <span className="text-muted-foreground">Sin nombre</span>
      ),
  };

  const teamColumns: DataTableColumn<MemberRow>[] = [
    nameColumn,
    roleColumn,
    {
      key: "lines",
      header: "Líneas",
      cell: (member) => (
        <MemberLines
          member={member}
          lines={lines}
          assigned={assignedLines[member.id] ?? []}
        />
      ),
    },
  ];

  const invitationColumns: DataTableColumn<Invitation>[] = [
    {
      key: "email",
      header: "Correo",
      cell: (invitation) => <span className="break-all">{invitation.email}</span>,
    },
    {
      key: "role",
      header: "Rol",
      className: "w-36",
      cell: (invitation) => ROLE_LABELS[invitation.role],
    },
    {
      key: "expiresAt",
      header: "Vence",
      className: "w-32",
      cell: (invitation) => new Date(invitation.expiresAt).toLocaleDateString("es-BO"),
    },
  ];

  const removeAccess = (member: MemberRow) =>
    ask({
      title: `¿Quitar el acceso a ${memberName(member)}?`,
      description:
        "Deja de entrar a esta organización desde ahora. Lo que registró y lo que tiene asignado se conserva.",
      confirmLabel: "Quitar acceso",
      destructive: true,
      action: () => archiveMembership({ membershipId: member.id }),
    });

  const revoke = (invitation: Invitation) =>
    ask({
      title: `¿Revocar la invitación de ${invitation.email}?`,
      description:
        "El enlace deja de servir. Si hace falta, puedes volver a invitar al mismo correo.",
      confirmLabel: "Revocar",
      destructive: true,
      action: () => revokeInvitation({ invitationId: invitation.id }),
    });

  return (
    <section>
      <SectionHeader
        title="Usuarios y roles"
        description="Quién entra a esta organización y con qué permisos."
        action={<InviteDialog />}
      />

      <div className="flex flex-col gap-6">
        <section aria-labelledby="members-team" className="flex flex-col gap-2">
          <h3 id="members-team" className="text-sm font-medium text-muted-foreground">
            Equipo
          </h3>
          <DataTable
            rows={active}
            columns={teamColumns}
            getRowKey={(member) => member.id}
            caption="Equipo"
            testId="member-list"
            rowTestId="member-row"
            rowActionsLabel={(member) => `Acciones de ${memberName(member)}`}
            rowActions={(member) => [
              { label: "Editar", icon: PencilIcon, onSelect: () => edit.openEdit(member) },
              {
                label: "Quitar acceso",
                icon: UserMinusIcon,
                destructive: true,
                onSelect: () => removeAccess(member),
              },
            ]}
          />
        </section>

        {invitations.length > 0 && (
          <section aria-labelledby="members-invitations" className="flex flex-col gap-2">
            <h3 id="members-invitations" className="text-sm font-medium text-muted-foreground">
              Invitaciones pendientes
            </h3>
            <DataTable
              rows={invitations}
              columns={invitationColumns}
              getRowKey={(invitation) => invitation.id}
              caption="Invitaciones pendientes"
              testId="invitation-list"
              rowTestId="invitation-row"
              rowActionsLabel={(invitation) => `Acciones de ${invitation.email}`}
              rowActions={(invitation) => [
                {
                  label: "Revocar",
                  icon: BanIcon,
                  destructive: true,
                  onSelect: () => revoke(invitation),
                },
              ]}
            />
          </section>
        )}

        {/* Sin acciones: devolver el acceso no existe en V15 (sigue en la
            vista de plataforma). */}
        {archived.length > 0 && (
          <section aria-labelledby="members-archived" className="flex flex-col gap-2">
            <h3 id="members-archived" className="text-sm font-medium text-muted-foreground">
              Sin acceso
            </h3>
            <DataTable
              rows={archived}
              columns={[nameColumn, roleColumn]}
              getRowKey={(member) => member.id}
              caption="Sin acceso"
              testId="archived-member-list"
              rowTestId="archived-member-row"
            />
          </section>
        )}
      </div>

      <MemberDialog dialog={edit} lines={lines} assignedLines={assignedLines} />
      {dialog}
    </section>
  );
}

/**
 * Las líneas que alcanza alguien. Ninguna declarada significa **todas**, no
 * ninguna (KAM-15, design D4): la fila lo dice con palabras, porque un hueco
 * vacío se lee al revés con toda naturalidad.
 */
function MemberLines({
  member,
  lines,
  assigned,
}: {
  member: MemberRow;
  lines: BusinessLine[];
  assigned: string[];
}) {
  const declared = lines.filter((line) => assigned.includes(line.id));

  if (member.role === "owner" || declared.length === 0) {
    return <span className="text-muted-foreground">Todas</span>;
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {declared.map((line) => (
        <li key={line.id}>
          <Badge className={cn("border-transparent", lineColorClasses(line.color).badge)}>
            {line.name}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
