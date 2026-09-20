import { describe, expect, it } from "vitest";

import { orderRequestWhatsAppLink, orderRequestWhatsAppMessage } from "./whatsapp";

describe("enlace de WhatsApp de una solicitud de pedido", () => {
  it("arma un enlace wa.me con solo dígitos en el teléfono", () => {
    const link = orderRequestWhatsAppLink(
      "+591 700-99999",
      "Geeko Store",
      "https://kamay.app/r/abc123",
    );

    expect(link.startsWith("https://wa.me/59170099999?text=")).toBe(true);
  });

  it("codifica el mensaje para ir en la URL", () => {
    const link = orderRequestWhatsAppLink(
      "70099999",
      "Geeko Store",
      "https://kamay.app/r/abc123",
    );
    const message = orderRequestWhatsAppMessage("Geeko Store", "https://kamay.app/r/abc123");

    expect(link).toBe(`https://wa.me/70099999?text=${encodeURIComponent(message)}`);
  });

  it("el mensaje lleva el nombre de la organización y el enlace, nada más", () => {
    const message = orderRequestWhatsAppMessage("Taller Kamay", "https://kamay.app/r/xyz");

    expect(message).toContain("Taller Kamay");
    expect(message).toContain("https://kamay.app/r/xyz");
  });

  it("un teléfono sin dígitos produce un enlace sin número, no revienta", () => {
    const link = orderRequestWhatsAppLink("---", "Geeko Store", "https://kamay.app/r/x");

    expect(link.startsWith("https://wa.me/?text=")).toBe(true);
  });
});
