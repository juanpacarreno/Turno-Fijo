"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Vacio } from "@/components/vacio";
import { Interruptor } from "@/components/panel/servicios-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { hhmm } from "@/lib/format";
import { DIAS_SEMANA } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export type BarberoFila = {
  id: string;
  nombre: string;
  descripcion: string | null;
  dias_trabajo: number[];
  hora_desde: string;
  hora_hasta: string;
  activo: boolean;
  /** Cuenta vinculada. Null mientras el barbero no entro por primera vez. */
  user_id: string | null;
  /** Correo invitado, pendiente de que esa persona entre con Google. */
  email_invitacion: string | null;
};

type Borrador = {
  id: string | null;
  nombre: string;
  descripcion: string;
  email: string;
  /** Ya tiene cuenta vinculada: la invitacion deja de ser editable. */
  vinculado: boolean;
  dias: number[];
  horaDesde: string;
  horaHasta: string;
  activo: boolean;
};

const BORRADOR_VACIO: Borrador = {
  id: null,
  nombre: "",
  descripcion: "",
  email: "",
  vinculado: false,
  dias: [2, 3, 4, 5, 6],
  horaDesde: "10:00",
  horaHasta: "20:00",
  activo: true,
};

/** Alta y edicion de barberos, con sus dias y su horario de trabajo. */
export function BarberosPanel({ barberos }: { barberos: BarberoFila[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState<Borrador>(BORRADOR_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  function abrirNuevo() {
    setBorrador(BORRADOR_VACIO);
    setFalla(null);
    setAbierto(true);
  }

  function abrirEdicion(b: BarberoFila) {
    setBorrador({
      id: b.id,
      nombre: b.nombre,
      descripcion: b.descripcion ?? "",
      email: b.email_invitacion ?? "",
      vinculado: Boolean(b.user_id),
      dias: b.dias_trabajo,
      horaDesde: hhmm(b.hora_desde),
      horaHasta: hhmm(b.hora_hasta),
      activo: b.activo,
    });
    setFalla(null);
    setAbierto(true);
  }

  function alternarDia(dia: number) {
    setBorrador((b) => ({
      ...b,
      dias: b.dias.includes(dia) ? b.dias.filter((d) => d !== dia) : [...b.dias, dia],
    }));
  }

  async function guardar() {
    if (borrador.dias.length === 0) return setFalla("Elegi al menos un dia de trabajo.");
    if (borrador.horaDesde >= borrador.horaHasta) {
      return setFalla("El horario de cierre tiene que ser posterior al de apertura.");
    }

    setGuardando(true);
    setFalla(null);

    const respuesta = await fetch(
      borrador.id ? `/api/panel/barberos/${borrador.id}` : "/api/panel/barberos",
      {
        method: borrador.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: borrador.nombre,
          descripcion: borrador.descripcion,
          // Si ya tiene cuenta, no se manda el correo: no hay nada que invitar.
          ...(borrador.vinculado ? {} : { email: borrador.email }),
          diasTrabajo: borrador.dias,
          horaDesde: borrador.horaDesde,
          horaHasta: borrador.horaHasta,
          activo: borrador.activo,
        }),
      },
    );

    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => ({}));
      setFalla(datos.error ?? "No pudimos guardar el barbero.");
      setGuardando(false);
      return;
    }

    setGuardando(false);
    setAbierto(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="etiqueta">En el salon</p>
          <h1 className="mt-1 font-display text-3xl leading-none text-crema sm:text-4xl">
            Barberos
          </h1>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus aria-hidden="true" />
          Nuevo barbero
        </Button>
      </div>

      {barberos.length === 0 ? (
        <Vacio
          className="mt-6"
          titulo="Todavia no hay barberos"
          detalle="Sin barberos cargados la pagina de reservas no muestra horarios."
        >
          <Button onClick={abrirNuevo}>Cargar el primero</Button>
        </Vacio>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {barberos.map((b) => (
            <li
              key={b.id}
              className={cn("border border-linea bg-carbon p-4", !b.activo && "opacity-50")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-xl text-crema">{b.nombre}</p>
                  {b.descripcion ? (
                    <p className="mt-1 text-sm text-ceniza">{b.descripcion}</p>
                  ) : null}
                </div>
                <Badge variant={b.activo ? "activo" : "neutro"}>
                  {b.activo ? "Activo" : "Baja"}
                </Badge>
              </div>

              <p className="mt-4 font-mono text-sm tabular-nums text-crema">
                {hhmm(b.hora_desde)} a {hhmm(b.hora_hasta)}
              </p>

              <div className="mt-3 flex flex-wrap gap-1">
                {DIAS_SEMANA.map((d) => (
                  <span
                    key={d.valor}
                    className={cn(
                      "border px-1.5 py-0.5 font-mono text-[10px] tracking-etiqueta",
                      b.dias_trabajo.includes(d.valor)
                        ? "border-linea text-crema"
                        : "border-transparent text-ceniza/40",
                    )}
                  >
                    {d.corto}
                  </span>
                ))}
              </div>

              <p className="mt-4 border-t border-linea pt-3 text-xs text-ceniza">
                {b.user_id ? (
                  <span className="text-navaja">Cuenta vinculada</span>
                ) : b.email_invitacion ? (
                  <>
                    Invitado: <span className="font-mono">{b.email_invitacion}</span>
                    <span className="mt-0.5 block">Falta que entre con Google.</span>
                  </>
                ) : (
                  "Sin cuenta. No puede entrar a la app."
                )}
              </p>

              <Button
                variant="contorno"
                size="sm"
                className="mt-3 w-full"
                onClick={() => abrirEdicion(b)}
              >
                <Pencil aria-hidden="true" />
                Editar
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{borrador.id ? "Editar barbero" : "Nuevo barbero"}</DialogTitle>
            <DialogDescription>
              Los dias y el horario definen que turnos se ofrecen online.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="nombre-barbero">Nombre</Label>
              <Input
                id="nombre-barbero"
                value={borrador.nombre}
                maxLength={60}
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                placeholder="Nico"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="detalle-barbero">Especialidad (opcional)</Label>
              <Input
                id="detalle-barbero"
                value={borrador.descripcion}
                maxLength={120}
                onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
                placeholder="Clasicos y barba a navaja"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-barbero">Correo para que entre a la app (opcional)</Label>
              {borrador.vinculado ? (
                <p className="flex h-11 items-center border border-linea bg-grafito px-3 text-sm text-navaja">
                  Ya tiene su cuenta vinculada
                </p>
              ) : (
                <>
                  <Input
                    id="email-barbero"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    value={borrador.email}
                    maxLength={254}
                    onChange={(e) => setBorrador({ ...borrador, email: e.target.value })}
                    placeholder="barbero@gmail.com"
                    className="font-mono text-xs"
                  />
                  <p className="text-xs leading-relaxed text-ceniza">
                    Tiene que ser la cuenta de Google con la que va a entrar. Va a ver solo
                    sus turnos y va a poder cobrarlos: no accede a la caja, a los precios ni
                    al resto de los barberos.
                  </p>
                </>
              )}
            </div>

            <fieldset>
              <legend className="etiqueta">Dias que trabaja</legend>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {DIAS_SEMANA.map((d) => {
                  const activo = borrador.dias.includes(d.valor);
                  return (
                    <button
                      key={d.valor}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => alternarDia(d.valor)}
                      className={cn(
                        "h-11 border font-mono text-[10px] tracking-etiqueta transition-colors",
                        activo
                          ? "border-oro bg-oro/15 text-oro"
                          : "border-linea text-ceniza hover:text-crema",
                      )}
                    >
                      {d.corto}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="desde">Abre</Label>
                <Input
                  id="desde"
                  type="time"
                  step={900}
                  value={borrador.horaDesde}
                  onChange={(e) => setBorrador({ ...borrador, horaDesde: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hasta">Cierra</Label>
                <Input
                  id="hasta"
                  type="time"
                  step={900}
                  value={borrador.horaHasta}
                  onChange={(e) => setBorrador({ ...borrador, horaHasta: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>

            <Interruptor
              etiqueta="Activo"
              activo={borrador.activo}
              onChange={(v) => setBorrador({ ...borrador, activo: v })}
            />

            {falla ? (
              <p role="alert" className="text-sm text-ladrillo">
                {falla}
              </p>
            ) : null}
          </div>

          <div className="flex gap-3 border-t border-linea px-5 py-4">
            <Button variant="contorno" className="flex-1" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
