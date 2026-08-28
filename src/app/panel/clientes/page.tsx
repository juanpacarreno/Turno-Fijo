import { requerirDuenio } from "@/lib/sesion";
import { Vacio } from "@/components/vacio";
import { fechaCorta } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Clientes - Turno Fijo" };
export const dynamic = "force-dynamic";

/**
 * Fichas de clientes de ESTA barberia.
 *
 * La misma persona que reserva en dos barberias tiene una ficha en cada una y
 * ninguna ve la actividad de la otra: RLS filtra por tenant y el listado
 * nunca cruza datos entre salones.
 */
export default async function PaginaClientes() {
  const { supabase, tenant } = await requerirDuenio("/panel/clientes");

  const [{ data: clientes }, { data: turnos }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, nombre, email, creado_en")
      .eq("tenant_id", tenant.id)
      .order("creado_en", { ascending: false })
      .limit(200),
    supabase.from("appointments").select("client_id, estado").eq("tenant_id", tenant.id),
  ]);

  const conteo = new Map<string, { visitas: number; ausencias: number }>();
  for (const t of turnos ?? []) {
    const actual = conteo.get(t.client_id as string) ?? { visitas: 0, ausencias: 0 };
    if (t.estado === "completado") actual.visitas += 1;
    if (t.estado === "no_asistio") actual.ausencias += 1;
    conteo.set(t.client_id as string, actual);
  }

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <p className="etiqueta">Agenda de contactos</p>
      <h1 className="mt-1 font-display text-3xl leading-none text-crema sm:text-4xl">Clientes</h1>

      {(clientes ?? []).length === 0 ? (
        <Vacio
          className="mt-6"
          titulo="Todavia no hay clientes"
          detalle="La ficha se crea sola la primera vez que alguien reserva con su cuenta de Google."
        />
      ) : (
        <>
          {/* DESKTOP */}
          <div className="mt-6 hidden border border-linea lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead className="w-32 text-right">Visitas</TableHead>
                  <TableHead className="w-32 text-right">No vino</TableHead>
                  <TableHead className="w-36 text-right">Alta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(clientes ?? []).map((c) => {
                  const datos = conteo.get(c.id as string) ?? { visitas: 0, ausencias: 0 };
                  return (
                    <TableRow key={c.id as string}>
                      <TableCell className="font-medium text-crema">{c.nombre}</TableCell>
                      <TableCell className="font-mono text-xs text-ceniza">{c.email}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-crema">
                        {datos.visitas}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-ceniza">
                        {datos.ausencias}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-ceniza">
                        {fechaCorta(String(c.creado_en).slice(0, 10))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* MOBILE */}
          <ul className="mt-6 border border-linea lg:hidden">
            {(clientes ?? []).map((c) => {
              const datos = conteo.get(c.id as string) ?? { visitas: 0, ausencias: 0 };
              return (
                <li key={c.id as string} className="fila-lista px-4 py-4">
                  <p className="truncate font-medium text-crema">{c.nombre}</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-ceniza">{c.email}</p>
                  <p className="mt-2 font-mono text-xs text-ceniza">
                    {datos.visitas} visitas &middot; {datos.ausencias} ausencias
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
