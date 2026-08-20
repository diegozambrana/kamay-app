import { create } from "zustand";

import { ALL_LINES, type ActiveLine, type BusinessLine } from "@/types";

type BusinessLineState = {
  lines: BusinessLine[];
  activeLine: ActiveLine;
  setLines: (lines: BusinessLine[]) => void;
  setActiveLine: (activeLine: ActiveLine) => void;
};

/**
 * Líneas vigentes y línea activa del contexto. El servidor lo hidrata en cada
 * navegación (D5); aquí nada se persiste: la cookie es la memoria.
 */
export const useBusinessLineStore = create<BusinessLineState>()((set) => ({
  lines: [],
  activeLine: ALL_LINES,
  setLines: (lines) => set({ lines }),
  setActiveLine: (activeLine) => set({ activeLine }),
}));
