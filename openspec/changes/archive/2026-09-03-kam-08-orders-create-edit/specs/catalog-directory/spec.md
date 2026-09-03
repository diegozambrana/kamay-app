> Origen: `specs/PRD/kamay-backlog.md` — KAM-08, criterio 3 (crear el cliente «con nombre y teléfono sin abandonar el formulario»).

## MODIFIED Requirements

### Requirement: Creación de contactos al vuelo

Todo buscador de contactos de la aplicación SHALL permitir crear el contacto sin abandonar el formulario en curso cuando el nombre escrito no existe. La creación al vuelo SHALL exigir el nombre y al menos un rol, SHALL admitir el teléfono como dato opcional en ese mismo paso, SHALL dejar el contacto recién creado seleccionado, y el resto de sus datos SHALL poder completarse después desde el directorio.

#### Scenario: Nombre inexistente ofrece crearlo

- **WHEN** el usuario escribe un nombre que no existe en un buscador de contactos
- **THEN** el buscador ofrece crear ese contacto con ese nombre

#### Scenario: El contacto creado queda seleccionado

- **WHEN** el usuario crea el contacto desde el buscador indicando su rol
- **THEN** el contacto se guarda, queda seleccionado en el campo y el formulario en curso conserva lo que ya tenía

#### Scenario: Con teléfono

- **WHEN** el usuario crea el contacto desde el buscador indicando además un teléfono
- **THEN** el contacto se guarda con ese teléfono y aparece así en el directorio

#### Scenario: Sin teléfono

- **WHEN** el usuario crea el contacto desde el buscador sin indicar teléfono
- **THEN** el contacto se guarda igualmente, con el teléfono vacío
