"use client";

import { create } from "zustand";

import { attachToTask } from "@/actions/tasks";
import { compressImage, isAcceptedImage } from "@/lib/attachments/compress-image";
import { FILE_TOO_LARGE_MESSAGE, fitsFileSize } from "@/lib/attachments/limits";

export type TaskUploadStatus = "pending" | "failed";

export type TaskUpload = {
  /** Identidad local, solo de interfaz: la fila la identifica el servidor. */
  id: string;
  taskId: string;
  fileName: string;
  status: TaskUploadStatus;
  error: string | null;
};

/** Lo que el store necesita para subir, separado para poder probarlo sin red. */
export type TaskUploader = {
  compress: (file: File) => Promise<File>;
  attach: (formData: FormData) => Promise<{ error: string } | undefined>;
};

const defaultUploader: TaskUploader = {
  compress: (file) => compressImage(file),
  attach: (formData) => attachToTask(formData),
};

/**
 * Cuántas subidas viajan a la vez.
 *
 * Tres imágenes de 5 MB en paralelo por la conexión de un taller no llegan
 * antes, y sí compiten con el guardado del cuerpo, que es lo que el requisito
 * promete que sigue funcionando mientras algo sube (design D4).
 */
export const MAX_CONCURRENT_UPLOADS = 2;

type State = {
  /** Subidas en vuelo o fallidas. Estado de interfaz, nunca datos. */
  uploads: TaskUpload[];
  /**
   * Encola archivos ya validados por la pantalla. Resuelve cuando termina el
   * lote, con o sin éxito; nadie tiene que esperarla.
   */
  enqueue: (
    taskId: string,
    files: File[],
    options?: { onDone?: () => void; uploader?: TaskUploader },
  ) => Promise<void>;
  retry: (id: string, file: File, options?: { uploader?: TaskUploader }) => Promise<void>;
  dismiss: (id: string) => void;
};

/**
 * Cola de adjuntos de tarea (design D4).
 *
 * Sigue el patrón de `receipt-upload-store` (KAM-09) pero indexado por
 * **adjunto** y no por registro: un egreso tiene un comprobante y una tarea
 * admite quince, que se arrastran de tres en tres. Indexar por registro haría
 * que la segunda imagen pisara el estado de la primera.
 */
export const useTaskUploadStore = create<State>((set, get) => ({
  uploads: [],

  async enqueue(taskId, files, options = {}) {
    const uploader = options.uploader ?? defaultUploader;

    const entries: { upload: TaskUpload; file: File }[] = files.map((file) => ({
      upload: {
        id: crypto.randomUUID(),
        taskId,
        fileName: file.name,
        status: "pending" as const,
        error: null,
      },
      file,
    }));

    set((state) => ({
      uploads: [...state.uploads, ...entries.map((entry) => entry.upload)],
    }));

    // Cola de concurrencia acotada: dos trabajadores tirando de la misma lista.
    let next = 0;
    const worker = async () => {
      while (next < entries.length) {
        const entry = entries[next++];
        await send(set, get, entry.upload, entry.file, uploader);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENT_UPLOADS, entries.length) }, worker),
    );

    options.onDone?.();
  },

  async retry(id, file, options = {}) {
    const upload = get().uploads.find((item) => item.id === id);
    if (!upload) return;

    set((state) => ({
      uploads: state.uploads.map((item) =>
        item.id === id ? { ...item, status: "pending", error: null } : item,
      ),
    }));

    await send(set, get, upload, file, options.uploader ?? defaultUploader);
  },

  dismiss(id) {
    set((state) => ({ uploads: state.uploads.filter((item) => item.id !== id) }));
  },
}));

/**
 * Sube un archivo: comprime si es imagen, lo manda y retira la entrada al
 * terminar bien.
 *
 * Una imagen de 10 MB se comprime hasta caber en el límite; lo que no es
 * imagen viaja tal cual y se rechaza aquí mismo si pasa de 5 MB, sin gastar
 * la red en subirlo para que el servidor lo rechace después.
 */
async function send(
  set: (fn: (state: State) => Partial<State>) => void,
  get: () => State,
  upload: TaskUpload,
  file: File,
  uploader: TaskUploader,
): Promise<void> {
  const fail = (message: string) => {
    set((state) => ({
      uploads: state.uploads.map((item) =>
        item.id === upload.id ? { ...item, status: "failed", error: message } : item,
      ),
    }));
  };

  try {
    const esImagen = isAcceptedImage(file.type);

    if (!esImagen && !fitsFileSize(file.size)) {
      fail(FILE_TOO_LARGE_MESSAGE);
      return;
    }

    const listo = esImagen ? await uploader.compress(file) : file;

    const body = new FormData();
    body.set("taskId", upload.taskId);
    body.set("file", listo);

    const result = await uploader.attach(body);
    if (result?.error) throw new Error(result.error);

    get().dismiss(upload.id);
  } catch (error) {
    fail(error instanceof Error ? error.message : "No se pudo subir el adjunto.");
  }
}

/** ¿Hay alguna subida en vuelo? Es lo que decide el aviso de `beforeunload`. */
export function hasPendingUploads(uploads: TaskUpload[]): boolean {
  return uploads.some((upload) => upload.status === "pending");
}

/** Las subidas de una tarea concreta: el detalle solo pinta las suyas. */
export function uploadsForTask(uploads: TaskUpload[], taskId: string): TaskUpload[] {
  return uploads.filter((upload) => upload.taskId === taskId);
}
