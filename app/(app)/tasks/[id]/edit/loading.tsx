import { RouteLoading } from "@/components/shared/route-loading";
import { FormSkeleton } from "@/components/shared/skeletons";

export default function TasksIdEditLoading() {
  return (
    <RouteLoading
      breadcrumbs={[{ label: "Tareas", href: "/tasks" }, { label: "Editar" }]}
      title="Editar tarea"
    >
      <FormSkeleton />
    </RouteLoading>
  );
}
