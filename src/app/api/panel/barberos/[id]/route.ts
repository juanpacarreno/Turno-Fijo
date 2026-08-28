import { contextoPanel } from "@/lib/panel-api";
import { esquemaBarberoUpdate, uuid } from "@/lib/validacion";
import { LIMITES } from "@/lib/rate-limit";
import { aplicarLimite, error, leerBody, ok, NO_ENCONTRADO, ERROR_INTERNO, registrarFalla } from "@/lib/api";
import { horaAMinutos } from "@/lib/format";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoPanel(true);
  if (ctx.respuesta) return ctx.respuesta;

  const cortado = aplicarLimite(request, "panel-barberos", LIMITES.panel, ctx.usuario.id);
  if (cortado) return cortado;

  const { id } = await params;
  if (!uuid.safeParse(id).success) return NO_ENCONTRADO();

  const { datos, respuesta } = await leerBody(request, esquemaBarberoUpdate);
  if (respuesta) return respuesta;

  if (
    datos.horaDesde &&
    datos.horaHasta &&
    horaAMinutos(datos.horaDesde) >= horaAMinutos(datos.horaHasta)
  ) {
    return error("El horario de cierre tiene que ser posterior al de apertura.", 422);
  }

  const cambios: Record<string, unknown> = {};
  if (datos.nombre !== undefined) cambios.nombre = datos.nombre;
  if (datos.descripcion !== undefined) cambios.descripcion = datos.descripcion ?? null;
  if (datos.diasTrabajo !== undefined) {
    cambios.dias_trabajo = Array.from(new Set(datos.diasTrabajo)).sort((a, b) => a - b);
  }
  if (datos.horaDesde !== undefined) cambios.hora_desde = datos.horaDesde;
  if (datos.horaHasta !== undefined) cambios.hora_hasta = datos.horaHasta;
  if (datos.activo !== undefined) cambios.activo = datos.activo;
  // La invitacion solo se puede cambiar mientras no haya cuenta vinculada:
  // desvincular a alguien es una operacion aparte, no un descuido de edicion.
  if (datos.email !== undefined) cambios.email_invitacion = datos.email ?? null;

  if (Object.keys(cambios).length === 0) return error("No hay cambios para guardar.", 422);

  let consulta = ctx.supabase
    .from("barbers")
    .update(cambios)
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id);

  if (cambios.email_invitacion !== undefined) consulta = consulta.is("user_id", null);

  const { data, error: falla } = await consulta
    .select("id, nombre, descripcion, dias_trabajo, hora_desde, hora_hasta, activo, user_id, email_invitacion")
    .maybeSingle();

  if (falla) {
    registrarFalla("PATCH /api/panel/barberos/[id]", falla);
    return ERROR_INTERNO();
  }
  if (!data) return NO_ENCONTRADO();

  return ok(data);
}

/** Baja logica: los turnos historicos siguen apuntando al barbero. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoPanel(true);
  if (ctx.respuesta) return ctx.respuesta;

  const cortado = aplicarLimite(request, "panel-barberos", LIMITES.panel, ctx.usuario.id);
  if (cortado) return cortado;

  const { id } = await params;
  if (!uuid.safeParse(id).success) return NO_ENCONTRADO();

  const { data, error: falla } = await ctx.supabase
    .from("barbers")
    .update({ activo: false })
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id)
    .select("id")
    .maybeSingle();

  if (falla) {
    registrarFalla("DELETE /api/panel/barberos/[id]", falla);
    return ERROR_INTERNO();
  }
  if (!data) return NO_ENCONTRADO();

  return ok({ id: data.id, activo: false });
}
