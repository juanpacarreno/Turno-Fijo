import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerUsuario } from "@/lib/sesion";
import { slug as esquemaSlug, uuid, fechaISO, horaHHMM } from "@/lib/validacion";
import { Vacio } from "@/components/vacio";
import {
  WizardReserva,
  type BarberoPublico,
  type ServicioPublico,
} from "@/components/reserva/wizard-reserva";

export const dynamic = "force-dynamic";

/**
 * Pagina publica de reservas de una barberia.
 *
 * Se lee con el cliente comun (anon), o sea a traves de las politicas de RLS
 * que exponen unicamente barberias, barberos y servicios activos. Ningun dato
 * de clientes ni de turnos ajenos se toca en esta consulta.
 */
async function traerBarberia(slugCrudo: string) {
  const parseo = esquemaSlug.safeParse(slugCrudo);
  if (!parseo.success) return null;

  const supabase = await crearClienteServidor();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, slug, nombre, direccion, telefono")
    .eq("slug", parseo.data)
    .eq("activo", true)
    .maybeSingle();

  if (!tenant) return null;

  const { data: barberos } = await supabase
    .from("barbers")
    .select("id, nombre, descripcion, dias_trabajo, hora_desde, hora_hasta")
    .eq("tenant_id", tenant.id)
    .eq("activo", true)
    .order("nombre", { ascending: true });

  const { data: servicios } = await supabase
    .from("services")
    .select("id, nombre, descripcion, duracion_min, precio_cent")
    .eq("tenant_id", tenant.id)
    .eq("activo", true)
    .eq("reservable", true)
    .order("precio_cent", { ascending: true });

  return {
    tenant,
    barberos: (barberos ?? []) as BarberoPublico[],
    servicios: (servicios ?? []) as ServicioPublico[],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const datos = await traerBarberia(slug);
  if (!datos) return { title: "Barberia no encontrada - Turno Fijo" };
  return {
    title: `Reservar en ${datos.tenant.nombre} - Turno Fijo`,
    description: `Pedi tu turno en ${datos.tenant.nombre}. Elegis barbero, servicio y horario.`,
  };
}

export default async function PaginaReserva({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const consulta = await searchParams;

  const datos = await traerBarberia(slug);
  if (!datos) notFound();

  const { usuario } = await obtenerUsuario();

  // Los valores que vuelven de la URL se validan antes de usarse.
  const soloTexto = (valor: string | string[] | undefined) =>
    typeof valor === "string" ? valor : undefined;

  const inicial = {
    barbero: uuid.safeParse(soloTexto(consulta.barbero)).success
      ? (consulta.barbero as string)
      : undefined,
    servicio: uuid.safeParse(soloTexto(consulta.servicio)).success
      ? (consulta.servicio as string)
      : undefined,
    fecha: fechaISO.safeParse(soloTexto(consulta.fecha)).success
      ? (consulta.fecha as string)
      : undefined,
    hora: horaHHMM.safeParse(soloTexto(consulta.hora)).success
      ? (consulta.hora as string)
      : undefined,
  };

  const sinAgenda = datos.barberos.length === 0 || datos.servicios.length === 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="border-b border-linea pb-5">
        <p className="etiqueta">
          {datos.tenant.nombre}
          {datos.tenant.direccion ? ` - ${datos.tenant.direccion}` : ""}
        </p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <h1 className="font-display text-2xl leading-none text-crema sm:text-3xl">
            Reserva tu turno
          </h1>
          {usuario ? (
            <Link
              href="/mis-turnos"
              className="shrink-0 text-sm text-ceniza transition-colors hover:text-oro"
            >
              Mis turnos
            </Link>
          ) : null}
        </div>
      </header>

      <div className="mt-8">
        {sinAgenda ? (
          <Vacio
            titulo="Esta barberia todavia no publico su agenda"
            detalle="Falta que carguen barberos o servicios. Volve a intentarlo en un rato."
          />
        ) : (
          <WizardReserva
            slug={datos.tenant.slug as string}
            barberia={datos.tenant.nombre as string}
            direccion={(datos.tenant.direccion as string | null) ?? null}
            barberos={datos.barberos}
            servicios={datos.servicios}
            haySesion={Boolean(usuario)}
            inicial={inicial}
          />
        )}
      </div>

      <footer className="mt-16 border-t border-linea pt-5 text-xs text-ceniza">
        Turno Fijo &middot; el pago se hace en el local &middot; precios en pesos
      </footer>
    </main>
  );
}
