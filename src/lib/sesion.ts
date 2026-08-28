import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { RolMiembro, Tenant } from "@/lib/tipos";

/**
 * Guards de sesion y de pertenencia al tenant.
 *
 * Toda pagina del panel y todo route handler de escritura pasa por aca: la
 * verificacion nunca queda solo en el frontend.
 */

export type Sesion = {
  supabase: SupabaseClient;
  usuario: User;
};

/**
 * Devuelve el usuario autenticado o null. Valida el JWT contra Supabase.
 *
 * Envuelto en `cache()` de React: el layout del panel y la pagina que renderiza
 * adentro piden la sesion por separado, y sin esto cada navegacion hacia dos
 * viajes identicos al servidor de auth. Con el cache, el segundo reusa el
 * resultado del primero dentro del mismo request.
 */
export const obtenerUsuario = cache(
  async (): Promise<{ supabase: SupabaseClient; usuario: User | null }> => {
    const supabase = await crearClienteServidor();
    const { data } = await supabase.auth.getUser();
    return { supabase, usuario: data.user ?? null };
  },
);

/** Para paginas: si no hay sesion, manda al login conservando el destino. */
export async function requerirUsuarioEnPagina(destino: string): Promise<Sesion> {
  const { supabase, usuario } = await obtenerUsuario();
  if (!usuario) redirect(`/ingresar?next=${encodeURIComponent(destino)}`);
  return { supabase, usuario };
}

export type Membresia = {
  tenant: Tenant;
  rol: RolMiembro;
  /** Ficha de barbero vinculada, solo cuando el rol es "barbero". */
  barberoId: string | null;
};

/**
 * Barberia del usuario y con que rol la administra. La consulta pasa por RLS,
 * con lo cual solo puede devolver tenants donde el usuario es miembro.
 *
 * Cacheada por request, por el mismo motivo que `obtenerUsuario`.
 */
export const obtenerMembresia = cache(async (
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<Membresia | null> => {
  const { data, error } = await supabase
    .from("tenant_members")
    .select("rol, tenants(id, slug, nombre, direccion, telefono, activo)")
    // Si alguien llegara a tener dos membresias, manda la mas antigua.
    .eq("user_id", usuarioId)
    .order("creado_en", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const crudo = data as { rol: RolMiembro; tenants: Tenant | Tenant[] | null };
  const tenant = Array.isArray(crudo.tenants) ? (crudo.tenants[0] ?? null) : crudo.tenants;
  if (!tenant) return null;

  let barberoId: string | null = null;
  if (crudo.rol === "barbero") {
    const { data: ficha } = await supabase
      .from("barbers")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("user_id", usuarioId)
      .maybeSingle();
    barberoId = (ficha?.id as string | undefined) ?? null;
  }

  return { tenant, rol: crudo.rol, barberoId };
});

/** Panel: exige sesion + barberia. Si no tiene barberia, va al alta. */
export async function requerirPanel(destino: string): Promise<Sesion & Membresia> {
  const { supabase, usuario } = await requerirUsuarioEnPagina(destino);
  const membresia = await obtenerMembresia(supabase, usuario.id);
  if (!membresia) redirect("/registrar");
  return { supabase, usuario, ...membresia };
}

/**
 * Secciones reservadas al dueno (caja, precios, barberos, clientes). Un
 * barbero que llegue por URL vuelve a su agenda.
 */
export async function requerirDuenio(destino: string): Promise<Sesion & Membresia> {
  const sesion = await requerirPanel(destino);
  if (sesion.rol !== "dueno") redirect("/panel");
  return sesion;
}

/**
 * Confirma en la base que el usuario es miembro del tenant indicado.
 * Se usa en los route handlers antes de cualquier escritura.
 */
export async function esMiembroDelTenant(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  return !error && Boolean(data);
}
