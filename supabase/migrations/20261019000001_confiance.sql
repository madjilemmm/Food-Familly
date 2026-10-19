-- Confiance : codes famille protégés et invitations par lien.
-- Ajouts seulement : rien n'est supprimé ni transformé. Peut être relancé sans risque.

-- Les essais de code ratés, par appareil (adresse IP hachée, jamais stockée en clair) :
-- au-delà de quelques essais, il faut attendre avant de réessayer.
create table if not exists public.essais_code (
  id          uuid primary key default gen_random_uuid(),
  cle         text not null,
  created_at  timestamptz not null default now()
);
create index if not exists essais_code_cle_idx on public.essais_code(cle, created_at desc);

-- Les liens d'invitation : valables 7 jours, puis il faut en demander un nouveau.
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  jeton       text not null unique,
  created_by  uuid references public.profiles(id) on delete set null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists invitations_family_idx on public.invitations(family_id, expires_at desc);

alter table public.essais_code enable row level security;
alter table public.invitations enable row level security;
revoke all on public.essais_code, public.invitations from anon, authenticated;
grant all on public.essais_code, public.invitations to service_role;
