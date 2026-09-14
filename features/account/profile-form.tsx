"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { updateDisplayName } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const schema = z.object({
  displayName: z.string().trim().min(1, "Ingresa un nombre."),
});

type FormValues = z.infer<typeof schema>;

/**
 * Nombre visible de la propia membresía en la organización activa (KAM-24).
 * Sigue el patrón de `features/auth/reset-password-form.tsx`: se guarda sin
 * recargar la pantalla y el resultado —éxito o error de dominio— se muestra
 * en el propio formulario.
 */
export function ProfileForm({
  initialDisplayName,
}: {
  initialDisplayName: string | null;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: initialDisplayName ?? "" },
  });
  const displayNameField = register("displayName");
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateDisplayName({ displayName: values.displayName });
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      setSaved(true);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate data-testid="profile-form">
      <FieldGroup>
        <Field data-invalid={!!errors.displayName}>
          <FieldLabel htmlFor="profile-display-name">Nombre visible</FieldLabel>
          <Input
            id="profile-display-name"
            autoComplete="name"
            {...displayNameField}
            onChange={(event) => {
              void displayNameField.onChange(event);
              setServerError(null);
              setSaved(false);
            }}
          />
          <FieldError errors={[errors.displayName]} />
        </Field>

        {serverError && (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        )}
        {saved && !serverError && (
          <p className="text-sm text-muted-foreground" data-testid="profile-saved">
            Nombre guardado.
          </p>
        )}

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar nombre"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
