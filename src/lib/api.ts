import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output as SalidaZod } from "zod";
import { limitar, ipDeRequest, type ResultadoLimite } from "@/lib/rate-limit";

/**
 * Utilidades comunes de los route handlers: respuestas uniformes, lectura de
 * body validada y rate limiting.
 *
 * Regla: los errores que salen al cliente son genericos y en espanol. El
 * detalle tecnico queda del lado del servidor y nunca incluye datos
 * personales, tokens ni ids internos.
 */

export function ok<T>(datos: T, status = 200) {
  return NextResponse.json(datos, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function error(mensaje: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: mensaje, ...extra },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export const NO_AUTORIZADO = () => error("Necesitas iniciar sesion.", 401);
export const PROHIBIDO = () => error("No tenes permiso para esta operacion.", 403);
export const NO_ENCONTRADO = () => error("No encontramos lo que buscabas.", 404);
export const ERROR_INTERNO = () =>
  error("No pudimos procesar la operacion. Intentalo de nuevo.", 500);

/** Registro sin datos personales: solo ruta y causa acotada. */
export function registrarFalla(ruta: string, causa: unknown) {
  const detalle = causa instanceof Error ? causa.message.slice(0, 200) : "error desconocido";
  console.error(`[api] ${ruta}: ${detalle}`);
}

export function respuestaLimite(resultado: ResultadoLimite) {
  return NextResponse.json(
    { error: "Demasiados intentos. Proba de nuevo en un rato." },
    {
      status: 429,
      headers: {
        "Retry-After": String(resultado.reintentarEn),
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Aplica rate limit por IP (o por la clave que se pase como sufijo).
 * Devuelve null si esta permitido, o la respuesta 429 si hay que cortar.
 */
export function aplicarLimite(
  request: Request,
  operacion: string,
  limite: { maximo: number; ventanaSeg: number },
  sufijo?: string,
) {
  const clave = `${operacion}:${sufijo ?? ipDeRequest(request)}`;
  const resultado = limitar(clave, limite.maximo, limite.ventanaSeg);
  return resultado.permitido ? null : respuestaLimite(resultado);
}

const TAMANO_MAXIMO_BODY = 16 * 1024; // 16 KB: ningun payload legitimo lo supera

/** Lee y valida el body JSON. Devuelve datos o una respuesta de error lista. */
export async function leerBody<E extends ZodTypeAny>(
  request: Request,
  esquema: E,
): Promise<
  | { datos: SalidaZod<E>; respuesta?: never }
  | { datos?: never; respuesta: NextResponse }
> {
  const tipo = request.headers.get("content-type") ?? "";
  if (!tipo.includes("application/json")) {
    return { respuesta: error("Formato de pedido invalido.", 415) };
  }

  const largo = Number(request.headers.get("content-length") ?? "0");
  if (largo > TAMANO_MAXIMO_BODY) {
    return { respuesta: error("El pedido es demasiado grande.", 413) };
  }

  let crudo: unknown;
  try {
    const texto = await request.text();
    if (texto.length > TAMANO_MAXIMO_BODY) {
      return { respuesta: error("El pedido es demasiado grande.", 413) };
    }
    crudo = JSON.parse(texto);
  } catch {
    return { respuesta: error("No pudimos leer los datos enviados.", 400) };
  }

  try {
    return { datos: esquema.parse(crudo) };
  } catch (causa) {
    if (causa instanceof ZodError) {
      const primero = causa.issues[0];
      const campo = primero?.path.join(".") || "dato";
      return {
        respuesta: error(`Revisa el campo ${campo}: ${primero?.message ?? "invalido"}`, 422),
      };
    }
    return { respuesta: error("Datos invalidos.", 422) };
  }
}
