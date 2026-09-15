import type { Locator, Page } from "./test";

/**
 * Las filas que se ven: `DataTable` rinde tabla y tarjetas, y el CSS decide
 * cuál aparece según el ancho. Contar ambas contaría cada registro dos veces,
 * y buscar un texto encontraría dos elementos (modo estricto de Playwright).
 */
export function visibleRows(page: Page, testId: string): Locator {
  return page.getByTestId(testId).filter({ visible: true });
}

/**
 * Elige una acción del «⋯» de la fila visible que contiene `rowText`.
 * El menú y el diálogo que abra viven fuera de la fila (en un portal), así
 * que se buscan en la página.
 */
export async function chooseRowAction(
  page: Page,
  testId: string,
  rowText: string | RegExp,
  action: string,
): Promise<void> {
  const row = visibleRows(page, testId).filter({ hasText: rowText });
  await row.getByRole("button", { name: /^Acciones de / }).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
}

/**
 * Elige una opción de un `Select` de shadcn: no es un `<select>` nativo, así
 * que `selectOption` no sirve. Se abre el disparador (el `combobox`) y se
 * pulsa la opción.
 */
export async function chooseOption(scope: Page | Locator, label: string, option: string) {
  const page = "page" in scope ? scope.page() : scope;
  await scope.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
