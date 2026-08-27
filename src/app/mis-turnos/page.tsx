import Link from "next/link";
import { Marca } from "@/components/marca";
import { CerrarSesion } from "@/components/cerrar-sesion";
import { EstadoTurnoBadge } from "@/components/estado";
import { BotonCancelar } from "@/components/boton-cancelar";
import { Vacio } from "@/components/vacio";
import { Button } from "@/components/ui/button";
import { requerirUsuarioEnPagina } from "@/lib/sesion";
import { fechaLarga, hhmm, pesos, hoyEnZona } from "@/lib/format";
import type { EstadoTurno } from "@/lib/tipos";

export const metadata = { title: "Mis turnos - Turno Fijo" };
export const dynamic = "force-dynamic";

type TurnoCliente = {
  codigo: string;
  fecha: string;
  hora_desde: string;
  estado: EstadoTurno;
  total_cent: number;
  tenants: { nombre: string; direccion: string | null; slug: string } | null;
  barbers: { nombre: string } | null;
  appointment_services: { nombre: string; precio_cent: number; principal: boolean }[];
};

/**
 * Turnos del cliente en todas las barberias donde reservo.
 *
 * La consulta no filtra por tenant a proposito: RLS devuelve unicamente las
 * filas cuyo client_id pertenece a este usuario, de cualquier barberia. Nunca
 * puede aparecer el turno de otra persona.
 */
export default async function PaginaMisTurnos() {
  const { supabase } = await requerirUsuarioEnPagina("/mis-turnos");

  const { data } = await supabase
    .from("appointments")
    .select(
      "codigo, fecha, hora_desde, estado, total_cent, tenants(nombre, direccion, slug), barbers(nombre), appointment_services(nombre, precio_cent, principal)",
    )
    .order("fecha", { ascending: false })
    .order("hora_desde", { ascending: false })
    .limit(50);

  const turnos = (data ?? []) as unknown as TurnoCliente[];
  const hoy = hoyEnZona();

  const proximos = turnos.filter((t) => t.estado === "reservado" && t.fecha >= hoy);
  const pasados = turnos.filter((t) => !(t.estado === "reservado" && t.fecha >= hoy));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex items-start justify-between">
        <Link href="/">
          <Marca compacto />
        </Link>
        <CerrarSesion />
      </header>

      <h1 className="mt-10 font-display text-3xl leading-none text-crema sm:text-4xl">
        Mis turnos
      </h1>

      {turnos.length === 0 ? (
        <Vacio
          className="mt-8"
          titulo="Todavia no reservaste ningun turno"
          detalle="Cuando reserves en una barberia que use Turno Fijo lo vas a ver aca."
        >
          <Button asChild variant="contorno">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </Vacio>
      ) : (
        <>
          <section className="mt-8">
            <p className="etiqueta">Proximos</p>
            {proximos.length === 0 ? (
              <p className="mt-3 border border-dashed border-linea px-4 py-6 text-sm text-ceniza">
                No tenes turnos pendientes.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {proximos.map((t) => (
                  <li key={t.codigo}>
                    <TarjetaTurno turno={t} cancelable />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {pasados.length > 0 ? (
            <section className="mt-10">
              <p className="etiqueta">Historial</p>
              <ul className="mt-3 space-y-3">
                {pasados.map((t) => (
                  <li key={t.codigo}>
                    <TarjetaTurno turno={t} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

function TarjetaTurno({ turno, cancelable = false }: { turno: TurnoCliente; cancelable?: boolean }) {
  const principal = turno.appointment_services.find((s) => s.principal);
  const adicionales = turno.appointment_services.filter((s) => !s.principal);
  const monto = turno.estado === "completado" ? turno.total_cent : (principal?.precio_cent ?? 0);

  return (
    <article className="border border-linea bg-carbon">
      <div className="flex items-start justify-between gap-4 border-b border-linea px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-sm text-crema">{turno.tenants?.nombre ?? "Barberia"}</p>
          {turno.tenants?.direccion ? (
            <p className="mt-0.5 truncate text-xs text-ceniza">{turno.tenants.direccion}</p>
          ) : null}
        </div>
        <EstadoTurnoBadge estado={turno.estado} />
      </div>

      <div className="px-4 py-4 sm:px-5">
        <p className="font-display text-xl text-crema">
          {fechaLarga(turno.fecha)} &middot;{" "}
          <span className="font-mono">{hhmm(turno.hora_desde)}</span>
        </p>
        <p className="mt-1 text-sm text-ceniza">
          {principal?.nombre ?? "Servicio"} con {turno.barbers?.nombre ?? "el barbero"}
          {adicionales.length > 0
            ? ` + ${adicionales.length} adicional${adicionales.length > 1 ? "es" : ""}`
            : ""}
        </p>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-linea pt-3">
          <div>
            <p className="etiqueta">Codigo</p>
            <p className="mt-0.5 font-mono text-sm text-oro">{turno.codigo}</p>
          </div>
          <div className="text-right">
            <p className="etiqueta">
              {turno.estado === "completado" ? "Total cobrado" : "A pagar en el local"}
            </p>
            <p className="mt-0.5 font-mono text-lg tabular-nums text-crema">{pesos(monto)}</p>
          </div>
        </div>

        {cancelable ? (
          <div className="mt-4">
            <BotonCancelar codigo={turno.codigo} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
