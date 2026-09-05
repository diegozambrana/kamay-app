import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FairProduct } from "@/services/fair/fair-sale-service";
import { useSyncStore } from "@/stores/sync-store";
import { useUserStore } from "@/stores/user-store";
import { ALL_LINES } from "@/types";

import type { DirectSaleInput } from "@/lib/fair/sale-schema";
import type { CaptureResult } from "@/lib/offline";

const captureSale = vi.fn<
  (sale: DirectSaleInput, userId: string, deps: unknown) => Promise<CaptureResult>
>(async () => ({ status: "queued" }));

vi.mock("./sync/capture-sale", () => ({
  captureSale: (sale: DirectSaleInput, userId: string, deps: unknown) =>
    captureSale(sale, userId, deps),
  FAIR_FLUSH_DEADLINE_MS: 0,
}));

const saveSnapshot = vi.fn(async () => undefined);
const readSnapshot = vi.fn(async () => null);

vi.mock("@/lib/fair/snapshot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fair/snapshot")>();
  return {
    ...actual,
    saveSnapshot: (...args: unknown[]) => saveSnapshot(...(args as [])),
    readSnapshot: (...args: unknown[]) => readSnapshot(...(args as [])),
  };
});

const { FairScreen } = await import("./fair-screen");
const { useFairSessionStore } = await import("./fair-session-store");
const { useCartStore } = await import("./cart-store");

const ORG = "00000000-0000-4000-8000-000000000001";
const LINE = "00000000-0000-4000-8000-000000000002";

const products: FairProduct[] = [
  { id: "taza", name: "Taza de barro", salePrice: 35, quantitySold: 30, businessLineId: LINE },
  { id: "maceta", name: "Maceta", salePrice: 60, quantitySold: 4, businessLineId: LINE },
];

const channels = [
  { id: "canal-feria", organizationId: ORG, name: "Feria", position: 1 },
] as never[];

function renderScreen(activeLine: string = LINE) {
  return render(
    <FairScreen
      organizationId={ORG}
      lines={[] as never[]}
      activeLine={activeLine}
      channels={channels}
      products={products}
    />,
  );
}

afterEach(cleanup);

beforeEach(() => {
  captureSale.mockClear();
  saveSnapshot.mockClear();
  readSnapshot.mockClear();
  useUserStore.setState({ user: { id: "user-a", email: "a@kamay.test" } } as never);
  useSyncStore.setState({
    items: [],
    counts: { pending: 0, held: 0, failed: 0, total: 0 },
    session: null,
  });
  useCartStore.setState({ lines: [] });
  useFairSessionStore.setState({
    businessLineId: null,
    salesChannelId: null,
    products: [],
    capturedAt: null,
    loading: true,
  });
});

describe("FairScreen", () => {
  it("captura el catálogo al entrar con red y muestra la cuadrícula", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getAllByTestId("fair-product")).toHaveLength(2));
    expect(saveSnapshot).toHaveBeenCalled();
  });

  // Escenario: Venta de dos productos en cuatro interacciones
  it("registra una venta de dos productos en cuatro interacciones", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getAllByTestId("fair-product")).toHaveLength(2));

    const [taza, maceta] = screen.getAllByTestId("fair-product");
    await userEvent.click(taza); // 1
    await userEvent.click(maceta); // 2
    await userEvent.click(screen.getByTestId("fair-checkout")); // 3
    await userEvent.click(await screen.findByTestId("fair-confirm")); // 4

    await waitFor(() => expect(captureSale).toHaveBeenCalledTimes(1));

    const [sale] = captureSale.mock.calls[0];
    expect(sale.items).toHaveLength(2);
    expect(sale.payment?.amount).toBe(95);
  });

  // Escenario: Retorno sin pantallas intermedias · Venta siguiente inmediata
  it("vuelve a la cuadrícula con el carrito vacío y sin pantalla intermedia", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getAllByTestId("fair-product")).toHaveLength(2));

    await userEvent.click(screen.getAllByTestId("fair-product")[0]);
    await userEvent.click(screen.getByTestId("fair-checkout"));
    await userEvent.click(await screen.findByTestId("fair-confirm"));

    await waitFor(() => expect(screen.getByTestId("cart-total")).toHaveTextContent("0"));
    expect(screen.queryByTestId("fair-amount")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("fair-product")).toHaveLength(2);
  });

  // Escenario: No se espera al servidor
  it("no espera a que la venta salga: vacía el carrito antes de resolverse", async () => {
    let resolver: (() => void) | null = null;
    captureSale.mockImplementation(
      () =>
        new Promise<CaptureResult>((resolve) => {
          resolver = () => resolve({ status: "queued" });
        }),
    );

    renderScreen();
    await waitFor(() => expect(screen.getAllByTestId("fair-product")).toHaveLength(2));

    await userEvent.click(screen.getAllByTestId("fair-product")[0]);
    await userEvent.click(screen.getByTestId("fair-checkout"));
    await userEvent.click(await screen.findByTestId("fair-confirm"));

    // La venta sigue en vuelo y la cuadrícula ya está lista para la siguiente.
    await waitFor(() => expect(screen.getByTestId("cart-total")).toHaveTextContent("0"));
    expect(resolver).not.toBeNull();
    resolver!();
  });

  it("la venta siguiente empieza en un carrito nuevo", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getAllByTestId("fair-product")).toHaveLength(2));

    await userEvent.click(screen.getAllByTestId("fair-product")[0]);
    await userEvent.click(screen.getByTestId("fair-checkout"));
    await userEvent.click(await screen.findByTestId("fair-confirm"));
    await waitFor(() => expect(screen.getByTestId("cart-total")).toHaveTextContent("0"));

    await userEvent.click(screen.getAllByTestId("fair-product")[1]);

    expect(screen.getByTestId("cart-total")).toHaveTextContent("60");
  });

  // Escenario: El canal no se pregunta durante la venta
  it("no pide línea ni canal en ninguna venta", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getAllByTestId("fair-product")).toHaveLength(2));

    await userEvent.click(screen.getAllByTestId("fair-product")[0]);
    await userEvent.click(screen.getByTestId("fair-checkout"));

    expect(screen.queryByTestId("fair-line")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fair-channel")).not.toBeInTheDocument();
  });

  // Escenario: «Todas» exige elegir línea
  it("con la línea en «Todas» muestra el paso de inicio, no la cuadrícula", async () => {
    renderScreen(ALL_LINES);

    await waitFor(() => expect(screen.getByTestId("fair-start")).toBeInTheDocument());
    expect(screen.queryByTestId("fair-product")).not.toBeInTheDocument();
  });

  // Escenario: Ningún elemento de navegación
  it("el único control de navegación es la salida", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getAllByTestId("fair-product")).toHaveLength(2));

    const enlaces = screen.getAllByRole("link");
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0]).toHaveAttribute("href", "/quick");
  });

  // Escenario: Fallo permanente visible
  it("un rechazo permanente se avisa sin interrumpir la venta siguiente", async () => {
    captureSale.mockImplementation(async (): Promise<CaptureResult> => ({
      status: "failed",
      message: "Esa venta pertenece a otra organización.",
    }));

    renderScreen();
    await waitFor(() => expect(screen.getAllByTestId("fair-product")).toHaveLength(2));

    await userEvent.click(screen.getAllByTestId("fair-product")[0]);
    await userEvent.click(screen.getByTestId("fair-checkout"));
    await userEvent.click(await screen.findByTestId("fair-confirm"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/otra organización/);
    // La cuadrícula sigue lista: el aviso no bloquea.
    expect(screen.getAllByTestId("fair-product")).toHaveLength(2);
  });

  it("la hora del hecho la fija el cliente al confirmar", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getAllByTestId("fair-product")).toHaveLength(2));

    await userEvent.click(screen.getAllByTestId("fair-product")[0]);
    await userEvent.click(screen.getByTestId("fair-checkout"));
    await userEvent.click(await screen.findByTestId("fair-confirm"));

    await waitFor(() => expect(captureSale).toHaveBeenCalled());
    const [sale] = captureSale.mock.calls[0];
    expect(Number.isFinite(Date.parse(sale.occurredAt))).toBe(true);
  });
});
