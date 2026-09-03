import { MainContainer } from "@/components/layout/main-container";

export const metadata = { title: "Panel · Kamay" };

/** Cascarón de V2: el contenido del panel llega con KAM-14. */
export default function DashboardPage() {
  return (
    <MainContainer title="Panel" description="Aquí vivirá el panel principal.">
      {null}
    </MainContainer>
  );
}
