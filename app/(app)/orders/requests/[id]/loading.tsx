import { RouteLoading } from "@/components/shared/route-loading";
import { DetailSkeleton } from "@/components/shared/skeletons";

export default function OrderRequestDetailLoading() {
  return (
    <RouteLoading
      breadcrumbs={[
        { label: "Pedidos", href: "/orders" },
        { label: "Solicitudes", href: "/orders/requests" },
        { label: "Solicitud" },
      ]}
      title="Solicitud"
    >
      <DetailSkeleton />
    </RouteLoading>
  );
}
