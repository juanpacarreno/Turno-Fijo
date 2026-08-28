import { requerirDuenio } from "@/lib/sesion";
import { BarberosPanel, type BarberoFila } from "@/components/panel/barberos-panel";

export const metadata = { title: "Barberos - Turno Fijo" };
export const dynamic = "force-dynamic";

export default async function PaginaBarberos() {
  const { supabase, tenant } = await requerirDuenio("/panel/barberos");

  const { data } = await supabase
    .from("barbers")
    .select("id, nombre, descripcion, dias_trabajo, hora_desde, hora_hasta, activo, user_id, email_invitacion")
    .eq("tenant_id", tenant.id)
    .order("activo", { ascending: false })
    .order("nombre", { ascending: true });

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <BarberosPanel barberos={(data ?? []) as BarberoFila[]} />
    </div>
  );
}
