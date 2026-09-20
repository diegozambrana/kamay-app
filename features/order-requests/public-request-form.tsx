"use client";

import { useState } from "react";

import { submitOrderRequest } from "@/actions/order-requests";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FileDropzone } from "@/components/file-dropzone/file-dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { compressImage, RECEIPT_INPUT_MAX_BYTES } from "@/lib/attachments/compress-image";
import { IMAGE_ACCEPT } from "@/lib/catalog/photos";
import { MAX_IMAGES_PER_REQUEST, publicOrderRequestSchema } from "@/lib/order-requests/schema";
import { createPublicClient } from "@/lib/supabase/public";
import { ORDER_REQUESTS_BUCKET } from "@/types";
import { CheckCircle2Icon } from "lucide-react";

type Props = {
  token: string;
  organizationId: string;
  requestId: string;
  organizationName: string;
  businessLineName: string;
  prefilledName: string;
  prefilledPhone: string;
};

/**
 * KAM-28 · El formulario que ve el cliente sin sesión.
 *
 * **Solo nombre, teléfono, nota e imágenes.** Nada del catálogo, ningún
 * precio, ningún otro dato de la organización (criterio de aceptación 1). Las
 * imágenes suben directo desde el navegador al bucket de cuarentena con el
 * cliente sin sesión (`createPublicClient()`), nunca por el servidor: la
 * política de Storage ya decide si la carpeta sigue abierta (design D1/D2).
 * Un fallo al subir una imagen no bloquea el envío: los datos de contacto son
 * lo que importa recibir, y es lo que la acción exige.
 */
export function PublicRequestForm({
  token,
  organizationId,
  requestId,
  organizationName,
  businessLineName,
  prefilledName,
  prefilledPhone,
}: Props) {
  const [name, setName] = useState(prefilledName);
  const [phone, setPhone] = useState(prefilledPhone);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function uploadImages(): Promise<void> {
    if (files.length === 0) return;

    const supabase = createPublicClient();
    let failed = 0;

    for (const file of files) {
      try {
        const compressed = await compressImage(file);
        const extension = compressed.name.includes(".")
          ? compressed.name.slice(compressed.name.lastIndexOf("."))
          : "";
        const path = `${organizationId}/${requestId}/${crypto.randomUUID()}${extension}`;

        const { error } = await supabase.storage
          .from(ORDER_REQUESTS_BUCKET)
          .upload(path, compressed, { contentType: compressed.type });

        if (error) failed += 1;
      } catch {
        failed += 1;
      }
    }

    if (failed > 0) {
      setUploadWarning(
        failed === files.length
          ? "No se pudieron subir las imágenes, pero tus datos sí se mandaron."
          : `${failed} imagen${failed === 1 ? "" : "es"} no se pudo subir; el resto sí.`,
      );
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setUploadWarning(null);

    const parsed = publicOrderRequestSchema.safeParse({ name, phone, note });
    if (!parsed.success) {
      const fieldErrors: { name?: string; phone?: string } = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "name") fieldErrors.name = issue.message;
        if (issue.path[0] === "phone") fieldErrors.phone = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    setPending(true);
    try {
      // Las imágenes van primero: si el envío marca la solicitud como
      // recibida y la cuarentena se cierra, una subida tardía ya no entraría
      // (spec `order-requests` — Requirement: Recibida o vencida, la carpeta
      // se cierra).
      await uploadImages();

      const result = await submitOrderRequest(token, parsed.data);
      if (result && "error" in result) {
        setSubmitError(result.error);
        return;
      }
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Empty>
            <EmptyMedia variant="icon">
              <CheckCircle2Icon className="text-primary" />
            </EmptyMedia>
            <EmptyTitle>Listo, lo recibimos</EmptyTitle>
            <EmptyDescription>
              {organizationName} ya tiene tus datos. Te van a contactar por tu
              teléfono para seguir con el pedido.
            </EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedido a {organizationName}</CardTitle>
        <CardDescription>
          Completa tus datos{businessLineName ? ` para ${businessLineName}` : ""}. No
          hace falta que elijas nada del catálogo: eso lo arma quien te atiende.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Tu nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              required
            />
            {errors.name && (
              <p role="alert" className="text-sm text-destructive">
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Tu teléfono</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={pending}
              required
            />
            {errors.phone && (
              <p role="alert" className="text-sm text-destructive">
                {errors.phone}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={pending}
              rows={3}
            />
          </div>

          <FileDropzone
            value={files}
            onChange={setFiles}
            accept={IMAGE_ACCEPT}
            maxFiles={MAX_IMAGES_PER_REQUEST}
            maxSizeBytes={RECEIPT_INPUT_MAX_BYTES}
            disabled={pending}
            label="Imágenes de referencia (opcional)"
            description="Hasta 6 fotos. Se comprimen antes de mandarse."
          />

          {uploadWarning && (
            <Alert>
              <AlertTitle>{uploadWarning}</AlertTitle>
            </Alert>
          )}

          {submitError && (
            <Alert variant="destructive" data-testid="submit-error">
              <AlertTitle>{submitError}</AlertTitle>
              <AlertDescription>Intenta de nuevo.</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Enviando…" : "Mandar mis datos"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
