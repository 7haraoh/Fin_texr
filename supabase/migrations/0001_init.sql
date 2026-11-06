-- FINANCE OS — esquema inicial
-- Todos os dados são isolados por usuário via Row Level Security (RLS).
-- Execute no SQL Editor do Supabase ou com `supabase db push`.

create extension if not exists "pgcrypto";

-- ============================================================
-- Perfil
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  risk_profile text check (risk_profile in ('conservador','moderado','arrojado')),
  -- Estilo de vida e comportamento (preenchido progressivamente)
  lifestyle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Renda
-- ============================================================
create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type text not null default 'salario'
    check (type in ('salario','beneficio','freelance','aluguel','investimento','outro')),
  gross_amount numeric(14,2) check (gross_amount >= 0),
  net_amount numeric(14,2) not null check (net_amount >= 0),
  frequency text not null default 'mensal'
    check (frequency in ('mensal','quinzenal','semanal','anual','eventual')),
  stability text not null default 'estavel'
    check (stability in ('estavel','variavel','incerta')),
  pay_day smallint check (pay_day between 1 and 31),
  expected_change_pct numeric(6,2),
  expected_change_date date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Patrimônio (saldos/valores — estoque, não fluxo)
-- ============================================================
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type text not null
    check (type in ('conta','especie','poupanca','investimento','imovel','veiculo','outro')),
  value numeric(14,2) not null check (value >= 0),
  institution text,
  is_emergency_reserve boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Obrigações: empréstimos, financiamentos, parcelamentos, contas
-- ============================================================
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type text not null
    check (type in ('emprestimo','financiamento','parcelamento','cheque_especial','outro')),
  outstanding_balance numeric(14,2) not null default 0 check (outstanding_balance >= 0),
  monthly_payment numeric(14,2) not null default 0 check (monthly_payment >= 0),
  interest_rate_monthly numeric(7,4), -- % ao mês
  remaining_installments integer check (remaining_installments >= 0),
  due_day smallint check (due_day between 1 and 31),
  is_late boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  -- Saldo de faturas anteriores ao início do uso do app (opcional)
  carried_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Categorias
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  group_name text not null,
  -- Finalidade orçamentária
  bucket text not null default 'pessoais'
    check (bucket in ('essenciais','pessoais','lazer','financeiro')),
  essential_default boolean not null default false,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, group_name, name)
);

-- ============================================================
-- Lançamentos
-- kind = 'expense'      → consumo (compra no cartão entra na data da compra)
-- kind = 'income'       → entrada de dinheiro
-- kind = 'card_payment' → pagamento de fatura: movimenta caixa, NÃO é consumo
-- ============================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'expense' check (kind in ('expense','income','card_payment')),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  category_id uuid references public.categories (id) on delete set null,
  occurred_on date not null,
  payment_method text not null default 'pix'
    check (payment_method in ('pix','debito','credito','dinheiro','boleto','transferencia')),
  card_id uuid references public.credit_cards (id) on delete set null,
  installments smallint not null default 1 check (installments between 1 and 72),
  is_essential boolean not null default false,
  recurrence text not null default 'nenhuma'
    check (recurrence in ('nenhuma','semanal','mensal','anual')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_required_for_credit check (payment_method <> 'credito' or card_id is not null or kind <> 'expense')
);
create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);

-- ============================================================
-- Orçamento
-- ============================================================
create table public.budget_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null, -- primeiro dia do mês
  -- { essenciais, pessoais, lazer, reserva, investimentos, metas_curto, metas_longo }
  allocations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create table public.category_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  monthly_limit numeric(14,2) not null check (monthly_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id)
);

-- ============================================================
-- Metas
-- ============================================================
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type text not null default 'outro'
    check (type in ('reserva','veiculo','imovel','viagem','equipamento','quitar_divida','investimento','independencia','outro')),
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  deadline date,
  priority smallint not null default 2 check (priority between 1 and 3), -- 1 = alta
  monthly_contribution numeric(14,2) not null default 0 check (monthly_contribution >= 0),
  horizon text not null default 'curto' check (horizon in ('curto','longo')),
  status text not null default 'ativa' check (status in ('ativa','pausada','concluida')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Fotografias mensais (evolução patrimonial registrada)
-- ============================================================
create table public.monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null,
  net_worth numeric(14,2) not null,
  liquid_assets numeric(14,2) not null,
  emergency_reserve numeric(14,2) not null,
  total_debt numeric(14,2) not null,
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

-- ============================================================
-- Conversas com o consultor
-- ============================================================
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_user_idx on public.chat_messages (user_id, created_at);

-- ============================================================
-- Histórico de alterações (auditoria)
-- ============================================================
create table public.audit_log (
  id bigint generated always as identity primary key,
  -- sem FK: as linhas são removidas explicitamente em delete_my_account()
  user_id uuid not null,
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz not null default now()
);
create index audit_log_user_idx on public.audit_log (user_id, changed_at desc);

-- ============================================================
-- Funções e gatilhos
-- ============================================================
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.write_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  -- Exclusão em cascata da conta: não registrar histórico de um usuário removido
  if tg_op = 'DELETE' and not exists (select 1 from auth.users u where u.id = (rec->>'user_id')::uuid) then
    return null;
  end if;
  insert into public.audit_log (user_id, table_name, record_id, action, old_data, new_data)
  values (
    coalesce((rec->>'user_id')::uuid, (rec->>'id')::uuid),
    tg_table_name,
    (rec->>'id')::uuid,
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','income_sources','assets','debts','credit_cards','categories',
    'transactions','budget_plans','category_limits','goals'
  ] loop
    execute format('create trigger %I_touch before update on public.%I
                    for each row execute function public.touch_updated_at()', t, t);
  end loop;
  foreach t in array array[
    'income_sources','assets','debts','credit_cards','transactions','budget_plans','category_limits','goals'
  ] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I
                    for each row execute function public.write_audit_log()', t, t);
  end loop;
end $$;

-- Garante que categoria/cartão referenciados pertencem ao mesmo usuário
create or replace function public.check_transaction_refs() returns trigger
language plpgsql as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id) then
    raise exception 'categoria inválida';
  end if;
  if new.card_id is not null and not exists (
    select 1 from public.credit_cards c where c.id = new.card_id and c.user_id = new.user_id) then
    raise exception 'cartão inválido';
  end if;
  return new;
end $$;
create trigger transactions_check_refs before insert or update on public.transactions
  for each row execute function public.check_transaction_refs();

create or replace function public.check_category_limit_refs() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id) then
    raise exception 'categoria inválida';
  end if;
  return new;
end $$;
create trigger category_limits_check_refs before insert or update on public.category_limits
  for each row execute function public.check_category_limit_refs();

-- Exclusão permanente da conta e de todos os dados do próprio usuário
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'não autenticado';
  end if;
  delete from auth.users where id = uid;   -- remove em cascata todas as tabelas
  delete from public.audit_log where user_id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Novo usuário: cria perfil e categorias iniciais
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');

  insert into public.categories (user_id, group_name, name, bucket, essential_default) values
    (new.id,'Moradia','Aluguel','essenciais',true),
    (new.id,'Moradia','Condomínio','essenciais',true),
    (new.id,'Moradia','Energia','essenciais',true),
    (new.id,'Moradia','Água','essenciais',true),
    (new.id,'Moradia','Internet','essenciais',true),
    (new.id,'Moradia','Manutenção','essenciais',true),
    (new.id,'Alimentação','Supermercado','essenciais',true),
    (new.id,'Alimentação','Restaurantes','lazer',false),
    (new.id,'Alimentação','Delivery','lazer',false),
    (new.id,'Alimentação','Lanches','lazer',false),
    (new.id,'Transporte','Combustível','essenciais',true),
    (new.id,'Transporte','Manutenção do veículo','essenciais',true),
    (new.id,'Transporte','Seguro','essenciais',true),
    (new.id,'Transporte','Transporte por aplicativo','pessoais',false),
    (new.id,'Pessoal','Roupas','pessoais',false),
    (new.id,'Pessoal','Academia','pessoais',false),
    (new.id,'Pessoal','Beleza','pessoais',false),
    (new.id,'Pessoal','Higiene','essenciais',true),
    (new.id,'Pessoal','Saúde','essenciais',true),
    (new.id,'Lazer','Viagens','lazer',false),
    (new.id,'Lazer','Passeios','lazer',false),
    (new.id,'Lazer','Jogos','lazer',false),
    (new.id,'Lazer','Streaming','lazer',false),
    (new.id,'Lazer','Entretenimento','lazer',false),
    (new.id,'Financeiro','Investimentos','financeiro',false),
    (new.id,'Financeiro','Empréstimos','financeiro',true),
    (new.id,'Financeiro','Juros','financeiro',true),
    (new.id,'Financeiro','Tarifas','financeiro',true),
    (new.id,'Financeiro','Impostos','financeiro',true);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
create policy "profiles_own" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'income_sources','assets','debts','credit_cards','categories','transactions',
    'budget_plans','category_limits','goals','chat_messages','monthly_snapshots'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_own', t);
  end loop;
end $$;

-- Histórico: somente leitura para o dono; escrita apenas via gatilho
alter table public.audit_log enable row level security;
create policy "audit_log_read_own" on public.audit_log
  for select using (user_id = auth.uid());
