## ADDED Requirements

### Requirement: Item categories declare their attributes

The organization MUST be able to declare, per item category, an ordered list of attributes. Each attribute MUST have a name (stored without surrounding spaces, not empty, unique within its category compared without case), a type among `text`, `number`, `list` and `color`, an optional unit (free text such as «°C» or «mm/s», meaningful only for `number`), a list of options (non-empty, distinct, non-blank strings, required for `list` and empty otherwise), a required flag, a scope among `item` and `variant`, and a position. The type and the scope MUST be fixed when the attribute is created and MUST NOT change afterwards. Attributes MUST be listed by position, assigned in creation order.

The definition MUST be declared once per category and MUST apply to every item of that category; creating another item of the category MUST NOT require declaring anything again. Archiving an attribute MUST stop it from being offered in item and variant forms and in catalog filters, while every value already stored under it MUST be kept and keep being shown with its label. Restoring an archived attribute MUST offer it again with its stored values.

The definition MUST be managed from the Item categories section of `/settings`, through the «Atributos» action of a category row, by the owner only. The definition of one organization MUST NOT be visible to, nor usable by, another organization.

#### Scenario: Owner declares the attributes of a category

- **WHEN** an owner opens «Atributos» of the supply category «Filamento» and creates «Marca» (list, item), «Temperatura mínima» (number, °C, item), «Temperatura máxima» (number, °C, item), «Velocidad recomendada» (number, mm/s, item) and «Color» (list, variant, required)
- **THEN** the category lists the five attributes in that order and every filament of the category offers exactly those attributes in its forms

#### Scenario: A color attribute

- **WHEN** an owner creates «Color de rollo» with type `color` and scope `variant` in «Filamento»
- **THEN** the attribute is created without unit and without options

#### Scenario: Declared once, used by every item

- **WHEN** «Filamento» already has its attributes and someone creates a second filament in that category
- **THEN** the form offers the same attributes without anyone declaring them again

#### Scenario: Duplicate attribute name in the same category is rejected

- **WHEN** an owner creates the attribute «color » in a category that already has «Color»
- **THEN** the creation is rejected with an understandable message inside the dialog, and no second attribute is created

#### Scenario: The same attribute name in two categories

- **WHEN** an owner creates «Color» in the supply category «Filamento» and again in the product category «Vajilla»
- **THEN** both attributes are created, one per category

#### Scenario: A list attribute needs its options

- **WHEN** an owner creates a `list` attribute without any option, or with two options that only differ in surrounding spaces
- **THEN** the creation is rejected and the dialog says that a list needs at least one distinct option

#### Scenario: Type and scope cannot change

- **WHEN** an update tries to change the type or the scope of an existing attribute
- **THEN** the attribute keeps its original type and scope

#### Scenario: Archiving an attribute keeps its stored values

- **WHEN** an owner archives «Velocidad recomendada» while three filaments have a value stored under it
- **THEN** the three filaments keep showing «Velocidad recomendada» with their value in the detail, and the item form no longer offers the field

#### Scenario: Restoring an attribute offers it again

- **WHEN** an owner restores the archived «Velocidad recomendada»
- **THEN** the item form offers the field again, prefilled with the value each filament kept

#### Scenario: The assistant cannot define attributes

- **WHEN** a user with role `assistant` attempts to insert, update or archive an attribute definition, by the interface or by direct query
- **THEN** the operation is rejected and the assistant does not see the «Atributos» action nor the section

#### Scenario: Definitions of another organization are invisible

- **WHEN** an owner of organization A, whose category «Filamento» declares attributes, is compared with organization B
- **THEN** organization B sees zero attribute definitions of A and cannot reference them from its items or variants

## MODIFIED Requirements

### Requirement: Configuration tables exist with the canonical shape

The database MUST contain the six configuration tables of the canonical schema §6 and §7, each with `organization_id` (not null, referencing `organizations`) and `archived_at`:

- `business_lines`: `name`, `color` (default `zinc`), `icon`, `is_shared` (default false), `position`, `created_at`, `updated_at`, unique `(organization_id, name)`.
- `sales_channels`: `name`, `position`, unique `(organization_id, name)`.
- `expense_categories`: `name`, unique `(organization_id, name)`.
- `units`: `code`, `name`, unique `(organization_id, code)`.
- `item_categories`: `kind` (restricted to `supply`, `product` or `asset`), `name`, `created_at`, `updated_at`, unique per `(organization_id, kind)` on the name compared without case or surrounding spaces, and unique `(id, organization_id, kind)` so items can reference it together with their organization and kind.
- `item_category_attributes`: `category_id` referencing `item_categories` of the same organization, `name`, `type` (restricted to `text`, `number`, `list` or `color`), `unit`, `options` (a JSON array, empty unless the type is `list`), `required` (default false), `scope` (restricted to `item` or `variant`), `position`, `created_at`, `updated_at`, unique per `category_id` on the name compared without case or surrounding spaces.

Each table MUST carry the `audit` trigger from its creation migration, per the activity-log attachment procedure.

#### Scenario: Duplicate name in the same organization is rejected

- **WHEN** a second `business_lines` row is inserted with a name that already exists in the same organization
- **THEN** the database rejects the insert with a unique constraint violation

#### Scenario: The same name is allowed in a different organization

- **WHEN** two organizations each create a business line named `Sublimación`
- **THEN** both inserts succeed

#### Scenario: Creating a configuration row is logged

- **WHEN** an owner creates a business line, a sales channel, an expense category, a unit, an item category or an item category attribute
- **THEN** an `activity_log` event with action `created` exists for that record, with the acting user as author

#### Scenario: An item category outside the allowed kinds is rejected

- **WHEN** an `item_categories` row is inserted with a `kind` other than `supply`, `product` or `asset`
- **THEN** the database rejects the insert

#### Scenario: An item category name differing only in case is rejected

- **WHEN** an `item_categories` row named `sustratos` is inserted for the same organization and kind as an existing `Sustratos`
- **THEN** the database rejects the insert with a unique constraint violation

#### Scenario: An attribute outside the allowed types or scopes is rejected

- **WHEN** an `item_category_attributes` row is inserted with a `type` other than `text`, `number`, `list` or `color`, or a `scope` other than `item` or `variant`
- **THEN** the database rejects the insert

#### Scenario: An attribute name differing only in case is rejected

- **WHEN** an `item_category_attributes` row named `color` is inserted for the same category as an existing `Color`
- **THEN** the database rejects the insert with a unique constraint violation

#### Scenario: An attribute cannot belong to a category of another organization

- **WHEN** an `item_category_attributes` row is inserted with the organization of A and a `category_id` of organization B
- **THEN** the database rejects the insert

### Requirement: Only the owner writes configuration; every member reads it

RLS MUST be enabled on the six configuration tables. `SELECT` MUST be granted to any active member of the organization (`is_member`). `INSERT` and `UPDATE` MUST be restricted to `is_owner`. No `DELETE` policy MUST exist on any of them.

#### Scenario: Assistant reads configuration

- **WHEN** a user with role `assistant` queries `business_lines`, `sales_channels`, `expense_categories`, `units`, `item_categories` or `item_category_attributes` of their organization
- **THEN** the active rows of their organization are returned

#### Scenario: Assistant cannot write configuration

- **WHEN** a user with role `assistant` attempts to insert or update a row in any of the six configuration tables
- **THEN** the database rejects the operation under RLS

#### Scenario: Configuration of another organization is invisible

- **WHEN** an owner of organization A queries any of the six configuration tables
- **THEN** zero rows of organization B are returned

#### Scenario: No one can delete configuration

- **WHEN** any authenticated user attempts a `DELETE` on any of the six configuration tables
- **THEN** the database rejects the operation
