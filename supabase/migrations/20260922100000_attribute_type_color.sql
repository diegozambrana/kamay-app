-- Cambio `catalog-custom-attributes` · Tipo de atributo `color` (design D11).
--
-- Un atributo de color guarda un hex normalizado (`#RRGGBB`) y se registra con
-- un selector de color o escribiendo el hex. Aquí solo se admite el tipo: la
-- forma del valor la valida el servidor, como la de los demás tipos (D3), y
-- `options_match_type` y `unit_only_for_numbers` ya dejan a un color sin
-- opciones ni unidad.

alter table item_category_attributes
  drop constraint item_category_attributes_type_check;

alter table item_category_attributes
  add constraint item_category_attributes_type_check
  check (type in ('text', 'number', 'list', 'color'));
