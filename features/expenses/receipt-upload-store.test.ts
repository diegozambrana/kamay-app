import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasPendingUploads,
  useReceiptUploadStore,
  type ReceiptUploader,
} from "./receipt-upload-store";

vi.mock("@/actions/expenses", () => ({
  attachReceipt: vi.fn(async () => undefined),
}));

const EXPENSE = "b0000000-0000-0000-0000-000000000001";

function file(name = "recibo.jpg"): File {
  return new File([new Uint8Array(10)], name, { type: "image/jpeg" });
}

/** Un subidor controlable: la subida no termina hasta que la prueba lo diga. */
function controllableUploader() {
  let release: (result: { error: string } | undefined) => void = () => {};
  const uploader: ReceiptUploader = {
    compress: vi.fn(async (input: File) => input),
    attach: vi.fn(
      () =>
        new Promise<{ error: string } | undefined>((resolve) => {
          release = resolve;
        }),
    ),
  };
  return { uploader, finish: (result?: { error: string }) => release(result) };
}

describe("receipt upload store", () => {
  beforeEach(() => {
    useReceiptUploadStore.setState({ uploads: {} });
  });

  it("el egreso queda en vuelo de inmediato y se limpia al terminar: el guardado no espera", async () => {
    const { uploader, finish } = controllableUploader();
    const onDone = vi.fn();

    const promise = useReceiptUploadStore
      .getState()
      .enqueue(EXPENSE, file(), { uploader, onDone });

    // Antes de que la subida termine, la fila ya puede pintar su indicador.
    const inFlight = useReceiptUploadStore.getState().uploads[EXPENSE];
    expect(inFlight?.status).toBe("pending");
    expect(hasPendingUploads(useReceiptUploadStore.getState().uploads)).toBe(true);
    expect(onDone).not.toHaveBeenCalled();

    // La subida sigue en vuelo hasta que la prueba la suelta.
    await vi.waitFor(() => expect(uploader.attach).toHaveBeenCalled());
    expect(useReceiptUploadStore.getState().uploads[EXPENSE]?.status).toBe("pending");

    finish(undefined);
    await promise;

    expect(useReceiptUploadStore.getState().uploads[EXPENSE]).toBeUndefined();
    expect(hasPendingUploads(useReceiptUploadStore.getState().uploads)).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("envía el archivo comprimido con el id del egreso", async () => {
    const compressed = file("recibo.webp");
    const uploader: ReceiptUploader = {
      compress: vi.fn(async () => compressed),
      attach: vi.fn(async () => undefined),
    };

    await useReceiptUploadStore.getState().enqueue(EXPENSE, file(), { uploader });

    const body = (uploader.attach as ReturnType<typeof vi.fn>).mock.calls[0][0] as FormData;
    expect(body.get("expenseId")).toBe(EXPENSE);
    expect(body.get("file")).toBe(compressed);
  });

  it("una subida fallida queda en failed con su aviso y se puede reintentar", async () => {
    const { uploader, finish } = controllableUploader();
    const promise = useReceiptUploadStore.getState().enqueue(EXPENSE, file(), { uploader });
    await vi.waitFor(() => expect(uploader.attach).toHaveBeenCalled());
    finish({ error: "No se pudo subir el comprobante." });
    await promise;

    const failed = useReceiptUploadStore.getState().uploads[EXPENSE];
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("No se pudo subir el comprobante.");
    expect(hasPendingUploads(useReceiptUploadStore.getState().uploads)).toBe(false);

    // Reintentar es volver a encolar: el fallo anterior desaparece.
    const retry: ReceiptUploader = {
      compress: vi.fn(async (input: File) => input),
      attach: vi.fn(async () => undefined),
    };
    await useReceiptUploadStore.getState().enqueue(EXPENSE, file(), { uploader: retry });
    expect(useReceiptUploadStore.getState().uploads[EXPENSE]).toBeUndefined();
  });

  it("si la compresión falla, el egreso sigue guardado y el aviso es el de la compresión", async () => {
    const uploader: ReceiptUploader = {
      compress: vi.fn(async () => {
        throw new Error("Formato no admitido.");
      }),
      attach: vi.fn(async () => undefined),
    };

    await useReceiptUploadStore.getState().enqueue(EXPENSE, file(), { uploader });

    expect(useReceiptUploadStore.getState().uploads[EXPENSE]?.error).toBe(
      "Formato no admitido.",
    );
    expect(uploader.attach).not.toHaveBeenCalled();
  });
});
