import { requerirDuenio } from "@/lib/sesion";
import {
  EquipoPanel,
  type Miembro,
  type Invitacion,
  type FichaLibre,
} from "@/components/panel/equipo-panel";

export const metadata = { title: "Equipo - Turno Fijo" };
export const dynamic = "force-dynamic";

export default async function PaginaEquipo() {
  const { supabase, tenant, usuario } = await requerirDuenio("/panel/equipo");

  const [{ data: miembros }, { data: invitaciones }, { data: fichas }] = await Promise.all([
    supabase
      .from("tenant_members")
      .select("user_id, email, rol, creado_en")
      .eq("tenant_id", tenant.id)
      .order("creado_en", { ascending: true }),
    supabase
      .from("invitaciones")
      .select("id, email, rol, barber_id")
      .eq("tenant_id", tenant.id)
      .order("creado_en", { ascending: true }),
    // Fichas sin cuenta vinculada: son las que se pueden ofrecer al invitar.
    supabase
      .from("barbers")
      .select("id, nombre")
      .eq("tenant_id", tenant.id)
      .eq("activo", true)
      .is("user_id", null)
      .order("nombre", { ascending: true }),
  ]);

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <EquipoPanel
        miembros={(miembros ?? []) as Miembro[]}
        invitaciones={(invitaciones ?? []) as Invitacion[]}
        fichasLibres={(fichas ?? []) as FichaLibre[]}
        usuarioActual={usuario.id}
      />
    </div>
  );
}
