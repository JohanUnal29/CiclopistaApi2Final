import { Resend } from "resend";
import { entorno } from "../config";

if (!entorno.RESEND_API_KEY) {
  console.error("FALTA RESEND_API_KEY en el entorno");
}

const resend = new Resend(entorno.RESEND_API_KEY);

/**
 * Envía un email con PDF adjunto usando Resend (sin SMTP).
 * @param {string|string[]} to - puede ser "a@a.com,b@b.com" o array
 * @param {string} subject
 * @param {string} html
 * @param {Buffer} pdfBuffer
 * @param {string} filename
 */
export async function sendEmailWithPdfResend({
  to,
  subject,
  html,
  pdfBuffer,
  filename,
}) {
  const recipients = Array.isArray(to)
    ? to
    : String(to)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  const result = await resend.emails.send({
    // SIN dominio propio: usa el dominio de Resend
    from: "Ciclopista <onboarding@resend.dev>",
    to: recipients,
    subject,
    html,
    attachments: [
      {
        filename,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });

  // Si Resend devuelve error, lánzalo como excepción
  if (result?.error) {
    throw new Error(
      `Resend error: ${result.error.message || JSON.stringify(result.error)}`
    );
  }

  return result;
}
