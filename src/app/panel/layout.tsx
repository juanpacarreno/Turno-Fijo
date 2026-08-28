import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Marca } from "@/components/marca";
import { CerrarSesion } from "@/components/cerrar-sesion";
import { NavLateral, NavInferior } from "@/components/panel/nav-panel";
import { requerirPanel } from "@/lib/sesion";

/**
 * Estructura del panel.
 * Desktop: columna fija de 232px + area de trabajo a ancho completo.
 * Mobile: encabezado compacto y barra inferior de navegacion.
 */
export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const { tenant, usuario, rol } = await requerirPanel("/panel");
  const esDuenio = rol === "dueno";

  return (
    <div className="min-h-dvh lg:flex">
      {/* Columna lateral: solo desktop */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-linea bg-carbon lg:flex">
        <div className="border-b border-linea px-4 py-5">
          <Marca compacto />
        </div>
        <div className="px-4 py-4">
          <p className="etiqueta">{esDuenio ? "Barberia" : "Trabajas en"}</p>
          <p className="mt-1 truncate text-sm text-crema" title={tenant.nombre}>
            {tenant.nombre}
          </p>
        </div>
        <div className="border-y border-linea py-2">
          <NavLateral esDuenio={esDuenio} />
        </div>
        <div className="mt-auto border-t border-linea p-4">
          {esDuenio ? (
            <Link
              href={`/b/${tenant.slug}`}
              className="mb-3 flex items-center gap-2 text-xs text-ceniza transition-colors hover:text-oro"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Ver pagina de reservas
            </Link>
          ) : null}
          <p className="truncate font-mono text-[11px] text-ceniza" title={usuario.email ?? ""}>
            {usuario.email}
          </p>
          <CerrarSesion className="mt-2 -ml-3" />
        </div>
      </aside>

      {/* Encabezado: solo mobile */}
      <header className="flex items-center justify-between border-b border-linea bg-carbon px-4 py-3 lg:hidden">
        <div>
          <p className="font-display text-lg leading-none text-crema">Turno Fijo</p>
          <p className="mt-1 truncate text-xs text-ceniza">{tenant.nombre}</p>
        </div>
        <CerrarSesion />
      </header>

      <main className="min-w-0 flex-1 pb-16 lg:pb-0">{children}</main>

      <NavInferior esDuenio={esDuenio} />
    </div>
  );
}
