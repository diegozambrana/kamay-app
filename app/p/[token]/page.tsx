import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PublicOrderView } from "@/features/order-shares/public-order-view";
import { createPublicClient } from "@/lib/supabase/public";

export const metadata = { title: "Tu pedido · Kamay" };

type ResolvedOrderShare = {
  organization_id: string;
  order_id: string;
  code: number;
  business_line_name: string;
  status_name: string;
  due_date: string | null;
  total: number;
  paid: number;
  balance: number;
  items: { description: string; quantity: number; unitPrice: number }[];
  attachments: { id: string; fileName: string; storagePath: string }[];
};

/**
 * KAM-32 · El seguimiento del pedido, sin sesión.
 *
 * `createPublicClient()` (KAM-28, reutilizado): la página se comporta igual
 * la abra quien la abra, con o sin cuenta en Kamay.
 */
export default async function PublicOrderSharePage({
  params,
}: PageProps<"/p/[token]">) {
  const { token } = await params;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .rpc("resolve_order_share", { p_token: token })
    .single<ResolvedOrderShare>();

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Este enlace no sirve</CardTitle>
          <CardDescription>
            Puede haber vencido o haberse revocado. Pide uno nuevo a quien te lo mandó.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Firmar las URLs de las imágenes aquí, con el mismo cliente sin sesión: la
  // política de `storage.objects` ya decide si el enlace sigue vigente.
  const attachmentPaths = data.attachments.map((a) => a.storagePath);
  const { data: signed } =
    attachmentPaths.length > 0
      ? await supabase.storage.from("attachments").createSignedUrls(attachmentPaths, 60 * 60)
      : { data: [] as { path: string; signedUrl: string }[] | null };

  const images = data.attachments.map((attachment) => ({
    id: attachment.id,
    fileName: attachment.fileName,
    signedUrl:
      signed?.find((s) => s.path === attachment.storagePath)?.signedUrl ?? null,
  }));

  return (
    <PublicOrderView
      token={token}
      code={data.code}
      businessLineName={data.business_line_name}
      statusName={data.status_name}
      dueDate={data.due_date}
      total={data.total}
      paid={data.paid}
      balance={data.balance}
      items={data.items}
      images={images}
    />
  );
}
