import { RouteLoading } from "@/components/shared/route-loading";
import { FormSkeleton } from "@/components/shared/skeletons";

export default function OrdersNewLoading() {
  return (
    <RouteLoading
      breadcrumbs={[{ label: "Pedidos", href: "/orders" }, { label: "Nuevo pedido" }]}
      title="Nuevo pedido"
    >
      <FormSkeleton />
    </RouteLoading>
  );
}
