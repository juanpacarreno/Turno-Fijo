import { obtenerUsuario } from "@/lib/sesion";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { esquemaReserva, sanearTexto } from "@/lib/validacion";
import { LIMITES } from "@/lib/rate-limit";
import {
  aplicarLimite,
  error,
  leerBody,
  ok,
  NO_AUTORIZADO,
  NO_ENCONTRADO,
  ERROR_INTERNO,
  registrarFalla,
} from "@/lib/api";
import { calcularHorarios, fechaReservable } from "@/lib/disponibilidad";
import { generarCodigoTurno } from "@/lib/codigo";
import { horaAMinutos, minutosAHora } from "@/lib/format";
import { enviarConfirmacionTurno } from "@/lib/email";

/**
 * Alta de un turno.
 *
 * Todo se revalida en el servidor: que la barberia este activa, que el
 * barbero y el servicio sean de esa barberia, que la fecha entre en la
 * ventana de reserva y que el horario siga libre. El insert va con el cliente
 * de sesion (o sea, filtrado por RLS) y el constraint de exclusion de la base
 * es la ultima linea contra la sobreventa.
 */
export async function POST(request: Request) {
  const { supabase, usuario } = await obtenerUsuario();
  if (!usuario || !usuario.email) return NO_AUTORIZADO();

  const porIp = aplicarLimite(request, "reserva-ip", LIMITES.reserva);
  if (porIp) return porIp;
  const porUsuario = aplicarLimite(request, "reserva-usuario", LIMITES.reserva, usuario.id);
  if (porUsuario) return porUsuario;

  const { datos, respuesta } = await leerBody(request, esquemaReserva);
  if (respuesta) return respuesta;

  if (!fechaReservable(datos.fecha)) {
    return error("Esa fecha esta fuera del periodo de reservas.", 422);
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, nombre, direccion, slug")
    .eq("slug", datos.slug)
    .eq("activo", true)
    .maybeSingle();
  if (!tenant) return NO_ENCONTRADO();

  const { data: barbero } = await supabase
    .from("barbers")
    .select("id, nombre, dias_trabajo, hora_desde, hora_hasta")
    .eq("id", datos.barberoId)
    .eq("tenant_id", tenant.id)
    .eq("activo", true)
    .maybeSingle();

  const { data: servicio } = await supabase
    .from("services")
    .select("id, nombre, duracion_min, precio_cent")
    .eq("id", datos.servicioId)
    .eq("tenant_id", tenant.id)
    .eq("activo", true)
    .eq("reservable", true)
    .maybeSingle();

  if (!barbero || !servicio) return NO_ENCONTRADO();

  const admin = crearClienteAdmin();

  // El horario se valida contra la agenda real, no contra lo que diga el front.
  const { data: ocupados, error: fallaOcupados } = await admin
    .from("appointments")
    .select("hora_desde, hora_hasta")
    .eq("tenant_id", tenant.id)
    .eq("barber_id", barbero.id)
    .eq("fecha", datos.fecha)
    .in("estado", ["reservado", "completado"]);

  if (fallaOcupados) {
    registrarFalla("POST /api/reservas", fallaOcupados);
    return ERROR_INTERNO();
  }

  const libres = calcularHorarios(
    {
      dias_trabajo: barbero.dias_trabajo as number[],
      hora_desde: barbero.hora_desde as string,
      hora_hasta: barbero.hora_hasta as string,
    },
    datos.fecha,
    servicio.duracion_min as number,
    ocupados ?? [],
  );

  if (!libres.includes(datos.hora)) {
    return error("Ese horario ya no esta disponible. Elegi otro.", 409);
  }

  const horaHasta = minutosAHora(horaAMinutos(datos.hora) + (servicio.duracion_min as number));

  // Ficha del cliente en ESTA barberia (una por tenant y usuario).
  const nombreCliente =
    sanearTexto(
      (usuario.user_metadata?.full_name as string) ||
        (usuario.user_metadata?.name as string) ||
        usuario.email.split("@")[0],
    ).slice(0, 80) || "Cliente";

  let clienteId: string | null = null;
  const { data: fichaExistente } = await supabase
    .from("clients")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("user_id", usuario.id)
    .maybeSingle();

  if (fichaExistente) {
    clienteId = fichaExistente.id as string;
  } else {
    const { data: fichaNueva, error: fallaFicha } = await supabase
      .from("clients")
      .insert({
        tenant_id: tenant.id,
        user_id: usuario.id,
        email: usuario.email,
        nombre: nombreCliente,
      })
      .select("id")
      .single();

    if (fallaFicha || !fichaNueva) {
      registrarFalla("POST /api/reservas (ficha)", fallaFicha);
      return ERROR_INTERNO();
    }
    clienteId = fichaNueva.id as string;
  }

  // Insert del turno, reintentando solo ante colision de codigo publico.
  let turno: { id: string; codigo: string } | null = null;
  for (let intento = 0; intento < 4 && !turno; intento += 1) {
    const { data, error: falla } = await supabase
      .from("appointments")
      .insert({
        tenant_id: tenant.id,
        barber_id: barbero.id,
        client_id: clienteId,
        codigo: generarCodigoTurno(datos.fecha),
        fecha: datos.fecha,
        hora_desde: datos.hora,
        hora_hasta: horaHasta,
        estado: "reservado",
        nota: datos.nota ?? null,
      })
      .select("id, codigo")
      .single();

    if (data) {
      turno = data as { id: string; codigo: string };
      break;
    }
    if (falla?.code === "23505") continue; // codigo repetido: se reintenta
    if (falla?.code === "23P01") {
      return error("Ese horario se acaba de ocupar. Elegi otro.", 409);
    }
    registrarFalla("POST /api/reservas (turno)", falla);
    return ERROR_INTERNO();
  }

  if (!turno) return ERROR_INTERNO();

  // Servicio reservado como fila principal de la tabla intermedia.
  const { error: fallaServicio } = await supabase.from("appointment_services").insert({
    tenant_id: tenant.id,
    appointment_id: turno.id,
    service_id: servicio.id,
    nombre: servicio.nombre,
    precio_cent: servicio.precio_cent,
    duracion_min: servicio.duracion_min,
    principal: true,
  });

  if (fallaServicio) {
    // Sin servicio el turno no tiene sentido: se limpia.
    await admin.from("appointments").delete().eq("id", turno.id);
    registrarFalla("POST /api/reservas (servicio)", fallaServicio);
    return ERROR_INTERNO();
  }

  await enviarConfirmacionTurno({
    para: usuario.email,
    nombreCliente,
    barberia: tenant.nombre as string,
    direccion: (tenant.direccion as string | null) ?? null,
    barbero: barbero.nombre as string,
    servicio: servicio.nombre as string,
    fecha: datos.fecha,
    hora: datos.hora,
    precioCent: servicio.precio_cent as number,
    codigo: turno.codigo,
  });

  // Solo el codigo publico: el uuid del turno no sale de la app.
  return ok(
    {
      codigo: turno.codigo,
      fecha: datos.fecha,
      hora: datos.hora,
      barbero: barbero.nombre,
      servicio: servicio.nombre,
      precioCent: servicio.precio_cent,
      barberia: tenant.nombre,
      direccion: tenant.direccion ?? null,
    },
    201,
  );
}
