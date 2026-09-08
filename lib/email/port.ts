/**
 * El puerto de correo.
 *
 * Todo el sistema conoce esto y nada más. El proveedor concreto vive detrás,
 * en `lib/email/resend.ts`, y sustituirlo es escribir otro archivo aquí al
 * lado: ninguna otra rebanada importa su SDK ni sabe su nombre.
 *
 * Que sea un puerto también es lo que permite que **ninguna prueba toque la
 * red**: las pruebas usan `MemoryMailer`, que acumula lo enviado y se puede
 * interrogar.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  /** Cuerpo en texto plano. Obligatorio: es el que siempre se puede leer. */
  text: string;
  /** Cuerpo en HTML, opcional y mínimo. El correo es un enlace con contexto. */
  html?: string;
};

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

/**
 * El adaptador de las pruebas: acumula en memoria y no sale a ninguna parte.
 */
export class MemoryMailer implements Mailer {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

/**
 * Un adaptador que siempre falla, para comprobar que un fallo del correo no se
 * lleva por delante la notificación.
 */
export class FailingMailer implements Mailer {
  async send(): Promise<void> {
    throw new Error("el proveedor de correo no responde");
  }
}
