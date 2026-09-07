import { MainContainer } from "@/components/layout/main-container";

export const metadata = { title: "Mis pendientes · Kamay" };

/**
 * Cascarón de V20: *Mis pendientes* llega con KAM-17.
 *
 * Existe desde ahora porque es el destino de la tercera ranura de la barra
 * inferior (mapa §4.2). La estructura de navegación del celular se cierra en
 * KAM-13 de una vez; llenar esta pantalla no volverá a moverla.
 */
export default function MyTasksPage() {
  return (
    <MainContainer
      title="Mis pendientes"
      description="Aquí vivirán tus tareas por hacer, agrupadas por fecha."
    >
      {null}
    </MainContainer>
  );
}
