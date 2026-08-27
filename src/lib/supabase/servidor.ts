import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * Cliente de servidor ligado a las cookies de la sesion.
 * Respeta RLS: lo que no permite la politica, no se lee ni se escribe.
 */
export async function crearClienteServidor() {
  const almacenCookies = await cookies();

  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return almacenCookies.getAll();
      },
      setAll(cookiesNuevas) {
        try {
          cookiesNuevas.forEach(({ name, value, options }) => {
            almacenCookies.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/",
            });
          });
        } catch {
          // En Server Components la escritura de cookies no esta permitida:
          // el refresco de sesion ya lo hace el middleware.
        }
      },
    },
  });
}
