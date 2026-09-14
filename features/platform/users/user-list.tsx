"use client";

import { EyeIcon } from "lucide-react";
import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { FilteredEmptyState } from "@/components/shared/filtered-empty-state";
import { LoadMore } from "@/components/shared/load-more";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format/datetime";
import { PLATFORM_ADMIN_LABEL } from "@/lib/platform/labels";
import { DEFAULT_TIMEZONE } from "@/lib/platform/schema";
import { type PlatformUser, displayNameOf } from "@/lib/platform/users";
import type { OrganizationOption } from "@/services/platform/platform-service";

import { ROLE_LABELS } from "../roles";
import { AddUserDialog } from "./add-user-dialog";

/**
 * V25 · *Usuarios* (KAM-26): las cuentas de la plataforma en una tabla —en
 * el celular, tarjetas—, con su correo, sus organizaciones y su rol en cada
 * una. Buscar por correo o nombre, ver solo las que no pertenecen a ninguna
 * organización y agregar a alguien a una organización.
 *
 * Una ventana y no la tabla entera (spec `performance-budget`): la búsqueda,
 * el filtro y el límite los resuelve `platform_list_users()` y viajan en la
 * dirección —`?q=`, `?sin=1`, `?limit=`—.
 */
export function UserList({
  users,
  hasMore,
  limit,
  query,
  withoutOrganization,
  organizations,
}: {
  users: PlatformUser[];
  hasMore: boolean;
  limit: number;
  query: string;
  withoutOrganization: boolean;
  /** Las organizaciones que ofrece «Agregar usuario». */
  organizations: OrganizationOption[];
}) {
  const filtering = query !== "" || withoutOrganization;

  const columns: DataTableColumn<PlatformUser>[] = [
    {
      key: "email",
      header: "Correo",
      cell: (user) => (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/users/${user.id}`} className="font-medium break-all hover:underline">
            {user.email}
          </Link>
          {user.platformAdmin && <Badge variant="secondary">{PLATFORM_ADMIN_LABEL}</Badge>}
        </div>
      ),
    },
    {
      key: "name",
      header: "Nombre",
      cell: (user) => displayNameOf(user) ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: "organizations",
      header: "Organizaciones",
      cell: (user) =>
        user.memberships.length === 0 ? (
          <span className="text-muted-foreground">Sin organización</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {user.memberships.map((m) => (
              <li key={m.membershipId}>
                <Badge variant={m.archivedAt ? "outline" : "secondary"}>
                  {m.organizationName} · {ROLE_LABELS[m.role]}
                  {m.archivedAt ? " · sin acceso" : ""}
                </Badge>
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: "lastSignInAt",
      header: "Último acceso",
      className: "w-40",
      cell: (user) =>
        user.lastSignInAt ? (
          formatDateTime(user.lastSignInAt, DEFAULT_TIMEZONE)
        ) : (
          <span className="text-muted-foreground">Nunca entró</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* En el celular, cada cosa en su fila: el buscador a todo el ancho,
          debajo el filtro, y «Agregar usuario» sin competir por espacio. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <form
          role="search"
          action="/admin/users"
          className="flex flex-1 flex-wrap items-center gap-3"
        >
          <Input
            name="q"
            defaultValue={query}
            placeholder="Buscar por correo o nombre"
            aria-label="Buscar cuenta por correo o nombre"
            className="w-full md:w-72"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="sin"
              value="1"
              defaultChecked={withoutOrganization}
              className="size-4 accent-primary"
            />
            Sin organización
          </label>
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
        </form>
        <AddUserDialog organizations={organizations} />
      </div>

      <DataTable
        rows={users}
        columns={columns}
        getRowKey={(user) => user.id}
        caption="Cuentas de la plataforma"
        testId="user-list"
        rowTestId="user-row"
        rowActionsLabel={(user) => `Acciones de ${user.email}`}
        rowActions={(user) => [
          { label: "Ver detalle", icon: EyeIcon, href: `/admin/users/${user.id}` },
        ]}
        empty={
          filtering ? (
            <FilteredEmptyState
              description="Ninguna cuenta coincide con los filtros."
              clearHref="/admin/users"
            />
          ) : (
            <EmptyState title="Aún no hay cuentas" />
          )
        }
      />

      {hasMore && <LoadMore limit={limit} shownLabel={`las primeras ${limit} cuentas`} />}
    </div>
  );
}
