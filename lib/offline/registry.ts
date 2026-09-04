/**
 * Registro de operaciones (design.md, decisión 1).
 *
 * Conectar un dominio nuevo a la cola cuesta registrar su operación; el motor
 * no se toca. KAM-11 registra las de pedidos; KAM-09, KAM-10, KAM-12 y KAM-15
 * registrarán las suyas sin abrir este archivo.
 */

export interface OfflineOperation {
  /** Llama a la Server Action. Devuelve lo que ella devuelva. */
  send: (payload: unknown) => Promise<unknown>;
  /** Lo que la bandeja muestra a la persona. En español, sin jerga. */
  describe: (payload: unknown) => string;
}

const operations = new Map<string, OfflineOperation>();

/**
 * Cambiar la forma de un `payload` obliga a registrar una **clave nueva**: una
 * entrada encolada antes del despliegue seguiría llevando el formato viejo.
 */
export function registerOperation(key: string, operation: OfflineOperation): void {
  operations.set(key, operation);
}

export function getOperation(key: string): OfflineOperation | undefined {
  return operations.get(key);
}

export function clearOperations(): void {
  operations.clear();
}

/**
 * El mensaje de una operación desconocida. No es un error del programa: es una
 * entrada que este código no sabe enviar, y acaba en la bandeja en vez de
 * perderse.
 */
export function unknownOperationMessage(key: string): string {
  return `Este registro se guardó con una versión anterior de la aplicación (${key}). Vuelve a intentarlo tras actualizar, o descártalo.`;
}
