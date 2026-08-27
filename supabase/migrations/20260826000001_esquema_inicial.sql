-- ===========================================================================
-- Turno Fijo - esquema multi-tenant con aislamiento por Row Level Security
-- ---------------------------------------------------------------------------
-- Regla de oro: TODA tabla de negocio lleva `tenant_id` y RLS habilitada.
-- Ningun dueno puede leer ni escribir filas de otra barberia bajo ninguna
-- circunstancia, ni siquiera con un token valido de otro tenant.
-- ===========================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "btree_gist"; -- constraint de solapamiento

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
do $$ begin
  create type estado_turno as enum ('reservado', 'completado', 'cancelado', 'no_asistio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type medio_pago as enum ('efectivo', 'transferencia', 'tarjeta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rol_miembro as enum ('dueno', 'barbero');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- tenants: una fila por barberia
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                check (slug ~ '^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$'),
  nombre        text not null check (char_length(nombre) between 2 and 80),
  direccion     text check (char_length(direccion) <= 160),
  telefono      text check (char_length(telefono) <= 40),
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tenant_members: que usuario administra que barberia
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_members (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rol        rol_miembro not null default 'dueno',
  creado_en  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists tenant_members_user_idx on public.tenant_members(user_id);

-- ---------------------------------------------------------------------------
-- Helpers de RLS.
-- SECURITY DEFINER para poder consultar tenant_members sin recursion de
-- politicas, con search_path fijo para evitar secuestro de esquema.
-- ---------------------------------------------------------------------------
create or replace function public.es_miembro_del_tenant(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = p_tenant
      and tm.user_id = (select auth.uid())
  );
$fn$;
revoke all on function public.es_miembro_del_tenant(uuid) from public;
grant execute on function public.es_miembro_del_tenant(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- barbers
-- ---------------------------------------------------------------------------
create table if not exists public.barbers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 2 and 60),
  descripcion text check (char_length(descripcion) <= 120),
  -- Dias trabajados: 0=domingo ... 6=sabado
  dias_trabajo smallint[] not null default '{2,3,4,5,6}'
               check (array_length(dias_trabajo, 1) between 1 and 7),
  hora_desde  time not null default '10:00',
  hora_hasta  time not null default '20:00',
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  constraint barbers_horario_valido check (hora_desde < hora_hasta)
);
create index if not exists barbers_tenant_idx on public.barbers(tenant_id);

-- ---------------------------------------------------------------------------
-- services: catalogo de la barberia. Sirve tanto para la reserva online
-- como para los adicionales cargados en el sillon.
-- ---------------------------------------------------------------------------
create table if not exists public.services (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  nombre        text not null check (char_length(nombre) between 2 and 60),
  descripcion   text check (char_length(descripcion) <= 140),
  duracion_min  integer not null check (duracion_min between 5 and 480),
  precio_cent   bigint not null check (precio_cent between 0 and 100000000000),
  -- true  -> se puede reservar online
  -- false -> solo se agrega en el sillon (adicional)
  reservable    boolean not null default true,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);
create index if not exists services_tenant_idx on public.services(tenant_id);

-- ---------------------------------------------------------------------------
-- clients: un registro por (barberia, usuario de Google).
-- La identidad viene siempre de auth.users; no hay alta manual.
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  email      text not null check (char_length(email) <= 254),
  nombre     text not null check (char_length(nombre) between 1 and 80),
  creado_en  timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index if not exists clients_tenant_idx on public.clients(tenant_id);
create index if not exists clients_user_idx on public.clients(user_id);

-- Fichas del usuario actual. Se define DESPUES de la tabla clients: una
-- funcion `language sql` valida su cuerpo al crearse y fallaria si la tabla
-- todavia no existe.
create or replace function public.mis_client_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select c.id from public.clients c where c.user_id = (select auth.uid());
$fn$;
revoke all on function public.mis_client_ids() from public;
grant execute on function public.mis_client_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- appointments
-- El horario se guarda en hora local del salon (fecha + hora), lo que evita
-- corrimientos de zona horaria en la agenda.
-- `codigo` es el identificador publico: nunca se expone el uuid al cliente.
-- ---------------------------------------------------------------------------
create table if not exists public.appointments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  barber_id   uuid not null references public.barbers(id) on delete restrict,
  client_id   uuid not null references public.clients(id) on delete restrict,
  codigo      text not null unique check (codigo ~ '^TF-[0-9]{4}-[A-Z0-9]{4}$'),
  fecha       date not null,
  hora_desde  time not null,
  hora_hasta  time not null,
  estado      estado_turno not null default 'reservado',
  medio_pago  medio_pago,
  total_cent  bigint not null default 0 check (total_cent >= 0),
  nota        text check (char_length(nota) <= 280),
  creado_en   timestamptz not null default now(),
  cerrado_en  timestamptz,
  constraint appointments_horario_valido check (hora_desde < hora_hasta),
  -- Solo un turno vigente por barbero y franja: la base rechaza la
  -- sobreventa aunque dos requests entren en paralelo.
  franja tsrange generated always as
    (tsrange(fecha + hora_desde, fecha + hora_hasta, '[)')) stored,
  exclude using gist (
    barber_id with =,
    franja with &&
  ) where (estado in ('reservado', 'completado'))
);
create index if not exists appointments_tenant_fecha_idx
  on public.appointments(tenant_id, fecha);
create index if not exists appointments_client_idx on public.appointments(client_id);
create index if not exists appointments_barber_fecha_idx
  on public.appointments(barber_id, fecha);

-- ---------------------------------------------------------------------------
-- appointment_services: tabla intermedia turno <-> servicios (1..N)
-- El servicio reservado entra como `principal`; los adicionales cargados en
-- el sillon entran como filas extra. El precio se congela al momento de la
-- carga para que un cambio de lista no altere la caja historica.
-- ---------------------------------------------------------------------------
create table if not exists public.appointment_services (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id     uuid references public.services(id) on delete set null,
  nombre         text not null check (char_length(nombre) between 2 and 60),
  precio_cent    bigint not null check (precio_cent between 0 and 100000000000),
  duracion_min   integer not null default 0 check (duracion_min between 0 and 480),
  principal      boolean not null default false,
  creado_en      timestamptz not null default now()
);
create index if not exists appointment_services_appointment_idx
  on public.appointment_services(appointment_id);
create index if not exists appointment_services_tenant_idx
  on public.appointment_services(tenant_id);
-- Un unico servicio principal por turno.
create unique index if not exists appointment_services_un_principal
  on public.appointment_services(appointment_id) where principal;

-- ---------------------------------------------------------------------------
-- Coherencia de tenant entre tablas relacionadas: impide que un turno apunte
-- a un barbero o a un servicio de otra barberia.
-- ---------------------------------------------------------------------------
create or replace function public.validar_tenant_coherente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_tenant uuid;
begin
  if tg_table_name = 'appointments' then
    select tenant_id into v_tenant from public.barbers where id = new.barber_id;
    if v_tenant is null or v_tenant <> new.tenant_id then
      raise exception 'El barbero no pertenece a la barberia indicada';
    end if;

    select tenant_id into v_tenant from public.clients where id = new.client_id;
    if v_tenant is null or v_tenant <> new.tenant_id then
      raise exception 'El cliente no pertenece a la barberia indicada';
    end if;

  elsif tg_table_name = 'appointment_services' then
    select tenant_id into v_tenant from public.appointments where id = new.appointment_id;
    if v_tenant is null or v_tenant <> new.tenant_id then
      raise exception 'El turno no pertenece a la barberia indicada';
    end if;

    if new.service_id is not null then
      select tenant_id into v_tenant from public.services where id = new.service_id;
      if v_tenant is null or v_tenant <> new.tenant_id then
        raise exception 'El servicio no pertenece a la barberia indicada';
      end if;
    end if;
  end if;

  return new;
end;
$fn$;

drop trigger if exists appointments_tenant_coherente on public.appointments;
create trigger appointments_tenant_coherente
  before insert or update on public.appointments
  for each row execute function public.validar_tenant_coherente();

drop trigger if exists appointment_services_tenant_coherente on public.appointment_services;
create trigger appointment_services_tenant_coherente
  before insert or update on public.appointment_services
  for each row execute function public.validar_tenant_coherente();

-- ---------------------------------------------------------------------------
-- Total del turno: siempre la suma real de sus servicios.
-- Se recalcula en la base, no se confia en el numero que manda el cliente.
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_total_turno()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_appointment uuid := coalesce(new.appointment_id, old.appointment_id);
begin
  update public.appointments a
     set total_cent = coalesce((
       select sum(s.precio_cent)
       from public.appointment_services s
       where s.appointment_id = v_appointment
     ), 0)
   where a.id = v_appointment;
  return null;
end;
$fn$;

drop trigger if exists appointment_services_total on public.appointment_services;
create trigger appointment_services_total
  after insert or update or delete on public.appointment_services
  for each row execute function public.recalcular_total_turno();

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================
alter table public.tenants              enable row level security;
alter table public.tenant_members       enable row level security;
alter table public.barbers              enable row level security;
alter table public.services             enable row level security;
alter table public.clients              enable row level security;
alter table public.appointments         enable row level security;
alter table public.appointment_services enable row level security;

alter table public.tenants              force row level security;
alter table public.tenant_members       force row level security;
alter table public.barbers              force row level security;
alter table public.services             force row level security;
alter table public.clients              force row level security;
alter table public.appointments         force row level security;
alter table public.appointment_services force row level security;

-- --- tenants ---------------------------------------------------------------
-- Lectura publica solo de barberias activas: es el catalogo necesario para
-- que un cliente abra /b/<slug>. No hay datos sensibles en esta tabla.
drop policy if exists tenants_lectura_publica on public.tenants;
create policy tenants_lectura_publica on public.tenants
  for select to anon, authenticated
  using (activo);

drop policy if exists tenants_update_miembro on public.tenants;
create policy tenants_update_miembro on public.tenants
  for update to authenticated
  using (public.es_miembro_del_tenant(id))
  with check (public.es_miembro_del_tenant(id));

-- El alta de barberia pasa por el endpoint del servidor (service role), que
-- crea tenant + membresia en una sola operacion. No se permite insert directo.

-- --- tenant_members --------------------------------------------------------
drop policy if exists tenant_members_lectura_propia on public.tenant_members;
create policy tenant_members_lectura_propia on public.tenant_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.es_miembro_del_tenant(tenant_id));

-- --- barbers ---------------------------------------------------------------
drop policy if exists barbers_lectura_publica on public.barbers;
create policy barbers_lectura_publica on public.barbers
  for select to anon, authenticated
  using (
    activo and exists (
      select 1 from public.tenants t where t.id = tenant_id and t.activo
    )
  );

drop policy if exists barbers_miembro_lectura on public.barbers;
create policy barbers_miembro_lectura on public.barbers
  for select to authenticated
  using (public.es_miembro_del_tenant(tenant_id));

drop policy if exists barbers_miembro_insert on public.barbers;
create policy barbers_miembro_insert on public.barbers
  for insert to authenticated
  with check (public.es_miembro_del_tenant(tenant_id));

drop policy if exists barbers_miembro_update on public.barbers;
create policy barbers_miembro_update on public.barbers
  for update to authenticated
  using (public.es_miembro_del_tenant(tenant_id))
  with check (public.es_miembro_del_tenant(tenant_id));

drop policy if exists barbers_miembro_delete on public.barbers;
create policy barbers_miembro_delete on public.barbers
  for delete to authenticated
  using (public.es_miembro_del_tenant(tenant_id));

-- --- services --------------------------------------------------------------
drop policy if exists services_lectura_publica on public.services;
create policy services_lectura_publica on public.services
  for select to anon, authenticated
  using (
    activo and reservable and exists (
      select 1 from public.tenants t where t.id = tenant_id and t.activo
    )
  );

drop policy if exists services_miembro_lectura on public.services;
create policy services_miembro_lectura on public.services
  for select to authenticated
  using (public.es_miembro_del_tenant(tenant_id));

drop policy if exists services_miembro_insert on public.services;
create policy services_miembro_insert on public.services
  for insert to authenticated
  with check (public.es_miembro_del_tenant(tenant_id));

drop policy if exists services_miembro_update on public.services;
create policy services_miembro_update on public.services
  for update to authenticated
  using (public.es_miembro_del_tenant(tenant_id))
  with check (public.es_miembro_del_tenant(tenant_id));

drop policy if exists services_miembro_delete on public.services;
create policy services_miembro_delete on public.services
  for delete to authenticated
  using (public.es_miembro_del_tenant(tenant_id));

-- --- clients ---------------------------------------------------------------
-- Un cliente ve unicamente su propia ficha. La barberia ve las fichas de su
-- tenant. Nunca hay lectura cruzada entre clientes.
drop policy if exists clients_lectura_propia on public.clients;
create policy clients_lectura_propia on public.clients
  for select to authenticated
  using (user_id = (select auth.uid()) or public.es_miembro_del_tenant(tenant_id));

drop policy if exists clients_alta_propia on public.clients;
create policy clients_alta_propia on public.clients
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.tenants t where t.id = tenant_id and t.activo)
  );

drop policy if exists clients_update_propia on public.clients;
create policy clients_update_propia on public.clients
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- --- appointments ----------------------------------------------------------
drop policy if exists appointments_lectura on public.appointments;
create policy appointments_lectura on public.appointments
  for select to authenticated
  using (
    public.es_miembro_del_tenant(tenant_id)
    or client_id in (select public.mis_client_ids())
  );

drop policy if exists appointments_alta_cliente on public.appointments;
create policy appointments_alta_cliente on public.appointments
  for insert to authenticated
  with check (
    estado = 'reservado'
    and medio_pago is null
    and client_id in (select public.mis_client_ids())
    and exists (
      select 1 from public.clients c
      where c.id = client_id and c.tenant_id = appointments.tenant_id
    )
  );

drop policy if exists appointments_update_miembro on public.appointments;
create policy appointments_update_miembro on public.appointments
  for update to authenticated
  using (public.es_miembro_del_tenant(tenant_id))
  with check (public.es_miembro_del_tenant(tenant_id));

-- El cliente solo puede cancelar su propio turno: no puede tocar estado
-- 'completado' ni cargar montos.
drop policy if exists appointments_cancela_cliente on public.appointments;
create policy appointments_cancela_cliente on public.appointments
  for update to authenticated
  using (client_id in (select public.mis_client_ids()) and estado = 'reservado')
  with check (client_id in (select public.mis_client_ids()) and estado = 'cancelado');

-- --- appointment_services --------------------------------------------------
drop policy if exists appointment_services_lectura on public.appointment_services;
create policy appointment_services_lectura on public.appointment_services
  for select to authenticated
  using (
    public.es_miembro_del_tenant(tenant_id)
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and a.client_id in (select public.mis_client_ids())
    )
  );

-- El cliente puede dejar asentado el servicio que reservo; los adicionales
-- (principal = false) solo los carga la barberia.
drop policy if exists appointment_services_alta_cliente on public.appointment_services;
create policy appointment_services_alta_cliente on public.appointment_services
  for insert to authenticated
  with check (
    principal
    and exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and a.client_id in (select public.mis_client_ids())
        and a.estado = 'reservado'
    )
  );

drop policy if exists appointment_services_miembro_insert on public.appointment_services;
create policy appointment_services_miembro_insert on public.appointment_services
  for insert to authenticated
  with check (public.es_miembro_del_tenant(tenant_id));

drop policy if exists appointment_services_miembro_update on public.appointment_services;
create policy appointment_services_miembro_update on public.appointment_services
  for update to authenticated
  using (public.es_miembro_del_tenant(tenant_id))
  with check (public.es_miembro_del_tenant(tenant_id));

drop policy if exists appointment_services_miembro_delete on public.appointment_services;
create policy appointment_services_miembro_delete on public.appointment_services
  for delete to authenticated
  using (public.es_miembro_del_tenant(tenant_id));

-- ---------------------------------------------------------------------------
-- Permisos base: sin GRANT no hay acceso ni siquiera con politica permisiva.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

grant select on public.tenants, public.barbers, public.services to anon;
grant select on public.tenants, public.tenant_members, public.barbers, public.services to authenticated;
grant update on public.tenants to authenticated;
grant select, insert, update, delete on public.barbers, public.services to authenticated;
grant select, insert, update on public.clients to authenticated;
grant select, insert, update on public.appointments to authenticated;
grant select, insert, update, delete on public.appointment_services to authenticated;
