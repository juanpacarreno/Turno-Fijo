import { contextoPanel } from "@/lib/panel-api";
import { uuid } from "@/lib/validacion";
import { LIMITES } from "@/lib/rate-limit";
import { aplicarLimite, ok, NO_ENCONTRADO, ERROR_INTERNO, registrarFalla } from "@/lib/api";

/** Cancela una invitacion pendiente. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoPanel(true);
  if (ctx.respuesta) return ctx.respuesta;

  const cortado = aplicarLimite(request, "panel-invitaciones", LIMITES.panel, ctx.usuario.id);
  if (cortado) return cortado;

  const { id } = await params;
  if (!uuid.safeParse(id).success) return NO_ENCONTRADO();

  const { data, error: falla } = await ctx.supabase
    .from("invitaciones")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id)
    .select("id")
    .maybeSingle();

  if (falla) {
    registrarFalla("DELETE /api/panel/invitaciones/[id]", falla);
    return ERROR_INTERNO();
  }
  if (!data) return NO_ENCONTRADO();

  return ok({ id: data.id });
}
