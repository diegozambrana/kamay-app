"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createOrganization } from "@/actions/platform";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "@/lib/platform/schema";

/**
 * Crear una organización (KAM-26, design D7): un diálogo y no una ruta, son
 * tres campos. La organización nace con su línea compartida y sus estados
 * mínimos; al terminar se va a su detalle, donde se le agrega su primera
 * dueña.
 */
export function CreateOrganizationDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    setError(null);

    if (!name) {
      setError("La organización necesita un nombre");
      return;
    }

    startTransition(async () => {
      const result = await createOrganization({
        name,
        currency: String(data.get("currency") ?? ""),
        timezone: String(data.get("timezone") ?? ""),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.push(`/admin/organizations/${result.organizationId}`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>Nueva organización</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva organización</DialogTitle>
          <DialogDescription>
            Nace con la línea General y los estados mínimos. Después le agregas su
            dueña o dueño.
          </DialogDescription>
        </DialogHeader>

        <form id="create-organization" onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="organization-name">Nombre</Label>
            <Input id="organization-name" name="name" autoComplete="off" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="organization-currency">Moneda</Label>
              <Input
                id="organization-currency"
                name="currency"
                defaultValue={DEFAULT_CURRENCY}
                maxLength={3}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="organization-timezone">Zona horaria</Label>
              <Input
                id="organization-timezone"
                name="timezone"
                defaultValue={DEFAULT_TIMEZONE}
                required
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button type="submit" form="create-organization" disabled={pending}>
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
