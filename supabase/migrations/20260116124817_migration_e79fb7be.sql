-- Drop and recreate the function with secure search_path
DROP FUNCTION IF EXISTS public.update_lead_columns_order(jsonb);

CREATE OR REPLACE FUNCTION public.update_lead_columns_order(columns_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
declare
  item jsonb;
begin
  for item in select * from jsonb_array_elements(columns_data)
  loop
    update lead_columns_config
    set column_order = (item->>'column_order')::int
    where column_key = (item->>'column_key')::text;
  end loop;
end;
$function$;