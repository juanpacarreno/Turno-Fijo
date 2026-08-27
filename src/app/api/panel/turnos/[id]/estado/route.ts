import { z } from "zod";
import { contextoPanel } from "@/lib/panel-api";
import { uuid } from "@/lib/validacion";
import { LIMITES } from "@/lib/rate-limit";
import { aplicarLimite, error, leerBody, ok, NO_ENCONTRADO, ERROR_INTERNO, registrarFalla } from "@/lib/api";

const esquema = z.object({
  estado: z.enum(["reservado", "cancelado", "no_asistio"]),
});

/**
 * Cambio de estado desde el panel: cliente que no vino, turno cancelado en el
 * salon, o vuelta atras a reservado. El cobro tiene su propio endpoint.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoPanel();
  if (ctx.respuesta) return ctx.respuesta;

  const cortado = aplicarLimite(request, "panel-estado", LIMITES.panel, ctx.usuario.id);
  if (cortado) return cortado;

  const { id } = await params;
  if (!uuid.safeParse(id).success) return NO_ENCONTRADO();

  const { datos, respuesta } = await leerBody(request, esquema);
  if (respuesta) return respuesta;

  const { data: turno } = await ctx.supabase
    .from("appointments")
    .select("id, estado")
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id)
    .maybeSingle();

  if (!turno) return NO_ENCONTRADO();
  if (turno.estado === "completado") {
    return error("Un turno ya cobrado no cambia de estado.", 409);
  }

  const { data, error: falla } = await ctx.supabase
    .from("appointments")
    .update({ estado: datos.estado, medio_pago: null, cerrado_en: null })
    .eq("id", turno.id)
    .eq("tenant_id", ctx.tenant.id)
    .select("id, codigo, estado")
    .maybeSingle();

  if (falla) {
    // Reabrir un turno cuya franja ya fue tomada por otro: lo corta el
    // constraint de exclusion de Postgres.
    if (falla.code === "23P01") {
      return error("Ese horario ya lo tomo otro turno.", 409);
    }
    registrarFalla("POST /api/panel/turnos/[id]/estado", falla);
    return ERROR_INTERNO();
  }
  if (!data) return NO_ENCONTRADO();

  return ok({ codigo: data.codigo, estado: data.estado });
}
