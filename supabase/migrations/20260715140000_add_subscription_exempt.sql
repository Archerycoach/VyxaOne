-- Permite ao admin isentar um utilizador de trial/subscrição (acesso permanente).
-- Usado pelo SubscriptionGuard: se subscription_exempt = true, o utilizador tem
-- sempre acesso, tal como um admin. Idempotente.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.subscription_exempt IS
  'Se true, o utilizador tem acesso permanente sem necessitar de trial/subscrição (isento pelo admin).';
