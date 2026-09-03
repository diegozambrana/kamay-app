"use client";

import { create } from "zustand";

import { attachReceipt } from "@/actions/expenses";
import { compressImage } from "@/lib/attachments/compress-image";

export type ReceiptUploadStatus = "pending" | "failed";

export type ReceiptUpload = {
  status: ReceiptUploadStatus;
  fileName: string;
  error: string | null;
};

/** Lo que el store necesita para subir: separado para poder probarlo sin red. */
export type ReceiptUploader = {
  compress: (file: File) => Promise<File>;
  attach: (formData: FormData) => Promise<{ error: string } | undefined>;
};

type ReceiptUploadState = {
  /** Subidas en vuelo o fallidas, por egreso. Estado de interfaz, no datos. */
  uploads: Record<string, ReceiptUpload>;
  /**
   * Encola el comprobante de un egreso ya guardado: comprime y sube en
   * segundo plano. Resuelve cuando termina, con o sin éxito; nadie tiene que
   * esperarla (design D4).
   */
  enqueue: (
    expenseId: string,
    file: File,
    options?: { onDone?: () => void; uploader?: ReceiptUploader },
  ) => Promise<void>;
  dismiss: (expenseId: string) => void;
};

const defaultUploader: ReceiptUploader = {
  compress: (file) => compressImage(file),
  attach: (formData) => attachReceipt(formData),
};

/**
 * Cola de comprobantes (design D4): el egreso se guarda primero y la foto sube
 * después. La bandeja consulta este store para pintar "comprobante
 * subiendo…" en la fila, y el detalle ofrece reintentar cuando falla.
 *
 * Guarda estado transitorio de interfaz —qué está en vuelo—, nunca datos
 * derivados (convención nº 4).
 */
export const useReceiptUploadStore = create<ReceiptUploadState>((set, get) => ({
  uploads: {},

  async enqueue(expenseId, file, options = {}) {
    const uploader = options.uploader ?? defaultUploader;

    set((state) => ({
      uploads: {
        ...state.uploads,
        [expenseId]: { status: "pending", fileName: file.name, error: null },
      },
    }));

    try {
      const compressed = await uploader.compress(file);
      const body = new FormData();
      body.set("expenseId", expenseId);
      body.set("file", compressed);

      const result = await uploader.attach(body);
      if (result?.error) throw new Error(result.error);

      get().dismiss(expenseId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo subir el comprobante.";
      set((state) => ({
        uploads: {
          ...state.uploads,
          [expenseId]: { status: "failed", fileName: file.name, error: message },
        },
      }));
    } finally {
      options.onDone?.();
    }
  },

  dismiss(expenseId) {
    set((state) => {
      const uploads = { ...state.uploads };
      delete uploads[expenseId];
      return { uploads };
    });
  },
}));

/** ¿Hay alguna subida en vuelo? Es lo que decide el aviso de `beforeunload`. */
export function hasPendingUploads(uploads: Record<string, ReceiptUpload>): boolean {
  return Object.values(uploads).some((upload) => upload.status === "pending");
}
