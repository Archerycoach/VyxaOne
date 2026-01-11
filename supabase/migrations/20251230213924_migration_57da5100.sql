-- Adicionar campos de imagens à tabela properties (se não existirem)
DO $$
BEGIN
  -- Imagem principal
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'main_image_url'
  ) THEN
    ALTER TABLE properties ADD COLUMN main_image_url TEXT;
  END IF;
  
  -- Array de imagens adicionais
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'images'
  ) THEN
    ALTER TABLE properties ADD COLUMN images TEXT[];
  END IF;
END $$;