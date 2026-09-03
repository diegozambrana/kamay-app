"use client";

import { useState } from "react";

import { FileDropzone } from "@/components/file-dropzone/file-dropzone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  isAcceptedImage,
  RECEIPT_INPUT_MAX_BYTES,
  UNSUPPORTED_FORMAT_MESSAGE,
} from "@/lib/attachments/compress-image";
import { IMAGE_ACCEPT } from "@/lib/catalog/photos";

/**
 * El comprobante del formulario (design D4). Admite una foto original grande
 * —el límite de entrada es de cordura— porque la compresión en el cliente es
 * la que garantiza los 5 MB antes de subir. La subida no ocurre aquí: el
 * formulario la encola después de guardar.
 *
 * Un archivo que no es una imagen admitida se rechaza aquí, antes de guardar,
 * nombrando los formatos válidos: el `accept` del selector no basta, porque
 * arrastrar un archivo lo salta.
 */
export function ReceiptField({
  value,
  onChange,
  disabled,
}: {
  value: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [formatError, setFormatError] = useState<string | null>(null);

  function accept(files: File[]) {
    const rejected = files.find((file) => !isAcceptedImage(file.type));
    if (rejected) {
      setFormatError(UNSUPPORTED_FORMAT_MESSAGE);
      onChange(files.filter((file) => isAcceptedImage(file.type)));
      return;
    }
    setFormatError(null);
    onChange(files);
  }

  return (
    <div className="flex flex-col gap-2">
      <FileDropzone
        value={value}
        onChange={accept}
        accept={IMAGE_ACCEPT}
        maxFiles={1}
        maxSizeBytes={RECEIPT_INPUT_MAX_BYTES}
        disabled={disabled}
        label="Comprobante (opcional)"
        description="Una foto del recibo. Se comprime antes de subir y no frena el guardado."
      />
      {formatError && (
        <Alert variant="destructive" data-testid="receipt-format-error">
          <AlertTitle>Ese archivo no sirve como comprobante</AlertTitle>
          <AlertDescription>{formatError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
