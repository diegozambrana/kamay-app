import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PickableItem } from "@/lib/orders/lines";
import type { BusinessLine, Contact, SalesChannel } from "@/types";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/actions/orders", () => ({
  createOrder: vi.fn(async () => ({ orderId: NEW_ORDER, code: 42 })),
  updateOrder: vi.fn(async () => undefined),
  uploadOrderAttachment: vi.fn(async () => undefined),
  setOrderAttachmentArchived: vi.fn(async () => undefined),
}));

vi.mock("@/actions/contacts", () => ({
  createContactInline: vi.fn(async () => ({ contact: CLIENTA })),
}));

import {
  createOrder,
  updateOrder,
  uploadOrderAttachment,
} from "@/actions/orders";

import { registerOfflineOperations } from "@/features/sync/operations";
import { clearOperations, listEntries, outboxDatabase, resetDrainLock } from "@/lib/offline";
import { useOrganizationStore } from "@/stores/organization-store";
import { useUserStore } from "@/stores/user-store";

import { OrderForm, type OrderFormState } from "./order-form";

const NEW_ORDER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LINE_SUBLIMACION = "11111111-1111-4111-8111-111111111111";
const LINE_ALFARERIA = "22222222-2222-4222-8222-222222222222";
const CONTACT = "33333333-3333-4333-8333-333333333333";
const CHANNEL = "44444444-4444-4444-8444-444444444444";
const ITEM = "55555555-5555-4555-8555-555555555555";
const ITEM_ALFARERIA = "66666666-6666-4666-8666-666666666666";
const LINE_ID = "77777777-7777-4777-8777-777777777777";

const CLIENTA: Contact = {
  id: CONTACT,
  organizationId: "org",
  name: "María Céspedes",
  phone: null,
  email: null,
  address: null,
  isSupplier: false,
  isCustomer: true,
  notes: null,
  archivedAt: null,
};

const LINES: BusinessLine[] = [
  {
    id: LINE_SUBLIMACION,
    organizationId: "org",
    name: "Sublimación",
    color: "blue",
    icon: null,
    isShared: false,
    position: 1,
    archivedAt: null,
  },
  {
    id: LINE_ALFARERIA,
    organizationId: "org",
    name: "Alfarería",
    color: "orange",
    icon: null,
    isShared: false,
    position: 2,
    archivedAt: null,
  },
];

const CHANNELS: SalesChannel[] = [
  { id: CHANNEL, organizationId: "org", name: "WhatsApp", position: 1, archivedAt: null },
];

function product(id: string, name: string, businessLineId: string | null): PickableItem {
  return {
    id,
    organizationId: "org",
    businessLineId,
    kind: "product",
    name,
    description: null,
    unitId: null,
    category: null,
    salePrice: 45,
    minStock: null,
    archivedAt: null,
    variants: [],
  };
}

const PRODUCTS = [
  product(ITEM, "Taza para sublimación", LINE_SUBLIMACION),
  product(ITEM_ALFARERIA, "Macetero de greda", LINE_ALFARERIA),
];

/** Un pedido válido mínimo: cliente y una línea. */
function defaults(overrides: Partial<OrderFormState> = {}): OrderFormState {
  return {
    id: NEW_ORDER,
    businessLineId: LINE_SUBLIMACION,
    contactId: CONTACT,
    salesChannelId: null,
    deliveryMode: null,
    dueDate: null,
    notes: "",
    occurredAt: "2026-09-03T12:00:00.000Z",
    items: [
      {
        id: LINE_ID,
        itemId: ITEM,
        variantId: null,
        description: "",
        quantity: 3,
        unitPrice: 45,
      },
    ],
    ...overrides,
  };
}

function renderForm(
  mode: "create" | "edit" = "create",
  values: Partial<OrderFormState> = {},
  extra: { code?: number } = {},
) {
  const result = render(
    <OrderForm
      mode={mode}
      defaultValues={defaults(values)}
      initialNames={{ [LINE_ID]: { item: "Taza para sublimación", variant: null } }}
      lines={LINES}
      channels={CHANNELS}
      contacts={[CLIENTA]}
      products={PRODUCTS}
      today="2026-09-03"
      code={extra.code}
    />,
  );
  return { ...result, user: userEvent.setup() };
}

/** El formulario se envía por su `<form>`: el botón vive en la barra fija. */
function submitForm() {
  const form = screen.getByTestId("order-form") as HTMLFormElement;
  form.requestSubmit();
}

/**
 * Desde KAM-11 el formulario no llama a la Server Action: encola y espera un
 * plazo corto. Con red —que es lo que jsdom simula— el vaciado responde dentro
 * del mismo gesto y todo se comporta como en KAM-08, que es justamente lo que
 * estas pruebas siguen comprobando.
 */
beforeEach(async () => {
  vi.clearAllMocks();
  resetDrainLock();
  clearOperations();
  registerOfflineOperations();
  await outboxDatabase().outbox.clear();
  useOrganizationStore.setState({
    organization: { id: "org", name: "Geeko", timezone: "America/La_Paz" } as never,
  });
  useUserStore.setState({ user: { id: "user-a", email: "a@kamay.test" } });
});

afterEach(cleanup);

describe("OrderForm · mínimos obligatorios", () => {
  it("guarda el alta mínima sin fecha, canal ni modo de entrega", async () => {
    renderForm();

    submitForm();

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        businessLineId: LINE_SUBLIMACION,
        contactId: CONTACT,
        dueDate: null,
        salesChannelId: null,
        deliveryMode: null,
        notes: null,
      }),
    );
  });

  it("sin cliente señala el campo y no llama a la acción", async () => {
    renderForm("create", { contactId: "" });

    submitForm();

    expect(await screen.findByTestId("contact-error")).toHaveTextContent(
      "Elige o crea un cliente",
    );
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("sin líneas señala la sección de líneas y no llama a la acción", async () => {
    renderForm("create", { items: [] });

    submitForm();

    expect(await screen.findByTestId("lines-error")).toHaveTextContent(
      "Agrega al menos una línea",
    );
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("una cantidad de cero señala la cantidad de esa línea", async () => {
    renderForm("create", {
      items: [
        {
          id: LINE_ID,
          itemId: ITEM,
          variantId: null,
          description: "",
          quantity: 0,
          unitPrice: 45,
        },
      ],
    });

    submitForm();

    expect(
      await screen.findByText("La cantidad tiene que ser mayor que cero"),
    ).toBeInTheDocument();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("una línea libre sin descripción se rechaza", async () => {
    renderForm("create", {
      items: [
        {
          id: LINE_ID,
          itemId: null,
          variantId: null,
          description: "",
          quantity: 1,
          unitPrice: 120,
        },
      ],
    });

    submitForm();

    expect(
      await screen.findByText("Una línea sin producto necesita una descripción"),
    ).toBeInTheDocument();
    expect(createOrder).not.toHaveBeenCalled();
  });
});

describe("OrderForm · línea de negocio", () => {
  it("al crear, la línea activa viene preseleccionada", () => {
    renderForm();

    expect(screen.getByTestId("line-select")).toHaveTextContent("Sublimación");
  });

  it("con «Todas» activa no preselecciona ninguna y exige elegirla", async () => {
    renderForm("create", { businessLineId: "" });

    expect(screen.getByTestId("line-select")).toHaveTextContent("Elige una línea");

    submitForm();

    expect(await screen.findByTestId("line-error")).toHaveTextContent(
      "Elige una línea de negocio",
    );
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("al editar, la línea se muestra pero no es un campo", () => {
    renderForm("edit", {}, { code: 12 });

    expect(screen.getByTestId("line-label")).toHaveTextContent("Sublimación");
    expect(screen.queryByTestId("line-select")).toBeNull();
  });
});

describe("OrderForm · guardar", () => {
  it("«Guardar» lleva al detalle del pedido creado", async () => {
    renderForm();

    submitForm();

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/orders/${NEW_ORDER}`));
  });

  it("«Guardar y crear otro» conserva línea y canal, y limpia lo demás", async () => {
    const { user } = renderForm("create", {
      salesChannelId: CHANNEL,
      notes: "Diseño por WhatsApp",
    });

    await user.click(screen.getByTestId("save-and-new"));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));

    // El número del pedido guardado se anuncia sin navegar a ninguna parte.
    expect(await screen.findByTestId("order-form-notice")).toHaveTextContent(
      "Pedido #42 guardado",
    );
    expect(push).not.toHaveBeenCalled();

    // Lo que no cambia entre dos pedidos sigue puesto…
    expect(screen.getByTestId("line-select")).toHaveTextContent("Sublimación");
    expect(screen.getByTestId("channel-select")).toHaveTextContent("WhatsApp");

    // …y lo que sí, queda en blanco.
    expect(screen.getByText("Sin líneas todavía")).toBeInTheDocument();
    expect(screen.queryByTestId("contact-selected")).toBeNull();
    expect(screen.getByLabelText("Nota")).toHaveValue("");
    expect(screen.getByTestId("order-form-total")).toHaveTextContent("0.00");
  });

  it("«Guardar y crear otro» estrena identificador para el pedido siguiente", async () => {
    const { user } = renderForm();

    await user.click(screen.getByTestId("save-and-new"));
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));

    // Se rehace el pedido entero —el formulario quedó en blanco— y se guarda
    // otra vez: el id no puede repetirse, que el anterior ya está guardado.
    await user.type(screen.getByLabelText("Cliente"), "María");
    await user.click(screen.getByRole("button", { name: "María Céspedes" }));
    await user.type(screen.getByLabelText("Agregar del catálogo"), "taza");
    await user.click(screen.getByRole("button", { name: /Taza para sublimación/ }));
    await user.click(screen.getByTestId("save-and-new"));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));

    const primero = vi.mocked(createOrder).mock.calls[0][0] as { id: string };
    const segundo = vi.mocked(createOrder).mock.calls[1][0] as { id: string };
    expect(segundo.id).not.toBe(primero.id);
  });

  it("al editar llama a updateOrder y vuelve al detalle", async () => {
    renderForm("edit", {}, { code: 12 });

    submitForm();

    await waitFor(() => expect(updateOrder).toHaveBeenCalledTimes(1));
    expect(createOrder).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(`/orders/${NEW_ORDER}`);
  });

  it("muestra el error del servidor y no navega", async () => {
    vi.mocked(createOrder).mockResolvedValueOnce({
      error: "Un pedido necesita al menos una línea.",
    });
    renderForm();

    submitForm();

    expect(
      await screen.findByText("Un pedido necesita al menos una línea."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("OrderForm · adjuntos", () => {
  function fileInput(container: HTMLElement) {
    return container.querySelector('input[type="file"]') as HTMLInputElement;
  }

  it("sube la imagen elegida después de guardar el pedido", async () => {
    const { container, user } = renderForm();

    await user.upload(
      fileInput(container),
      new File(["x"], "referencia.jpg", { type: "image/jpeg" }),
    );
    submitForm();

    await waitFor(() => expect(uploadOrderAttachment).toHaveBeenCalledTimes(1));
    const body = vi.mocked(uploadOrderAttachment).mock.calls[0][0];
    expect(body.get("orderId")).toBe(NEW_ORDER);
    expect((body.get("file") as File).name).toBe("referencia.jpg");
  });

  /**
   * El pedido no se pierde por una foto: existe, y el aviso dice cuál falló y
   * ofrece abrirlo.
   */
  it("si la imagen falla, avisa y deja el pedido guardado", async () => {
    vi.mocked(uploadOrderAttachment).mockResolvedValueOnce({
      error: "No se pudo subir la imagen.",
    });
    const { container, user } = renderForm();

    await user.upload(
      fileInput(container),
      new File(["x"], "referencia.jpg", { type: "image/jpeg" }),
    );
    submitForm();

    expect(await screen.findByText(/se guardó, pero esta imagen no/)).toHaveTextContent(
      "referencia.jpg",
    );
    expect(screen.getByRole("link", { name: "Abrir el pedido" })).toHaveAttribute(
      "href",
      `/orders/${NEW_ORDER}`,
    );
    // No navega: el aviso se perdería.
    expect(push).not.toHaveBeenCalled();
  });

  it("un archivo de más de 5 MB se rechaza antes de enviar nada", async () => {
    const { container, user } = renderForm();

    const grande = new File([new Uint8Array(6 * 1024 * 1024)], "enorme.jpg", {
      type: "image/jpeg",
    });
    await user.upload(fileInput(container), grande);

    expect(await screen.findByText(/el máximo es/i)).toBeInTheDocument();

    submitForm();
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    expect(uploadOrderAttachment).not.toHaveBeenCalled();
  });
});

/**
 * KAM-11 · Registrar sin conexión.
 *
 * Escenarios del delta `orders` — "Guardar y Guardar y crear otro": «Guardar
 * sin conexión», «Guardar y crear otro sin conexión»; y "Adjuntos del pedido":
 * «Adjuntar sin conexión». Del delta `offline-capture` — "Todo registro
 * cubierto se guarda localmente antes de intentar enviarse": «Registrar sin
 * red».
 */
describe("OrderForm · sin conexión", () => {
  function goOffline() {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
  }

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("guarda el pedido en la cola y lo confirma sin error", async () => {
    goOffline();
    renderForm();

    submitForm();

    expect(
      await screen.findByText(/pendiente de sincronizar/i),
    ).toBeVisible();
    // Ningún error: la confirmación es la única alerta en pantalla.
    expect(screen.queryByText("No se pudo guardar")).not.toBeInTheDocument();
    expect(createOrder).not.toHaveBeenCalled();

    const entries = await listEntries(outboxDatabase());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      recordId: NEW_ORDER,
      operation: "order.create",
      organizationId: "org",
      userId: "user-a",
      state: "pending",
    });
  });

  it("no confirma con un número que todavía no existe", async () => {
    goOffline();
    renderForm();

    submitForm();

    const notice = await screen.findByText(/pendiente de sincronizar/i);
    expect(notice.textContent).not.toMatch(/#\d/);
  });

  it("no navega al detalle: no hay detalle que servir sin red", async () => {
    goOffline();
    renderForm();

    submitForm();

    await screen.findByText(/pendiente de sincronizar/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("conserva línea y canal para el pedido siguiente", async () => {
    goOffline();
    renderForm("create", { salesChannelId: CHANNEL });

    submitForm();

    await screen.findByText(/pendiente de sincronizar/i);
    // La línea y el canal siguen elegidos; el cliente y las líneas, no.
    expect(screen.getByTestId("order-form")).toBeInTheDocument();
    expect(screen.queryByText("María Céspedes")).not.toBeInTheDocument();
  });

  it("la hora real del hecho es la de registrar, no la de abrir el formulario", async () => {
    goOffline();
    // El formulario se abrió con una hora vieja: la que trae por omisión al
    // rendir la página. Entre abrirlo y guardarlo puede pasar media hora, y
    // sin red esa es la única hora que habrá.
    renderForm("create", { occurredAt: "2026-09-03T12:00:00.000Z" });

    const antes = Date.now();
    submitForm();

    await screen.findByText(/pendiente de sincronizar/i);
    const [entry] = await listEntries(outboxDatabase());
    const occurredAt = (entry.payload as { occurredAt: string }).occurredAt;

    expect(occurredAt).not.toBe("2026-09-03T12:00:00.000Z");
    expect(new Date(occurredAt).getTime()).toBeGreaterThanOrEqual(antes);
  });

  it("al editar no reescribe la hora del hecho: ocurrió cuando ocurrió", async () => {
    goOffline();
    renderForm("edit", { occurredAt: "2026-09-03T12:00:00.000Z" }, { code: 42 });

    submitForm();

    await screen.findByText(/pendiente de sincronizar/i);
    const [entry] = await listEntries(outboxDatabase());
    expect((entry.payload as { occurredAt: string }).occurredAt).toBe(
      "2026-09-03T12:00:00.000Z",
    );
  });

  it("avisa de que las imágenes necesitan conexión y deja guardar igualmente", async () => {
    goOffline();
    const { user } = renderForm();

    // El aviso aparece antes de guardar, junto a la zona de imágenes.
    expect(await screen.findByTestId("attachments-offline")).toBeVisible();

    const file = new File(["x"], "referencia.png", { type: "image/png" });
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await user.upload(input, file);

    submitForm();

    expect(await screen.findByText(/imágenes necesitan conexión/i)).toBeVisible();
    expect(uploadOrderAttachment).not.toHaveBeenCalled();
    expect(await listEntries(outboxDatabase())).toHaveLength(1);
  });

  it("al editar también encola, con su propia operación", async () => {
    goOffline();
    renderForm("edit", {}, { code: 42 });

    submitForm();

    await screen.findByText(/pendiente de sincronizar/i);
    const [entry] = await listEntries(outboxDatabase());
    expect(entry.operation).toBe("order.update");
    expect(updateOrder).not.toHaveBeenCalled();
  });
});
