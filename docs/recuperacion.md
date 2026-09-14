# Recuperación de Kamay a partir de una copia

Procedimiento para devolver Kamay a funcionar sobre un proyecto de Supabase
**nuevo y vacío** a partir de una copia de seguridad (KAM-23, design D9 y D10).
Se ejecuta de arriba abajo; cada paso dice cómo comprobar que salió bien antes
de pasar al siguiente.

Al final está la **bitácora de ensayos**. El criterio 4 del backlog —«la
restauración se ejecuta en un entorno limpio y el sistema queda operativo, con
el resultado documentado»— se cumple cuando esa bitácora tiene al menos un
ensayo real, hecho a partir de una copia de producción.

---

## 1. Qué contiene una copia

Cada copia es una carpeta con estos archivos. Los produce el trabajo programado
de copias (tarea 12.2) con estos comandos, que son los que se ensayaron:

| Archivo | Qué es | Cómo se produce |
| --- | --- | --- |
| `roles.sql` | Roles del clúster | `supabase db dump --db-url "$ORIGEN" -f roles.sql --role-only` |
| `schema.sql` | Esquema de la aplicación: tablas, vistas, funciones, disparadores, políticas de RLS, permisos | `supabase db dump --db-url "$ORIGEN" -f schema.sql` |
| `storage-policies.sql` | Las políticas de Storage de Kamay (acceso por carpeta de organización) | `supabase db dump --db-url "$ORIGEN" -s storage -f storage-schema.sql` y después `awk '/^CREATE POLICY/{p=1} p{print} p&&/;$/{p=0}' storage-schema.sql > storage-policies.sql` |
| `data.sql` | Todas las filas, **incluidas las cuentas de Auth** (`auth.users`, `auth.identities`) y la configuración de los buckets | `supabase db dump --db-url "$ORIGEN" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes" -x "storage.objects"` |
| `history-schema.sql` y `history-data.sql` | El historial de migraciones, para que las siguientes migraciones sepan qué ya está aplicado | `supabase db dump --db-url "$ORIGEN" -s supabase_migrations -f history-schema.sql` y `supabase db dump --db-url "$ORIGEN" --data-only --use-copy -s supabase_migrations -f history-data.sql` |
| `storage/` | Los archivos de los buckets (`attachments`, `receipts`, `item-photos`, `org-logos`, `activity-exports`), con su ruta intacta | Sincronización del trabajo de copias (12.2) |
| `SHA256SUMS` | Huella de cada archivo, para saber que la copia llegó entera | `shasum -a 256 *.sql > SHA256SUMS` |

Por qué cada archivo existe, en lugar de uno solo:

- **El volcado de esquema no trae las políticas de Storage.** Viven en el esquema
  `storage`, que Supabase administra y que `supabase db dump` no incluye por
  omisión. Sin `storage-policies.sql`, el sistema restaurado no dejaría a nadie
  leer ni subir un archivo. Se comprobó: el volcado de esquema tiene cero
  políticas sobre `storage.objects`, y el de `-s storage` tiene las cuatro.
- **Los datos se vuelcan sin `storage.objects`.** Esas filas describen los
  archivos, y los archivos vuelven aparte (paso 4): al subirlos, Storage crea
  sus filas. Restaurar las filas sin los archivos dejaría referencias a objetos
  que no existen.
- **El historial de migraciones no viaja con los datos.** Sin él, la siguiente
  `supabase db push` intentaría aplicar las 29 migraciones otra vez sobre un
  esquema que ya las tiene.

## 2. Antes de empezar

- Un **proyecto de Supabase nuevo**, en la misma región que el de producción y
  con la **misma versión mayor de Postgres** (Kamay usa la 17,
  `supabase/config.toml` → `[db] major_version`).
- En ese proyecto, las extensiones que `schema.sql` declara (`pg_trgm`,
  `unaccent`, `pgcrypto`, `uuid-ossp`, `pg_net`, `pg_graphql`,
  `pg_stat_statements`, `supabase_vault`) están habilitadas por omisión en
  Supabase o se crean con el propio `schema.sql`. `pgtap` solo existe en local:
  si el proyecto no la ofrece, se quita su línea de `schema.sql` antes de
  restaurar.
- `psql` 17 y el CLI de Supabase en la máquina que restaura.
- La cadena de conexión **directa** del proyecto nuevo (no la del pooler), en
  `$DESTINO`.
- La copia descargada del destino de copias (tarea 12.1) y descifrada.

Comprobar que la copia está entera:

```bash
shasum -a 256 -c SHA256SUMS
```

Cada línea debe terminar en `OK`.

## 3. Restaurar la base

Un solo comando, en **una sola transacción**: si algo falla, no queda nada a
medias y se puede repetir desde cero.

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --file storage-policies.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$DESTINO"
```

**`session_replication_role = replica` es lo que evita repetir la historia.**
Con los disparadores activos, cargar los datos los ejecutaría otra vez:

- `record_stock_entry` crearía una entrada de inventario por cada línea de
  compra, que ya está en el volcado: el inventario quedaría duplicado;
- el disparador de auditoría escribiría un evento por cada fila a nombre de
  quien restaura, y la bitácora sería falsa;
- `assign_code` y `assign_initial_status` volverían a numerar pedidos y a
  asignar estados que ya vienen dados;
- las comprobaciones diferidas del juego de estados se evaluarían a mitad de la
  carga.

En modo réplica ningún disparador se ejecuta **durante esta sesión**. Al
terminar, la base vuelve a su comportamiento normal: la siguiente escritura de
la aplicación se audita como siempre.

Después, el historial de migraciones:

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file history-schema.sql --file history-data.sql \
  --dbname "$DESTINO"
```

Comprobación: `psql "$DESTINO" -c "select count(*), max(version) from supabase_migrations.schema_migrations"`
devuelve el número de migraciones de `supabase/migrations/` y la más reciente.

## 4. Restaurar los archivos

Los archivos de `storage/` se suben a los mismos buckets y con **la misma
ruta**. La ruta empieza por el `organization_id`, que es lo que comprueban las
políticas, y la tabla `attachments` guarda esa ruta. Una ruta distinta deja
cada adjunto sin su archivo.

> El comando exacto depende del destino de copias que se elija (tarea 12.1) y
> se escribe aquí cuando exista el flujo de copias (12.2). Se sube por la API
> de Storage o por su punto de acceso compatible con S3, **nunca** insertando
> filas en `storage.objects` a mano.

Comprobación: el número de archivos por bucket en el proyecto nuevo es igual al
de `storage/`.

## 5. Lo que no vive en la base

Hay que configurarlo a mano en el proyecto nuevo:

- **Auth → Hooks → Before user created**: `public.hook_before_user_created`
  (Postgres). Sin el hook, el alta queda abierta a cualquiera (KAM-23, D8).
  Comprobar un alta sin invitación rechazada y otra con invitación aceptada.
- **Auth → URL Configuration**: la URL del sitio y las de redirección del
  dominio de producción, para los enlaces de recuperación e invitación.
- **Auth → SMTP**, si el proyecto de origen tenía correo propio.
- **API → Data API**: el esquema `public` expuesto. Los permisos de cada tabla
  vienen en `schema.sql`, pero la exposición del esquema es configuración del
  proyecto.
- **Administradores de la plataforma (KAM-26).** La tabla `platform_admins`
  viaja en la copia, así que quien era super admin lo sigue siendo. Comprobar
  con `node scripts/platform-admin.mjs list` contra el proyecto nuevo que la
  lista es la esperada, y revocar lo que sobre. Una cuenta super admin lee y
  edita todas las organizaciones: se recomienda activarle MFA en Supabase Auth
  y no compartirla.
- **Las sesiones abiertas no sobreviven.** El proyecto nuevo firma con otras
  claves: cada persona vuelve a iniciar sesión con **su misma contraseña**,
  porque los hashes vienen en `auth.users`.

Y en Vercel, las variables del ambiente de producción apuntando al proyecto
nuevo (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`), seguidas de un redespliegue. `CRON_SECRET` y
`APP_URL` no cambian.

## 6. Comprobar que el sistema quedó operativo

**Conteos iguales tabla por tabla.** La misma consulta en el origen y en el
destino, y el resultado idéntico:

```bash
Q="select table_schema || '.' || table_name,
          (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
     from information_schema.tables
    where table_type = 'BASE TABLE'
      and (table_schema = 'public' or (table_schema, table_name) in (('auth', 'users'), ('auth', 'identities'), ('storage', 'buckets')))
    order by 1;"
psql "$ORIGEN"  -At -F' ' -c "$Q" > conteos-origen.txt
psql "$DESTINO" -At -F' ' -c "$Q" > conteos-destino.txt
diff conteos-origen.txt conteos-destino.txt && echo "conteos idénticos"
```

`inventory_movements` y `activity_log` son las dos que delatan una restauración
con disparadores activos: tendrían **más** filas que el origen.

**La estructura, completa.** Mismo número de políticas (`pg_policies` en
`public` y `storage`), de disparadores y de funciones de `public` en los dos
lados.

**Recorrido a mano**, en el dominio de producción:

1. Entrar como dueña: aterriza en el panel, con las cifras del día.
2. Abrir un pedido con imagen de referencia y un egreso con comprobante: la
   miniatura se ve (firma y archivo restaurados).
3. Entrar como ayudante: no ve egresos ni la bitácora.
4. Registrar algo de prueba y verlo en la bitácora a nombre de quien lo hizo:
   los disparadores volvieron a funcionar.
5. Llamar al trabajo de retención con el secreto
   (`supabase/README.md` § Trabajos programados): responde 200.

## 7. Si algo sale mal

- **Falla el comando del paso 3.** No quedó nada a medias (`--single-transaction`).
  El mensaje de `psql` nombra la línea. Se corrige la causa y se repite el paso.
- **Faltan archivos.** Se repite solo el paso 4: subir otra vez un archivo con
  la misma ruta no duplica nada.
- **Los conteos no cuadran.** No se da por buena la restauración. Se borra el
  proyecto de destino y se empieza de nuevo: es más barato que averiguar qué
  fila sobra.

---

## Bitácora de ensayos

Cada ensayo se anota aquí al terminarlo, **también si falló**. Lo que cuenta
para el criterio 4 es un ensayo a partir de una copia **real de producción**
sobre un proyecto limpio.

| Fecha | Origen de la copia | Entorno de destino | Pasos | Incidencias | Duración | Quién |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-11 | Base local de desarrollo (semilla y copias de la suite e2e: 31 tablas, 357 080 eventos de bitácora, 22 088 movimientos de inventario, 3 802 cuentas) | Un segundo proyecto local de Supabase recién creado (`supabase init` + `supabase start`, puertos 5552x) | 1, 3, 6 (conteos, estructura, acceso y aislamiento por la API). No los pasos 4 y 5: no hay destino de copias ni proyecto alojado | El historial de migraciones no se restaura solo con los datos: el esquema `supabase_migrations` no existe en un proyecto nuevo y hace falta `history-schema.sql` (ya incluido arriba). El volcado de esquema no trae las políticas de Storage: de ahí `storage-policies.sql` | 14 s la base, 1 s el historial | Claude, durante KAM-23 |

**El primer ensayo es de procedimiento, no de producción.** Comprobó que los
comandos de este documento funcionan tal cual: conteos idénticos en las 31
tablas, las mismas 84 políticas, 48 disparadores y 39 funciones, disparadores
de nuevo activos tras la carga (una escritura nueva deja su evento), inicio de
sesión con la contraseña de siempre y RLS intacto (la dueña de Geeko ve solo
los pedidos de Geeko). **No cumple el criterio 4**: falta el ensayo con una
copia de producción, que incluye los pasos 4 y 5 (tareas 12.5 a 12.7).
