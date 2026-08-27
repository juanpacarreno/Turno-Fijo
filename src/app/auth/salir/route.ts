import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/** Cierre de sesion. Solo POST: un GET no puede desloguear a nadie (CSRF). */
export async function POST() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
