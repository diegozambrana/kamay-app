-- Cambio `fair-all-lines` · Varias ventas directas en una sola operación.
--
-- Con la bandera «Venta rápida con todas las líneas», un carrito con productos
-- de varias líneas se registra como una venta por línea (design.md,
-- decisión 5). Esas ventas son **un solo hecho** para quien cobra: se guardan
-- todas o ninguna. Encolarlas por separado dejaría, con red a medias, un
-- cobro partido que nadie va a reconciliar en un puesto de feria.
--
-- La función no reimplementa nada: recorre el lote y llama a
-- `create_direct_sale` por cada venta. Una llamada a función es una
-- transacción, así que la excepción de cualquiera deshace las anteriores. La
-- idempotencia se hereda: `create_direct_sale` devuelve la venta existente si
-- su `id` ya está, así que reenviar el lote no crea nada de más.
--
-- Cada elemento del lote lleva los tres argumentos de `create_direct_sale`:
-- `{ "sale": {...}, "items": [...], "payment": {...} | null }`.
--
-- `security invoker` como todas: RLS sigue siendo la autorización real.

create or replace function create_direct_sales(p_sales jsonb)
returns uuid[]
language plpgsql security invoker as $$
declare
  v_entry jsonb;
  v_ids   uuid[] := '{}';
begin
  if p_sales is null
     or jsonb_typeof(p_sales) <> 'array'
     or jsonb_array_length(p_sales) = 0 then
    raise exception 'El lote necesita al menos una venta'
      using errcode = 'check_violation';
  end if;

  for v_entry in select value from jsonb_array_elements(p_sales) loop
    v_ids := v_ids || create_direct_sale(
      v_entry->'sale',
      v_entry->'items',
      nullif(v_entry->'payment', 'null'::jsonb)
    );
  end loop;

  return v_ids;
end;
$$;

revoke execute on function create_direct_sales(jsonb) from public;
grant execute on function create_direct_sales(jsonb) to authenticated;
