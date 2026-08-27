import { contextoPanel } from "@/lib/panel-api";
import { esquemaBarbero } from "@/lib/validacion";
import { LIMITES } from "@/lib/rate-limit";
import { aplicarLimite, error, leerBody, ok, ERROR_INTERNO, registrarFalla } from "@/lib/api";
import { horaAMinutos } from "@/lib/format";

/** Alta de un barbero del salon. */
export async function POST(request: Request) {
  const ctx = await contextoPanel();
  if (ctx.respuesta) return ctx.respuesta;

  const cortado = aplicarLimite(request, "panel-barberos", LIMITES.panel, ctx.usuario.id);
  if (cortado) return cortado;

  const { datos, respuesta } = await leerBody(request, esquemaBarbero);
  if (respuesta) return respuesta;

  if (horaAMinutos(datos.horaDesde) >= horaAMinutos(datos.horaHasta)) {
    return error("El horario de cierre tiene que ser posterior al de apertura.", 422);
  }

  const dias = Array.from(new Set(datos.diasTrabajo)).sort((a, b) => a - b);

  const { data, error: falla } = await ctx.supabase
    .from("barbers")
    .insert({
      tenant_id: ctx.tenant.id,
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      dias_trabajo: dias,
      hora_desde: datos.horaDesde,
      hora_hasta: datos.horaHasta,
      activo: datos.activo,
    })
    .select("id, nombre, descripcion, dias_trabajo, hora_desde, hora_hasta, activo")
    .single();

  if (falla || !data) {
    registrarFalla("POST /api/panel/barberos", falla);
    return ERROR_INTERNO();
  }

  return ok(data, 201);
}
