import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requerirPanel } from "@/lib/sesion";
import { fechaISO } from "@/lib/validacion";
import {
  hoyEnZona,
  sumarDias,
  partesFecha,
  hhmm,
  pesos,
  horaAMinutos,
  diaDeSemana,
} from "@/lib/format";
import { EstadoTurnoBadge } from "@/components/estado";
import { Monto } from "@/components/monto";
import { Vacio } from "@/components/vacio";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EstadoTurno } from "@/lib/tipos";

export const metadata = { title: "Agenda - Turno Fijo" };
export const dynamic = "force-dynamic";

type FilaTurno = {
  id: string;
  codigo: string;
  hora_desde: string;
  hora_hasta: string;
  estado: EstadoTurno;
  total_cent: number;
  barbers: { nombre: string } | null;
  clients: { nombre: string } | null;
  appointment_services: { nombre: string; principal: boolean; precio_cent: number }[];
};

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { supabase, tenant } = await requerirPanel("/panel");
  const params = await searchParams;

  const hoy = hoyEnZona();
  const fecha = fechaISO.safeParse(params.fecha).success ? (params.fecha as string) : hoy;

  // Las dos consultas son independientes: van en paralelo para no encadenar
  // dos viajes a la base en cada navegacion.
  // RLS ya limita a la barberia del usuario; el filtro explicito queda igual.
  const [{ data: turnosCrudos }, { data: barberos }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, codigo, hora_desde, hora_hasta, estado, total_cent, barbers(nombre), clients(nombre), appointment_services(nombre, principal, precio_cent)",
      )
      .eq("tenant_id", tenant.id)
      .eq("fecha", fecha)
      .order("hora_desde", { ascending: true }),
    supabase
      .from("barbers")
      .select("id, nombre, dias_trabajo, hora_desde, hora_hasta")
      .eq("tenant_id", tenant.id)
      .eq("activo", true),
  ]);

  const turnos = (turnosCrudos ?? []) as unknown as FilaTurno[];

  const cobrado = turnos
    .filter((t) => t.estado === "completado")
    .reduce((suma, t) => suma + t.total_cent, 0);

  const vigentes = turnos.filter((t) => t.estado === "reservado" || t.estado === "completado");

  const dia = diaDeSemana(fecha);
  const minutosDisponibles = (barberos ?? [])
    .filter((b) => (b.dias_trabajo as number[]).includes(dia))
    .reduce((suma, b) => suma + (horaAMinutos(b.hora_hasta) - horaAMinutos(b.hora_desde)), 0);
  const minutosOcupados = vigentes.reduce(
    (suma, t) => suma + (horaAMinutos(t.hora_hasta) - horaAMinutos(t.hora_desde)),
    0,
  );
  const ocupacion =
    minutosDisponibles > 0 ? Math.round((minutosOcupados / minutosDisponibles) * 100) : 0;
  const libresMin = Math.max(0, minutosDisponibles - minutosOcupados);

  const partes = partesFecha(fecha);

  const estadisticas = [
    { etiqueta: "Turnos", valor: String(vigentes.length), oro: false },
    { etiqueta: "Cobrado", valor: pesos(cobrado), oro: true },
    { etiqueta: "Ocupacion", valor: `${ocupacion}%`, oro: false },
    { etiqueta: "Libre", valor: `${Math.floor(libresMin / 60)}h ${libresMin % 60}m`, oro: false },
  ];

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      {/* Encabezado del dia */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="etiqueta">{partes.diaSemanaLargo}</p>
          <h1 className="mt-1 font-display text-3xl leading-none text-crema sm:text-4xl">
            {Number(partes.dia)} de {partes.mes}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="contorno" size="sm">
            <Link href={`/panel?fecha=${sumarDias(fecha, -1)}`}>
              <ChevronLeft aria-hidden="true" />
              Ayer
            </Link>
          </Button>
          {fecha !== hoy ? (
            <Button asChild variant="contorno" size="sm">
              <Link href="/panel">Hoy</Link>
            </Button>
          ) : null}
          <Button asChild variant="contorno" size="sm">
            <Link href={`/panel?fecha=${sumarDias(fecha, 1)}`}>
              Manana
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Tira de indicadores */}
      <dl className="mt-6 grid grid-cols-2 border border-linea sm:grid-cols-4">
        {estadisticas.map((e, i) => (
          <div
            key={e.etiqueta}
            className={[
              "px-4 py-3",
              i % 2 === 0 ? "border-r border-linea" : "",
              i < 2 ? "border-b border-linea sm:border-b-0" : "",
              "sm:border-r sm:last:border-r-0",
            ].join(" ")}
          >
            <dt className="etiqueta">{e.etiqueta}</dt>
            <dd
              className={`mt-1 font-mono text-lg tabular-nums ${e.oro ? "text-oro" : "text-crema"}`}
            >
              {e.valor}
            </dd>
          </div>
        ))}
      </dl>

      {turnos.length === 0 ? (
        <Vacio
          className="mt-6"
          titulo="No hay turnos para este dia"
          detalle="Cuando alguien reserve desde la pagina publica va a aparecer aca, ordenado por hora."
        >
          <Button asChild variant="contorno" size="sm">
            <Link href={`/b/${tenant.slug}`}>Ver pagina de reservas</Link>
          </Button>
        </Vacio>
      ) : (
        <>
          {/* DESKTOP: tabla ancha */}
          <div className="mt-6 hidden border border-linea lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24">Hora</TableHead>
                  <TableHead>Cliente / servicio</TableHead>
                  <TableHead className="w-40">Barbero</TableHead>
                  <TableHead className="w-32">Estado</TableHead>
                  <TableHead className="w-36 text-right">Monto</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {turnos.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono tabular-nums text-ceniza">
                      {hhmm(t.hora_desde)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-crema">{t.clients?.nombre ?? "Cliente"}</p>
                      <p className="mt-0.5 text-xs text-ceniza">{descripcionServicios(t)}</p>
                    </TableCell>
                    <TableCell className="text-ceniza">{t.barbers?.nombre ?? "-"}</TableCell>
                    <TableCell>
                      <EstadoTurnoBadge estado={t.estado} />
                    </TableCell>
                    <TableCell>
                      <div className="text-right">
                        {t.estado === "completado" ? (
                          <Monto centavos={t.total_cent} destacado />
                        ) : (
                          <span className="font-mono tabular-nums text-ceniza">
                            {pesos(t.total_cent)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="contorno" size="sm" className="w-full">
                        <Link href={`/panel/turno/${t.id}`}>
                          {t.estado === "reservado" ? "Cobrar" : "Ver"}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* MOBILE: lista tactil */}
          <ul className="mt-6 border border-linea lg:hidden">
            {turnos.map((t) => (
              <li key={t.id} className="fila-lista">
                <Link href={`/panel/turno/${t.id}`} className="flex items-start gap-3 px-4 py-4">
                  <span className="mt-0.5 w-12 shrink-0 font-mono text-sm tabular-nums text-ceniza">
                    {hhmm(t.hora_desde)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-crema">
                      {t.clients?.nombre ?? "Cliente"}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ceniza">
                      {descripcionServicios(t)} &middot; {t.barbers?.nombre ?? "-"}
                    </span>
                    <span className="mt-2 block">
                      <EstadoTurnoBadge estado={t.estado} />
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-mono text-sm tabular-nums ${
                      t.estado === "completado" ? "text-oro" : "text-ceniza"
                    }`}
                  >
                    {pesos(t.total_cent)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function descripcionServicios(t: FilaTurno): string {
  const principal = t.appointment_services.find((s) => s.principal)?.nombre ?? "Servicio";
  const extras = t.appointment_services.filter((s) => !s.principal).length;
  return extras > 0 ? `${principal} + ${extras} adicional${extras > 1 ? "es" : ""}` : principal;
}
