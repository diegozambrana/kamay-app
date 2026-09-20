"use client";

import { useState } from "react";

import { submitOrderComment } from "@/actions/order-shares";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { publicOrderCommentSchema } from "@/lib/order-shares/schema";
import { formatCalendarDate } from "@/lib/format/datetime";
import { CheckCircle2Icon } from "lucide-react";

type LineItem = { description: string; quantity: number; unitPrice: number };
type Image = { id: string; fileName: string; signedUrl: string | null };

type Props = {
  token: string;
  code: number;
  businessLineName: string;
  statusName: string;
  dueDate: string | null;
  total: number;
  paid: number;
  balance: number;
  items: LineItem[];
  images: Image[];
};

/**
 * KAM-32 · Lo que ve el cliente sin sesión: su pedido, sus imágenes, y un
 * lugar para dejar un comentario. Nunca un costo, un margen ni un proveedor
 * — eso ni siquiera llega hasta aquí, `resolve_order_share()` no lo devuelve
 * (spec `order-share` — Requirement: La resolución pública no expone nada de
 * más).
 */
export function PublicOrderView({
  token,
  code,
  businessLineName,
  statusName,
  dueDate,
  total,
  paid,
  balance,
  items,
  images,
}: Props) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<{ name?: string; body?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const parsed = publicOrderCommentSchema.safeParse({ name, body });
    if (!parsed.success) {
      const fieldErrors: { name?: string; body?: string } = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "name") fieldErrors.name = issue.message;
        if (issue.path[0] === "body") fieldErrors.body = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    setPending(true);
    try {
      const result = await submitOrderComment(token, parsed.data);
      if (result && "error" in result) {
        setSubmitError(result.error);
        return;
      }
      setSent(true);
      setBody("");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Pedido #{code}</CardTitle>
          <CardDescription>{businessLineName}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" data-testid="public-order-status">
              {statusName}
            </Badge>
            {dueDate && (
              <span className="text-sm text-muted-foreground">
                Fecha comprometida: {formatCalendarDate(dueDate)}
              </span>
            )}
          </div>

          {items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.unitPrice.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex flex-col gap-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span>Total</span>
              <span className="tabular-nums font-medium" data-testid="public-order-total">
                {total.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Pagado</span>
              <span className="tabular-nums">{paid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Saldo</span>
              <span className="tabular-nums" data-testid="public-order-balance">
                {balance.toFixed(2)}
              </span>
            </div>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((image) =>
                image.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={image.id}
                    src={image.signedUrl}
                    alt={image.fileName}
                    className="aspect-square rounded-md border object-cover"
                  />
                ) : null,
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deja un comentario</CardTitle>
        </CardHeader>
        <CardContent>
          {sent ? (
            <Empty>
              <EmptyMedia variant="icon">
                <CheckCircle2Icon className="text-primary" />
              </EmptyMedia>
              <EmptyTitle>Gracias por tu comentario</EmptyTitle>
              <EmptyDescription>Ya lo recibieron.</EmptyDescription>
            </Empty>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="comment-name">Tu nombre</Label>
                <Input
                  id="comment-name"
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
                <Label htmlFor="comment-body">Comentario</Label>
                <Textarea
                  id="comment-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  disabled={pending}
                  rows={3}
                  required
                />
                {errors.body && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.body}
                  </p>
                )}
              </div>

              {submitError && (
                <Alert variant="destructive" data-testid="comment-error">
                  <AlertTitle>{submitError}</AlertTitle>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Enviando…" : "Enviar comentario"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
