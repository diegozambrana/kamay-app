"use client";

import { EyeIcon, LogInIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { enterOrganization } from "@/actions/auth";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { FilteredEmptyState } from "@/components/shared/filtered-empty-state";
import { LoadMore } from "@/components/shared/load-more";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format/datetime";
import { DEFAULT_TIMEZONE } from "@/lib/platform/schema";
import type { OrganizationSummary } from "@/services/platform/organization-admin-service";

import { CreateOrganizationDialog } from "./create-organization-dialog";

/**
 * V24 · *Organizaciones* (KAM-26): todas las organizaciones de la plataforma
 * en una tabla —en el celular, tarjetas—, con sus dueños y su tamaño. Desde
 * cada fila se entra a la organización —con la vista de su dueño— o se abre
 * su detalle para gestionar su equipo.
 *
 * Una ventana por nombre y no la tabla entera (spec `performance-budget`): la
 * búsqueda y el límite viajan en la dirección —`?q=`, `?limit=`—, así que
 * buscar funciona sin JavaScript y «Mostrar más» amplía sin recargar.
 */
export function OrganizationList({
  organizations,
  hasMore,
  limit,
  query,
  activeOrganizationId,
}: {
  organizations: OrganizationSummary[];
  hasMore: boolean;
  limit: number;
  query: string;
  activeOrganizationId: string | null;
}) {
  const [, startTransition] = useTransition();

  const enter = (organization: OrganizationSummary) =>
    startTransition(async () => {
      await enterOrganization(organization.id);
    });

  const columns: DataTableColumn<OrganizationSummary>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (organization) => (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/organizations/${organization.id}`}
            className="font-medium break-words hover:underline"
          >
            {organization.name}
          </Link>
          {organization.id === activeOrganizationId && <Badge variant="secondary">Activa</Badge>}
          {organization.archivedAt && <Badge variant="outline">Archivada</Badge>}
        </div>
      ),
    },
    {
      key: "owners",
      header: "Dueños",
      cell: (organization) =>
        organization.owners.length > 0 ? (
          organization.owners.join(", ")
        ) : (
          <span className="text-muted-foreground">Sin dueño activo</span>
        ),
    },
    {
      key: "members",
      header: "Miembros",
      className: "w-24",
      cell: (organization) => organization.activeMembers,
    },
    {
      key: "createdAt",
      header: "Creada",
      className: "w-32",
      cell: (organization) => formatDate(organization.createdAt, DEFAULT_TIMEZONE),
    },
    {
      key: "enter",
      header: "Entrar",
      className: "w-28",
      bareOnCard: true,
      cell: (organization) =>
        !organization.archivedAt && (
          <form action={enterOrganization.bind(null, organization.id)}>
            <Button type="submit" size="sm" aria-label={`Entrar a ${organization.name}`}>
              Entrar
            </Button>
          </form>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* En el celular, el buscador a todo el ancho y «Nueva organización»
          debajo, sin competir por espacio. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <form role="search" action="/admin/organizations" className="flex flex-1 gap-2">
          <Input
            name="q"
            defaultValue={query}
            placeholder="Buscar por nombre"
            aria-label="Buscar organización por nombre"
            className="min-w-0 flex-1 md:max-w-xs"
          />
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
        <CreateOrganizationDialog />
      </div>

      <DataTable
        rows={organizations}
        columns={columns}
        getRowKey={(organization) => organization.id}
        caption="Organizaciones de la plataforma"
        testId="organization-list"
        rowTestId="organization-row"
        rowActionsLabel={(organization) => `Acciones de ${organization.name}`}
        rowActions={(organization) => [
          {
            label: "Ver detalle",
            icon: EyeIcon,
            href: `/admin/organizations/${organization.id}`,
          },
          ...(organization.archivedAt
            ? []
            : [{ label: "Entrar", icon: LogInIcon, onSelect: () => enter(organization) }]),
        ]}
        empty={
          query ? (
            <FilteredEmptyState
              description="Ninguna organización coincide con la búsqueda."
              clearHref="/admin/organizations"
            />
          ) : (
            <EmptyState
              title="Aún no hay organizaciones"
              description="Crea la primera con «Nueva organización»."
            />
          )
        }
      />

      {hasMore && (
        <LoadMore limit={limit} shownLabel={`las primeras ${limit} organizaciones`} />
      )}
    </div>
  );
}
