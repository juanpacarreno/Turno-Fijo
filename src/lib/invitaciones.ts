import type { SupabaseClient } from "@supabase/supabase-js";
import type { RolMiembro } from "@/lib/tipos";

/**
 * Alta de una invitacion.
 *
 * Se guarda siempre en minusculas y hay a lo sumo una invitacion por correo y
 * barberia, asi que antes de insertar se limpia cualquier invitacion previa
 * para ese correo o para esa misma ficha de barbero.
 */
export async function guardarInvitacion(
  supabase: SupabaseClient,
  opciones: {
    tenantId: string;
    email: string;
    rol: RolMiembro;
    barberId?: string | null;
    creadoPor: string;
  },
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const email = opciones.email.trim().toLowerCase();
  if (!email) return { ok: false, motivo: "Falta el correo." };

  // Si esa persona ya pertenece al salon no hace falta invitarla.
  const { data: yaMiembro } = await supabase
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", opciones.tenantId)
    .eq("email", email)
    .maybeSingle();
  if (yaMiembro) return { ok: false, motivo: "Esa persona ya forma parte del equipo." };

  await supabase
    .from("invitaciones")
    .delete()
    .eq("tenant_id", opciones.tenantId)
    .eq("email", email);

  if (opciones.barberId) {
    await supabase
      .from("invitaciones")
      .delete()
      .eq("tenant_id", opciones.tenantId)
      .eq("barber_id", opciones.barberId);
  }

  const { error } = await supabase.from("invitaciones").insert({
    tenant_id: opciones.tenantId,
    email,
    rol: opciones.rol,
    barber_id: opciones.barberId ?? null,
    creado_por: opciones.creadoPor,
  });

  if (error) return { ok: false, motivo: "No pudimos guardar la invitacion." };
  return { ok: true };
}

/** Borra la invitacion pendiente de una ficha de barbero. */
export async function borrarInvitacionDeBarbero(
  supabase: SupabaseClient,
  tenantId: string,
  barberId: string,
) {
  await supabase
    .from("invitaciones")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("barber_id", barberId);
}
