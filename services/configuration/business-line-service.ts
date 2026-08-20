import type { BusinessLine, LineColor } from "@/types";

import { ConfigTableService } from "./config-table-service";

type BusinessLineRow = {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  icon: string | null;
  is_shared: boolean;
  position: number;
  archived_at: string | null;
};

/** Acceso a `business_lines`. La línea compartida no se crea ni se archiva aquí. */
export class BusinessLineService extends ConfigTableService<
  BusinessLineRow,
  BusinessLine
> {
  protected readonly table = "business_lines";
  protected readonly columns =
    "id, organization_id, name, color, icon, is_shared, position, archived_at";
  protected readonly orderBy = [
    { column: "position", ascending: true },
    { column: "name", ascending: true },
  ];
  protected readonly label = "las líneas de negocio";

  protected toEntity(row: BusinessLineRow): BusinessLine {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      color: row.color as LineColor,
      icon: row.icon,
      isShared: row.is_shared,
      position: row.position,
      archivedAt: row.archived_at,
    };
  }

  async create(
    organizationId: string,
    input: { name: string; color: LineColor; icon?: string | null },
  ): Promise<BusinessLine> {
    // La posición se calcula al crear: una línea nueva va al final de la lista.
    const existing = await this.listAll(organizationId);
    const position =
      existing.reduce((max, line) => Math.max(max, line.position), 0) + 1;

    return this.insert(organizationId, {
      name: input.name,
      color: input.color,
      icon: input.icon ?? null,
      position,
    });
  }

  async rename(
    organizationId: string,
    id: string,
    input: { name: string; color: LineColor; icon?: string | null },
  ): Promise<BusinessLine> {
    return this.patch(organizationId, id, {
      name: input.name,
      color: input.color,
      icon: input.icon ?? null,
      updated_at: new Date().toISOString(),
    });
  }
}
