CREATE OR REPLACE FUNCTION public.health_ping()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT now() $$;

REVOKE ALL ON FUNCTION public.health_ping() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_ping() TO anon, authenticated, service_role;