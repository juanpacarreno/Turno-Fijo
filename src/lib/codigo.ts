import { randomInt } from "node:crypto";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1

/**
 * Codigo publico del turno: TF-DDMM-XXXX.
 *
 * Es el unico identificador de turno que ve el cliente. Los uuid internos
 * nunca salen de la app: asi un codigo filtrado no permite deducir ni
 * enumerar otros registros.
 */
export function generarCodigoTurno(fecha: string): string {
  const [, mes, dia] = fecha.split("-");
  let sufijo = "";
  for (let i = 0; i < 4; i += 1) {
    sufijo += ALFABETO[randomInt(0, ALFABETO.length)];
  }
  return `TF-${dia}${mes}-${sufijo}`;
}
