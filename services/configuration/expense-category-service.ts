import type { ExpenseCategory } from "@/types";

import { ConfigTableService } from "./config-table-service";

type ExpenseCategoryRow = {
  id: string;
  organization_id: string;
  name: string;
  archived_at: string | null;
};

/** Acceso a `expense_categories`. */
export class ExpenseCategoryService extends ConfigTableService<
  ExpenseCategoryRow,
  ExpenseCategory
> {
  protected readonly table = "expense_categories";
  protected readonly columns = "id, organization_id, name, archived_at";
  protected readonly orderBy = [{ column: "name", ascending: true }];
  protected readonly label = "las categorías de gasto";

  protected toEntity(row: ExpenseCategoryRow): ExpenseCategory {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      archivedAt: row.archived_at,
    };
  }

  async create(
    organizationId: string,
    input: { name: string },
  ): Promise<ExpenseCategory> {
    return this.insert(organizationId, { name: input.name });
  }

  async rename(
    organizationId: string,
    id: string,
    input: { name: string },
  ): Promise<ExpenseCategory> {
    return this.patch(organizationId, id, { name: input.name });
  }
}
