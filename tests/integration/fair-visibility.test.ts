import { beforeAll, describe, expect, it } from "vitest";

import { ItemService } from "@/services/catalog/item-service";
import { FairSaleService } from "@/services/fair/fair-sale-service";

import { seedWorkshop, type Workshop } from "./tools-support";

/**
 * `fair-product-photos-visibility-cart-drawer` · «Mostrar en venta rápida»
 * contra la base real, como la dueña de una organización propia y con RLS
 * decidiendo.
 *
 * Escenarios del delta `catalog-directory`: «Ocultar un producto de la venta
 * rápida» (la bitácora) y «Oculto en la feria, presente en el resto»; y del
 * delta `fair-mode`: «Producto oculto de la venta rápida» y «Producto con
 * foto», con una firma real que responde.
 */

let workshop: Workshop;
const hiddenId = crypto.randomUUID();
const visibleId = crypto.randomUUID();
const photoId = crypto.randomUUID();
let lineId: string;

/** Un PNG de 1 × 1 px: basta para que Storage lo acepte como imagen. */
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

const product = {
  kind: "product" as const,
  businessLineId: null,
  unitId: null,
  categoryId: null,
  description: null,
  minStock: null,
};

beforeAll(async () => {
  workshop = await seedWorkshop("Visibilidad en feria");
  const { owner, organizationId } = workshop;

  const items = new ItemService(owner);
  await items.create(organizationId, hiddenId, {
    ...product,
    name: "Taza oculta",
    salePrice: 35,
  });
  await items.update(organizationId, hiddenId, {
    ...product,
    name: "Taza oculta",
    salePrice: 35,
    showInFair: false,
  });

  const { data: line, error } = await owner
    .from("business_lines")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(1)
    .single();
  if (error) throw new Error(`línea: ${error.message}`);
  lineId = line.id as string;

  await items.create(organizationId, visibleId, {
    ...product,
    name: "Taza con foto",
    salePrice: 40,
  });

  // La foto sin miniatura: la subida real la genera con `sharp` en la acción;
  // aquí basta el original, que es a lo que cae la firma cuando no hay
  // miniatura.
  const storagePath = `${organizationId}/item/${visibleId}/${photoId}.png`;
  const upload = await owner.storage
    .from("item-photos")
    .upload(storagePath, PNG, { contentType: "image/png" });
  if (upload.error) throw new Error(`foto: ${upload.error.message}`);

  const { data: userData } = await owner.auth.getUser();
  const inserted = await owner.from("attachments").insert({
    id: photoId,
    organization_id: organizationId,
    entity_type: "item",
    entity_id: visibleId,
    bucket: "item-photos",
    storage_path: storagePath,
    file_name: "taza.png",
    mime_type: "image/png",
    size_bytes: PNG.byteLength,
    uploaded_by: userData.user?.id,
  });
  if (inserted.error) throw new Error(`adjunto: ${inserted.error.message}`);
});

describe("Mostrar en venta rápida", () => {
  it("Ocultar un producto de la venta rápida: queda guardado y en la bitácora", async () => {
    const { owner, organizationId } = workshop;

    const stored = await new ItemService(owner).findById(organizationId, hiddenId);
    expect(stored?.showInFair).toBe(false);

    const { data, error } = await owner
      .from("activity_log")
      .select("action, changes")
      .eq("organization_id", organizationId)
      .eq("table_name", "items")
      .eq("record_id", hiddenId)
      .eq("action", "updated");
    if (error) throw new Error(error.message);

    expect(data?.some((row) => "show_in_fair" in (row.changes ?? {}))).toBe(true);
  });

  it("Oculto en la feria, presente en el resto: catálogo y buscador de pedidos", async () => {
    const { owner, organizationId } = workshop;
    const items = new ItemService(owner);

    const catalog = await items.list(organizationId, { kind: "product" });
    expect(catalog.map((item) => item.id)).toContain(hiddenId);

    const orderPicker = await items.listProductsWithVariants(organizationId);
    expect(orderPicker.map((item) => item.id)).toContain(hiddenId);
  });
});

describe("La cuadrícula de la feria", () => {
  it("Producto oculto de la venta rápida: no sale; el visible sí", async () => {
    const { owner, organizationId } = workshop;

    const grid = await new FairSaleService(owner).listSellableProducts(organizationId, lineId);
    const ids = grid.map((product) => product.id);

    expect(ids).not.toContain(hiddenId);
    expect(ids).toContain(visibleId);
  });

  it("Producto con foto: trae una URL firmada que responde", async () => {
    const { owner, organizationId } = workshop;

    const grid = await new FairSaleService(owner).listSellableProducts(organizationId, lineId);
    const withPhoto = grid.find((product) => product.id === visibleId);

    expect(withPhoto?.photoAttachmentId).toBe(photoId);
    expect(withPhoto?.photoUrl).toEqual(expect.any(String));

    const response = await fetch(withPhoto!.photoUrl!);
    expect(response.status).toBe(200);
  });
});
