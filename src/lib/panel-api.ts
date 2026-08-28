import type { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { obtenerUsuario, obtenerMembresia } from "@/lib/sesion";
import { NO_AUTORIZADO, PROHIBIDO } from "@/lib/api";
import type { RolMiembro, Tenant } from "@/lib/tipos";

export type ContextoPanel =
  | {
      supabase: SupabaseClient;
      usuario: User;
      tenant: Tenant;
      rol: RolMiembro;
      barberoId: string | null;
      respuesta?: never;
    }
  | {
      respuesta: NextResponse;
      supabase?: never;
      usuario?: never;
      tenant?: never;
      rol?: never;
      barberoId?: never;
    };

/**
 * Verificacion obligatoria de todo endpoint del panel:
 * 1) hay sesion valida (JWT chequeado contra Supabase);
 * 2) el usuario es miembro de una barberia.
 *
 * Devuelve el tenant al que pertenece; los handlers filtran SIEMPRE por ese
 * tenant_id, ademas del filtro que ya aplica RLS.
 */
export async function contextoPanel(soloDuenio = false): Promise<ContextoPanel> {
  const { supabase, usuario } = await obtenerUsuario();
  if (!usuario) return { respuesta: NO_AUTORIZADO() };

  const membresia = await obtenerMembresia(supabase, usuario.id);
  if (!membresia) return { respuesta: PROHIBIDO() };

  // Precios, servicios y barberos son del dueno. El barbero solo opera turnos.
  if (soloDuenio && membresia.rol !== "dueno") return { respuesta: PROHIBIDO() };

  return { supabase, usuario, ...membresia };
}
