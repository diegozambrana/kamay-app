import { RouteLoading } from "@/components/shared/route-loading";
import { FormSkeleton } from "@/components/shared/skeletons";

export default function OrdersIdEditLoading() {
  return (
    <RouteLoading
      breadcrumbs={[{ label: "Pedidos", href: "/orders" }, { label: "Editar" }]}
      title="Editar pedido"
    >
      <FormSkeleton />
    </RouteLoading>
  );
}
