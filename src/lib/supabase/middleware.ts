import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refresca el token de sesion en cada navegacion y devuelve la respuesta con
 * las cookies actualizadas. Sin esto, la sesion de un Server Component puede
 * quedar vencida.
 */
export async function actualizarSesion(request: NextRequest, respuesta: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesNuevas) {
          cookiesNuevas.forEach(({ name, value, options }) => {
            respuesta.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/",
            });
          });
        },
      },
    },
  );

  // getUser() valida el JWT contra el servidor de auth; getSession() no.
  const { data } = await supabase.auth.getUser();
  return { respuesta, usuario: data.user ?? null };
}
