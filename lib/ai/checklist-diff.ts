import { parseChecklistItems } from "@/lib/markdown/checklist";

/**
 * Ítems de lista de verificación del original ausentes en la propuesta
 * (KAM-30). Un aviso determinista, a propósito conservador: compara por texto
 * normalizado —espacios, mayúsculas— e ignora el estado marcado, así que un
 * ítem que la propuesta conservó pero desmarcó no cuenta como perdido; solo
 * cuenta el que desapareció.
 */
function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function findLostChecklistItems(original: string, proposal: string): string[] {
  const proposalItems = new Set(
    parseChecklistItems(proposal).map((item) => normalize(item.text)),
  );

  const lost = new Set<string>();
  for (const item of parseChecklistItems(original)) {
    const key = normalize(item.text);
    if (key !== "" && !proposalItems.has(key)) lost.add(item.text);
  }

  return [...lost];
}
