-- Fix 1: Add the missing foreign key relationship between subscriptions and subscription_plans
ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_plan_id_fkey 
FOREIGN KEY (plan_id) 
REFERENCES subscription_plans(id) 
ON DELETE SET NULL;