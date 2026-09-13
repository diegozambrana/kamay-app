# accessibility Specification

## Purpose

Garantiza que Kamay se pueda usar sin ratón, con poca luz y con baja visión: contraste suficiente, foco siempre visible, toda acción alcanzable por teclado —incluido el movimiento de tarjetas en los tableros— y todo control con nombre accesible, verificado por una auditoría automática que corre con las pruebas y no como un informe suelto.

> Origen: `specs/PRD/kamay-backlog.md` — KAM-23, alcance «auditoría de accesibilidad básica» y criterio 6; `specs/PRD/kamay-especificacion-producto-v6.md` §5 (legible en taller y feria: alto contraste, texto grande, botones para dedos), §11 (facilidad de uso).

## Requirements

### Requirement: Text and interactive elements meet contrast thresholds

Todo texto y todo elemento interactivo MUST alcanzar la relación de contraste mínima de WCAG 2.1 AA respecto de su fondo —4.5:1 para texto normal, 3:1 para texto grande y para los límites de controles— **en los dos temas**, claro y oscuro.

#### Scenario: Contrast holds in both themes

- **WHEN** la auditoría automática evalúa las vistas principales en tema claro y en tema oscuro
- **THEN** no reporta ninguna violación de contraste en texto ni en elementos interactivos

### Requirement: Focus is always visible

Todo elemento enfocable MUST presentar un indicador de foco visible y distinguible del estado en reposo cuando recibe el foco por teclado. Ninguna hoja de estilo MAY suprimir el indicador de foco sin sustituirlo por otro que cumpla el contraste exigido.

#### Scenario: Tabbing reveals focus on every control

- **WHEN** el usuario recorre con la tecla de tabulación todos los controles de una vista
- **THEN** cada control que recibe el foco presenta un indicador visible

### Requirement: Every action is reachable by keyboard

Toda acción de la aplicación MUST poder ejecutarse solo con teclado. Los diálogos y paneles MUST atrapar el foco mientras están abiertos, devolverlo al control que los abrió al cerrarse, y cerrarse con la tecla de escape.

#### Scenario: A dialog traps and returns focus

- **WHEN** el usuario abre un diálogo con el teclado, lo recorre y lo cierra con la tecla de escape
- **THEN** el foco permanece dentro del diálogo mientras está abierto y vuelve al control que lo abrió al cerrarse

#### Scenario: A record can be created without a pointer

- **WHEN** el usuario completa un formulario de alta usando exclusivamente el teclado
- **THEN** el registro se crea sin que ninguna acción haya requerido puntero

### Requirement: Board cards can be moved without a pointer

Los tableros que permiten mover tarjetas por arrastre MUST ofrecer una alternativa de teclado que cambie una tarjeta de columna, con el mismo efecto sobre el estado del registro que el arrastre.

#### Scenario: Keyboard moves a card between columns

- **WHEN** el usuario enfoca una tarjeta del tablero y usa la alternativa de teclado para moverla a otra columna
- **THEN** la tarjeta queda en la columna destino y el estado del registro cambia igual que si se hubiera arrastrado

#### Scenario: The keyboard alternative is announced

- **WHEN** una tarjeta del tablero recibe el foco
- **THEN** su nombre accesible comunica la tarjeta y la forma de moverla

### Requirement: Every control has an accessible name

Todo campo de formulario MUST tener una etiqueta asociada; todo control que solo muestre un icono MUST tener un nombre accesible; toda imagen informativa MUST tener texto alternativo y toda imagen decorativa MUST estar marcada como tal. Todo diálogo MUST tener un nombre accesible.

#### Scenario: Icon-only controls are named

- **WHEN** la auditoría automática evalúa una vista con controles de solo icono
- **THEN** cada uno expone un nombre accesible y no se reporta ninguna violación de nombre

#### Scenario: Form fields are labelled

- **WHEN** la auditoría automática evalúa un formulario de la aplicación
- **THEN** cada campo tiene su etiqueta asociada y los mensajes de error quedan vinculados al campo que los origina

### Requirement: The accessibility audit runs automatically and reports no critical failures

Una auditoría automática de accesibilidad MUST ejecutarse como parte de la suite de pruebas sobre las vistas principales de la aplicación —incluidos el modo feria y la pantalla de captura móvil— y MUST fallar la ejecución si reporta alguna violación de gravedad crítica o seria.

#### Scenario: A critical violation breaks the build

- **WHEN** una vista introduce un control sin nombre accesible y la auditoría se ejecuta
- **THEN** la ejecución falla señalando la vista y el elemento responsable

#### Scenario: The audited surface covers the main views

- **WHEN** la auditoría se ejecuta sobre la aplicación
- **THEN** cubre las vistas principales en escritorio y en móvil, incluidos el modo feria y la pantalla de captura
