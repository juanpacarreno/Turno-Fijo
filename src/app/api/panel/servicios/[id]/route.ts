import { contextoPanel } from "@/lib/panel-api";
import { esquemaServicioUpdate, uuid } from "@/lib/validacion";
import { LIMITES } from "@/lib/rate-limit";
import { aplicarLimite, error, leerBody, ok, NO_ENCONTRADO, ERROR_INTERNO, registrarFalla } from "@/lib/api";

/**
 * Edicion de un servicio. El `.eq("tenant_id")` es redundante con RLS a
 * proposito: si manana alguien afloja una politica, el filtro sigue puesto.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoPanel();
  if (ctx.respuesta) return ctx.respuesta;

  const cortado = aplicarLimite(request, "panel-servicios", LIMITES.panel, ctx.usuario.id);
  if (cortado) return cortado;

  const { id } = await params;
  if (!uuid.safeParse(id).success) return NO_ENCONTRADO();

  const { datos, respuesta } = await leerBody(request, esquemaServicioUpdate);
  if (respuesta) return respuesta;

  const cambios: Record<string, unknown> = {};
  if (datos.nombre !== undefined) cambios.nombre = datos.nombre;
  if (datos.descripcion !== undefined) cambios.descripcion = datos.descripcion ?? null;
  if (datos.duracionMin !== undefined) cambios.duracion_min = datos.duracionMin;
  if (datos.precioCent !== undefined) cambios.precio_cent = datos.precioCent;
  if (datos.reservable !== undefined) cambios.reservable = datos.reservable;
  if (datos.activo !== undefined) cambios.activo = datos.activo;

  if (Object.keys(cambios).length === 0) return error("No hay cambios para guardar.", 422);

  const { data, error: falla } = await ctx.supabase
    .from("services")
    .update(cambios)
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id)
    .select("id, nombre, descripcion, duracion_min, precio_cent, reservable, activo")
    .maybeSingle();

  if (falla) {
    registrarFalla("PATCH /api/panel/servicios/[id]", falla);
    return ERROR_INTERNO();
  }
  if (!data) return NO_ENCONTRADO();

  return ok(data);
}

/** Baja logica: el historial de caja necesita el servicio, no se borra. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoPanel();
  if (ctx.respuesta) return ctx.respuesta;

  const cortado = aplicarLimite(request, "panel-servicios", LIMITES.panel, ctx.usuario.id);
  if (cortado) return cortado;

  const { id } = await params;
  if (!uuid.safeParse(id).success) return NO_ENCONTRADO();

  const { data, error: falla } = await ctx.supabase
    .from("services")
    .update({ activo: false })
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id)
    .select("id")
    .maybeSingle();

  if (falla) {
    registrarFalla("DELETE /api/panel/servicios/[id]", falla);
    return ERROR_INTERNO();
  }
  if (!data) return NO_ENCONTRADO();

  return ok({ id: data.id, activo: false });
}
