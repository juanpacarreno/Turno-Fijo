import { obtenerUsuario } from "@/lib/sesion";
import { aplicarLimite, error, ok, NO_AUTORIZADO, NO_ENCONTRADO, ERROR_INTERNO, registrarFalla } from "@/lib/api";
import { LIMITES } from "@/lib/rate-limit";
import { hoyEnZona, ahoraEnZona, horaAMinutos } from "@/lib/format";

/** Margen minimo para cancelar, en minutos. */
const MARGEN_CANCELACION_MIN = 120;

/**
 * Cancelacion del turno por parte del cliente.
 *
 * El turno se identifica por su codigo publico. La pertenencia la resuelve
 * RLS: la politica solo deja pasar filas cuyo client_id sea del usuario, asi
 * que un codigo ajeno no devuelve nada aunque se adivine.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { supabase, usuario } = await obtenerUsuario();
  if (!usuario) return NO_AUTORIZADO();

  const cortado = aplicarLimite(request, "cancelar", LIMITES.panel, usuario.id);
  if (cortado) return cortado;

  const { codigo } = await params;
  if (!/^TF-\d{4}-[A-Z0-9]{4}$/.test(codigo)) return NO_ENCONTRADO();

  const { data: turno } = await supabase
    .from("appointments")
    .select("id, fecha, hora_desde, estado")
    .eq("codigo", codigo)
    .maybeSingle();

  if (!turno) return NO_ENCONTRADO();
  if (turno.estado !== "reservado") {
    return error("Ese turno ya no se puede cancelar.", 409);
  }

  const hoy = hoyEnZona();
  if (
    turno.fecha < hoy ||
    (turno.fecha === hoy &&
      horaAMinutos(turno.hora_desde as string) - horaAMinutos(ahoraEnZona()) < MARGEN_CANCELACION_MIN)
  ) {
    return error("Se cancela hasta 2 horas antes. Llama a la barberia.", 409);
  }

  const { error: falla } = await supabase
    .from("appointments")
    .update({ estado: "cancelado" })
    .eq("id", turno.id);

  if (falla) {
    registrarFalla("POST /api/reservas/[codigo]/cancelar", falla);
    return ERROR_INTERNO();
  }

  return ok({ codigo, estado: "cancelado" });
}
