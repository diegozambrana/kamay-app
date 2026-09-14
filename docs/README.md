# Documentación de Kamay

| Documento | Para quién | Contenido |
| --- | --- | --- |
| [Manual de uso](manual-de-uso.md) | Personas que usan la plataforma | Paso a paso de cada función, pantalla por pantalla, con capturas |
| [Manual de pruebas](manual-de-pruebas.md) | Equipo de QA | Entorno, cuentas, casos de prueba por módulo con resultado esperado, pruebas automáticas |
| [Estado de la plataforma](estado-de-la-plataforma.md) | Quien planifica el siguiente sprint | Estado por vista y por ticket, hallazgos, propuesta de trabajo |
| [Documento técnico](documento-tecnico.md) | Personas desarrolladoras nuevas | Stack, puesta en marcha, arquitectura, base de datos, pruebas, despliegue, receta para añadir funcionalidad |
| [Recuperación desde copia](recuperacion.md) | Operación | Procedimiento y bitácora de ensayos de restauración |
| [Verificación del anexo de BD](anexo-bd-verificacion.md) | Operación / desarrollo | Lista de comprobación previa a producción, punto por punto |

Las capturas de pantalla viven en `capturas/` (organización de ejemplo *Geeko Store*, datos de la semilla local). Se regeneran con `node scripts/docs-capturas.mjs` (Playwright contra `npm run dev` y la semilla local); si la interfaz cambia, conviene repetirlas.
