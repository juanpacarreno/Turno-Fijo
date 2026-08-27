/** Formato argentino: pesos, fecha DD/MM/AAAA y horas en monoespaciada. */

const formateadorPesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 1250000 (centavos) -> "$12.500" */
export function pesos(centavos: number): string {
  return formateadorPesos.format(Math.round((centavos ?? 0) / 100));
}

/** "12500,50" | "12.500" | "12500" -> 1250050 | 1250000 (centavos) */
export function aCentavos(entrada: string | number): number | null {
  if (typeof entrada === "number") {
    if (!Number.isFinite(entrada)) return null;
    return Math.round(entrada * 100);
  }
  const limpio = entrada.trim().replace(/[^0-9.,-]/g, "");
  if (limpio === "") return null;
  // En es-AR el punto es separador de miles y la coma es decimal.
  const normalizado = limpio.replace(/\./g, "").replace(",", ".");
  const valor = Number(normalizado);
  if (!Number.isFinite(valor) || valor < 0) return null;
  return Math.round(valor * 100);
}

/** "2026-08-26" -> "26/08/2026" */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const DIAS_TILDE = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function diaDeSemana(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** "2026-08-26" -> "martes 26 de agosto" */
export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS_TILDE[dia]} ${d} de ${MESES[m - 1]}`;
}

/** "2026-08-26" -> { dia: "26", mes: "agosto", diaSemana: "MAR" } */
export function partesFecha(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return {
    dia: String(d).padStart(2, "0"),
    mes: MESES[m - 1],
    anio: String(a),
    diaSemana: DIAS[dia].slice(0, 3).toUpperCase(),
    diaSemanaLargo: DIAS_TILDE[dia],
  };
}

/** "14:30:00" -> "14:30" */
export function hhmm(hora: string): string {
  return hora.slice(0, 5);
}

export function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? "";
}

/** Fecha de hoy en la zona horaria del salon, como "AAAA-MM-DD". */
export function hoyEnZona(zona = "America/Argentina/Buenos_Aires"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Hora actual "HH:MM" en la zona del salon. */
export function ahoraEnZona(zona = "America/Argentina/Buenos_Aires"): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: zona,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** Suma dias a "AAAA-MM-DD" sin tocar zonas horarias. */
export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

export function minutosAHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}
