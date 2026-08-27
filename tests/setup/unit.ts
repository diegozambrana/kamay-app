import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom no implementa matchMedia; next-themes lo necesita para el tema "system".
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom no implementa ResizeObserver; los primitivos de Radix (Checkbox,
// Dialog, Select) lo usan para medir sus disparadores.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// Tampoco implementa la API de puntero ni el desplazamiento que Select usa al
// abrirse. Sin estos, el diálogo y el desplegable revientan en la prueba, no
// en el navegador.
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView ??= vi.fn();
  Element.prototype.hasPointerCapture ??= vi.fn(() => false);
  Element.prototype.setPointerCapture ??= vi.fn();
  Element.prototype.releasePointerCapture ??= vi.fn();
}
