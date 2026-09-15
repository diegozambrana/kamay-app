"use client";

import { useState } from "react";

import { changeMemberRole, setMemberLines } from "@/actions/members";
import { FormDialog, type EntityDialog } from "@/components/shared/form-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/features/platform/roles";
import type { BusinessLine, MemberRow, Role } from "@/types";

import { ColorDot } from "../color-select";

export const memberName = (member: MemberRow) => member.displayName ?? "Sin nombre";

/**
 * Editar a alguien del equipo: su rol y, si es ayudante, las líneas que
 * alcanza (design D7). Antes se cambiaban en la propia fila y cada casilla
 * guardaba al marcarse; ahora es un formulario con «Guardar cambios».
 *
 * Son dos acciones, en orden y solo si cambió cada cosa. No es una
 * transacción: si el rol se guarda y las líneas no, el diálogo sigue abierto
 * con el error, y volver a guardar es seguro porque las dos son idempotentes.
 */
export function MemberDialog({
  dialog,
  lines,
  assignedLines,
}: {
  dialog: EntityDialog<MemberRow>;
  lines: BusinessLine[];
  assignedLines: Record<string, string[]>;
}) {
  const member = dialog.target;
  if (!member) return null;

  const assigned = assignedLines[member.id] ?? [];

  return (
    <FormDialog
      open={dialog.open}
      onOpenChange={dialog.onOpenChange}
      title={`Editar a ${memberName(member)}`}
      description="Su rol en esta organización y, si es ayudante, qué líneas alcanza."
      submitLabel="Guardar cambios"
      pending={dialog.pending}
      error={dialog.error}
      data-testid="member-dialog"
      onSubmit={(data) => {
        const role = String(data.get("role") ?? member.role) as Role;
        const lineIds = data.getAll("lines").map(String);
        const linesChanged =
          lineIds.length !== assigned.length || lineIds.some((id) => !assigned.includes(id));

        dialog.submit(async () => {
          if (role !== member.role) {
            const result = await changeMemberRole({ membershipId: member.id, role });
            if (result?.error) return result;
          }
          // Quien es dueño ve todo por definición (matriz de acceso §16): sus
          // líneas no se tocan.
          if (role === "assistant" && linesChanged) {
            return setMemberLines({ membershipId: member.id, businessLineIds: lineIds });
          }
        });
      }}
    >
      <MemberFields member={member} lines={lines} assigned={assigned} />
    </FormDialog>
  );
}

/**
 * Los campos, aparte para que el rol elegido viva en su propio estado y
 * vuelva a empezar cada vez que se abre el diálogo (el contenido se desmonta
 * al cerrarse).
 */
function MemberFields({
  member,
  lines,
  assigned,
}: {
  member: MemberRow;
  lines: BusinessLine[];
  assigned: string[];
}) {
  const [role, setRole] = useState<Role>(member.role);
  const name = memberName(member);

  return (
    <>
      <Field>
        <FieldLabel htmlFor="member-role">Rol</FieldLabel>
        <Select name="role" value={role} onValueChange={(value) => setRole(value as Role)}>
          <SelectTrigger id="member-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="assistant">{ROLE_LABELS.assistant}</SelectItem>
            <SelectItem value="owner">{ROLE_LABELS.owner}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {/* Las líneas solo restringen a quien no es dueño: quien manda ve todo
          por definición (matriz de acceso §16). */}
      {role === "assistant" && (
        <FieldSet data-testid="line-picker">
          <FieldLegend variant="label">Líneas</FieldLegend>
          <FieldDescription>
            Sin ninguna marcada, ve las tareas de todas las líneas. Con alguna, solo las de
            esas líneas, la compartida y las asignadas a esta persona.
          </FieldDescription>
          <div className="flex flex-col gap-2">
            {lines.map((line) => (
              <label key={line.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  name="lines"
                  value={line.id}
                  defaultChecked={assigned.includes(line.id)}
                  aria-label={`${line.name} para ${name}`}
                />
                <ColorDot color={line.color} />
                {line.name}
              </label>
            ))}
          </div>
        </FieldSet>
      )}
    </>
  );
}
