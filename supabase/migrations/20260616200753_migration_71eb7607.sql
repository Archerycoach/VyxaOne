ALTER TABLE public.subscription_plans
DROP CONSTRAINT IF EXISTS subscription_plans_billing_interval_check;

ALTER TABLE public.subscription_plans
ADD CONSTRAINT subscription_plans_billing_interval_check
CHECK (
  billing_interval IS NULL
  OR billing_interval = ANY (ARRAY['monthly'::text, 'semiannual'::text, 'yearly'::text])
);