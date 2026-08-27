import "server-only";

import { env } from "@/lib/env";
import { fechaLarga, hhmm, pesos } from "@/lib/format";

/**
 * Mail transaccional desde la casilla generica de la aplicacion (nunca desde
 * la casilla de la barberia). Si no hay RESEND_API_KEY configurada, el envio
 * se omite sin romper la reserva.
 *
 * El cuerpo HTML se arma escapando cada valor dinamico: los nombres de
 * clientes, barberos y servicios son input de usuario.
 */

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type DatosConfirmacion = {
  para: string;
  nombreCliente: string;
  barberia: string;
  direccion: string | null;
  barbero: string;
  servicio: string;
  fecha: string;
  hora: string;
  precioCent: number;
  codigo: string;
};

function plantilla(d: DatosConfirmacion): string {
  const e = escaparHtml;
  const filas = [
    ["Codigo de turno", e(d.codigo)],
    ["Servicio", e(d.servicio)],
    ["Barbero", e(d.barbero)],
    ["Cuando", `${e(fechaLarga(d.fecha))} a las ${e(hhmm(d.hora))}`],
    ["A pagar en el local", pesos(d.precioCent)],
  ]
    .map(
      ([etiqueta, valor]) =>
        `<tr>
           <td style="padding:10px 0;border-bottom:1px solid #38352F;color:#9C948A;font-size:13px;">${etiqueta}</td>
           <td style="padding:10px 0;border-bottom:1px solid #38352F;color:#F0EAE0;font-size:14px;text-align:right;font-family:'IBM Plex Mono',monospace;">${valor}</td>
         </tr>`,
    )
    .join("");

  const donde = d.direccion ? `<p style="color:#9C948A;font-size:14px;margin:0 0 24px;">${e(d.barberia)} &middot; ${e(d.direccion)}</p>` : "";

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#0F0E0D;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#1B1A18;border:1px solid #38352F;padding:32px;">
    <p style="color:#C79A45;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;margin:0 0 8px;">Turno confirmado</p>
    <h1 style="color:#F0EAE0;font-family:Georgia,serif;font-size:28px;font-weight:400;margin:0 0 16px;">Hola ${e(d.nombreCliente)}, te esperamos</h1>
    ${donde}
    <table style="width:100%;border-collapse:collapse;">${filas}</table>
    <p style="color:#9C948A;font-size:13px;line-height:1.6;margin:24px 0 0;">
      Si te sumas algo en el sillon (cejas, tonico o cera) se agrega al total ese dia.
      Podes cancelar el turno desde <a href="${env.siteUrl()}/mis-turnos" style="color:#C79A45;">Mis turnos</a>.
    </p>
  </div>
  <p style="max-width:520px;margin:16px auto 0;color:#9C948A;font-size:11px;text-align:center;">
    Turno Fijo &middot; este mail es automatico, no hace falta responderlo.
  </p>
</body></html>`;
}

function textoPlano(d: DatosConfirmacion): string {
  return [
    `Hola ${d.nombreCliente}, tu turno quedo confirmado.`,
    "",
    `Barberia: ${d.barberia}${d.direccion ? ` (${d.direccion})` : ""}`,
    `Servicio: ${d.servicio}`,
    `Barbero: ${d.barbero}`,
    `Cuando: ${fechaLarga(d.fecha)} a las ${hhmm(d.hora)}`,
    `A pagar en el local: ${pesos(d.precioCent)}`,
    `Codigo de turno: ${d.codigo}`,
    "",
    `Podes cancelarlo en ${env.siteUrl()}/mis-turnos`,
  ].join("\n");
}

/** Devuelve true si el mail se envio. Nunca lanza: no bloquea la reserva. */
export async function enviarConfirmacionTurno(datos: DatosConfirmacion): Promise<boolean> {
  const apiKey = env.resendApiKey();
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY sin configurar: se omite la confirmacion.");
    return false;
  }

  try {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.emailFrom(),
        to: [datos.para],
        subject: `Turno confirmado en ${datos.barberia} - ${fechaLarga(datos.fecha)} ${hhmm(datos.hora)}`,
        html: plantilla(datos),
        text: textoPlano(datos),
      }),
    });

    if (!respuesta.ok) {
      // Sin cuerpo ni destinatario en el log.
      console.error(`[email] envio rechazado con status ${respuesta.status}`);
      return false;
    }
    return true;
  } catch {
    console.error("[email] no se pudo contactar al proveedor de mail");
    return false;
  }
}
