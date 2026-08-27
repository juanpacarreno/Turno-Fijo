"use client";

import { useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Button } from "@/components/ui/button";
import { rutaInternaSegura } from "@/lib/validacion";

/**
 * Unico metodo de identificacion de la app: Google via Supabase Auth.
 * No hay formulario de contrasena ni alta manual de datos personales.
 */
export function BotonGoogle({
  next = "/",
  etiqueta = "Continuar con Google",
}: {
  next?: string;
  etiqueta?: string;
}) {
  const [cargando, setCargando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  async function ingresar() {
    setCargando(true);
    setFalla(null);
    try {
      const supabase = crearClienteNavegador();
      const destino = rutaInternaSegura(next, "/");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch {
      setFalla("No pudimos abrir el ingreso con Google. Proba de nuevo.");
      setCargando(false);
    }
  }

  return (
    <div className="w-full">
      <Button
        type="button"
        variant="claro"
        size="lg"
        className="w-full"
        onClick={ingresar}
        disabled={cargando}
      >
        <GoogleIcono />
        {cargando ? "Abriendo Google..." : etiqueta}
      </Button>
      {falla ? (
        <p role="alert" className="mt-3 text-center text-sm text-ladrillo">
          {falla}
        </p>
      ) : null}
    </div>
  );
}

function GoogleIcono() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}
