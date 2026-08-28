import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requerirDuenio } from "@/lib/sesion";
import { pesos, hoyEnZona, nombreMes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ETIQUETA_MEDIO_PAGO, type MedioPago } from "@/lib/tipos";

export const metadata = { title: "Caja - Turno Fijo" };
export const dynamic = "force-dynamic";

const MEDIOS: MedioPago[] = ["efectivo", "transferencia", "tarjeta"];

function limitesDelMes(anio: number, mes: number) {
  const dosDigitos = (n: number) => String(n).padStart(2, "0");
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return {
    desde: `${anio}-${dosDigitos(mes)}-01`,
    hasta: `${anio}-${dosDigitos(mes)}-${dosDigitos(ultimoDia)}`,
  };
}

/**
 * Caja del mes: ingresos por medio de pago sobre el monto REALMENTE cobrado
 * (servicio reservado + adicionales del sillon), turnos completados y
 * clientes que no llegaron.
 */
export default async function PaginaCaja({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { supabase, tenant } = await requerirDuenio("/panel/caja");
  const params = await searchParams;

  const hoy = hoyEnZona();
  const pedido = /^\d{4}-\d{2}$/.test(params.mes ?? "") ? (params.mes as string) : hoy.slice(0, 7);
  const [anio, mes] = pedido.split("-").map(Number);
  const { desde, hasta } = limitesDelMes(anio, mes);

  const anterior = mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, "0")}`;
  const siguiente = mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, "0")}`;

  // Las dos consultas del mes no dependen entre si: van juntas.
  const [{ data: turnos }, { data: lineas }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, estado, medio_pago, total_cent")
      .eq("tenant_id", tenant.id)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    // Que se vendio en el mes, sumando servicio reservado y adicionales.
    supabase
      .from("appointment_services")
      .select("nombre, precio_cent, principal, appointments!inner(fecha, estado)")
      .eq("tenant_id", tenant.id)
      .eq("appointments.estado", "completado")
      .gte("appointments.fecha", desde)
      .lte("appointments.fecha", hasta),
  ]);

  const filas = turnos ?? [];
  const completados = filas.filter((t) => t.estado === "completado");
  const noVinieron = filas.filter((t) => t.estado === "no_asistio").length;
  const cancelados = filas.filter((t) => t.estado === "cancelado").length;

  const totalCobrado = completados.reduce((s, t) => s + (t.total_cent as number), 0);

  const porMedio = MEDIOS.map((medio) => {
    const delMedio = completados.filter((t) => t.medio_pago === medio);
    const monto = delMedio.reduce((s, t) => s + (t.total_cent as number), 0);
    return {
      medio,
      monto,
      cantidad: delMedio.length,
      porcentaje: totalCobrado > 0 ? Math.round((monto / totalCobrado) * 100) : 0,
    };
  });

  const porServicio = new Map<string, number>();
  let montoAdicionales = 0;
  for (const linea of lineas ?? []) {
    const nombre = linea.nombre as string;
    const precio = linea.precio_cent as number;
    porServicio.set(nombre, (porServicio.get(nombre) ?? 0) + precio);
    if (!linea.principal) montoAdicionales += precio;
  }
  const ranking = [...porServicio.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const ticketPromedio =
    completados.length > 0 ? Math.round(totalCobrado / completados.length) : 0;

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="etiqueta">Ingresos del mes</p>
          <h1 className="mt-1 font-display text-3xl leading-none text-crema sm:text-4xl">
            {nombreMes(mes)} {anio}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="contorno" size="sm">
            <Link href={`/panel/caja?mes=${anterior}`}>
              <ChevronLeft aria-hidden="true" />
              Anterior
            </Link>
          </Button>
          <Button asChild variant="contorno" size="sm">
            <Link href={`/panel/caja?mes=${siguiente}`}>
              Siguiente
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Total del mes */}
      <div className="mt-6 border border-linea bg-carbon px-5 py-6">
        <p className="etiqueta">Cobrado en el mes</p>
        <p className="mt-2 font-mono text-4xl tabular-nums text-oro sm:text-5xl">
          {pesos(totalCobrado)}
        </p>
        <p className="mt-2 text-sm text-ceniza">
          {completados.length} turnos cobrados &middot; ticket promedio{" "}
          <span className="font-mono text-crema">{pesos(ticketPromedio)}</span>
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Medios de pago */}
        <Card>
          <CardHeader>
            <CardTitle>Medios de pago</CardTitle>
            <p className="text-sm text-ceniza">Sobre el monto realmente cobrado.</p>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <ul>
              {porMedio.map((m) => (
                <li key={m.medio} className="fila-lista px-4 py-4 sm:px-6">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-crema">{ETIQUETA_MEDIO_PAGO[m.medio]}</span>
                    <span className="flex items-baseline gap-4">
                      <span className="font-mono text-xs tabular-nums text-ceniza">
                        {m.cantidad} turnos
                      </span>
                      <span className="w-28 text-right font-mono tabular-nums text-crema">
                        {pesos(m.monto)}
                      </span>
                    </span>
                  </div>
                  {/* Barra de proporcion: 1px de linea, sin sombras */}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-px flex-1 bg-linea">
                      <div
                        className="h-px bg-oro"
                        style={{ width: `${m.porcentaje}%` }}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-xs tabular-nums text-ceniza">
                      {m.porcentaje}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-linea px-4 py-4 sm:px-6">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ceniza">Adicionales cargados en el sillon</span>
                <span className="font-mono tabular-nums text-oro">{pesos(montoAdicionales)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Asistencia y ranking */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asistencia</CardTitle>
            </CardHeader>
            <CardContent className="px-0 py-0">
              <dl>
                <FilaDato etiqueta="Turnos completados" valor={String(completados.length)} />
                <FilaDato etiqueta="No llegaron" valor={String(noVinieron)} />
                <FilaDato etiqueta="Cancelados" valor={String(cancelados)} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Que se vende</CardTitle>
            </CardHeader>
            <CardContent className="px-0 py-0">
              {ranking.length === 0 ? (
                <p className="px-4 py-5 text-sm text-ceniza sm:px-6">
                  Todavia no hay turnos cobrados este mes.
                </p>
              ) : (
                <ul>
                  {ranking.map(([nombre, monto]) => (
                    <li
                      key={nombre}
                      className="fila-lista flex items-baseline justify-between gap-4 px-4 py-3 sm:px-6"
                    >
                      <span className="min-w-0 truncate text-sm text-crema">{nombre}</span>
                      <span className="shrink-0 font-mono tabular-nums text-ceniza">
                        {pesos(monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="fila-lista flex items-baseline justify-between px-4 py-3 sm:px-6">
      <dt className="text-sm text-ceniza">{etiqueta}</dt>
      <dd className="font-mono text-lg tabular-nums text-crema">{valor}</dd>
    </div>
  );
}
