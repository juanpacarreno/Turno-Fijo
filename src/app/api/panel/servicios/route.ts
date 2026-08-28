import { contextoPanel } from "@/lib/panel-api";
import { esquemaServicio } from "@/lib/validacion";
import { LIMITES } from "@/lib/rate-limit";
import { aplicarLimite, leerBody, ok, ERROR_INTERNO, registrarFalla } from "@/lib/api";

/** Alta de un servicio del catalogo de la barberia. */
export async function POST(request: Request) {
  const ctx = await contextoPanel(true);
  if (ctx.respuesta) return ctx.respuesta;

  const cortado = aplicarLimite(request, "panel-servicios", LIMITES.panel, ctx.usuario.id);
  if (cortado) return cortado;

  const { datos, respuesta } = await leerBody(request, esquemaServicio);
  if (respuesta) return respuesta;

  const { data, error: falla } = await ctx.supabase
    .from("services")
    .insert({
      tenant_id: ctx.tenant.id,
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      duracion_min: datos.duracionMin,
      precio_cent: datos.precioCent,
      reservable: datos.reservable,
      activo: datos.activo,
    })
    .select("id, nombre, descripcion, duracion_min, precio_cent, reservable, activo")
    .single();

  if (falla || !data) {
    registrarFalla("POST /api/panel/servicios", falla);
    return ERROR_INTERNO();
  }

  return ok(data, 201);
}
