import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PublicRequestForm } from "@/features/order-requests/public-request-form";
import { createPublicClient } from "@/lib/supabase/public";

export const metadata = { title: "Solicitud de pedido · Kamay" };

type ResolvedRequest = {
  organization_id: string;
  request_id: string;
  organization_name: string;
  business_line_name: string;
  prefilled_name: string;
  prefilled_phone: string;
};

/**
 * KAM-28 · El formulario público, sin sesión.
 *
 * `createPublicClient()` y no `createClient()` (design D7): esta página tiene
 * que comportarse igual la abra quien la abra, con o sin cuenta en Kamay.
 *
 * Un token inválido, vencido, ya usado o de una solicitud archivada
 * resuelven todos al mismo mensaje — `resolve_order_request()` no distingue,
 * y esta página tampoco (spec `order-requests` — Requirement: La resolución
 * pública del token no revela nada de más).
 */
export default async function PublicOrderRequestPage({
  params,
}: PageProps<"/r/[token]">) {
  const { token } = await params;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .rpc("resolve_order_request", { p_token: token })
    .single<ResolvedRequest>();

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Este enlace no sirve</CardTitle>
          <CardDescription>
            Puede haber vencido, ya haberse usado, o no existir. Pide uno nuevo a
            quien te lo mandó.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <PublicRequestForm
      token={token}
      organizationId={data.organization_id}
      requestId={data.request_id}
      organizationName={data.organization_name}
      businessLineName={data.business_line_name}
      prefilledName={data.prefilled_name}
      prefilledPhone={data.prefilled_phone}
    />
  );
}
