import { redirect } from "next/navigation";
import { Marca } from "@/components/marca";
import { CerrarSesion } from "@/components/cerrar-sesion";
import { FormularioAlta } from "@/components/formulario-alta";
import { requerirUsuarioEnPagina, obtenerTenantDelUsuario } from "@/lib/sesion";
import { env } from "@/lib/env";

export const metadata = { title: "Registrar barberia - Turno Fijo" };
export const dynamic = "force-dynamic";

export default async function PaginaRegistrar() {
  const { supabase, usuario } = await requerirUsuarioEnPagina("/registrar");

  // Un usuario administra una sola barberia.
  const tenant = await obtenerTenantDelUsuario(supabase, usuario.id);
  if (tenant) redirect("/panel");

  const sitio = env.siteUrl().replace(/^https?:\/\//, "");

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <div className="flex items-start justify-between">
        <Marca />
        <CerrarSesion />
      </div>

      <p className="mt-10 etiqueta">Paso 1 de 2</p>
      <h1 className="mt-2 font-display text-4xl leading-tight text-crema">
        Registra tu barberia
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ceniza">
        Despues vas a cargar los barberos y la lista de precios. La agenda queda lista
        para recibir turnos apenas tengas un barbero y un servicio.
      </p>

      <FormularioAlta sitio={sitio} />
    </main>
  );
}
