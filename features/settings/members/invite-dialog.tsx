"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { inviteMember } from "@/actions/members";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/features/platform/roles";
import type { Role } from "@/types";

/**
 * Invitar a alguien (spec `settings-interaction` → *The Users and roles
 * section follows the same pattern*).
 *
 * Al crearse la invitación, el mismo diálogo pasa a mostrar el enlace para
 * copiarlo. Es la única vez que existe: en la base solo queda su hash, así que
 * al cerrar el diálogo se pierde y hay que revocar e invitar de nuevo. Por eso
 * el aviso va pegado al enlace y cerrar es un «Listo» explícito.
 */
export function InviteDialog() {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    if (pending && !next) return;
    setOpen(next);
    if (!next) {
      setInviteUrl(null);
      setCopied(false);
      setError(null);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await inviteMember({
        email: String(data.get("email") ?? ""),
        role: String(data.get("role") ?? "assistant") as Role,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setInviteUrl(result.inviteUrl);
    });
  }

  async function copy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  return (
    <>
      <Button onClick={() => onOpenChange(true)}>Invitar</Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="invite-dialog">
          {inviteUrl ? (
            <>
              <DialogHeader>
                <DialogTitle>Invitación creada</DialogTitle>
                <DialogDescription>
                  Copia este enlace y envíaselo. No se vuelve a mostrar: al cerrar este
                  diálogo se pierde.
                </DialogDescription>
              </DialogHeader>

              <div
                role="status"
                data-testid="invite-url"
                className="rounded-lg border bg-muted/40 p-3 text-sm"
              >
                <code className="block break-all text-xs">{inviteUrl}</code>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={copy}>
                  {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
                  {copied ? "Enlace copiado" : "Copiar enlace"}
                </Button>
                <DialogClose asChild>
                  <Button type="button">Listo</Button>
                </DialogClose>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Invitar</DialogTitle>
                <DialogDescription>
                  Se crea un enlace para que esa persona entre a esta organización con el
                  rol que elijas.
                </DialogDescription>
              </DialogHeader>

              <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="invite-email">Correo</FieldLabel>
                  <Input
                    id="invite-email"
                    name="email"
                    type="email"
                    placeholder="ayudante@ejemplo.com"
                    autoComplete="off"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="invite-role">Rol</FieldLabel>
                  <Select name="role" defaultValue="assistant">
                    <SelectTrigger id="invite-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assistant">{ROLE_LABELS.assistant}</SelectItem>
                      <SelectItem value="owner">{ROLE_LABELS.owner}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </form>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={pending}>
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" form={formId} disabled={pending}>
                  Invitar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
