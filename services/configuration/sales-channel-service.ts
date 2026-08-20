import type { SalesChannel } from "@/types";

import { ConfigTableService } from "./config-table-service";

type SalesChannelRow = {
  id: string;
  organization_id: string;
  name: string;
  position: number;
  archived_at: string | null;
};

/** Acceso a `sales_channels`. */
export class SalesChannelService extends ConfigTableService<
  SalesChannelRow,
  SalesChannel
> {
  protected readonly table = "sales_channels";
  protected readonly columns = "id, organization_id, name, position, archived_at";
  protected readonly orderBy = [
    { column: "position", ascending: true },
    { column: "name", ascending: true },
  ];
  protected readonly label = "los canales de venta";

  protected toEntity(row: SalesChannelRow): SalesChannel {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      position: row.position,
      archivedAt: row.archived_at,
    };
  }

  async create(
    organizationId: string,
    input: { name: string },
  ): Promise<SalesChannel> {
    const existing = await this.listAll(organizationId);
    const position =
      existing.reduce((max, channel) => Math.max(max, channel.position), 0) + 1;

    return this.insert(organizationId, { name: input.name, position });
  }

  async rename(
    organizationId: string,
    id: string,
    input: { name: string },
  ): Promise<SalesChannel> {
    return this.patch(organizationId, id, { name: input.name });
  }
}
