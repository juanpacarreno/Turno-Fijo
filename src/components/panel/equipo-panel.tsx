"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaCorta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RolMiembro } from "@/lib/tipos";

export type Miembro = {
  user_id: string;
  email: string | null;
  rol: RolMiembro;
  creado_en: string;
};

export type Invitacion = {
  id: string;
  email: string;
  rol: RolMiembro;
  barber_id: string | null;
};

export type FichaLibre = { id: string; nombre: string };

const ETIQUETA_ROL: Record<RolMiembro, string> = {
  dueno: "Socio",
  barbero: "Barbero",
};

/**
 * Equipo de la barberia: quien tiene acceso, con que rol, y las invitaciones
 * pendientes. Solo la ve el dueno.
 */
export function EquipoPanel({
  miembros,
  invitaciones,
  fichasLibres,
  usuarioActual,
}: {
  miembros: Miembro[];
  invitaciones: Invitacion[];
  fichasLibres: FichaLibre[];
  usuarioActual: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<RolMiembro>("dueno");
  const [fichaId, setFichaId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  async function invitar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setFalla(null);

    const respuesta = await fetch("/api/panel/invitaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        rol,
        barberoId: rol === "barbero" ? fichaId || null : fichaId || null,
      }),
    });

    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => ({}));
      setFalla(datos.error ?? "No pudimos crear la invitacion.");
      setEnviando(false);
      return;
    }

    setEmail("");
    setFichaId("");
    setEnviando(false);
    router.refresh();
  }

  async function cancelar(id: string) {
    setFalla(null);
    const respuesta = await fetch(`/api/panel/invitaciones/${id}`, { method: "DELETE" });
    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => ({}));
      setFalla(datos.error ?? "No pudimos cancelar la invitacion.");
      return;
    }
    router.refresh();
  }

  async function quitar(userId: string) {
    setFalla(null);
    const respuesta = await fetch(`/api/panel/equipo/${userId}`, { method: "DELETE" });
    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => ({}));
      setFalla(datos.error ?? "No pudimos quitar a esa persona.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div>
        <p className="etiqueta">Quien entra a la app</p>
        <h1 className="mt-1 font-display text-3xl leading-none text-crema sm:text-4xl">Equipo</h1>
      </div>

      {falla ? (
        <p role="alert" className="mt-4 border border-ladrillo px-4 py-3 text-sm text-ladrillo">
          {falla}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {/* Miembros con acceso */}
          <Card>
            <CardHeader>
              <CardTitle>Con acceso</CardTitle>
              <p className="text-sm text-ceniza">
                Los socios ven todo. Los barberos, solo su agenda y el cobro de sus turnos.
              </p>
            </CardHeader>
            <CardContent className="px-0 py-0">
              <ul>
                {miembros.map((m) => {
                  const soyYo = m.user_id === usuarioActual;
                  return (
                    <li
                      key={m.user_id}
                      className="fila-lista flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm text-crema">
                          {m.email ?? "Sin correo registrado"}
                        </span>
                        <span className="mt-1 block text-xs text-ceniza">
                          Desde el {fechaCorta(String(m.creado_en).slice(0, 10))}
                        </span>
                      </span>

                      <Badge variant={m.rol === "dueno" ? "activo" : "neutro"}>
                        {ETIQUETA_ROL[m.rol]}
                      </Badge>

                      {soyYo ? (
                        <span className="font-mono text-[10px] uppercase tracking-etiqueta text-ceniza">
                          Vos
                        </span>
                      ) : (
                        <Button variant="peligro" size="sm" onClick={() => quitar(m.user_id)}>
                          Quitar
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Invitaciones pendientes */}
          {invitaciones.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Invitaciones pendientes</CardTitle>
                <p className="text-sm text-ceniza">
                  Se activan solas cuando esa persona entra con Google.
                </p>
              </CardHeader>
              <CardContent className="px-0 py-0">
                <ul>
                  {invitaciones.map((i) => (
                    <li
                      key={i.id}
                      className="fila-lista flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6"
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-sm text-crema">
                        {i.email}
                      </span>
                      <Badge variant="neutro">{ETIQUETA_ROL[i.rol]}</Badge>
                      <Button variant="fantasma" size="sm" onClick={() => cancelar(i.id)}>
                        Cancelar
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Alta */}
        <Card className="lg:sticky lg:top-6 lg:self-start">
          <CardHeader>
            <CardTitle>Invitar</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={invitar} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email-invitado">Correo de Google</Label>
                <Input
                  id="email-invitado"
                  type="email"
                  inputMode="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="socio@gmail.com"
                  className="font-mono text-xs"
                />
              </div>

              <fieldset>
                <legend className="etiqueta">Rol</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["dueno", "barbero"] as RolMiembro[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={rol === r}
                      onClick={() => setRol(r)}
                      className={cn(
                        "h-11 border text-[11px] uppercase tracking-etiqueta transition-colors",
                        rol === r
                          ? "border-oro bg-oro/15 text-oro"
                          : "border-linea text-ceniza hover:text-crema",
                      )}
                    >
                      {ETIQUETA_ROL[r]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ceniza">
                  {rol === "dueno"
                    ? "Un socio tiene el mismo acceso que vos: caja, precios, barberos y equipo."
                    : "Un barbero ve solo los turnos de su ficha y puede cobrarlos."}
                </p>
              </fieldset>

              <div className="space-y-1.5">
                <Label htmlFor="ficha-invitado">
                  Ficha de barbero {rol === "dueno" ? "(opcional)" : ""}
                </Label>
                <select
                  id="ficha-invitado"
                  value={fichaId}
                  onChange={(e) => setFichaId(e.target.value)}
                  required={rol === "barbero"}
                  className="h-11 w-full appearance-none rounded-sm border border-linea bg-grafito px-3 text-sm text-crema focus-visible:border-oro focus-visible:outline-none"
                >
                  <option value="">
                    {rol === "dueno" ? "Sin ficha (solo administra)" : "Elegi una ficha"}
                  </option>
                  {fichasLibres.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-relaxed text-ceniza">
                  {fichasLibres.length === 0
                    ? "No hay fichas libres. Crea una en Barberos para vincularla."
                    : "La ficha define que turnos va a ver en su agenda."}
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={enviando}>
                <UserPlus aria-hidden="true" />
                {enviando ? "Invitando..." : "Invitar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
