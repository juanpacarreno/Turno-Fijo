/**
 * Acceso centralizado a variables de entorno.
 * Ninguna clave se escribe en el codigo: si falta una, el proceso falla
 * temprano y con un mensaje que no incluye el valor.
 */
function requerido(nombre: string, valor: string | undefined): string {
  if (!valor || valor.trim() === "") {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copiala de .env.example a .env.local.`,
    );
  }
  return valor;
}

export const env = {
  supabaseUrl: () => requerido("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    requerido("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  /** Solo servidor. Nunca importar desde un componente cliente. */
  supabaseServiceRoleKey: () =>
    requerido("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  siteUrl: () =>
    (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  resendApiKey: () => process.env.RESEND_API_KEY || "",
  emailFrom: () => process.env.EMAIL_FROM || "Turno Fijo <turnos@example.com>",
};
