import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esquemaDisponibilidad } from "@/lib/validacion";
import { LIMITES } from "@/lib/rate-limit";
import { aplicarLimite, error, ok, NO_ENCONTRADO, ERROR_INTERNO, registrarFalla } from "@/lib/api";
import { calcularHorarios, fechaReservable } from "@/lib/disponibilidad";

export const dynamic = "force-dynamic";

/**
 * Horarios libres de un barbero para una fecha y un servicio.
 *
 * Endpoint publico (lo consulta gente sin sesion), por eso:
 *  - rate limit por IP;
 *  - la barberia, el barbero y el servicio se leen con el cliente anonimo,
 *    o sea a traves de las politicas publicas de RLS (solo filas activas);
 *  - los turnos ocupados se leen con service role pidiendo UNICAMENTE las
 *    columnas de horario: nunca sale de aca quien reservo ni que se hizo.
 */
export async function GET(request: Request) {
  const cortado = aplicarLimite(request, "disponibilidad", LIMITES.disponibilidad);
  if (cortado) return cortado;

  const url = new URL(request.url);
  const parseo = esquemaDisponibilidad.safeParse({
    slug: url.searchParams.get("slug") ?? "",
    barberoId: url.searchParams.get("barbero") ?? "",
    servicioId: url.searchParams.get("servicio") ?? "",
    fecha: url.searchParams.get("fecha") ?? "",
  });
  if (!parseo.success) return error("Consulta invalida.", 422);
  const { slug, barberoId, servicioId, fecha } = parseo.data;

  if (!fechaReservable(fecha)) return ok({ horarios: [] });

  const publico = await crearClienteServidor();

  const { data: tenant } = await publico
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .eq("activo", true)
    .maybeSingle();
  if (!tenant) return NO_ENCONTRADO();

  const { data: barbero } = await publico
    .from("barbers")
    .select("id, dias_trabajo, hora_desde, hora_hasta")
    .eq("id", barberoId)
    .eq("tenant_id", tenant.id)
    .eq("activo", true)
    .maybeSingle();

  const { data: servicio } = await publico
    .from("services")
    .select("id, duracion_min")
    .eq("id", servicioId)
    .eq("tenant_id", tenant.id)
    .eq("activo", true)
    .eq("reservable", true)
    .maybeSingle();

  if (!barbero || !servicio) return NO_ENCONTRADO();

  const admin = crearClienteAdmin();
  const { data: ocupados, error: falla } = await admin
    .from("appointments")
    .select("hora_desde, hora_hasta")
    .eq("tenant_id", tenant.id)
    .eq("barber_id", barbero.id)
    .eq("fecha", fecha)
    .in("estado", ["reservado", "completado"]);

  if (falla) {
    registrarFalla("GET /api/disponibilidad", falla);
    return ERROR_INTERNO();
  }

  const horarios = calcularHorarios(
    {
      dias_trabajo: barbero.dias_trabajo as number[],
      hora_desde: barbero.hora_desde as string,
      hora_hasta: barbero.hora_hasta as string,
    },
    fecha,
    servicio.duracion_min as number,
    ocupados ?? [],
  );

  return ok({ horarios, duracionMin: servicio.duracion_min });
}
