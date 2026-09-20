"use client";

import { useTransition } from "react";

import { archiveOrderComment } from "@/actions/order-shares";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format/datetime";
import type { OrderComment } from "@/types";

/**
 * KAM-32 · Los comentarios del cliente, leídos en el detalle del pedido
 * (spec `order-share` — Requirement: El comentario del cliente se recibe sin
 * sesión, se lee en el detalle, y es inmutable). Solo la organización puede
 * archivarlos — nunca editarlos.
 */
export function OrderComments({
  orderId,
  comments,
  timezone = "",
}: {
  orderId: string;
  comments: OrderComment[];
  timezone?: string;
}) {
  const [pending, startTransition] = useTransition();

  function archive(commentId: string) {
    startTransition(async () => {
      await archiveOrderComment(orderId, commentId);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comentarios del cliente</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {comments.map((comment) => (
          <div
            key={comment.id}
            data-testid="order-comment"
            className="flex items-start justify-between gap-3 rounded-lg border p-3"
          >
            <div>
              <p className="text-sm font-medium">{comment.authorName}</p>
              <p className="text-sm">{comment.body}</p>
              <p className="text-xs text-muted-foreground">
                {timezone ? formatDateTime(comment.occurredAt, timezone) : comment.occurredAt}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => archive(comment.id)}
            >
              Archivar
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
