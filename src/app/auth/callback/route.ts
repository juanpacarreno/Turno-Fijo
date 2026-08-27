import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { rutaInternaSegura } from "@/lib/validacion";
import { limitar, ipDeRequest } from "@/lib/rate-limit";
import { LIMITES } from "@/lib/rate-limit";

/**
 * Cierre del flujo OAuth de Google.
 *
 * - Rate limit por IP: es el punto de entrada de sesion de la app.
 * - El destino se valida como ruta interna (sin open redirect).
 * - Ningun dato del perfil se escribe en el log.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const codigo = url.searchParams.get("code");
  const destino = rutaInternaSegura(url.searchParams.get("next"), "/panel");

  const limite = limitar(
    `login:${ipDeRequest(request)}`,
    LIMITES.login.maximo,
    LIMITES.login.ventanaSeg,
  );
  if (!limite.permitido) {
    return NextResponse.redirect(new URL("/ingresar?error=limite", url.origin));
  }

  if (!codigo) {
    return NextResponse.redirect(new URL("/ingresar?error=codigo", url.origin));
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(codigo);

  if (error) {
    console.error("[auth] no se pudo canjear el codigo de sesion");
    return NextResponse.redirect(new URL("/ingresar?error=sesion", url.origin));
  }

  return NextResponse.redirect(new URL(destino, url.origin));
}
