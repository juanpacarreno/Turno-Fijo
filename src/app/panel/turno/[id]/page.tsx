import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requerirPanel } from "@/lib/sesion";
import { uuid } from "@/lib/validacion";
import { fechaLarga, hhmm } from "@/lib/format";
import { PantallaCobro } from "@/components/panel/pantalla-cobro";
import { EstadoTurnoBadge } from "@/components/estado";
import type { EstadoTurno, MedioPago } from "@/lib/tipos";

export const metadata = { title: "Turno - Turno Fijo" };
export const dynamic = "force-dynamic";

type TurnoDetalle = {
  id: string;
  codigo: string;
  fecha: string;
  hora_desde: string;
  hora_hasta: string;
  estado: EstadoTurno;
  medio_pago: MedioPago | null;
  total_cent: number;
  nota: string | null;
  barbers: { nombre: string } | null;
  clients: { nombre: string; email: string } | null;
  appointment_services: {
    id: string;
    service_id: string | null;
    nombre: string;
    precio_cent: number;
    principal: boolean;
  }[];
};

export default async function PaginaTurno({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const { supabase, tenant } = await requerirPanel(`/panel/turno/${id}`);

  // Doble filtro: politica de RLS + tenant_id explicito.
  const [{ data }, { data: catalogo }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, codigo, fecha, hora_desde, hora_hasta, estado, medio_pago, total_cent, nota, barbers(nombre), clients(nombre, email), appointment_services(id, service_id, nombre, precio_cent, principal)",
      )
      .eq("id", id)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    // Catalogo para cargar adicionales en el sillon.
    supabase
      .from("services")
      .select("id, nombre, precio_cent, duracion_min")
      .eq("tenant_id", tenant.id)
      .eq("activo", true)
      .order("precio_cent", { ascending: true }),
  ]);

  if (!data) notFound();
  const turno = data as unknown as TurnoDetalle;

  const principal = turno.appointment_services.find((s) => s.principal);
  const adicionalesActuales = turno.appointment_services.filter((s) => !s.principal);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <Link
        href={`/panel?fecha=${turno.fecha}`}
        className="inline-flex items-center gap-2 text-sm text-ceniza transition-colors hover:text-crema"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a la agenda
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-linea pb-5">
        <div>
          <p className="etiqueta">
            {fechaLarga(turno.fecha)} &middot; {hhmm(turno.hora_desde)} a {hhmm(turno.hora_hasta)}
          </p>
          <h1 className="mt-1 font-display text-3xl leading-none text-crema">
            {turno.clients?.nombre ?? "Cliente"}
          </h1>
          <p className="mt-2 text-sm text-ceniza">
            Con {turno.barbers?.nombre ?? "el barbero"} &middot;{" "}
            <span className="font-mono text-oro">{turno.codigo}</span>
          </p>
        </div>
        <EstadoTurnoBadge estado={turno.estado} />
      </header>

      {turno.nota ? (
        <p className="mt-4 border-l-2 border-linea pl-3 text-sm text-ceniza">
          Nota del cliente: {turno.nota}
        </p>
      ) : null}

      <PantallaCobro
        turnoId={turno.id}
        estado={turno.estado}
        medioPago={turno.medio_pago}
        totalCent={turno.total_cent}
        fecha={turno.fecha}
        principal={
          principal
            ? { nombre: principal.nombre, precioCent: principal.precio_cent }
            : { nombre: "Servicio", precioCent: 0 }
        }
        adicionalesActuales={adicionalesActuales.map((a) => ({
          nombre: a.nombre,
          precioCent: a.precio_cent,
        }))}
        catalogo={(catalogo ?? []).map((s) => ({
          id: s.id as string,
          nombre: s.nombre as string,
          precioCent: s.precio_cent as number,
        }))}
        servicioPrincipalId={principal?.service_id ?? null}
      />
    </div>
  );
}
