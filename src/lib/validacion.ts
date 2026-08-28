import { z } from "zod";

/**
 * Saneamiento + validacion de todo input que entra a la app.
 *
 * Criterio: el texto se normaliza ANTES de validar longitud, se guarda ya
 * limpio en la base y React lo escapa al renderizar (no se usa
 * dangerouslySetInnerHTML en ningun lado). Para el HTML del mail hay un
 * escape explicito en `lib/email.ts`.
 */

/** Controles C0/C1, salvo el salto de linea. */
function esControl(c: number): boolean {
  return (
    c <= 0x08 ||
    c === 0x0b ||
    c === 0x0c ||
    (c >= 0x0e && c <= 0x1f) ||
    (c >= 0x7f && c <= 0x9f)
  );
}

/**
 * Invisibles y bidireccionales: se usan para homografos, para esconder texto
 * y para dar vuelta el orden visual de una cadena.
 */
function esInvisible(c: number): boolean {
  return (
    (c >= 0x200b && c <= 0x200f) || // ZWSP, ZWNJ, ZWJ, LRM, RLM
    (c >= 0x202a && c <= 0x202e) || // embeddings y overrides bidi
    (c >= 0x2066 && c <= 0x2069) || // isolates bidi
    c === 0x2060 || // word joiner
    c === 0xfeff || // BOM
    c === 0x2028 || // separador de linea
    c === 0x2029 // separador de parrafo
  );
}

/** Marcas diacriticas combinantes (bloque Combining Diacritical Marks). */
function esDiacritico(c: number): boolean {
  return c >= 0x0300 && c <= 0x036f;
}

/** Quita caracteres de control, invisibles y espacios redundantes. */
export function sanearTexto(valor: unknown): string {
  if (typeof valor !== "string") return "";
  let salida = "";
  for (const caracter of valor.normalize("NFC")) {
    const c = caracter.codePointAt(0) ?? 0;
    if (esControl(c) || esInvisible(c)) continue;
    salida += caracter;
  }
  return salida.replace(/[ \t]+/g, " ").trim();
}

/** Texto de una sola linea (nombres, titulos). */
export const textoCorto = (min: number, max: number) =>
  z.preprocess(
    (v) => sanearTexto(v).replace(/[\r\n]+/g, " ").trim(),
    z.string().min(min, `Minimo ${min} caracteres`).max(max, `Maximo ${max} caracteres`),
  );

export const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => {
      const limpio = sanearTexto(v).replace(/[\r\n]+/g, " ").trim();
      return limpio === "" ? undefined : limpio;
    },
    z.string().max(max, `Maximo ${max} caracteres`).optional(),
  );

export const uuid = z.string().uuid("Identificador invalido");

export const slug = z.preprocess(
  (v) => sanearTexto(v).toLowerCase(),
  z
    .string()
    .min(3, "Minimo 3 caracteres")
    .max(48, "Maximo 48 caracteres")
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])$/, "Solo minusculas, numeros y guiones"),
);

export const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida (AAAA-MM-DD)")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Fecha invalida");

export const horaHHMM = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Hora invalida");

export const telefono = z.preprocess(
  (v) => sanearTexto(v),
  z
    .string()
    .max(40)
    .regex(/^[0-9+()\s-]*$/, "Telefono invalido")
    .optional()
    .or(z.literal("")),
);

/** "Barberia El Sillon" -> "barberia-el-sillon" */
export function slugificar(nombre: string): string {
  const sinAcentos = Array.from(sanearTexto(nombre).toLowerCase().normalize("NFD"))
    .filter((caracter) => !esDiacritico(caracter.codePointAt(0) ?? 0))
    .join("");
  return sinAcentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

// ---------------------------------------------------------------------------
// Esquemas por endpoint
// ---------------------------------------------------------------------------

export const esquemaAltaBarberia = z.object({
  nombre: textoCorto(2, 80),
  slug,
  direccion: textoOpcional(160),
  telefono,
});

/**
 * Correo de invitacion: opcional, normalizado a minusculas.
 * El tipo va anotado a mano porque `z.preprocess` con entrada `unknown` no
 * infiere solo el tipo de salida.
 */
export const correoOpcional: z.ZodType<string | undefined, z.ZodTypeDef, unknown> = z.preprocess(
  (v) => {
    const limpio = sanearTexto(v).toLowerCase();
    return limpio === "" ? undefined : limpio;
  },
  z.string().email("Correo invalido").max(254).optional(),
);

export const esquemaBarbero = z.object({
  nombre: textoCorto(2, 60),
  descripcion: textoOpcional(120),
  email: correoOpcional,
  diasTrabajo: z.array(z.number().int().min(0).max(6)).min(1, "Elegi al menos un dia").max(7),
  horaDesde: horaHHMM,
  horaHasta: horaHHMM,
  activo: z.boolean().default(true),
});

export const esquemaBarberoUpdate = esquemaBarbero.partial();

export const esquemaServicio = z.object({
  nombre: textoCorto(2, 60),
  descripcion: textoOpcional(140),
  duracionMin: z.number().int().min(5).max(480),
  precioCent: z.number().int().min(0).max(100000000000),
  reservable: z.boolean().default(true),
  activo: z.boolean().default(true),
});

export const esquemaServicioUpdate = esquemaServicio.partial();

export const esquemaReserva = z.object({
  slug,
  barberoId: uuid,
  servicioId: uuid,
  fecha: fechaISO,
  hora: horaHHMM,
  nota: textoOpcional(280),
});

export const esquemaCobro = z.object({
  adicionales: z.array(uuid).max(20, "Demasiados adicionales").default([]),
  medioPago: z.enum(["efectivo", "transferencia", "tarjeta"]),
});

export const esquemaDisponibilidad = z.object({
  slug,
  barberoId: uuid,
  servicioId: uuid,
  fecha: fechaISO,
});

/** Valida que un `next` de redireccion sea una ruta interna (anti open-redirect). */
export function rutaInternaSegura(valor: string | null | undefined, porDefecto = "/"): string {
  if (!valor) return porDefecto;
  // Debe empezar con un solo "/" y no contener esquema ni host: corta
  // "//evil.com" y "https://evil.com".
  if (!/^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?]*$/.test(valor)) return porDefecto;
  return valor;
}
