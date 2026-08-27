"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de navegador. Usa exclusivamente la anon key, que es publica por
 * diseno: toda la autorizacion la resuelve RLS del lado de Postgres.
 */
export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
