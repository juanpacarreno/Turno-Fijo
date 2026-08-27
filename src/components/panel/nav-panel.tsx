"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Scissors, Wallet, Users, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const SECCIONES = [
  { href: "/panel", etiqueta: "Agenda", Icono: CalendarDays },
  { href: "/panel/servicios", etiqueta: "Servicios", Icono: Scissors },
  { href: "/panel/caja", etiqueta: "Caja", Icono: Wallet },
  { href: "/panel/clientes", etiqueta: "Clientes", Icono: Users },
  { href: "/panel/barberos", etiqueta: "Barberos", Icono: UserRound },
];

function esActiva(ruta: string, href: string) {
  return href === "/panel" ? ruta === "/panel" : ruta.startsWith(href);
}

/** Columna de navegacion del panel en desktop. */
export function NavLateral() {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones del panel" className="flex flex-col">
      {SECCIONES.map(({ href, etiqueta, Icono }) => {
        const activa = esActiva(ruta, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "flex items-center justify-between border-l-2 px-4 py-3 text-sm transition-colors",
              activa
                ? "border-l-oro bg-grafito text-crema"
                : "border-l-transparent text-ceniza hover:bg-grafito/50 hover:text-crema",
            )}
          >
            <span className="flex items-center gap-3">
              <Icono className="size-4" aria-hidden="true" />
              {etiqueta}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Barra inferior en mobile: cinco destinos, area tactil de 56px, sin scroll
 * horizontal ni menus escondidos.
 */
export function NavInferior() {
  const ruta = usePathname();
  return (
    <nav
      aria-label="Secciones del panel"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-linea bg-carbon lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {SECCIONES.map(({ href, etiqueta, Icono }) => {
        const activa = esActiva(ruta, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-1 border-t-2 text-[10px] uppercase tracking-etiqueta transition-colors",
              activa ? "border-t-oro text-crema" : "border-t-transparent text-ceniza",
            )}
          >
            <Icono className="size-5" aria-hidden="true" />
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
