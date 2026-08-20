import type { Unit } from "@/types";

import { ConfigTableService } from "./config-table-service";

type UnitRow = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  archived_at: string | null;
};

/** Acceso a `units`. Aquí la clave visible es `code` ('u', 'kg', 'm', 'l'). */
export class UnitService extends ConfigTableService<UnitRow, Unit> {
  protected readonly table = "units";
  protected readonly columns = "id, organization_id, code, name, archived_at";
  protected readonly orderBy = [{ column: "code", ascending: true }];
  protected readonly label = "las unidades de medida";

  protected toEntity(row: UnitRow): Unit {
    return {
      id: row.id,
      organizationId: row.organization_id,
      code: row.code,
      name: row.name,
      archivedAt: row.archived_at,
    };
  }

  async create(
    organizationId: string,
    input: { code: string; name: string },
  ): Promise<Unit> {
    return this.insert(organizationId, { code: input.code, name: input.name });
  }

  async rename(
    organizationId: string,
    id: string,
    input: { code: string; name: string },
  ): Promise<Unit> {
    return this.patch(organizationId, id, {
      code: input.code,
      name: input.name,
    });
  }
}
