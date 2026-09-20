import { RouteLoading } from "@/components/shared/route-loading";
import { FormSkeleton } from "@/components/shared/skeletons";

export default function ExtensionsSlugLoading() {
  return (
    <RouteLoading breadcrumbs={[{ label: "Herramientas" }, { label: "Herramienta" }]} title="Herramienta">
      <FormSkeleton />
    </RouteLoading>
  );
}
