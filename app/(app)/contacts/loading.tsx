import { RouteLoading } from "@/components/shared/route-loading";
import { ListSkeleton } from "@/components/shared/skeletons";

export default function ContactsLoading() {
  return (
    <RouteLoading title="Contactos">
      <ListSkeleton />
    </RouteLoading>
  );
}
