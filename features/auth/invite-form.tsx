"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { acceptInvitation, signUpAndAccept } from "@/actions/members";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Canje del enlace de invitación. Con sesión abierta basta confirmar; sin ella
 * se crea la cuenta ahí mismo, porque en Kamay no existe registro público.
 */
export function InviteForm({
  token,
  signedIn,
}: {
  token: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = signedIn
        ? await acceptInvitation(token)
        : await signUpAndAccept({
            email: String(data.get("email") ?? ""),
            password: String(data.get("password") ?? ""),
            token,
          });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      router.replace("/dashboard");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Te invitaron a Kamay</CardTitle>
        <CardDescription>
          {signedIn
            ? "Confirma para unirte a la organización."
            : "Crea tu cuenta con el correo al que llegó la invitación."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {!signedIn && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" name="email" type="email" required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={6}
                  required
                />
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {signedIn ? "Aceptar invitación" : "Crear cuenta y unirme"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
