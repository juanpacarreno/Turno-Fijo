"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotonGoogle } from "@/components/boton-google";
import { pesos, partesFecha, hoyEnZona, sumarDias, diaDeSemana, fechaLarga } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BarberoPublico = {
  id: string;
  nombre: string;
  descripcion: string | null;
  dias_trabajo: number[];
  hora_desde: string;
  hora_hasta: string;
};

export type ServicioPublico = {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracion_min: number;
  precio_cent: number;
};

export type Comprobante = {
  codigo: string;
  fecha: string;
  hora: string;
  barbero: string;
  servicio: string;
  precioCent: number;
  barberia: string;
  direccion: string | null;
};

const DIAS_VISIBLES = 14;

/**
 * Reserva del cliente: una decision por paso.
 *
 * Mobile: una sola columna, la accion siempre al alcance del pulgar.
 * Desktop: el paso ocupa el ancho disponible y la seleccion queda fija en una
 * columna lateral, como una aplicacion de escritorio.
 *
 * La disponibilidad la calcula el servidor; aca solo se muestra.
 */
export function WizardReserva({
  slug,
  barberia,
  direccion,
  barberos,
  servicios,
  haySesion,
  inicial,
}: {
  slug: string;
  barberia: string;
  direccion: string | null;
  barberos: BarberoPublico[];
  servicios: ServicioPublico[];
  haySesion: boolean;
  inicial: { barbero?: string; servicio?: string; fecha?: string; hora?: string };
}) {
  const [barberoId, setBarberoId] = useState<string | null>(inicial.barbero ?? null);
  const [servicioId, setServicioId] = useState<string | null>(inicial.servicio ?? null);
  const [fecha, setFecha] = useState<string | null>(inicial.fecha ?? null);
  const [hora, setHora] = useState<string | null>(inicial.hora ?? null);

  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [cargandoHorarios, setCargandoHorarios] = useState(false);
  const [reservando, setReservando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);

  const barbero = barberos.find((b) => b.id === barberoId) ?? null;
  const servicio = servicios.find((s) => s.id === servicioId) ?? null;

  const fechaPuesta = fecha ?? null;
  const paso = comprobante
    ? 5
    : !barbero
      ? 1
      : !servicio
        ? 2
        : !fechaPuesta || !hora
          ? 3
          : 4;

  // La seleccion viaja en la URL: si hay que pasar por Google, al volver el
  // cliente encuentra el turno donde lo dejo.
  useEffect(() => {
    if (comprobante) return;
    const query = new URLSearchParams();
    if (barberoId) query.set("barbero", barberoId);
    if (servicioId) query.set("servicio", servicioId);
    if (fecha) query.set("fecha", fecha);
    if (hora) query.set("hora", hora);
    const texto = query.toString();
    window.history.replaceState(null, "", texto ? `/b/${slug}?${texto}` : `/b/${slug}`);
  }, [slug, barberoId, servicioId, fecha, hora, comprobante]);

  const fechasPosibles = useMemo(() => {
    if (!barbero) return [];
    const hoy = hoyEnZona();
    const dias: string[] = [];
    for (let i = 0; i < DIAS_VISIBLES; i += 1) {
      const dia = sumarDias(hoy, i);
      if (barbero.dias_trabajo.includes(diaDeSemana(dia))) dias.push(dia);
    }
    return dias;
  }, [barbero]);

  // Recibe barbero y servicio por parametro: al elegir un servicio hay que
  // pedir la grilla con el valor recien clickeado, no con el del estado.
  const buscarHorarios = useCallback(
    async (barbero: string | null, servicio: string | null, dia: string | null) => {
      if (!barbero || !servicio || !dia) return;
      setCargandoHorarios(true);
      setHorarios(null);
      try {
        const query = new URLSearchParams({
          slug,
          barbero,
          servicio,
          fecha: dia,
        });
        const respuesta = await fetch(`/api/disponibilidad?${query.toString()}`);
        if (!respuesta.ok) throw new Error("sin horarios");
        const datos = await respuesta.json();
        setHorarios(datos.horarios ?? []);
      } catch {
        setHorarios([]);
        setFalla("No pudimos traer los horarios. Proba de nuevo.");
      } finally {
        setCargandoHorarios(false);
      }
    },
    [slug],
  );

  // El dia mostrado por defecto es el primero que trabaja el barbero.
  const fechaElegida = fecha ?? fechasPosibles[0] ?? null;

  function elegirServicio(id: string) {
    setServicioId(id);
    // Se fija el primer dia trabajado para que el turno quede completo en
    // cuanto el cliente toque un horario.
    if (fechaElegida) setFecha(fechaElegida);
    void buscarHorarios(barberoId, id, fechaElegida);
  }

  function elegirFecha(dia: string) {
    setFecha(dia);
    setHora(null);
    void buscarHorarios(barberoId, servicioId, dia);
  }

  async function reservar() {
    if (!barberoId || !servicioId || !fecha || !hora) return;
    setReservando(true);
    setFalla(null);

    const respuesta = await fetch("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, barberoId, servicioId, fecha, hora }),
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      setFalla(datos.error ?? "No pudimos confirmar el turno.");
      setReservando(false);
      if (respuesta.status === 409) {
        setHora(null);
        void buscarHorarios(barberoId, servicioId, fecha);
      }
      return;
    }

    setComprobante(datos as Comprobante);
    setReservando(false);
    window.history.replaceState(null, "", `/b/${slug}`);
  }

  function volver() {
    setFalla(null);
    if (paso === 4) {
      setHora(null);
      return;
    }
    if (paso === 3) {
      setFecha(null);
      setHorarios(null);
      setServicioId(null);
      return;
    }
    if (paso === 2) {
      setServicioId(null);
      setBarberoId(null);
    }
  }

  // ------------------------------------------------------------ comprobante
  if (comprobante) {
    return <ComprobanteTurno comprobante={comprobante} slug={slug} />;
  }

  const resumen = (
    <ResumenSeleccion
      barbero={barbero?.nombre ?? null}
      servicio={servicio?.nombre ?? null}
      precioCent={servicio?.precio_cent ?? null}
      fecha={fecha}
      hora={hora}
      duracion={servicio?.duracion_min ?? null}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
      <div className="pb-28 lg:pb-0">
        {/* Progreso */}
        <div className="flex items-center gap-3">
          {paso > 1 ? (
            <button
              type="button"
              onClick={volver}
              className="text-ceniza transition-colors hover:text-crema"
              aria-label="Volver al paso anterior"
            >
              <ArrowLeft className="size-5" />
            </button>
          ) : null}
          <p className="etiqueta">Paso {paso} de 4</p>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={cn("h-0.5 flex-1", n <= paso ? "bg-oro" : "bg-linea")}
            />
          ))}
        </div>

        {paso === 1 ? (
          <PasoBarbero barberos={barberos} onElegir={setBarberoId} />
        ) : null}

        {paso === 2 ? (
          <PasoServicio servicios={servicios} onElegir={elegirServicio} />
        ) : null}

        {paso === 3 ? (
          <PasoHorario
            fechas={fechasPosibles}
            fecha={fechaElegida}
            horarios={horarios}
            cargando={cargandoHorarios}
            onFecha={elegirFecha}
            onHora={setHora}
          />
        ) : null}

        {paso === 4 && barbero && servicio && fechaPuesta && hora ? (
          <PasoConfirmacion
            barberia={barberia}
            direccion={direccion}
            barbero={barbero.nombre}
            servicio={servicio.nombre}
            duracion={servicio.duracion_min}
            precioCent={servicio.precio_cent}
            fecha={fechaPuesta}
            hora={hora}
            haySesion={haySesion}
            slug={slug}
            reservando={reservando}
            falla={falla}
            onReservar={reservar}
            barberoId={barbero.id}
            servicioId={servicio.id}
          />
        ) : null}

        {falla && paso !== 4 ? (
          <p role="alert" className="mt-4 text-sm text-ladrillo">
            {falla}
          </p>
        ) : null}
      </div>

      {/* Columna de seleccion: fija en desktop */}
      <aside className="hidden lg:block">
        <div className="sticky top-8 border border-linea bg-carbon p-5">{resumen}</div>
      </aside>

      {/* Resumen compacto en mobile */}
      {paso > 1 && paso < 4 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-carbon px-4 py-3 lg:hidden">
          <div className="flex items-baseline justify-between">
            <span className="truncate text-xs text-ceniza">
              {barbero?.nombre}
              {servicio ? ` - ${servicio.nombre}` : ""}
            </span>
            {servicio ? (
              <span className="ml-3 shrink-0 font-mono tabular-nums text-oro">
                {pesos(servicio.precio_cent)}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PasoBarbero({
  barberos,
  onElegir,
}: {
  barberos: BarberoPublico[];
  onElegir: (id: string) => void;
}) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-3xl leading-tight text-crema sm:text-4xl">
        Con quien te cortas
      </h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {barberos.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onElegir(b.id)}
              className="flex min-h-[88px] w-full items-center gap-4 border border-linea bg-carbon px-4 py-4 text-left transition-colors hover:border-oro"
            >
              <span className="flex size-12 shrink-0 items-center justify-center border border-linea font-mono text-sm text-ceniza">
                {iniciales(b.nombre)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-xl text-crema">{b.nombre}</span>
                {b.descripcion ? (
                  <span className="mt-0.5 block truncate text-sm text-ceniza">{b.descripcion}</span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PasoServicio({
  servicios,
  onElegir,
}: {
  servicios: ServicioPublico[];
  onElegir: (id: string) => void;
}) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-3xl leading-tight text-crema sm:text-4xl">Que te haces</h2>
      <ul className="mt-6 grid gap-3 lg:grid-cols-2">
        {servicios.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onElegir(s.id)}
              className="flex w-full items-center justify-between gap-4 border border-linea bg-carbon px-4 py-4 text-left transition-colors hover:border-oro"
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-medium text-crema">{s.nombre}</span>
                <span className="mt-1 block font-mono text-xs tracking-etiqueta text-ceniza">
                  {s.duracion_min} MIN
                  {s.descripcion ? ` - ${s.descripcion}` : ""}
                </span>
              </span>
              <span className="shrink-0 font-mono tabular-nums text-oro">
                {pesos(s.precio_cent)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-5 border-t border-linea pt-4 text-sm leading-relaxed text-ceniza">
        Si te sumas algo en el sillon (cejas, tonico o cera) lo agrega el barbero ese dia. No
        hace falta decidirlo ahora.
      </p>
    </section>
  );
}

function PasoHorario({
  fechas,
  fecha,
  horarios,
  cargando,
  onFecha,
  onHora,
}: {
  fechas: string[];
  fecha: string | null;
  horarios: string[] | null;
  cargando: boolean;
  onFecha: (f: string) => void;
  onHora: (h: string) => void;
}) {
  const manana = (horarios ?? []).filter((h) => Number(h.slice(0, 2)) < 12);
  const tarde = (horarios ?? []).filter((h) => Number(h.slice(0, 2)) >= 12);

  return (
    <section className="mt-6">
      <h2 className="font-display text-3xl leading-tight text-crema sm:text-4xl">Cuando venis</h2>

      {/* Dias: carrusel tactil en mobile, grilla en desktop */}
      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        {fechas.map((f) => {
          const p = partesFecha(f);
          const activo = f === fecha;
          return (
            <button
              key={f}
              type="button"
              onClick={() => onFecha(f)}
              aria-pressed={activo}
              className={cn(
                "flex h-[72px] w-16 shrink-0 flex-col items-center justify-center border transition-colors",
                activo ? "border-oro bg-oro/10" : "border-linea hover:border-ceniza",
              )}
            >
              <span className="font-mono text-[10px] tracking-etiqueta text-ceniza">
                {p.diaSemana}
              </span>
              <span
                className={cn(
                  "font-mono text-xl tabular-nums",
                  activo ? "text-oro" : "text-crema",
                )}
              >
                {p.dia}
              </span>
            </button>
          );
        })}
      </div>

      {cargando ? (
        <p className="mt-8 text-sm text-ceniza">Buscando horarios...</p>
      ) : horarios === null ? (
        <button
          type="button"
          onClick={() => (fecha ? onFecha(fecha) : undefined)}
          className="mt-8 w-full border border-linea px-4 py-8 text-sm text-ceniza transition-colors hover:border-oro hover:text-crema"
        >
          Ver los horarios de este dia
        </button>
      ) : horarios.length === 0 ? (
        <p className="mt-8 border border-dashed border-linea px-4 py-8 text-center text-sm text-ceniza">
          No quedan horarios ese dia. Proba con otra fecha.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          <GrillaHorarios titulo="Manana" horarios={manana} onHora={onHora} />
          <GrillaHorarios titulo="Tarde" horarios={tarde} onHora={onHora} />
        </div>
      )}
    </section>
  );
}

function GrillaHorarios({
  titulo,
  horarios,
  onHora,
}: {
  titulo: string;
  horarios: string[];
  onHora: (h: string) => void;
}) {
  if (horarios.length === 0) return null;
  return (
    <div>
      <p className="etiqueta">{titulo}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        {horarios.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => onHora(h)}
            className="h-[52px] border border-linea font-mono tabular-nums text-crema transition-colors hover:border-oro hover:text-oro"
          >
            {h}
          </button>
        ))}
      </div>
    </div>
  );
}

function PasoConfirmacion({
  barberia,
  direccion,
  barbero,
  servicio,
  duracion,
  precioCent,
  fecha,
  hora,
  haySesion,
  slug,
  reservando,
  falla,
  onReservar,
  barberoId,
  servicioId,
}: {
  barberia: string;
  direccion: string | null;
  barbero: string;
  servicio: string;
  duracion: number;
  precioCent: number;
  fecha: string;
  hora: string;
  haySesion: boolean;
  slug: string;
  reservando: boolean;
  falla: string | null;
  onReservar: () => void;
  barberoId: string;
  servicioId: string;
}) {
  const volverA = `/b/${slug}?barbero=${barberoId}&servicio=${servicioId}&fecha=${fecha}&hora=${hora}`;

  return (
    <section className="mt-6">
      <h2 className="font-display text-3xl leading-tight text-crema sm:text-4xl">
        Confirma el turno
      </h2>

      <div className="mt-6 border border-linea bg-carbon">
        <div className="border-b border-linea px-5 py-4">
          <p className="font-display text-2xl text-crema">
            {fechaLarga(fecha)} &middot; {hora}
          </p>
          <p className="mt-1 text-sm text-ceniza">
            {servicio} con {barbero} &middot; {duracion} min
          </p>
        </div>
        <div className="flex items-baseline justify-between px-5 py-4">
          <span className="text-sm text-ceniza">A pagar en el local</span>
          <span className="font-mono text-2xl tabular-nums text-oro">{pesos(precioCent)}</span>
        </div>
        <p className="border-t border-linea px-5 py-3 text-xs leading-relaxed text-ceniza">
          {barberia}
          {direccion ? ` - ${direccion}` : ""}. Si sumas algo en el sillon se agrega al total
          ese dia.
        </p>
      </div>

      {falla ? (
        <p role="alert" className="mt-4 border border-ladrillo px-4 py-3 text-sm text-ladrillo">
          {falla}
        </p>
      ) : null}

      {haySesion ? (
        <div className="mt-6">
          <Button size="lg" className="w-full" onClick={onReservar} disabled={reservando}>
            {reservando ? "Confirmando..." : "Reservar turno"}
          </Button>
          <p className="mt-3 text-center font-mono text-[11px] tracking-etiqueta text-ceniza">
            CANCELAS GRATIS HASTA 2 H ANTES
          </p>
        </div>
      ) : (
        <div className="mt-6 border border-linea bg-carbon p-5">
          <p className="text-sm leading-relaxed text-ceniza">
            Para confirmar entra con tu cuenta de Google. Te mandamos el comprobante por
            correo y desde ahi podes cancelar si no llegas.
          </p>
          <div className="mt-4">
            <BotonGoogle next={volverA} etiqueta="Entrar y reservar" />
          </div>
        </div>
      )}
    </section>
  );
}

function ResumenSeleccion({
  barbero,
  servicio,
  precioCent,
  fecha,
  hora,
  duracion,
}: {
  barbero: string | null;
  servicio: string | null;
  precioCent: number | null;
  fecha: string | null;
  hora: string | null;
  duracion: number | null;
}) {
  const filas = [
    { etiqueta: "Barbero", valor: barbero },
    { etiqueta: "Servicio", valor: servicio },
    { etiqueta: "Duracion", valor: duracion ? `${duracion} min` : null, mono: true },
    { etiqueta: "Dia", valor: fecha ? fechaLarga(fecha) : null },
    { etiqueta: "Hora", valor: hora, mono: true },
  ];

  return (
    <div>
      <p className="etiqueta">Tu turno</p>
      <dl className="mt-4">
        {filas.map((f) => (
          <div
            key={f.etiqueta}
            className="flex items-baseline justify-between gap-3 border-b border-linea py-2.5 last:border-b-0"
          >
            <dt className="text-xs uppercase tracking-etiqueta text-ceniza">{f.etiqueta}</dt>
            <dd
              className={cn(
                "min-w-0 truncate text-right text-sm",
                f.valor ? "text-crema" : "text-ceniza/50",
                f.mono && "font-mono tabular-nums",
              )}
            >
              {f.valor ?? "-"}
            </dd>
          </div>
        ))}
      </dl>
      {precioCent !== null ? (
        <div className="mt-4 flex items-baseline justify-between border-t border-linea pt-4">
          <span className="etiqueta">Total</span>
          <span className="font-mono text-2xl tabular-nums text-oro">{pesos(precioCent)}</span>
        </div>
      ) : null}
    </div>
  );
}

function ComprobanteTurno({ comprobante, slug }: { comprobante: Comprobante; slug: string }) {
  const filas: [string, string][] = [
    ["Codigo de turno", comprobante.codigo],
    ["Servicio", comprobante.servicio],
    ["Barbero", comprobante.barbero],
    ["Cuando", `${fechaLarga(comprobante.fecha)} ${comprobante.hora}`],
    ["A pagar en el local", pesos(comprobante.precioCent)],
  ];

  return (
    <section className="mx-auto max-w-lg">
      <span
        className="flex size-12 items-center justify-center border border-navaja bg-navaja/15 text-navaja"
        aria-hidden="true"
      >
        <Check className="size-6" />
      </span>

      <h2 className="mt-6 font-display text-4xl leading-tight text-crema">Turno reservado</h2>
      <p className="mt-3 text-sm leading-relaxed text-ceniza">
        {comprobante.barbero} te espera el {fechaLarga(comprobante.fecha)} a las{" "}
        {comprobante.hora} en {comprobante.barberia}
        {comprobante.direccion ? `, ${comprobante.direccion}` : ""}. Te mandamos el
        comprobante por correo.
      </p>

      <dl className="mt-6 border border-linea bg-carbon px-5 py-2">
        {filas.map(([etiqueta, valor], i) => (
          <div
            key={etiqueta}
            className="flex items-baseline justify-between gap-4 border-b border-linea py-3 last:border-b-0"
          >
            <dt className="text-xs uppercase tracking-etiqueta text-ceniza">{etiqueta}</dt>
            <dd
              className={cn(
                "text-right font-mono tabular-nums",
                i === 0 ? "text-oro" : "text-crema",
              )}
            >
              {valor}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button asChild size="lg">
          <Link href="/mis-turnos">Ver mis turnos</Link>
        </Button>
        <Button asChild variant="contorno" size="lg">
          <Link href={`/b/${slug}`}>Reservar otro</Link>
        </Button>
      </div>
    </section>
  );
}

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
