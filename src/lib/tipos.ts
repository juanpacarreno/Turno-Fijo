export type EstadoTurno = "reservado" | "completado" | "cancelado" | "no_asistio";
export type MedioPago = "efectivo" | "transferencia" | "tarjeta";
export type RolMiembro = "dueno" | "barbero";

export type Tenant = {
  id: string;
  slug: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
};

export type Barbero = {
  id: string;
  tenant_id: string;
  nombre: string;
  descripcion: string | null;
  dias_trabajo: number[];
  hora_desde: string;
  hora_hasta: string;
  activo: boolean;
};

export type Servicio = {
  id: string;
  tenant_id: string;
  nombre: string;
  descripcion: string | null;
  duracion_min: number;
  precio_cent: number;
  reservable: boolean;
  activo: boolean;
};

export type Cliente = {
  id: string;
  tenant_id: string;
  user_id: string;
  email: string;
  nombre: string;
};

export type TurnoServicio = {
  id: string;
  nombre: string;
  precio_cent: number;
  duracion_min: number;
  principal: boolean;
  service_id: string | null;
};

export type Turno = {
  id: string;
  tenant_id: string;
  codigo: string;
  fecha: string;
  hora_desde: string;
  hora_hasta: string;
  estado: EstadoTurno;
  medio_pago: MedioPago | null;
  total_cent: number;
  nota: string | null;
  barber_id: string;
  client_id: string;
};

export const ETIQUETA_ESTADO: Record<EstadoTurno, string> = {
  reservado: "RESERVADO",
  completado: "PAGADO",
  cancelado: "CANCELO",
  no_asistio: "NO VINO",
};

export const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

export const DIAS_SEMANA = [
  { valor: 0, corto: "DOM", largo: "Domingo" },
  { valor: 1, corto: "LUN", largo: "Lunes" },
  { valor: 2, corto: "MAR", largo: "Martes" },
  { valor: 3, corto: "MIE", largo: "Miercoles" },
  { valor: 4, corto: "JUE", largo: "Jueves" },
  { valor: 5, corto: "VIE", largo: "Viernes" },
  { valor: 6, corto: "SAB", largo: "Sabado" },
] as const;
