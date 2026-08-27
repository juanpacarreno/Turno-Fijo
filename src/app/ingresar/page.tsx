import Link from "next/link";
import { redirect } from "next/navigation";
import { Marca } from "@/components/marca";
import { BotonGoogle } from "@/components/boton-google";
import { obtenerUsuario } from "@/lib/sesion";
import { rutaInternaSegura } from "@/lib/validacion";

export const metadata = { title: "Ingresar - Turno Fijo" };

const MENSAJES: Record<string, string> = {
  limite: "Hubo demasiados intentos desde esta conexion. Espera unos minutos.",
  codigo: "El enlace de ingreso no era valido. Proba de nuevo.",
  sesion: "No pudimos completar el ingreso. Proba de nuevo.",
};

export default async function PaginaIngresar({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const destino = rutaInternaSegura(params.next, "/panel");
  const { usuario } = await obtenerUsuario();
  if (usuario) redirect(destino);

  const aviso = params.error ? MENSAJES[params.error] : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <Marca />

      <h1 className="mt-10 font-display text-3xl leading-tight text-crema">
        Entra con tu cuenta de Google
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ceniza">
        Es la unica forma de identificarte: sin contrasenas nuevas ni formularios.
        Usamos tu correo para mandarte la confirmacion del turno.
      </p>

      {aviso ? (
        <p role="alert" className="mt-6 border border-ladrillo px-4 py-3 text-sm text-ladrillo">
          {aviso}
        </p>
      ) : null}

      <div className="mt-8">
        <BotonGoogle next={destino} />
      </div>

      <p className="mt-8 text-xs leading-relaxed text-ceniza">
        Al continuar aceptas que guardemos tu nombre y tu correo para gestionar los
        turnos de la barberia donde reservas.{" "}
        <Link href="/" className="text-oro underline underline-offset-4">
          Volver al inicio
        </Link>
      </p>
    </main>
  );
}
