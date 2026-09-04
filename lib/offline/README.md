# `lib/offline` — la cola de captura sin conexión

Registrar no puede depender de la red (KAM-11). Esta carpeta es el motor que lo
garantiza; las pantallas no la conocen, solo registran su operación.

## Conectar un dominio nuevo

No hay que abrir el motor. Basta registrar la operación donde vive la pantalla:

```ts
registerOperation("order.create", {
  send: (payload) => createOrder(payload),
  describe: (payload) => `Pedido para ${nombreDelCliente(payload)}`,
});
```

Y capturar en lugar de llamar a la acción:

```ts
const result = await capture(
  { recordId: values.id, operation: "order.create", payload: values,
    organizationId, userId },
  { enqueue, drain: () => drainOutbox({ session }), isOnline },
);
```

`result.status` es `sent` (llegó dentro del plazo corto), `queued` (quedó en la
cola; confirma igual) o `failed` (rechazo definitivo; se muestra el mensaje).

## Reglas que no se pueden saltar

1. **El `payload` es serializable y estable en el tiempo.** Nada de `File`,
   `Date` ni instancias de clase: fechas como cadenas ISO. Por eso los adjuntos
   no entran en la cola.
2. **Cambiar la forma de un `payload` obliga a registrar una clave nueva.** Una
   entrada encolada antes del despliegue sigue llevando el formato viejo, y se
   enviaría mal interpretada. Si el formato de la *entrada* cambia —no el del
   payload— se sube `OUTBOX_SCHEMA_VERSION` y las viejas quedan retenidas y
   visibles en la bandeja.
3. **El identificador lo genera el cliente y no cambia entre reintentos.** Es lo
   que permite que la base ignore el segundo envío (`on conflict do nothing`).
   Toda operación encolable necesita su equivalente idempotente en la base.
4. **`occurred_at` lo fija el cliente al registrar, no al enviar.**
5. **Un hijo declara `dependsOn: [recordIdDelPadre]`.** El orden ya lo da `seq`;
   `dependsOn` es lo que impide que el hijo salga solo si el padre murió.

## Por qué está partido así

- `db.ts` — la base Dexie y la versión del formato de entrada.
- `queue.ts` — escribir y leer. No envía nada, y por eso el orden se prueba sin red.
- `drain.ts` — el motor: secuencial, con candado, con espera creciente.
- `classify.ts` — fallo transitorio contra fallo definitivo, por la forma de la respuesta.
- `hold.ts` — por qué una entrada pendiente no sale *ahora*. Se calcula, nunca se persiste.
- `capture.ts` — encolar y esperar un plazo corto: el punto de entrada de las pantallas.
- `registry.ts` — el registro de operaciones.

Las decisiones y sus alternativas descartadas están en
`openspec/changes/kam-11-offline-infrastructure/design.md`.
