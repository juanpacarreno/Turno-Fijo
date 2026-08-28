"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pesos } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ETIQUETA_MEDIO_PAGO, type EstadoTurno, type MedioPago } from "@/lib/tipos";

type ServicioCatalogo = { id: string; nombre: string; precioCent: number };
type LineaFija = { nombre: string; precioCent: number };

const MEDIOS: MedioPago[] = ["efectivo", "transferencia", "tarjeta"];

/**
 * Pantalla de cierre del turno.
 *
 * Los importes que se ven aca son una previsualizacion: el total que se
 * guarda lo recalcula la base sumando las filas de la tabla intermedia, con
 * los precios del catalogo. Lo que se manda al servidor son ids, nunca
 * montos.
 */
export function PantallaCobro({
  turnoId,
  estado,
  medioPago,
  totalCent,
  fecha,
  principal,
  adicionalesActuales,
  catalogo,
  servicioPrincipalId,
}: {
  turnoId: string;
  estado: EstadoTurno;
  medioPago: MedioPago | null;
  totalCent: number;
  fecha: string;
  principal: LineaFija;
  adicionalesActuales: LineaFija[];
  catalogo: ServicioCatalogo[];
  servicioPrincipalId: string | null;
}) {
  const router = useRouter();
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [medio, setMedio] = useState<MedioPago | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  const cerrado = estado === "completado";
  const inactivo = estado === "cancelado" || estado === "no_asistio";

  const adicionalesElegidos = useMemo(
    () => catalogo.filter((s) => elegidos.includes(s.id)),
    [catalogo, elegidos],
  );

  const totalPrevisto = useMemo(
    () => principal.precioCent + adicionalesElegidos.reduce((s, a) => s + a.precioCent, 0),
    [principal.precioCent, adicionalesElegidos],
  );

  function alternar(id: string) {
    setElegidos((actuales) =>
      actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id],
    );
  }

  async function cobrar() {
    if (!medio) {
      setFalla("Elegi como pago el cliente.");
      return;
    }
    setGuardando(true);
    setFalla(null);

    const respuesta = await fetch(`/api/panel/turnos/${turnoId}/cobrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adicionales: elegidos, medioPago: medio }),
    });

    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => ({}));
      setFalla(cuerpo.error ?? "No pudimos registrar el cobro.");
      setGuardando(false);
      return;
    }

    router.push(`/panel?fecha=${fecha}`);
    router.refresh();
  }

  async function cambiarEstado(nuevo: "no_asistio" | "cancelado" | "reservado") {
    setGuardando(true);
    setFalla(null);

    const respuesta = await fetch(`/api/panel/turnos/${turnoId}/estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevo }),
    });

    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => ({}));
      setFalla(cuerpo.error ?? "No pudimos actualizar el turno.");
      setGuardando(false);
      return;
    }

    router.push(`/panel?fecha=${fecha}`);
    router.refresh();
  }

  // ---------------------------------------------------------------- cerrado
  if (cerrado || inactivo) {
    const lineas = cerrado ? [principal, ...adicionalesActuales] : [principal];
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{cerrado ? "Detalle del turno cobrado" : "Turno sin cobrar"}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul>
            {lineas.map((linea, i) => (
              <li
                key={`${linea.nombre}-${i}`}
                className="flex items-baseline justify-between border-b border-linea py-2.5 last:border-b-0"
              >
                <span className={cn("text-sm", i === 0 ? "text-crema" : "text-ceniza")}>
                  {linea.nombre}
                  {i > 0 ? <span className="ml-2 text-[11px] text-ceniza">adicional</span> : null}
                </span>
                <span className="font-mono tabular-nums text-crema">{pesos(linea.precioCent)}</span>
              </li>
            ))}
          </ul>

          {cerrado ? (
            <div className="mt-5 flex items-end justify-between border-t border-linea pt-4">
              <div>
                <p className="etiqueta">Total cobrado</p>
                {medioPago ? (
                  <p className="mt-1 text-sm text-ceniza">{ETIQUETA_MEDIO_PAGO[medioPago]}</p>
                ) : null}
              </div>
              <p className="font-mono text-3xl tabular-nums text-oro">{pesos(totalCent)}</p>
            </div>
          ) : (
            <div className="mt-5 border-t border-linea pt-4">
              <Button
                variant="contorno"
                onClick={() => cambiarEstado("reservado")}
                disabled={guardando}
              >
                Reabrir como reservado
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------- por cobrar
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Adicionales del sillon */}
      <Card>
        <CardHeader>
          <CardTitle>Adicionales del sillon</CardTitle>
          <p className="text-sm text-ceniza">
            Lo que se sumo durante la visita, con los precios de la lista.
          </p>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {catalogo.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ceniza sm:px-6">
              Todavia no cargaste servicios en el catalogo.
            </p>
          ) : (
            <ul>
              {catalogo
                .filter((s) => s.id !== servicioPrincipalId)
                .map((s) => {
                  const activo = elegidos.includes(s.id);
                  return (
                    <li key={s.id} className="fila-lista">
                      <button
                        type="button"
                        onClick={() => alternar(s.id)}
                        aria-pressed={activo}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-4 text-left transition-colors sm:px-6",
                          activo ? "bg-grafito" : "hover:bg-grafito/50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center border",
                            activo ? "border-oro bg-oro text-sillon" : "border-linea text-transparent",
                          )}
                          aria-hidden="true"
                        >
                          {activo ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-crema">
                          {s.nombre}
                        </span>
                        <span className="shrink-0 font-mono tabular-nums text-sm text-ceniza">
                          {pesos(s.precioCent)}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Cuenta y cobro */}
      <Card className="lg:sticky lg:top-6 lg:self-start">
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <ul>
            <li className="flex items-baseline justify-between border-b border-linea py-2.5">
              <span className="text-sm text-crema">
                {principal.nombre}
                <span className="ml-2 text-[11px] uppercase tracking-etiqueta text-ceniza">
                  reservado
                </span>
              </span>
              <span className="font-mono tabular-nums text-crema">
                {pesos(principal.precioCent)}
              </span>
            </li>
            {adicionalesElegidos.map((a) => (
              <li
                key={a.id}
                className="flex items-baseline justify-between border-b border-linea py-2.5"
              >
                <span className="text-sm text-ceniza">{a.nombre}</span>
                <span className="font-mono tabular-nums text-ceniza">{pesos(a.precioCent)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-end justify-between border-t border-linea pt-4">
            <p className="etiqueta">Total a cobrar</p>
            <p className="font-mono text-3xl tabular-nums text-oro">{pesos(totalPrevisto)}</p>
          </div>

          <fieldset className="mt-6">
            <legend className="etiqueta">Medio de pago</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {MEDIOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMedio(m)}
                  aria-pressed={medio === m}
                  className={cn(
                    // Tipografia mas chica y menos espaciada que el resto de las
                    // etiquetas: "TRANSFERENCIA" no entra a un tercio del ancho
                    // con el tracking habitual.
                    "flex h-12 items-center justify-center whitespace-nowrap border px-1",
                    "text-[10px] uppercase leading-tight tracking-[0.06em] transition-colors",
                    medio === m
                      ? "border-oro bg-oro/15 text-oro"
                      : "border-linea text-ceniza hover:text-crema",
                  )}
                >
                  {ETIQUETA_MEDIO_PAGO[m]}
                </button>
              ))}
            </div>
          </fieldset>

          {falla ? (
            <p role="alert" className="mt-4 text-sm text-ladrillo">
              {falla}
            </p>
          ) : null}

          <Button
            variant="oro"
            size="lg"
            className="mt-5 w-full"
            onClick={cobrar}
            disabled={guardando}
          >
            {guardando ? "Registrando..." : `Cobrar ${pesos(totalPrevisto)}`}
          </Button>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="contorno"
              onClick={() => cambiarEstado("no_asistio")}
              disabled={guardando}
            >
              No vino
            </Button>
            <Button
              variant="peligro"
              onClick={() => cambiarEstado("cancelado")}
              disabled={guardando}
            >
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
