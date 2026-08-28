import { contextoPanel } from "@/lib/panel-api";
import { uuid } from "@/lib/validacion";
import { LIMITES } from "@/lib/rate-limit";
import { aplicarLimite, error, ok, NO_ENCONTRADO, ERROR_INTERNO, registrarFalla } from "@/lib/api";

/**
 * Quita a una persona del equipo.
 *
 * La politica de RLS impide sacarse a uno mismo y un trigger impide dejar la
 * barberia sin duenos; ademas, al borrar la membresia se libera su ficha de
 * barbero para poder invitar a otra persona.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const ctx = await contextoPanel(true);
  if (ctx.respuesta) return ctx.respuesta;

  const cortado = aplicarLimite(request, "panel-equipo", LIMITES.panel, ctx.usuario.id);
  if (cortado) return cortado;

  const { userId } = await params;
  if (!uuid.safeParse(userId).success) return NO_ENCONTRADO();
  if (userId === ctx.usuario.id) {
    return error("No podes quitarte a vos mismo del equipo.", 409);
  }

  const { data, error: falla } = await ctx.supabase
    .from("tenant_members")
    .delete()
    .eq("tenant_id", ctx.tenant.id)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (falla) {
    // El trigger que protege al ultimo dueno llega como error de la base.
    if (falla.message?.includes("sin duenos")) {
      return error("La barberia no puede quedarse sin duenos.", 409);
    }
    registrarFalla("DELETE /api/panel/equipo/[userId]", falla);
    return ERROR_INTERNO();
  }
  if (!data) return NO_ENCONTRADO();

  return ok({ userId: data.user_id });
}
