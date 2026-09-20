import { RouteLoading } from "@/components/shared/route-loading";
import { DetailSkeleton } from "@/components/shared/skeletons";

export default function OrdersIdLoading() {
  return (
    <RouteLoading
      breadcrumbs={[{ label: "Pedidos", href: "/orders" }, { label: "Pedido" }]}
      title="Pedido"
    >
      <DetailSkeleton />
    </RouteLoading>
  );
}
