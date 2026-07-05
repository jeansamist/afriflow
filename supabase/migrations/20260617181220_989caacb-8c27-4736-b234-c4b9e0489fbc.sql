
-- =============================================================================
-- SPRINT 0 — AfriFlow / OS-AFRICA : Schéma de données (Section 11 du blueprint)
-- =============================================================================

-- Extensions
-- uuid_generate_v4() replaced with gen_random_uuid() (native PG13+, no extension needed)

-- =========================
-- ENUMS (machines d'états)
-- =========================
create type public.user_status_type as enum ('PENDING_EMAIL_VALIDATION', 'ACTIVE', 'SUSPENDED');
create type public.kyc_status_type  as enum ('NOT_SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
create type public.payment_status_type as enum ('GENERATED', 'PAID', 'EXPIRED', 'CANCELLED');
create type public.ledger_entry_type as enum ('DEBIT', 'CREDIT');
create type public.dossier_status_type as enum ('OPEN', 'IN_PROGRESS', 'WAITING_CLIENT', 'CLOSED', 'ARCHIVED');

-- ===============================================
-- 1. PROFILES  (lié à auth.users)
-- ===============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  first_name text,
  last_name text,
  country_iso text check (country_iso is null or char_length(country_iso) = 2),
  mobile_money_number text,
  status public.user_status_type not null default 'PENDING_EMAIL_VALIDATION',
  kyc_status public.kyc_status_type not null default 'NOT_SUBMITTED',
  allocated_phone_number text unique,
  is_frozen boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Profil lisible par son propriétaire"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Profil modifiable par son propriétaire"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "Profil inserté par son propriétaire"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- ===============================================
-- 2. PAYMENT_LINKS
-- ===============================================
create table public.payment_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  description text not null,
  status public.payment_status_type not null default 'GENERATED',
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text unique,
  hosted_url text,
  dossier_id uuid,
  client_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index payment_links_user_id_idx on public.payment_links(user_id);
create index payment_links_status_idx on public.payment_links(status);

grant select, insert, update, delete on public.payment_links to authenticated;
grant all on public.payment_links to service_role;
-- Lecture publique d'un lien spécifique = via server function (pas d'anon select).

alter table public.payment_links enable row level security;

create policy "Liens de paiement gérés par leur propriétaire"
  on public.payment_links for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===============================================
-- 3. LEDGER_ENTRIES (grand livre immuable)
-- ===============================================
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null,
  entry_type public.ledger_entry_type not null,
  reference_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index ledger_entries_user_id_idx on public.ledger_entries(user_id);
create index ledger_entries_created_at_idx on public.ledger_entries(created_at desc);

grant select on public.ledger_entries to authenticated;
grant all on public.ledger_entries to service_role;

alter table public.ledger_entries enable row level security;

create policy "Écritures lisibles par leur propriétaire"
  on public.ledger_entries for select to authenticated
  using (auth.uid() = user_id);
-- INSERT/UPDATE/DELETE réservés au service_role (immuabilité côté utilisateur).

-- ===============================================
-- 4. CALL_LOGS
-- ===============================================
create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  twilio_call_sid text unique not null,
  from_number text not null,
  to_number text not null,
  direction text not null check (direction in ('INBOUND', 'OUTBOUND')),
  status text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  cost_credits numeric(10,4) not null default 0.0000,
  recording_url text,
  dossier_id uuid,
  client_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create index call_logs_user_id_idx on public.call_logs(user_id);
create index call_logs_created_at_idx on public.call_logs(created_at desc);

grant select on public.call_logs to authenticated;
grant all on public.call_logs to service_role;

alter table public.call_logs enable row level security;

create policy "Appels lisibles par leur propriétaire"
  on public.call_logs for select to authenticated
  using (auth.uid() = user_id);

-- ===============================================
-- 5. CRM_CLIENTS
-- ===============================================
create table public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_name text,
  contact_name text not null,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index crm_clients_user_id_idx on public.crm_clients(user_id);

grant select, insert, update, delete on public.crm_clients to authenticated;
grant all on public.crm_clients to service_role;

alter table public.crm_clients enable row level security;

create policy "Clients CRM gérés par leur propriétaire"
  on public.crm_clients for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===============================================
-- 6. DOSSIERS (objet pivot CRM — Architecture IA)
-- ===============================================
create table public.dossiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete set null,
  title text not null,
  description text,
  status public.dossier_status_type not null default 'OPEN',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index dossiers_user_id_idx on public.dossiers(user_id);
create index dossiers_client_id_idx on public.dossiers(client_id);

grant select, insert, update, delete on public.dossiers to authenticated;
grant all on public.dossiers to service_role;

alter table public.dossiers enable row level security;

create policy "Dossiers gérés par leur propriétaire"
  on public.dossiers for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- FK croisées (après création de dossiers)
alter table public.payment_links
  add constraint payment_links_dossier_fk
  foreign key (dossier_id) references public.dossiers(id) on delete set null,
  add constraint payment_links_client_fk
  foreign key (client_id) references public.crm_clients(id) on delete set null;

alter table public.call_logs
  add constraint call_logs_dossier_fk
  foreign key (dossier_id) references public.dossiers(id) on delete set null,
  add constraint call_logs_client_fk
  foreign key (client_id) references public.crm_clients(id) on delete set null;

-- ===============================================
-- TRIGGERS — updated_at + profil auto à l'inscription
-- ===============================================
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_payment_links_updated_at
  before update on public.payment_links
  for each row execute function public.set_updated_at();

create trigger trg_crm_clients_updated_at
  before update on public.crm_clients
  for each row execute function public.set_updated_at();

create trigger trg_dossiers_updated_at
  before update on public.dossiers
  for each row execute function public.set_updated_at();

-- Création automatique d'un profil au signup
create or replace function public.handle_new_user()
returns trigger language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
