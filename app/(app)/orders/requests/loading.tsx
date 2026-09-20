import { RouteLoading } from "@/components/shared/route-loading";
import { ListSkeleton } from "@/components/shared/skeletons";

export default function OrderRequestsLoading() {
  return (
    <RouteLoading
      breadcrumbs={[{ label: "Pedidos", href: "/orders" }, { label: "Solicitudes" }]}
      title="Solicitudes de pedido"
    >
      <ListSkeleton />
    </RouteLoading>
  );
}
