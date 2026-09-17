import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Contact } from "@/types";

export type ContactFieldValues = Partial<
  Pick<Contact, "name" | "phone" | "email" | "address">
>;

/**
 * Nombre, teléfono, correo y dirección de un contacto, con `name` para leerlos
 * de `FormData` (design D6 de `order-form-picker-dialogs`).
 *
 * Los comparten el diálogo del directorio y el registro de cliente del
 * pedido. No son controlados: cada formulario los lee al enviar, y el
 * `defaultValue` vuelve a empezar cada vez que el diálogo se monta.
 */
export function ContactFields({
  idPrefix = "contact",
  defaultValues = {},
  autoFocusName = false,
  nameInvalid = false,
}: {
  /** Prefijo de los `id`, para que dos formularios no choquen. */
  idPrefix?: string;
  defaultValues?: ContactFieldValues;
  autoFocusName?: boolean;
  nameInvalid?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field data-invalid={nameInvalid || undefined}>
        <FieldLabel htmlFor={`${idPrefix}-name`}>Nombre</FieldLabel>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          defaultValue={defaultValues.name ?? ""}
          autoFocus={autoFocusName}
          aria-invalid={nameInvalid || undefined}
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-phone`}>Teléfono</FieldLabel>
        <Input
          id={`${idPrefix}-phone`}
          name="phone"
          inputMode="tel"
          defaultValue={defaultValues.phone ?? ""}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-email`}>Correo</FieldLabel>
        <Input
          id={`${idPrefix}-email`}
          name="email"
          inputMode="email"
          defaultValue={defaultValues.email ?? ""}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-address`}>Dirección</FieldLabel>
        <Input
          id={`${idPrefix}-address`}
          name="address"
          defaultValue={defaultValues.address ?? ""}
        />
      </Field>
    </div>
  );
}
