import { requerirDuenio } from "@/lib/sesion";
import { ServiciosPanel, type ServicioFila } from "@/components/panel/servicios-panel";

export const metadata = { title: "Servicios - Turno Fijo" };
export const dynamic = "force-dynamic";

export default async function PaginaServicios() {
  const { supabase, tenant } = await requerirDuenio("/panel/servicios");

  const { data } = await supabase
    .from("services")
    .select("id, nombre, descripcion, duracion_min, precio_cent, reservable, activo")
    .eq("tenant_id", tenant.id)
    .order("activo", { ascending: false })
    .order("precio_cent", { ascending: false });

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <ServiciosPanel servicios={(data ?? []) as ServicioFila[]} />
    </div>
  );
}
