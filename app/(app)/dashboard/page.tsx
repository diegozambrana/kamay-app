export const metadata = { title: "Panel · Kamay" };

/** Cascarón de V2: el contenido del panel llega con KAM-14. */
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Panel</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Aquí vivirá el panel principal.
      </p>
    </div>
  );
}
