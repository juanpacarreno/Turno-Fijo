import { Badge } from "@/components/ui/badge";
import { ETIQUETA_ESTADO, type EstadoTurno } from "@/lib/tipos";

const VARIANTE: Record<EstadoTurno, "reservado" | "pagado" | "cancelado" | "ausente"> = {
  reservado: "reservado",
  completado: "pagado",
  cancelado: "cancelado",
  no_asistio: "ausente",
};

export function EstadoTurnoBadge({ estado }: { estado: EstadoTurno }) {
  return <Badge variant={VARIANTE[estado]}>{ETIQUETA_ESTADO[estado]}</Badge>;
}
