import { diaDeSemana, horaAMinutos, minutosAHora, hoyEnZona, ahoraEnZona } from "@/lib/format";

/** Paso de la grilla de horarios, en minutos. */
export const PASO_MIN = 15;

/** Anticipacion minima para reservar, en minutos. */
export const ANTICIPACION_MIN = 30;

/** Cuantos dias hacia adelante se puede reservar. */
export const DIAS_A_FUTURO = 30;

export type Ocupado = { hora_desde: string; hora_hasta: string };

export type Barbero = {
  dias_trabajo: number[];
  hora_desde: string;
  hora_hasta: string;
};

/**
 * Calcula los horarios libres de un barbero para una fecha y una duracion.
 *
 * Se ejecuta siempre del lado del servidor: el cliente nunca decide si un
 * horario esta disponible, solo muestra lo que devuelve el endpoint. Ademas,
 * el constraint de exclusion en Postgres corta cualquier carrera.
 */
export function calcularHorarios(
  barbero: Barbero,
  fecha: string,
  duracionMin: number,
  ocupados: Ocupado[],
  zona = "America/Argentina/Buenos_Aires",
): string[] {
  const dia = diaDeSemana(fecha);
  if (!barbero.dias_trabajo.includes(dia)) return [];

  const abre = horaAMinutos(barbero.hora_desde);
  const cierra = horaAMinutos(barbero.hora_hasta);
  if (duracionMin <= 0 || abre + duracionMin > cierra) return [];

  const rangosOcupados = ocupados.map((o) => ({
    desde: horaAMinutos(o.hora_desde),
    hasta: horaAMinutos(o.hora_hasta),
  }));

  const esHoy = fecha === hoyEnZona(zona);
  const minimoHoy = esHoy ? horaAMinutos(ahoraEnZona(zona)) + ANTICIPACION_MIN : -1;

  const libres: string[] = [];
  for (let inicio = abre; inicio + duracionMin <= cierra; inicio += PASO_MIN) {
    if (inicio < minimoHoy) continue;
    const fin = inicio + duracionMin;
    const pisa = rangosOcupados.some((r) => inicio < r.hasta && fin > r.desde);
    if (!pisa) libres.push(minutosAHora(inicio));
  }
  return libres;
}

/** Separa la grilla en manana y tarde, como en la pantalla de reserva. */
export function partirEnFranjas(horarios: string[]) {
  return {
    manana: horarios.filter((h) => horaAMinutos(h) < 12 * 60),
    tarde: horarios.filter((h) => horaAMinutos(h) >= 12 * 60),
  };
}

/** Valida que la fecha pedida este dentro de la ventana de reserva. */
export function fechaReservable(fecha: string, zona = "America/Argentina/Buenos_Aires"): boolean {
  const hoy = hoyEnZona(zona);
  if (fecha < hoy) return false;
  const limite = new Date(`${hoy}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + DIAS_A_FUTURO);
  return fecha <= limite.toISOString().slice(0, 10);
}
