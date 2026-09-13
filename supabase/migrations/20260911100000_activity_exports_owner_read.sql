-- KAM-23 · La persona dueña puede leer las exportaciones de la purga de su
-- organización (spec `data-export` → *The export includes the activity
-- detail already purged by retention*; design D6).
--
-- KAM-22 creó el bucket `activity-exports` sin ninguna política para
-- `authenticated`: solo el service role escribía y leía. Era deliberado —la
-- descarga «pertenece a la exportación completa de KAM-23», dejó dicho— y es
-- lo que esta migración abre, y nada más:
--
--   · **Solo lectura.** Escribir sigue siendo del sistema, que es quien purga;
--     y borrar no existe para nadie, como en todo el esquema.
--   · **Solo la persona dueña**, y solo de su organización. La ruta empieza
--     por el `organization_id` (`{org}/{fecha}-bitacora-hasta-{corte}.csv`),
--     igual que en los demás buckets, y la política lo verifica con la misma
--     forma: la primera carpeta de la ruta. El ayudante no lee la bitácora,
--     así que tampoco lee su purga.
--
-- Es la primera política de Storage por rol del proyecto: las otras cuatro
-- dan lectura a cualquier miembro. Por eso va aparte y con su propia prueba
-- (`activity_exports_access.test.sql`).
--
-- Con esto, la exportación completa lee la purga con la sesión de quien la
-- pide, bajo RLS, sin la clave de servicio (convención nº 2).

create policy "storage: la dueña lee las exportaciones de la purga"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'activity-exports'
    and is_owner(((storage.foldername(name))[1])::uuid)
  );
