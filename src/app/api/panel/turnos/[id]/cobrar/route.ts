import { contextoPanel } from "@/lib/panel-api";
import { esquemaCobro, uuid } from "@/lib/validacion";
import { LIMITES } from "@/lib/rate-limit";
import { aplicarLimite, error, leerBody, ok, NO_ENCONTRADO, ERROR_INTERNO, registrarFalla } from "@/lib/api";

/**
 * Cierre del turno: se marca completado y se registra el cobro.
 *
 * El barbero manda una lista de ids de servicios adicionales; los precios
 * SIEMPRE se leen de la base (tenant propio y servicio activo). El front no
 * puede influir en el monto: el total lo recalcula un trigger sumando las
 * filas de appointment_services.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoPanel();
  if (ctx.respuesta) return ctx.respuesta;

  const cortado = aplicarLimite(request, "panel-cobro", LIMITES.panel, ctx.usuario.id);
  if (cortado) return cortado;

  const { id } = await params;
  if (!uuid.safeParse(id).success) return NO_ENCONTRADO();

  const { datos, respuesta } = await leerBody(request, esquemaCobro);
  if (respuesta) return respuesta;

  const { data: turno } = await ctx.supabase
    .from("appointments")
    .select("id, estado")
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.id)
    .maybeSingle();

  if (!turno) return NO_ENCONTRADO();
  if (turno.estado === "completado") return error("Ese turno ya fue cobrado.", 409);
  if (turno.estado === "cancelado") return error("Ese turno esta cancelado.", 409);

  const idsAdicionales = Array.from(new Set(datos.adicionales));

  // Se reemplazan los adicionales anteriores (permite corregir antes de cerrar).
  const { error: fallaBorrado } = await ctx.supabase
    .from("appointment_services")
    .delete()
    .eq("appointment_id", turno.id)
    .eq("tenant_id", ctx.tenant.id)
    .eq("principal", false);

  if (fallaBorrado) {
    registrarFalla("POST cobrar (limpieza)", fallaBorrado);
    return ERROR_INTERNO();
  }

  if (idsAdicionales.length > 0) {
    const { data: servicios, error: fallaServicios } = await ctx.supabase
      .from("services")
      .select("id, nombre, precio_cent, duracion_min")
      .eq("tenant_id", ctx.tenant.id)
      .eq("activo", true)
      .in("id", idsAdicionales);

    if (fallaServicios) {
      registrarFalla("POST cobrar (servicios)", fallaServicios);
      return ERROR_INTERNO();
    }
    if (!servicios || servicios.length !== idsAdicionales.length) {
      return error("Alguno de los adicionales no pertenece a la barberia.", 422);
    }

    const { error: fallaAlta } = await ctx.supabase.from("appointment_services").insert(
      servicios.map((s) => ({
        tenant_id: ctx.tenant.id,
        appointment_id: turno.id,
        service_id: s.id,
        nombre: s.nombre,
        precio_cent: s.precio_cent,
        duracion_min: s.duracion_min,
        principal: false,
      })),
    );

    if (fallaAlta) {
      registrarFalla("POST cobrar (adicionales)", fallaAlta);
      return ERROR_INTERNO();
    }
  }

  const { data: cerrado, error: fallaCierre } = await ctx.supabase
    .from("appointments")
    .update({
      estado: "completado",
      medio_pago: datos.medioPago,
      cerrado_en: new Date().toISOString(),
    })
    .eq("id", turno.id)
    .eq("tenant_id", ctx.tenant.id)
    .select("id, codigo, estado, medio_pago, total_cent")
    .maybeSingle();

  if (fallaCierre) {
    registrarFalla("POST cobrar (cierre)", fallaCierre);
    return ERROR_INTERNO();
  }
  if (!cerrado) return NO_ENCONTRADO();

  return ok({
    codigo: cerrado.codigo,
    estado: cerrado.estado,
    medioPago: cerrado.medio_pago,
    totalCent: cerrado.total_cent,
  });
}
