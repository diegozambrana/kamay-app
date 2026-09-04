## Context

Ver `proposal.md` — Why. Lo que condiciona el diseño es el estado del repositorio y del esquema:

- `order_totals` existe desde `20260826200000_orders.sql` **sin** la columna `paid`, y esa migración dejó escrito por qué: exponer hoy un `paid = 0` que en realidad significa "todavía no se sabe" es una mentira que algún reporte acabaría sumando. La misma nota anuncia el `create or replace view` que llega aquí.
- `expense_totals` la crea KAM-09, también sin `paid` por el mismo motivo. **KAM-09 no está fusionado**: sin `expenses`, la referencia `payments.expense_id` no se puede crear y esta migración no arranca.
- Las convenciones nº 3 (nada se borra), nº 4 (nada derivado se almacena) y nº 6 (migraciones solo como archivos nuevos) fijan de antemano casi todas las decisiones de esquema. Lo que queda por decidir es dónde se apoya cada garantía: en la base, en la política o en el componente.
- `enforce_archive_rules()` (de `20260826120000_catalog.sql`) ya implementa "solo el dueño archiva" y "un archivado no se edita", y `log_activity()` ya audita cualquier tabla. Ninguna de las dos hace falta reinventarla.
- La matriz de acceso del esquema es tajante en un punto poco habitual: `payments` es la **única** tabla donde el ayudante tiene un permiso parcial —crear cobros, no pagos—. Todas las demás son "todo o nada".

## Goals / Non-Goals

**Goals:**

- Que las cuatro invariantes del dinero —destino único, dirección coherente con el destino, importe positivo, hecho inmutable— sean imposibles de violar desde cualquier ruta de escritura, incluida la cola de sincronización sin conexión de KAM-11, que escribirá sin pasar por ningún formulario.
- Que `paid`, el saldo y el estado de pago existan en **un solo lugar** cada uno, y que ese lugar sea una vista o una función pura, nunca una columna ni un store.
- Que la separación cobrar/pagar del ayudante se sostenga con la interfaz apagada.
- Redefinir dos vistas ya en uso sin romper a sus consumidores actuales.

**Non-Goals:**

- No se diseña la pantalla de egresos: KAM-09 la trae y este cambio solo le añade un punto de entrada.
- No se diseña la cola sin conexión (KAM-11), aunque sí se deja `payments` preparada para ella: UUID generable en cliente y `occurred_at` fijado por el cliente (convención nº 9).
- No se diseña el panel principal V2 (KAM-14); este cambio solo deja listas las vistas que consumirá.

## Decisions

### 1. Las cuatro invariantes viven en la base, no en Zod

`exactly_one_target`, `direction_matches_target`, `amount > 0` y la inmutabilidad se implementan como restricciones y triggers de Postgres. El esquema Zod de la acción de servidor las repite para dar un mensaje útil al usuario, pero no es la garantía.

*Alternativa descartada:* validar solo en la acción de servidor. Se descarta porque KAM-11 escribirá `payments` desde una cola de sincronización que no pasa por la acción, y porque la semilla y las pruebas también insertan directo. Una garantía que solo existe en un camino no es una garantía. Además, los criterios 4 y 5 del backlog piden explícitamente que *la base de datos lo impida*.

### 2. `paid` entra en las vistas existentes con `create or replace view`, no en vistas nuevas

Se redefinen `order_totals` y `expense_totals` añadiendo `paid` como subconsulta sobre `payments` no archivados. Se conservan `security_invoker = true` y el `grant select` a `authenticated, service_role`.

*Alternativa descartada:* crear `order_payments_summary` y unirla en la aplicación. Se descarta porque partiría el total y el cobrado en dos lugares, y cada consumidor tendría que acordarse de unirlos; a la primera pantalla que lo olvide, muestra un saldo igual al total. La definición canónica del esquema ya declara ambas vistas con `total` y `paid` juntos: este cambio no inventa forma, la completa.

**Cuidado operativo:** `create or replace view` en Postgres exige que las columnas preexistentes conserven nombre, tipo y **orden**. `paid` se añade **al final**, después de `total`. Si en el futuro hiciera falta insertar una columna en medio, habría que `drop view ... cascade` y recrear, con el coste de recrear también dependientes.

### 3. El saldo se deriva en la lectura; el estado de pago, en una función pura de `lib/`

`balance = total - paid` no es una columna de la vista sino el resultado de leer ambas. El estado de pago (`pendiente` / `parcial` / `pagado` / `sobrepagado`) se calcula en una función pura de `lib/payments/` que recibe `total` y `paid`, se prueba a nivel unitario y la usan por igual la tarjeta del tablero, el detalle y la bandeja de egresos.

*Alternativa descartada:* añadir `balance` y `payment_status` como columnas calculadas de la vista. Tentador, pero el estado de pago es una regla de presentación con nombres visibles al usuario, y la convención nº 8 quiere el texto visible en español mientras la base habla en inglés. Dejarlo en `lib/` mantiene los nombres traducibles y la regla en un único sitio comprobable sin base de datos.

El caso límite `total = 0` se resuelve como `pagado`, no `pendiente`: un pedido sin nada que cobrar no está pendiente de cobro. Queda fijado en la función y probado.

### 4. Anular es archivar el original, no insertar un movimiento negativo

El backlog dice "movimiento inverso". Se implementa como `archived_at` sobre el movimiento original, no como una segunda fila con importe negativo.

*Alternativa descartada:* insertar una fila espejo con `amount` negativo. Se descarta por tres razones: `amount > 0` es una restricción del esquema canónico y habría que relajarla; la suma de `paid` tendría que distinguir originales de reversos; y la bitácora ya conserva los dos hechos —el registro y el archivado— sin necesidad de una segunda fila. El resultado observable que pide el criterio 3 es el mismo: ambos hechos quedan en la bitácora y el saldo vuelve a su valor anterior.

El "movimiento inverso" del backlog se cumple, entonces, a nivel de bitácora, no de tabla. Es una interpretación deliberada y está anotada aquí para que la revisión pueda rechazarla si se prefiere la otra.

### 5. El permiso partido del ayudante se escribe en la política `INSERT`, no en el componente

```
create policy "payments: crear cobros todo miembro, pagos solo el dueño"
  on payments for insert to authenticated
  with check (
    is_member(organization_id)
    and (direction = 'in' or is_owner(organization_id))
  );
```

La cláusula `direction = 'in' or is_owner(...)` es toda la regla. El diálogo de la interfaz simplemente no ofrece *Registrar pago* al ayudante, pero eso es cortesía, no seguridad.

Refuerzo natural: aunque un ayudante lograse insertar un `direction = 'out'`, la fila apuntaría a un `expense_id` de una tabla que él no puede leer, así que ni la vería. Son dos barreras independientes; se conservan ambas.

### 6. `UPDATE` abierto a todo miembro, con los triggers decidiendo qué se puede tocar

La política `UPDATE` deja pasar a todo miembro (`is_member`), y dos triggers deciden lo demás: `enforce_payment_immutable()` —nuevo— rechaza cualquier cambio que no sea `archived_at`, y `enforce_archive_rules()` —ya existente— exige `is_owner` para archivar y congela la fila archivada. El resultado observable es que solo el dueño anula y nadie edita.

*Alternativa descartada:* restringir la política a `is_owner`. Prohíbe lo mismo, pero de la peor manera: RLS descarta la fila en silencio, el `update` afecta a cero filas y quien lo intentó no recibe ningún error que la interfaz pueda mostrar. Dejando pasar la fila, el trigger levanta `insufficient_privilege` con su mensaje. Es además el patrón que ya siguen el catálogo, los pedidos y los egresos: política de edición por membresía, gate de archivado en el trigger. *(Ajustado durante la implementación, al ver que la prueba del ayudante no obtenía rechazo alguno.)*

*Alternativa descartada:* permitir editar el importe de un cobro mal tecleado. Se descarta porque un movimiento de dinero es un hecho, y un hecho corregido en silencio deja la bitácora mintiendo. La corrección prevista —anular y volver a registrar— cuesta un clic más y deja rastro.

### 7. Dos vistas separadas para Por cobrar y Por pagar

`receivables_by_line` (saldo pendiente positivo de pedidos no archivados, agrupado por organización y línea) y `payables_by_line` (lo mismo sobre egresos), ambas con `security_invoker = true`.

*Alternativa descartada:* una sola vista con una columna `direction`. Se descarta porque el ayudante debe obtener cero en Por pagar y su valor real en Por cobrar: con dos vistas eso ocurre solo por `security_invoker`, sin una línea de lógica de permisos. Con una vista unificada habría que filtrar en la aplicación, que es exactamente donde estos permisos se filtran.

Los saldos negativos —pedidos sobrepagados— se recortan a cero con `greatest(total - paid, 0)` antes de sumar: un cliente que pagó de más no reduce lo que otro debe. El total "Todas las líneas" lo suma la aplicación desde las filas por línea, para no duplicar la definición.

### 8. Actualización optimista solo en el saldo, no en la lista de cobros

Al registrar un cobro, el saldo y la insignia de estado se actualizan sin esperar la respuesta —el mismo patrón que el arrastre del tablero en KAM-07—; la lista de cobros se refresca con la respuesta real. Un importe con dos decimales mal redondeado en el cliente sería un error visible en dinero; el saldo aproximado durante 200 ms, no.

Todos los importes se manejan en la capa de aplicación como cadenas o enteros de centavos hasta el borde de presentación, nunca como `number` de coma flotante en operaciones acumuladas, para que `numeric(14,2)` de Postgres no se degrade al pasar por JavaScript.

## Risks / Trade-offs

- **KAM-09 no está fusionado y esta migración no arranca sin `expenses`.** → No hay mitigación técnica: es orden de fusión. El cambio se revisa ahora y se aplica después de KAM-09. Si el orden se invirtiera, la única salida sería partir KAM-10 en dos, con el coste de una segunda migración que reabre la tabla.
- **`create or replace view` es frágil ante cambios de forma.** Si alguien reordena o renombra columnas de `order_totals`, la migración falla en `db reset` con un error poco explicativo. → `paid` se añade estrictamente al final y la prueba pgTAP comprueba la lista de columnas de ambas vistas, para que el fallo aparezca donde se entiende.
- **Interpretar "movimiento inverso" como archivado es una decisión de diseño, no una lectura literal del backlog.** → Queda escrita en la decisión 4 y verificada por escenarios que comprueban el resultado observable (saldo restaurado, ambos hechos en bitácora). Si la revisión prefiere la fila negativa, cambia el esquema y hay que rehacer la migración: conviene resolverlo antes de escribirla.
- **El sobrepago permitido crea saldos negativos que se propagarán a los reportes de KAM-20.** → El recorte a cero se hace en las vistas de indicadores, no en el saldo del pedido: el pedido muestra su −50 real y el agregado no lo compensa. La regla queda en un solo lugar para que KAM-20 la herede.
- **Redondeo de dinero en JavaScript.** → Importes tratados como cadena o centavos hasta presentar; las pruebas unitarias del saldo incluyen casos con decimales que exponen el error de coma flotante si alguien lo reintroduce.
- **El ayudante y la vista `expense_totals`.** `security_invoker` le devuelve cero filas de egresos, lo cual es correcto, pero significa que un componente compartido puede recibir una lista vacía sin saber si es "no hay" o "no puedes". → El punto de entrada de pagos no se renderiza para el ayudante; no se le muestra una bandeja vacía sin explicación.

## Migration Plan

1. **Requisito previo:** KAM-09 fusionado en `main`; `expenses`, `expense_items` y `expense_totals` existen.
2. Migración nueva `YYYYMMDDHHMMSS_payments.sql`, en este orden dentro del archivo: tabla `payments` con sus restricciones e índices → trigger `enforce_archive` → trigger `audit` → `create or replace view order_totals` → `create or replace view expense_totals` → `receivables_by_line` y `payables_by_line` → `grant` / `revoke` → `enable row level security` → políticas (sin `DELETE`).
3. Su prueba pgTAP en el mismo commit (convención nº 6): ninguna migración se fusiona sin ella.
4. Ampliar `supabase/seed.sql` con los casos que las pantallas y las pruebas necesitan: anticipo, saldado, sobrepagado y cobro anulado.
5. `supabase db reset` local, `supabase test db`, y `graphify .` para regenerar el grafo.
6. **Rollback:** la migración solo añade. Revertirla exige una migración nueva que reponga `order_totals` y `expense_totals` en su forma anterior y archive `payments`; la tabla no se elimina, en coherencia con la convención nº 3. En la práctica el rollback real es revertir el despliegue antes de que existan datos de cobro.
