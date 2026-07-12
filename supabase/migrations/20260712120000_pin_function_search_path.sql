-- Hardening de segurança: fixar o search_path das funções SECURITY DEFINER.
-- Estas funções correm com os privilégios do dono (definer). Sem um
-- search_path fixo, um utilizador poderia criar um objeto (tabela/função)
-- num schema à frente no search_path e "sequestrar" uma referência não
-- qualificada usada dentro da função — um vetor clássico de escalonamento de
-- privilégios. ALTER FUNCTION ... SET search_path pina a resolução de nomes
-- SEM alterar o corpo da função (seguro, reversível, idempotente).
--
-- Usa-se "public, extensions" porque as funções tocam tabelas em public e,
-- eventualmente, funções de extensões (pgcrypto, pg_net) no schema
-- extensions. Referências a auth./cron./net. continuam qualificadas e não
-- são afetadas.

ALTER FUNCTION public.can_invite_user() SET search_path = public, extensions;
ALTER FUNCTION public.can_manage_user(target_user_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.get_current_user_role() SET search_path = public, extensions;
ALTER FUNCTION public.get_lead_statistics(start_date timestamp with time zone, end_date timestamp with time zone) SET search_path = public, extensions;
ALTER FUNCTION public.get_meta_sync_cron_info() SET search_path = public, extensions;
ALTER FUNCTION public.get_meta_sync_cron_status() SET search_path = public, extensions;
ALTER FUNCTION public.get_pipeline_overview() SET search_path = public, extensions;
ALTER FUNCTION public.get_property_statistics() SET search_path = public, extensions;
ALTER FUNCTION public.get_task_statistics() SET search_path = public, extensions;
ALTER FUNCTION public.get_team_agents() SET search_path = public, extensions;
ALTER FUNCTION public.get_user_role() SET search_path = public, extensions;
ALTER FUNCTION public.get_visible_users_with_details() SET search_path = public, extensions;
ALTER FUNCTION public.invoke_meta_leads_sync() SET search_path = public, extensions;
ALTER FUNCTION public.is_broker() SET search_path = public, extensions;
ALTER FUNCTION public.is_team_lead() SET search_path = public, extensions;
ALTER FUNCTION public.test_meta_sync() SET search_path = public, extensions;
ALTER FUNCTION public.test_role_visibility(test_role user_role) SET search_path = public, extensions;
ALTER FUNCTION public.update_user_role(target_user_id uuid, new_role user_role) SET search_path = public, extensions;
