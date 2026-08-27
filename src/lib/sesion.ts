import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Tenant } from "@/lib/tipos";

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

/** Devuelve el usuario autenticado o null. Valida el JWT contra Supabase. */
export async function obtenerUsuario(): Promise<{ supabase: SupabaseClient; usuario: User | null }> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  return { supabase, usuario: data.user ?? null };
}

/** Para paginas: si no hay sesion, manda al login conservando el destino. */
export async function requerirUsuarioEnPagina(destino: string): Promise<Sesion> {
  const { supabase, usuario } = await obtenerUsuario();
  if (!usuario) redirect(`/ingresar?next=${encodeURIComponent(destino)}`);
  return { supabase, usuario };
}

/**
 * Barberia administrada por el usuario. La consulta pasa por RLS, con lo cual
 * solo puede devolver tenants donde el usuario es miembro.
 */
export async function obtenerTenantDelUsuario(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from("tenant_members")
    .select("tenant_id, tenants(id, slug, nombre, direccion, telefono, activo)")
    .eq("user_id", usuarioId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const tenant = (data as { tenants: Tenant | Tenant[] | null }).tenants;
  if (!tenant) return null;
  return Array.isArray(tenant) ? (tenant[0] ?? null) : tenant;
}

/** Panel: exige sesion + barberia. Si no tiene barberia, va al alta. */
export async function requerirPanel(destino: string): Promise<Sesion & { tenant: Tenant }> {
  const { supabase, usuario } = await requerirUsuarioEnPagina(destino);
  const tenant = await obtenerTenantDelUsuario(supabase, usuario.id);
  if (!tenant) redirect("/registrar");
  return { supabase, usuario, tenant };
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
