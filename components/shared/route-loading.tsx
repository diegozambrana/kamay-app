import { MainContainer } from "@/components/layout/main-container";

type RouteLoadingProps = {
  /** El mismo título que la página: el encabezado no salta al llegar los datos. */
  title: string;
  description?: string;
  /** El esqueleto con la forma de lo que viene. */
  children: React.ReactNode;
};

/**
 * Lo que rinde el `loading.tsx` de cada segmento con datos (design D1).
 *
 * Las páginas son componentes de servidor que consultan antes de rendir, así
 * que el único momento en que puede verse un estado de carga es el que Next
 * abre con `loading.tsx` mientras el segmento llega. El encabezado se pinta
 * ya, con su título, para que la pantalla no dé un salto al completarse.
 */
export function RouteLoading({ title, description, children }: RouteLoadingProps) {
  return (
    <MainContainer title={title} description={description}>
      {children}
    </MainContainer>
  );
}
