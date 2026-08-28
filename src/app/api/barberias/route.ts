import { obtenerUsuario, obtenerMembresia } from "@/lib/sesion";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { esquemaAltaBarberia } from "@/lib/validacion";
import { LIMITES } from "@/lib/rate-limit";
import { aplicarLimite, error, leerBody, NO_AUTORIZADO, ok, ERROR_INTERNO, registrarFalla } from "@/lib/api";

/**
 * Alta de barberia.
 *
 * Es la unica operacion que usa service role: crear el tenant y la membresia
 * del dueno tiene que pasar si o si en un solo paso, y RLS todavia no puede
 * autorizar una fila que no existe. La sesion se verifica ANTES.
 */
export async function POST(request: Request) {
  const { usuario } = await obtenerUsuario();
  if (!usuario) return NO_AUTORIZADO();

  const cortado = aplicarLimite(request, "alta-barberia", LIMITES.altaBarberia, usuario.id);
  if (cortado) return cortado;

  const { datos, respuesta } = await leerBody(request, esquemaAltaBarberia);
  if (respuesta) return respuesta;

  const { supabase } = await obtenerUsuario();

  // Un usuario pertenece a una sola barberia, sea como dueno o como barbero.
  const yaTiene = await obtenerMembresia(supabase, usuario.id);
  if (yaTiene) return error("Ya estas asociado a una barberia.", 409);

  const admin = crearClienteAdmin();

  const { data: ocupado } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", datos.slug)
    .maybeSingle();
  if (ocupado) return error("Esa direccion web ya esta tomada. Proba con otra.", 409);

  const { data: tenant, error: fallaTenant } = await admin
    .from("tenants")
    .insert({
      slug: datos.slug,
      nombre: datos.nombre,
      direccion: datos.direccion ?? null,
      telefono: datos.telefono || null,
    })
    .select("id, slug")
    .single();

  if (fallaTenant || !tenant) {
    registrarFalla("POST /api/barberias", fallaTenant);
    return ERROR_INTERNO();
  }

  const { error: fallaMiembro } = await admin
    .from("tenant_members")
    .insert({ tenant_id: tenant.id, user_id: usuario.id, rol: "dueno" });

  if (fallaMiembro) {
    // Sin membresia el tenant queda huerfano: se revierte.
    await admin.from("tenants").delete().eq("id", tenant.id);
    registrarFalla("POST /api/barberias", fallaMiembro);
    return ERROR_INTERNO();
  }

  // Se devuelve el slug publico, no el uuid del tenant.
  return ok({ slug: tenant.slug }, 201);
}
