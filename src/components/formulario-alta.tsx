"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugificar } from "@/lib/validacion";

/**
 * Alta de la barberia. La direccion web se propone a partir del nombre y se
 * puede corregir; el servidor la vuelve a validar y a sanear.
 */
export function FormularioAlta({ sitio }: { sitio: string }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  function cambiarNombre(valor: string) {
    setNombre(valor);
    if (!slugTocado) setSlug(slugificar(valor));
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setFalla(null);

    const respuesta = await fetch("/api/barberias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, slug, direccion, telefono }),
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      setFalla(datos.error ?? "No pudimos crear la barberia.");
      setGuardando(false);
      return;
    }

    router.replace("/panel/barberos");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="mt-8 space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre de la barberia</Label>
        <Input
          id="nombre"
          required
          maxLength={80}
          value={nombre}
          onChange={(e) => cambiarNombre(e.target.value)}
          placeholder="Barberia El Sillon"
          autoComplete="organization"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="slug">Direccion de tu pagina de reservas</Label>
        <div className="flex items-center border border-linea bg-grafito">
          <span className="shrink-0 border-r border-linea px-3 py-2 font-mono text-xs text-ceniza">
            {sitio}/b/
          </span>
          <input
            id="slug"
            required
            maxLength={48}
            value={slug}
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(slugificar(e.target.value));
            }}
            placeholder="barberia-el-sillon"
            className="h-11 w-full bg-transparent px-3 font-mono text-sm text-crema outline-none placeholder:text-ceniza/70"
          />
        </div>
        <p className="text-xs text-ceniza">Solo minusculas, numeros y guiones.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="direccion">Direccion del local (opcional)</Label>
        <Input
          id="direccion"
          maxLength={160}
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Thames 1180, Villa Crespo"
          autoComplete="street-address"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="telefono">Telefono del local (opcional)</Label>
        <Input
          id="telefono"
          maxLength={40}
          inputMode="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="11 5487 2210"
          className="font-mono"
        />
      </div>

      {falla ? (
        <p role="alert" className="border border-ladrillo px-4 py-3 text-sm text-ladrillo">
          {falla}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={guardando}>
        {guardando ? "Creando..." : "Crear mi barberia"}
      </Button>
    </form>
  );
}
