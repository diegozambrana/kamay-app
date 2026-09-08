import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_CONCURRENT_UPLOADS,
  type TaskUploader,
  hasPendingUploads,
  uploadsForTask,
  useTaskUploadStore,
} from "./upload-store";

const TASK = "22222222-2222-4222-8222-222222222222";

function imagen(name = "taza.jpg", size = 10 * 1024 * 1024): File {
  const file = new File(["x"], name, { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function pdf(name = "ficha.pdf", size = 12 * 1024 * 1024): File {
  const file = new File(["x"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/** Subidor que registra qué se comprimió y qué se mandó, sin tocar la red. */
function fakeUploader(
  overrides: Partial<TaskUploader> & { comprimido?: number } = {},
): TaskUploader & { comprimidas: File[]; enviadas: FormData[] } {
  const comprimidas: File[] = [];
  const enviadas: FormData[] = [];

  return {
    comprimidas,
    enviadas,
    compress:
      overrides.compress ??
      (async (file) => {
        comprimidas.push(file);
        const chico = new File(["x"], file.name, { type: file.type });
        Object.defineProperty(chico, "size", {
          value: overrides.comprimido ?? 2 * 1024 * 1024,
        });
        return chico;
      }),
    attach:
      overrides.attach ??
      (async (formData) => {
        enviadas.push(formData);
        return undefined;
      }),
  };
}

beforeEach(() => {
  useTaskUploadStore.setState({ uploads: [] });
});

describe("cola de adjuntos de tarea", () => {
  it("comprime una foto de 10 MB antes de mandarla", async () => {
    const uploader = fakeUploader();

    await useTaskUploadStore.getState().enqueue(TASK, [imagen()], { uploader });

    expect(uploader.comprimidas).toHaveLength(1);
    expect(uploader.enviadas).toHaveLength(1);
    const enviada = uploader.enviadas[0].get("file") as File;
    expect(enviada.size).toBeLessThanOrEqual(5 * 1024 * 1024);
  });

  it("manda el identificador de la tarea con cada archivo", async () => {
    const uploader = fakeUploader();

    await useTaskUploadStore.getState().enqueue(TASK, [imagen()], { uploader });

    expect(uploader.enviadas[0].get("taskId")).toBe(TASK);
  });

  it("rechaza un archivo que no es imagen y pasa de 5 MB, sin subirlo", async () => {
    const uploader = fakeUploader();

    await useTaskUploadStore.getState().enqueue(TASK, [pdf()], { uploader });

    // No se gasta la red en subirlo para que el servidor lo rechace después.
    expect(uploader.enviadas).toHaveLength(0);
    expect(uploader.comprimidas).toHaveLength(0);

    const [fallida] = useTaskUploadStore.getState().uploads;
    expect(fallida.status).toBe("failed");
    expect(fallida.error).toContain("5 MB");
  });

  it("un archivo que no es imagen y cabe viaja sin comprimir", async () => {
    const uploader = fakeUploader();
    const chico = pdf("ficha.pdf", 200 * 1024);

    await useTaskUploadStore.getState().enqueue(TASK, [chico], { uploader });

    expect(uploader.comprimidas).toHaveLength(0);
    expect(uploader.enviadas).toHaveLength(1);
  });

  it("lo que está subiendo se ve mientras viaja", async () => {
    let soltar: (() => void) | undefined;
    const uploader = fakeUploader({
      attach: () =>
        new Promise((resolve) => {
          soltar = () => resolve(undefined);
        }),
    });

    const enVuelo = useTaskUploadStore
      .getState()
      .enqueue(TASK, [imagen()], { uploader });

    // Antes de que la subida termine, la entrada existe y está pendiente.
    await vi.waitFor(() => {
      expect(useTaskUploadStore.getState().uploads).toHaveLength(1);
      expect(soltar).toBeDefined();
    });
    const [pendiente] = useTaskUploadStore.getState().uploads;
    expect(pendiente.status).toBe("pending");
    expect(pendiente.fileName).toBe("taza.jpg");
    expect(hasPendingUploads(useTaskUploadStore.getState().uploads)).toBe(true);

    soltar?.();
    await enVuelo;

    // Al terminar bien, la entrada se retira: lo que queda es el adjunto real.
    expect(useTaskUploadStore.getState().uploads).toHaveLength(0);
  });

  it("una subida fallida queda señalada y se puede reintentar", async () => {
    let falla = true;
    const uploader = fakeUploader({
      attach: async () => (falla ? { error: "sin conexión" } : undefined),
    });

    await useTaskUploadStore.getState().enqueue(TASK, [imagen()], { uploader });

    const [fallida] = useTaskUploadStore.getState().uploads;
    expect(fallida.status).toBe("failed");
    expect(fallida.error).toBe("sin conexión");

    falla = false;
    await useTaskUploadStore.getState().retry(fallida.id, imagen(), { uploader });

    expect(useTaskUploadStore.getState().uploads).toHaveLength(0);
  });

  it("un fallo no arrastra a los demás adjuntos del lote", async () => {
    const uploader = fakeUploader({
      attach: async (formData) => {
        const file = formData.get("file") as File;
        return file.name === "rota.jpg" ? { error: "sin conexión" } : undefined;
      },
    });

    await useTaskUploadStore
      .getState()
      .enqueue(TASK, [imagen("buena.jpg"), imagen("rota.jpg"), imagen("otra.jpg")], {
        uploader,
      });

    const restantes = useTaskUploadStore.getState().uploads;
    expect(restantes).toHaveLength(1);
    expect(restantes[0].fileName).toBe("rota.jpg");
  });

  it("sube varias imágenes a la vez, cada una con su propia entrada", async () => {
    const uploader = fakeUploader();

    await useTaskUploadStore
      .getState()
      .enqueue(TASK, [imagen("a.jpg"), imagen("b.jpg"), imagen("c.jpg")], {
        uploader,
      });

    expect(uploader.enviadas).toHaveLength(3);
  });

  it("no manda más de dos a la vez", async () => {
    let simultaneas = 0;
    let pico = 0;
    const sueltas: (() => void)[] = [];

    const uploader = fakeUploader({
      attach: () => {
        simultaneas += 1;
        pico = Math.max(pico, simultaneas);
        return new Promise((resolve) => {
          sueltas.push(() => {
            simultaneas -= 1;
            resolve(undefined);
          });
        });
      },
    });

    const lote = useTaskUploadStore
      .getState()
      .enqueue(TASK, [imagen("a.jpg"), imagen("b.jpg"), imagen("c.jpg"), imagen("d.jpg")], {
        uploader,
      });

    // Se van soltando de una en una: el pico nunca debe pasar del tope.
    for (let i = 0; i < 4; i += 1) {
      await vi.waitFor(() => expect(sueltas.length).toBeGreaterThan(i));
      sueltas[i]();
    }
    await lote;

    expect(pico).toBeLessThanOrEqual(MAX_CONCURRENT_UPLOADS);
    expect(uploader.enviadas.length + sueltas.length).toBeGreaterThan(0);
  });

  it("avisa cuando queda algo en vuelo, para el aviso de salir de la página", () => {
    expect(hasPendingUploads([])).toBe(false);
    expect(
      hasPendingUploads([
        { id: "1", taskId: TASK, fileName: "a.jpg", status: "failed", error: "x" },
      ]),
    ).toBe(false);
    expect(
      hasPendingUploads([
        { id: "1", taskId: TASK, fileName: "a.jpg", status: "pending", error: null },
      ]),
    ).toBe(true);
  });

  it("cada detalle pinta solo las subidas de su tarea", () => {
    const uploads = [
      { id: "1", taskId: TASK, fileName: "a.jpg", status: "pending" as const, error: null },
      { id: "2", taskId: "otra", fileName: "b.jpg", status: "pending" as const, error: null },
    ];

    expect(uploadsForTask(uploads, TASK)).toHaveLength(1);
  });
});
