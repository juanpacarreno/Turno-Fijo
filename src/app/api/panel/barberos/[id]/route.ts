import { contextoPanel } from "@/lib/panel-api";
import { esquemaBarberoUpdate, uuid } from "@/lib/validacion";
import { LIMITES } from "@/lib/rate-limit";
import { aplicarLimite, error, leerBody, ok, NO_ENCONTRADO, ERROR_INTERNO, registrarFalla } from "@/lib/api";
import { horaAMinutos } from "@/lib/format";
import { guardarInvitacion, borrarInvitacionDeBarbero } from "@/lib/invitaciones";

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

  if (Object.keys(cambios).length === 0) return error("No hay cambios para guardar.", 422);

  const { data, error: falla } = await ctx.supabase
    .from("barbers")
    .update(cambios)
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id)
    .select("id, nombre, descripcion, dias_trabajo, hora_desde, hora_hasta, activo, user_id")
    .maybeSingle();

  if (falla) {
    registrarFalla("PATCH /api/panel/barberos/[id]", falla);
    return ERROR_INTERNO();
  }
  if (!data) return NO_ENCONTRADO();

  // La invitacion solo se toca mientras no haya cuenta vinculada: sacarle el
  // acceso a alguien se hace desde Equipo, no editando su ficha.
  if (datos.email !== undefined && !data.user_id) {
    if (datos.email) {
      const invitacion = await guardarInvitacion(ctx.supabase, {
        tenantId: ctx.tenant.id,
        email: datos.email,
        rol: "barbero",
        barberId: data.id as string,
        creadoPor: ctx.usuario.id,
      });
      if (!invitacion.ok) return ok({ ...data, avisoInvitacion: invitacion.motivo });
    } else {
      await borrarInvitacionDeBarbero(ctx.supabase, ctx.tenant.id, data.id as string);
    }
  }

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
