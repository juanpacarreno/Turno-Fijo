-- ===========================================================================
-- Equipo de la barberia: socios (rol dueno) y barberos (rol barbero)
-- ---------------------------------------------------------------------------
-- Reemplaza el campo suelto `barbers.email_invitacion` por una tabla propia
-- de invitaciones, que sirve para los dos roles:
--
--   - socio  -> entra con rol 'dueno', acceso completo. Puede tener ficha de
--               barbero (si atiende) o no (si solo administra).
--   - barbero-> entra con rol 'barbero', ve solo sus turnos.
--
-- Ademas, `tenant_members` guarda el correo del miembro para poder listar el
-- equipo sin leer auth.users desde la aplicacion.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Correo del miembro, para el listado de equipo
-- ---------------------------------------------------------------------------
alter table public.tenant_members
  add column if not exists email text;

update public.tenant_members tm
   set email = u.email
  from auth.users u
 where u.id = tm.user_id
   and tm.email is null;

-- ---------------------------------------------------------------------------
-- invitaciones
-- ---------------------------------------------------------------------------
create table if not exists public.invitaciones (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  email       text not null
              check (
                char_length(email) <= 254
                and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
              ),
  rol         rol_miembro not null default 'barbero',
  -- Ficha de barbero que queda vinculada al aceptar. Obligatoria para el rol
  -- barbero; opcional para un socio que ademas atiende.
  barber_id   uuid references public.barbers(id) on delete cascade,
  creado_en   timestamptz not null default now(),
  creado_por  uuid references auth.users(id) on delete set null,
  constraint invitaciones_barbero_con_ficha
    check (rol = 'dueno' or barber_id is not null)
);

create unique index if not exists invitaciones_tenant_email_idx
  on public.invitaciones(tenant_id, lower(email));
create index if not exists invitaciones_email_idx on public.invitaciones(lower(email));
create index if not exists invitaciones_barber_idx on public.invitaciones(barber_id);

-- ---------------------------------------------------------------------------
-- Migracion de las invitaciones que vivian en la ficha del barbero
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'barbers'
      and column_name = 'email_invitacion'
  ) then
    insert into public.invitaciones (tenant_id, email, rol, barber_id)
    select b.tenant_id, lower(b.email_invitacion), 'barbero', b.id
    from public.barbers b
    where b.email_invitacion is not null
      and b.user_id is null
    on conflict do nothing;

    alter table public.barbers drop column email_invitacion;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Aceptacion: se ejecuta al terminar el ingreso con Google.
-- Compara contra el correo del token, nunca contra algo que mande el cliente.
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
    select i.* from public.invitaciones i where lower(i.email) = v_email
  loop
    -- La membresia no se pisa: si ya pertenece al salon, la invitacion solo
    -- se consume. Cambiar el rol de alguien es una accion explicita aparte.
    insert into public.tenant_members (tenant_id, user_id, rol, email)
    values (v_fila.tenant_id, v_uid, v_fila.rol, v_email)
    on conflict (tenant_id, user_id) do nothing;

    -- Vinculo con la ficha de barbero, si la invitacion traia una y sigue libre.
    if v_fila.barber_id is not null then
      update public.barbers
         set user_id = v_uid
       where id = v_fila.barber_id
         and user_id is null
         and not exists (
           select 1 from public.barbers x
           where x.tenant_id = v_fila.tenant_id and x.user_id = v_uid
         );
    end if;

    delete from public.invitaciones where id = v_fila.id;
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$fn$;
revoke all on function public.aceptar_invitaciones() from public;
grant execute on function public.aceptar_invitaciones() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS de invitaciones: solo el dueno del salon las ve y las administra.
-- El invitado no necesita leerlas: la aceptacion pasa por la funcion de
-- arriba, que corre con privilegios propios.
-- ---------------------------------------------------------------------------
alter table public.invitaciones enable row level security;
alter table public.invitaciones force row level security;

drop policy if exists invitaciones_duenio_lectura on public.invitaciones;
create policy invitaciones_duenio_lectura on public.invitaciones
  for select to authenticated
  using (public.es_duenio_del_tenant(tenant_id));

drop policy if exists invitaciones_duenio_alta on public.invitaciones;
create policy invitaciones_duenio_alta on public.invitaciones
  for insert to authenticated
  with check (public.es_duenio_del_tenant(tenant_id));

drop policy if exists invitaciones_duenio_baja on public.invitaciones;
create policy invitaciones_duenio_baja on public.invitaciones
  for delete to authenticated
  using (public.es_duenio_del_tenant(tenant_id));

grant select, insert, delete on public.invitaciones to authenticated;

-- ---------------------------------------------------------------------------
-- Quitar acceso a un miembro. El dueno puede sacar a otro, nunca a si mismo;
-- el trigger de abajo impide que el salon se quede sin ningun dueno.
-- ---------------------------------------------------------------------------
drop policy if exists tenant_members_duenio_baja on public.tenant_members;
create policy tenant_members_duenio_baja on public.tenant_members
  for delete to authenticated
  using (
    public.es_duenio_del_tenant(tenant_id)
    and user_id <> (select auth.uid())
  );

grant delete on public.tenant_members to authenticated;

create or replace function public.proteger_ultimo_duenio()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if old.rol = 'dueno' and not exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = old.tenant_id
      and tm.rol = 'dueno'
      and tm.user_id <> old.user_id
  ) then
    raise exception 'La barberia no puede quedarse sin duenos';
  end if;
  return old;
end;
$fn$;

drop trigger if exists tenant_members_ultimo_duenio on public.tenant_members;
create trigger tenant_members_ultimo_duenio
  before delete on public.tenant_members
  for each row execute function public.proteger_ultimo_duenio();

-- Al quitar a alguien del equipo, su ficha de barbero queda libre para
-- volver a invitar.
create or replace function public.liberar_ficha_de_barbero()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  update public.barbers
     set user_id = null
   where tenant_id = old.tenant_id
     and user_id = old.user_id;
  return old;
end;
$fn$;

drop trigger if exists tenant_members_libera_ficha on public.tenant_members;
create trigger tenant_members_libera_ficha
  after delete on public.tenant_members
  for each row execute function public.liberar_ficha_de_barbero();
