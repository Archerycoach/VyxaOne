-- Hoje a linha em daily_digest_settings só é criada quando o consultor visita
-- Definições — quem nunca visitou fica silenciosamente fora do resumo diário
-- automático. Passa a ser criada automaticamente para qualquer perfil novo,
-- com os mesmos valores por omissão já usados em Definições (todos definidos
-- a nível da coluna, por isso basta o INSERT sem valores explícitos).
CREATE OR REPLACE FUNCTION create_default_digest_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO daily_digest_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_digest_settings ON profiles;
CREATE TRIGGER on_profile_created_digest_settings
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_digest_settings();

-- Preenche retroativamente quem já é consultor mas nunca visitou Definições.
INSERT INTO daily_digest_settings (user_id)
SELECT p.id FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM daily_digest_settings d WHERE d.user_id = p.id)
ON CONFLICT (user_id) DO NOTHING;
