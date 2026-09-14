"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { changePassword } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Ingresa tu contraseña actual."),
    newPassword: z
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    error: "Las contraseñas no coinciden.",
  });

type FormValues = z.infer<typeof schema>;

/**
 * Cambio de contraseña con verificación de la actual (KAM-24). Tres campos:
 * contraseña actual, nueva y su confirmación. La confirmación y el largo
 * mínimo se validan con Zod antes de tocar el servidor; la contraseña actual
 * la verifica `changePassword` sin cerrar la sesión, correcta o no.
 */
export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setServerError(null);
      reset();
    }
  }

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      onOpenChange(false);
    });
  });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="open-change-password"
        onClick={() => setOpen(true)}
      >
        Cambiar contraseña
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="change-password-dialog">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>Cambiar contraseña</DialogTitle>
              <DialogDescription>
                Ingresa tu contraseña actual y la nueva, dos veces.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="py-4">
              <Field data-invalid={!!errors.currentPassword}>
                <FieldLabel htmlFor="current-password">Contraseña actual</FieldLabel>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  {...register("currentPassword")}
                />
                <FieldError errors={[errors.currentPassword]} />
              </Field>

              <Field data-invalid={!!errors.newPassword}>
                <FieldLabel htmlFor="new-password">Nueva contraseña</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  {...register("newPassword")}
                />
                <FieldError errors={[errors.newPassword]} />
              </Field>

              <Field data-invalid={!!errors.confirmPassword}>
                <FieldLabel htmlFor="confirm-password">
                  Confirmar nueva contraseña
                </FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                />
                <FieldError errors={[errors.confirmPassword]} />
              </Field>

              {serverError && (
                <p role="alert" className="text-sm text-destructive">
                  {serverError}
                </p>
              )}
            </FieldGroup>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Cambiar contraseña"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
