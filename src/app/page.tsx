import Link from "next/link";
import { redirect } from "next/navigation";
import { Marca } from "@/components/marca";
import { Button } from "@/components/ui/button";
import { obtenerUsuario, obtenerMembresia } from "@/lib/sesion";

export const dynamic = "force-dynamic";

const CAPACIDADES = [
  {
    titulo: "Agenda del dia",
    detalle:
      "Los turnos del salon ordenados por hora, con el estado de cada uno y el cobro del dia a la vista.",
  },
  {
    titulo: "Cobro con adicionales",
    detalle:
      "Lo que se suma en el sillon se carga desde la lista de precios y entra al total del turno.",
  },
  {
    titulo: "Caja del mes",
    detalle:
      "Ingresos por efectivo, transferencia y tarjeta sobre lo realmente cobrado, con ausencias incluidas.",
  },
];

export default async function PaginaInicio({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  // Red de contencion: si Supabase no reconoce la URL de retorno, redirige al
  // Site URL con el codigo pegado. Antes eso dejaba al visitante en la portada
  // y sin sesion; ahora se completa el ingreso.
  const params = await searchParams;
  if (params.code && /^[A-Za-z0-9._~-]{8,512}$/.test(params.code)) {
    redirect(`/auth/callback?code=${encodeURIComponent(params.code)}`);
  }

  const { supabase, usuario } = await obtenerUsuario();
  const membresia = usuario ? await obtenerMembresia(supabase, usuario.id) : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 lg:py-16">
      <header className="flex items-center justify-between">
        <Marca />
        <nav className="flex items-center gap-2">
          {usuario ? (
            <Button asChild variant="contorno" size="sm">
              <Link href={membresia ? "/panel" : "/registrar"}>
                {membresia ? "Ir al panel" : "Registrar barberia"}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="contorno" size="sm">
              <Link href="/ingresar">Ingresar</Link>
            </Button>
          )}
        </nav>
      </header>

      <section className="mt-16 max-w-2xl lg:mt-24">
        <p className="etiqueta">Agenda y caja para barberias de barrio</p>
        <h1 className="mt-4 font-display text-5xl leading-[1.05] text-crema sm:text-6xl">
          El turno anotado donde tiene que estar
        </h1>
        <p className="mt-5 text-base leading-relaxed text-ceniza">
          Tu cliente elige barbero, servicio y horario desde el celular, entra con su cuenta
          de Google y recibe la confirmacion por correo. Vos cerras el turno en el sillon,
          cargas lo que se sumo y la caja del mes se arma sola.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={usuario ? (membresia ? "/panel" : "/registrar") : "/ingresar?next=/registrar"}>
              {membresia ? "Ir a mi panel" : "Registrar mi barberia"}
            </Link>
          </Button>
          {usuario ? (
            <Button asChild variant="contorno" size="lg">
              <Link href="/mis-turnos">Mis turnos</Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="mt-16 grid gap-px border border-linea bg-linea sm:grid-cols-3 lg:mt-24">
        {CAPACIDADES.map((c) => (
          <article key={c.titulo} className="bg-sillon p-6">
            <h2 className="font-display text-xl text-crema">{c.titulo}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ceniza">{c.detalle}</p>
          </article>
        ))}
      </section>

      <footer className="mt-16 border-t border-linea pt-6 text-xs text-ceniza">
        Turno Fijo &middot; pesos argentinos &middot; horarios del salon
      </footer>
    </main>
  );
}
