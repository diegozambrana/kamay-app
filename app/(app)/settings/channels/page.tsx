import { redirect } from "next/navigation";

import { createSalesChannel, updateSalesChannel } from "@/actions/configuration";
import { NamedSection } from "@/features/settings/named-section";
import { getOwnerContext } from "@/lib/auth/session-context";
import { SalesChannelService } from "@/services/configuration/sales-channel-service";

export const metadata = { title: "Canales · Configuración · Kamay" };

export default async function ChannelsSettingsPage() {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  const channels = await new SalesChannelService(context.supabase).listAll(
    context.organizationId,
  );

  return (
    <NamedSection
      title="Canales de venta"
      description="Por dónde llega cada venta."
      placeholder="Feria"
      entity="channel"
      items={channels}
      onCreate={createSalesChannel}
      onUpdate={updateSalesChannel}
    />
  );
}
