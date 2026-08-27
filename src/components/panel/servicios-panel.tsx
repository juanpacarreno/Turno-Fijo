"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, InputNumerico } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Vacio } from "@/components/vacio";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pesos, aCentavos } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ServicioFila = {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracion_min: number;
  precio_cent: number;
  reservable: boolean;
  activo: boolean;
};

type Borrador = {
  id: string | null;
  nombre: string;
  descripcion: string;
  duracion: string;
  precio: string;
  reservable: boolean;
  activo: boolean;
};

const BORRADOR_VACIO: Borrador = {
  id: null,
  nombre: "",
  descripcion: "",
  duracion: "30",
  precio: "",
  reservable: true,
  activo: true,
};

/**
 * Catalogo de servicios: precio, duracion y si se puede reservar online.
 * Los que no son reservables solo se cargan como adicional en el sillon.
 */
export function ServiciosPanel({ servicios }: { servicios: ServicioFila[] }) {
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

  function abrirEdicion(s: ServicioFila) {
    setBorrador({
      id: s.id,
      nombre: s.nombre,
      descripcion: s.descripcion ?? "",
      duracion: String(s.duracion_min),
      precio: String(Math.round(s.precio_cent / 100)),
      reservable: s.reservable,
      activo: s.activo,
    });
    setFalla(null);
    setAbierto(true);
  }

  async function guardar() {
    const precioCent = aCentavos(borrador.precio);
    const duracion = Number(borrador.duracion);

    if (precioCent === null) return setFalla("Revisa el precio.");
    if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) {
      return setFalla("La duracion va de 5 a 480 minutos.");
    }

    setGuardando(true);
    setFalla(null);

    const cuerpo = {
      nombre: borrador.nombre,
      descripcion: borrador.descripcion,
      duracionMin: duracion,
      precioCent,
      reservable: borrador.reservable,
      activo: borrador.activo,
    };

    const respuesta = await fetch(
      borrador.id ? `/api/panel/servicios/${borrador.id}` : "/api/panel/servicios",
      {
        method: borrador.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      },
    );

    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => ({}));
      setFalla(datos.error ?? "No pudimos guardar el servicio.");
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
          <p className="etiqueta">Lista de precios</p>
          <h1 className="mt-1 font-display text-3xl leading-none text-crema sm:text-4xl">
            Servicios y precios
          </h1>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus aria-hidden="true" />
          Nuevo servicio
        </Button>
      </div>

      {servicios.length === 0 ? (
        <Vacio
          className="mt-6"
          titulo="Todavia no hay servicios"
          detalle="Carga al menos uno reservable para que la gente pueda pedir turno."
        >
          <Button onClick={abrirNuevo}>Cargar el primero</Button>
        </Vacio>
      ) : (
        <>
          {/* DESKTOP */}
          <div className="mt-6 hidden border border-linea lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Servicio</TableHead>
                  <TableHead className="w-32">Duracion</TableHead>
                  <TableHead className="w-40 text-right">Precio</TableHead>
                  <TableHead className="w-40">Reserva online</TableHead>
                  <TableHead className="w-28">Estado</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicios.map((s) => (
                  <TableRow key={s.id} className={cn(!s.activo && "opacity-50")}>
                    <TableCell>
                      <p className="font-medium text-crema">{s.nombre}</p>
                      {s.descripcion ? (
                        <p className="mt-0.5 text-xs text-ceniza">{s.descripcion}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-ceniza">
                      {s.duracion_min} min
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-crema">
                      {pesos(s.precio_cent)}
                    </TableCell>
                    <TableCell className="text-sm text-ceniza">
                      {s.reservable ? "Si" : "Solo en el sillon"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.activo ? "activo" : "neutro"}>
                        {s.activo ? "Activo" : "Baja"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="fantasma" size="sm" onClick={() => abrirEdicion(s)}>
                        <Pencil aria-hidden="true" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* MOBILE */}
          <ul className="mt-6 border border-linea lg:hidden">
            {servicios.map((s) => (
              <li key={s.id} className="fila-lista">
                <button
                  type="button"
                  onClick={() => abrirEdicion(s)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-4 text-left",
                    !s.activo && "opacity-50",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-crema">{s.nombre}</span>
                    <span className="mt-1 block font-mono text-xs text-ceniza">
                      {s.duracion_min} min
                      {s.reservable ? "" : " - solo en el sillon"}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-crema">
                    {pesos(s.precio_cent)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{borrador.id ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
            <DialogDescription>
              El precio se usa tanto en la reserva online como en los adicionales del sillon.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={borrador.nombre}
                maxLength={60}
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                placeholder="Corte clasico"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descripcion">Detalle (opcional)</Label>
              <Input
                id="descripcion"
                value={borrador.descripcion}
                maxLength={140}
                onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
                placeholder="Tijera y maquina, lavado incluido"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="duracion">Duracion (min)</Label>
                <InputNumerico
                  id="duracion"
                  value={borrador.duracion}
                  onChange={(e) => setBorrador({ ...borrador, duracion: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="precio">Precio (pesos)</Label>
                <InputNumerico
                  id="precio"
                  value={borrador.precio}
                  onChange={(e) => setBorrador({ ...borrador, precio: e.target.value })}
                  placeholder="12500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Interruptor
                etiqueta="Reserva online"
                activo={borrador.reservable}
                onChange={(v) => setBorrador({ ...borrador, reservable: v })}
              />
              <Interruptor
                etiqueta="Activo"
                activo={borrador.activo}
                onChange={(v) => setBorrador({ ...borrador, activo: v })}
              />
            </div>

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

export function Interruptor({
  etiqueta,
  activo,
  onChange,
}: {
  etiqueta: string;
  activo: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onChange(!activo)}
      className="flex h-11 items-center justify-between border border-linea px-3 text-left"
    >
      <span className="text-[11px] uppercase tracking-etiqueta text-ceniza">{etiqueta}</span>
      <span
        className={cn(
          "ml-3 flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition-colors",
          activo ? "border-navaja bg-navaja/40" : "border-linea bg-grafito",
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "size-4 rounded-full transition-transform",
            activo ? "translate-x-4 bg-navaja" : "translate-x-0 bg-ceniza",
          )}
        />
      </span>
    </button>
  );
}
