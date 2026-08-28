-- ===========================================================================
-- Cuentas de barbero
-- ---------------------------------------------------------------------------
-- El dueno invita a un barbero cargando su correo en la ficha del barbero.
-- Cuando esa persona entra con Google, su usuario queda vinculado a esa ficha
-- y se le crea la membresia con rol 'barbero'.
--
-- Un barbero SOLO puede:
--   - ver los turnos donde el barbero asignado es el;
--   - marcarlos completados, cargar adicionales del catalogo y registrar pago;
--   - ver la ficha de los clientes que atiende el.
-- No ve la caja del mes, ni la lista completa de clientes, ni puede tocar
-- precios, servicios ni barberos. Eso queda solo para el rol 'dueno'.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Vinculo entre la ficha del barbero y su usuario
-- ---------------------------------------------------------------------------
alter table public.barbers
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.barbers
  add column if not exists email_invitacion text;

do $$ begin
  alter table public.barbers
    add constraint barbers_email_invitacion_valido
    check (
      email_invitacion is null
      or (char_length(email_invitacion) <= 254 and email_invitacion ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    );
exception when duplicate_object then null; end $$;

-- Un usuario ocupa a lo sumo un sillon por barberia.
create unique index if not exists barbers_tenant_user_idx
  on public.barbers(tenant_id, user_id)
  where user_id is not null;

-- Busqueda de invitaciones pendientes por correo.
create index if not exists barbers_invitacion_idx
  on public.barbers(lower(email_invitacion))
  where email_invitacion is not null and user_id is null;

-- ---------------------------------------------------------------------------
-- Helpers de rol. SECURITY DEFINER con search_path fijo, igual que los del
-- esquema inicial: evitan recursion de politicas y secuestro de esquema.
-- ---------------------------------------------------------------------------
create or replace function public.es_duenio_del_tenant(p_tenant uuid)
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
      and tm.rol = 'dueno'
  );
$fn$;
revoke all on function public.es_duenio_del_tenant(uuid) from public;
grant execute on function public.es_duenio_del_tenant(uuid) to authenticated;

/** Ficha de barbero vinculada al usuario actual dentro de una barberia. */
create or replace function public.mi_barber_id(p_tenant uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select b.id
  from public.barbers b
  where b.tenant_id = p_tenant
    and b.user_id = (select auth.uid())
  limit 1;
$fn$;
revoke all on function public.mi_barber_id(uuid) from public;
grant execute on function public.mi_barber_id(uuid) to authenticated;

/** Dueno de la barberia, o el barbero al que pertenece el turno. */
create or replace function public.puede_operar_turno(p_tenant uuid, p_barber uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select public.es_duenio_del_tenant(p_tenant)
      or p_barber = public.mi_barber_id(p_tenant);
$fn$;
revoke all on function public.puede_operar_turno(uuid, uuid) from public;
grant execute on function public.puede_operar_turno(uuid, uuid) to authenticated;

/** Igual que la anterior, resolviendo el turno por su id. */
create or replace function public.puede_operar_turno_por_id(p_appointment uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
    from public.appointments a
    where a.id = p_appointment
      and public.puede_operar_turno(a.tenant_id, a.barber_id)
  );
$fn$;
revoke all on function public.puede_operar_turno_por_id(uuid) from public;
grant execute on function public.puede_operar_turno_por_id(uuid) to authenticated;

/** El dueno ve todas las fichas; el barbero, solo las de sus clientes. */
create or replace function public.puede_ver_cliente(p_client uuid, p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select public.es_duenio_del_tenant(p_tenant)
      or exists (
        select 1
        from public.appointments a
        where a.client_id = p_client
          and a.barber_id = public.mi_barber_id(p_tenant)
      );
$fn$;
revoke all on function public.puede_ver_cliente(uuid, uuid) from public;
grant execute on function public.puede_ver_cliente(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Aceptacion de invitaciones
-- Se ejecuta al terminar el ingreso con Google. Vincula al usuario con toda
-- ficha de barbero que tenga su correo cargado y todavia no tenga cuenta.
-- ---------------------------------------------------------------------------
create or replace function public.aceptar_invitaciones()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid   uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_fila  record;
  v_total integer := 0;
begin
  if v_uid is null or v_email = '' then
    return 0;
  end if;

  for v_fila in
    select b.id, b.tenant_id
    from public.barbers b
    where b.user_id is null
      and b.email_invitacion is not null
      and lower(b.email_invitacion) = v_email
      and b.activo
  loop
    -- Si ya ocupa un sillon en ese salon, la invitacion se ignora.
    if exists (
      select 1 from public.barbers x
      where x.tenant_id = v_fila.tenant_id and x.user_id = v_uid
    ) then
      continue;
    end if;

    update public.barbers
       set user_id = v_uid,
           email_invitacion = null
     where id = v_fila.id;

    insert into public.tenant_members (tenant_id, user_id, rol)
    values (v_fila.tenant_id, v_uid, 'barbero')
    on conflict (tenant_id, user_id) do nothing;

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$fn$;
revoke all on function public.aceptar_invitaciones() from public;
grant execute on function public.aceptar_invitaciones() to authenticated;

-- ===========================================================================
-- POLITICAS: se reemplazan las que trataban a todo miembro como dueno
-- ===========================================================================

-- --- tenants: solo el dueno edita los datos del salon ----------------------
drop policy if exists tenants_update_miembro on public.tenants;
create policy tenants_update_duenio on public.tenants
  for update to authenticated
  using (public.es_duenio_del_tenant(id))
  with check (public.es_duenio_del_tenant(id));

-- --- barbers: solo el dueno da de alta, edita o da de baja -----------------
drop policy if exists barbers_miembro_insert on public.barbers;
create policy barbers_duenio_insert on public.barbers
  for insert to authenticated
  with check (public.es_duenio_del_tenant(tenant_id));

drop policy if exists barbers_miembro_update on public.barbers;
create policy barbers_duenio_update on public.barbers
  for update to authenticated
  using (public.es_duenio_del_tenant(tenant_id))
  with check (public.es_duenio_del_tenant(tenant_id));

drop policy if exists barbers_miembro_delete on public.barbers;
create policy barbers_duenio_delete on public.barbers
  for delete to authenticated
  using (public.es_duenio_del_tenant(tenant_id));

-- La lectura sigue abierta a todo miembro: el barbero necesita ver los
-- nombres del salon en la agenda.

-- --- services: el barbero lee el catalogo (lo necesita para los
-- --- adicionales), pero no lo modifica -------------------------------------
drop policy if exists services_miembro_insert on public.services;
create policy services_duenio_insert on public.services
  for insert to authenticated
  with check (public.es_duenio_del_tenant(tenant_id));

drop policy if exists services_miembro_update on public.services;
create policy services_duenio_update on public.services
  for update to authenticated
  using (public.es_duenio_del_tenant(tenant_id))
  with check (public.es_duenio_del_tenant(tenant_id));

drop policy if exists services_miembro_delete on public.services;
create policy services_duenio_delete on public.services
  for delete to authenticated
  using (public.es_duenio_del_tenant(tenant_id));

-- --- clients: el barbero solo ve a quienes atiende -------------------------
drop policy if exists clients_lectura_propia on public.clients;
create policy clients_lectura on public.clients
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.puede_ver_cliente(id, tenant_id)
  );

-- --- appointments: el barbero solo ve y opera los suyos --------------------
drop policy if exists appointments_lectura on public.appointments;
create policy appointments_lectura on public.appointments
  for select to authenticated
  using (
    public.puede_operar_turno(tenant_id, barber_id)
    or client_id in (select public.mis_client_ids())
  );

drop policy if exists appointments_update_miembro on public.appointments;
create policy appointments_update_operador on public.appointments
  for update to authenticated
  using (public.puede_operar_turno(tenant_id, barber_id))
  with check (public.puede_operar_turno(tenant_id, barber_id));

-- --- appointment_services: idem, atado al turno ----------------------------
drop policy if exists appointment_services_lectura on public.appointment_services;
create policy appointment_services_lectura on public.appointment_services
  for select to authenticated
  using (
    public.puede_operar_turno_por_id(appointment_id)
    or exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and a.client_id in (select public.mis_client_ids())
    )
  );

drop policy if exists appointment_services_miembro_insert on public.appointment_services;
create policy appointment_services_operador_insert on public.appointment_services
  for insert to authenticated
  with check (public.puede_operar_turno_por_id(appointment_id));

drop policy if exists appointment_services_miembro_update on public.appointment_services;
create policy appointment_services_operador_update on public.appointment_services
  for update to authenticated
  using (public.puede_operar_turno_por_id(appointment_id))
  with check (public.puede_operar_turno_por_id(appointment_id));

drop policy if exists appointment_services_miembro_delete on public.appointment_services;
create policy appointment_services_operador_delete on public.appointment_services
  for delete to authenticated
  using (public.puede_operar_turno_por_id(appointment_id));
