/**
 * Sustituto de `server-only` para las pruebas.
 *
 * El paquete real lanza al cargarse en un entorno de cliente, que es su
 * cometido: hacer fallar la compilación de quien lo importe desde el bundle
 * del navegador. En Vitest eso solo impide probar los módulos que más falta
 * hace probar, sin proteger nada —la protección la da `next build`—.
 *
 * Ver el alias en `vitest.config.ts`.
 */
export {};
