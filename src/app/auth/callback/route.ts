import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
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

  // El destino lo dejo el boton de ingreso en una cookie propia (ver
  // components/boton-google.tsx). Se acepta tambien por query para no romper
  // enlaces viejos, pero la URL de retorno registrada en Supabase no la lleva.
  const almacen = await cookies();
  const guardado = almacen.get("tf-destino")?.value;
  const destino = rutaInternaSegura(
    url.searchParams.get("next") ?? (guardado ? decodeURIComponent(guardado) : null),
    "/panel",
  );

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

  // Si alguien invito a esta persona como barbero cargando su correo, aca
  // queda vinculada su ficha y se le crea la membresia. La funcion compara
  // contra el correo del token, no contra algo que mande el navegador.
  const { error: fallaInvitacion } = await supabase.rpc("aceptar_invitaciones");
  if (fallaInvitacion) {
    console.error("[auth] no se pudieron procesar las invitaciones pendientes");
  }

  const respuesta = NextResponse.redirect(new URL(destino, url.origin));
  respuesta.cookies.delete("tf-destino");
  return respuesta;
}
