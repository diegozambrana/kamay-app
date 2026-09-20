/**
 * KAM-28 · «Generar y enviar»: abre WhatsApp con el mensaje y el enlace de la
 * solicitud, sin API ni credencial — un `wa.me` que abre el WhatsApp de quien
 * lo manda (spec `order-requests` — Requirement: Generar y enviar abre
 * WhatsApp sin API ni credencial).
 */

/** wa.me solo acepta dígitos, con el código de país al frente y sin signos. */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function orderRequestWhatsAppMessage(
  organizationName: string,
  url: string,
): string {
  return `Hola, soy de ${organizationName}. Por favor completa tus datos y, si quieres, adjunta una foto de referencia en este enlace: ${url}`;
}

/**
 * @param phone el teléfono prellenado de la solicitud, tal como se guardó.
 * @param organizationName el nombre que ve el cliente en el mensaje.
 * @param url el enlace público `/r/<token>` recién generado.
 */
export function orderRequestWhatsAppLink(
  phone: string,
  organizationName: string,
  url: string,
): string {
  const message = orderRequestWhatsAppMessage(organizationName, url);
  return `https://wa.me/${digitsOnly(phone)}?text=${encodeURIComponent(message)}`;
}
