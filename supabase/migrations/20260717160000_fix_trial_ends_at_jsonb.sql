-- BUG CRÍTICO: criação de perfis a falhar em todas as bases onde a definição
-- "trial_period_days" já foi guardada.
--
-- system_settings.value é jsonb. A função set_default_trial_ends_at() (trigger
-- BEFORE INSERT em profiles) fazia `NULLIF(value, '')::int`, tratando value
-- como texto — o Postgres tenta então `''::jsonb`, que é JSON inválido e
-- aborta o INSERT. Resultado: o auth.users é criado mas o profiles não, e o
-- utilizador fica invisível (ex.: criar um Broker "não aparece na listagem").
--
-- Correção: extrair o inteiro do jsonb com `value #>> '{}'` (funciona quer o
-- valor esteja guardado como número `30` quer como string `"30"`).
--
-- Idempotente (create or replace).

create or replace function public.set_default_trial_ends_at()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare days int;
begin
  if new.trial_ends_at is null then
    select coalesce(nullif(value #>> '{}', '')::int, 30) into days
    from public.system_settings where key = 'trial_period_days';
    if days is null then days := 30; end if;
    new.trial_ends_at := now() + (days || ' days')::interval;
  end if;
  return new;
end;
$function$;
