"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Cancelacion del turno por parte del cliente, identificado por su codigo. */
export function BotonCancelar({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  async function cancelar() {
    setEnviando(true);
    setFalla(null);

    const respuesta = await fetch(`/api/reservas/${codigo}/cancelar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => ({}));
      setFalla(datos.error ?? "No pudimos cancelar el turno.");
      setEnviando(false);
      setConfirmando(false);
      return;
    }

    setEnviando(false);
    router.refresh();
  }

  if (!confirmando) {
    return (
      <div>
        <Button variant="peligro" size="sm" onClick={() => setConfirmando(true)}>
          Cancelar turno
        </Button>
        {falla ? (
          <p role="alert" className="mt-2 text-xs text-ladrillo">
            {falla}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-ceniza">Seguro?</span>
      <Button variant="peligro" size="sm" onClick={cancelar} disabled={enviando}>
        {enviando ? "Cancelando..." : "Si, cancelar"}
      </Button>
      <Button variant="fantasma" size="sm" onClick={() => setConfirmando(false)}>
        No
      </Button>
    </div>
  );
}
