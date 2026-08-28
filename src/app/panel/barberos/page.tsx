import { requerirDuenio } from "@/lib/sesion";
import { BarberosPanel, type BarberoFila } from "@/components/panel/barberos-panel";

export const metadata = { title: "Barberos - Turno Fijo" };
export const dynamic = "force-dynamic";

export default async function PaginaBarberos() {
  const { supabase, tenant } = await requerirDuenio("/panel/barberos");

  const [{ data: fichas }, { data: invitaciones }] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, nombre, descripcion, dias_trabajo, hora_desde, hora_hasta, activo, user_id")
      .eq("tenant_id", tenant.id)
      .order("activo", { ascending: false })
      .order("nombre", { ascending: true }),
    // La invitacion pendiente de cada ficha vive en su propia tabla.
    supabase
      .from("invitaciones")
      .select("email, barber_id")
      .eq("tenant_id", tenant.id)
      .not("barber_id", "is", null),
  ]);

  const invitadoPorFicha = new Map<string, string>();
  for (const i of invitaciones ?? []) {
    invitadoPorFicha.set(i.barber_id as string, i.email as string);
  }

  const barberos = (fichas ?? []).map((f) => ({
    ...f,
    email_invitacion: invitadoPorFicha.get(f.id as string) ?? null,
  })) as BarberoFila[];

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <BarberosPanel barberos={barberos} />
    </div>
  );
}
