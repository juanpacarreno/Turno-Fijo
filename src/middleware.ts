import { NextResponse, type NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/middleware";

/**
 * Middleware de seguridad:
 *  1. Content-Security-Policy con nonce por request (Next inyecta el nonce en
 *     sus propios scripts leyendolo del header del request).
 *  2. Refresco de la sesion de Supabase.
 *  3. Corte temprano de rutas privadas sin sesion.
 */

const RUTAS_PRIVADAS = ["/panel", "/mis-turnos", "/registrar"];

function armarCSP(nonce: string): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const enDesarrollo = process.env.NODE_ENV !== "production";

  const script = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    enDesarrollo ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const conexiones = ["'self'", supabase, enDesarrollo ? "ws://localhost:*" : ""]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src ${script}`,
    // Las tipografias las sirve next/font desde el propio dominio.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    `connect-src ${conexiones}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    enDesarrollo ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = armarCSP(nonce);

  const headersDelRequest = new Headers(request.headers);
  headersDelRequest.set("x-nonce", nonce);
  headersDelRequest.set("content-security-policy", csp);

  const respuesta = NextResponse.next({ request: { headers: headersDelRequest } });
  respuesta.headers.set("content-security-policy", csp);

  const { usuario } = await actualizarSesion(request, respuesta);

  const ruta = request.nextUrl.pathname;
  const esPrivada = RUTAS_PRIVADAS.some((p) => ruta === p || ruta.startsWith(`${p}/`));

  if (esPrivada && !usuario) {
    const destino = new URL("/ingresar", request.url);
    destino.searchParams.set("next", ruta);
    const redireccion = NextResponse.redirect(destino);
    respuesta.cookies.getAll().forEach((c) => redireccion.cookies.set(c));
    redireccion.headers.set("content-security-policy", csp);
    return redireccion;
  }

  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
