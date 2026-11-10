-- Início do recebimento integral de uma fonte de renda (ex.: emprego novo).
alter table public.income_sources add column if not exists starts_on date;
