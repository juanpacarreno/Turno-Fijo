import { z } from "zod";
import { contextoPanel } from "@/lib/panel-api";
import { correoOpcional, uuid } from "@/lib/validacion";
import { guardarInvitacion } from "@/lib/invitaciones";
import { LIMITES } from "@/lib/rate-limit";
import { aplicarLimite, error, leerBody, ok } from "@/lib/api";

const esquema = z.object({
  email: correoOpcional,
  rol: z.enum(["dueno", "barbero"]),
  barberoId: uuid.optional().nullable(),
});

/**
 * Invitacion al equipo. Solo el dueno invita.
 *
 * Un socio entra con rol 'dueno' y acceso completo; un barbero necesita una
 * ficha para quedar vinculado a su agenda.
 */
export async function POST(request: Request) {
  const ctx = await contextoPanel(true);
  if (ctx.respuesta) return ctx.respuesta;

  const cortado = aplicarLimite(request, "panel-invitaciones", LIMITES.panel, ctx.usuario.id);
  if (cortado) return cortado;

  const { datos, respuesta } = await leerBody(request, esquema);
  if (respuesta) return respuesta;

  if (!datos.email) return error("Escribi el correo de Google de la persona.", 422);
  if (datos.rol === "barbero" && !datos.barberoId) {
    return error("Para invitar a un barbero elegi su ficha.", 422);
  }

  // La ficha tiene que ser de esta barberia y estar libre.
  if (datos.barberoId) {
    const { data: ficha } = await ctx.supabase
      .from("barbers")
      .select("id, user_id")
      .eq("id", datos.barberoId)
      .eq("tenant_id", ctx.tenant.id)
      .maybeSingle();

    if (!ficha) return error("Esa ficha de barbero no es de tu barberia.", 422);
    if (ficha.user_id) return error("Esa ficha ya tiene una cuenta vinculada.", 409);
  }

  const resultado = await guardarInvitacion(ctx.supabase, {
    tenantId: ctx.tenant.id,
    email: datos.email,
    rol: datos.rol,
    barberId: datos.barberoId ?? null,
    creadoPor: ctx.usuario.id,
  });

  if (!resultado.ok) return error(resultado.motivo, 409);

  return ok({ email: datos.email, rol: datos.rol }, 201);
}
