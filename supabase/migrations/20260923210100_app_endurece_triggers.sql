-- Ajustes apontados pelo Security Advisor nas funções de trigger do app:
--   * search_path fixo (function_search_path_mutable);
--   * funções de trigger não precisam ser chamadas pela API (/rest/v1/rpc).
alter function public.app_set_auditoria() set search_path = public;
alter function public.app_perfis_protege_sistema() set search_path = public;
revoke all on function public.app_set_auditoria() from public, anon, authenticated;
revoke all on function public.app_perfis_protege_sistema() from public, anon, authenticated;
revoke all on function public.app_usuarios_on_sign_in() from public, anon, authenticated;
