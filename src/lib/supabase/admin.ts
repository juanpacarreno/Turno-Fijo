import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cliente con service role. BYPASSEA RLS.
 *
 * Uso permitido, y unicamente desde route handlers:
 *  - alta de barberia (crear tenant + membresia en un solo paso)
 *  - lectura acotada para armar el mail de confirmacion
 *
 * Toda consulta hecha con este cliente DEBE filtrar por tenant_id de forma
 * explicita y despues de haber verificado la sesion del usuario.
 */
export function crearClienteAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
