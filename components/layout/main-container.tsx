/** Contenedor principal: deja sitio a la barra inferior en móvil. */
export function MainContainer({ children }: { children: React.ReactNode }) {
  return <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">{children}</main>;
}
