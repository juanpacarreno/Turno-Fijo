/**
 * Rate limiting de ventana deslizante, en memoria del proceso.
 *
 * Cubre los formularios publicos (reserva, login, disponibilidad, alta de
 * barberia). En un despliegue con varias instancias serverless el limite es
 * por instancia; para un limite global compartido hay que reemplazar el mapa
 * por un contador en Redis/Upstash manteniendo la firma de `limitar`.
 */

type Registro = { golpes: number[]; expira: number };

const almacen = new Map<string, Registro>();
const MAX_CLAVES = 20000;

function limpiar(ahora: number) {
  if (almacen.size < MAX_CLAVES) return;
  for (const [clave, registro] of almacen) {
    if (registro.expira <= ahora) almacen.delete(clave);
  }
}

export type ResultadoLimite = {
  permitido: boolean;
  restantes: number;
  reintentarEn: number; // segundos
};

export function limitar(clave: string, maximo: number, ventanaSeg: number): ResultadoLimite {
  const ahora = Date.now();
  const ventanaMs = ventanaSeg * 1000;
  limpiar(ahora);

  const registro = almacen.get(clave);
  const golpes = (registro?.golpes ?? []).filter((t) => ahora - t < ventanaMs);

  if (golpes.length >= maximo) {
    const masViejo = golpes[0];
    return {
      permitido: false,
      restantes: 0,
      reintentarEn: Math.max(1, Math.ceil((ventanaMs - (ahora - masViejo)) / 1000)),
    };
  }

  golpes.push(ahora);
  almacen.set(clave, { golpes, expira: ahora + ventanaMs });
  return { permitido: true, restantes: maximo - golpes.length, reintentarEn: 0 };
}

/**
 * IP del cliente. En Vercel `x-forwarded-for` lo escribe el proxy y no es
 * falsificable desde el navegador; igual se toma solo el primer valor.
 */
export function ipDeRequest(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const primera = xff.split(",")[0]?.trim();
    if (primera) return primera.slice(0, 64);
  }
  return request.headers.get("x-real-ip")?.slice(0, 64) ?? "desconocida";
}

/** Presets por tipo de operacion. */
export const LIMITES = {
  reserva: { maximo: 8, ventanaSeg: 600 },        // 8 reservas cada 10 min
  disponibilidad: { maximo: 90, ventanaSeg: 60 }, // consulta de horarios
  login: { maximo: 12, ventanaSeg: 300 },         // inicios de sesion
  altaBarberia: { maximo: 3, ventanaSeg: 3600 },  // alta de barberia
  panel: { maximo: 120, ventanaSeg: 60 },         // escritura del dueno
} as const;
