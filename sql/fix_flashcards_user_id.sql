-- ============================================================
-- FIX: Cambiar user_id de UUID a TEXT para soportar Teachable IDs
-- ============================================================
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Eliminar las foreign keys existentes
ALTER TABLE public.flashcards DROP CONSTRAINT IF EXISTS flashcards_user_id_fkey;
ALTER TABLE public.generated_reports DROP CONSTRAINT IF EXISTS generated_reports_user_id_fkey;

-- 2. Cambiar el tipo de user_id a TEXT en generated_reports
ALTER TABLE public.generated_reports
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 3. Cambiar el tipo de user_id a TEXT en flashcards
ALTER TABLE public.flashcards
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 4. Actualizar las políticas RLS para usar el nuevo tipo
-- Primero eliminamos las políticas existentes
DROP POLICY IF EXISTS "Users can view their own reports" ON public.generated_reports;
DROP POLICY IF EXISTS "Users can insert their own reports" ON public.generated_reports;
DROP POLICY IF EXISTS "Users can update their own reports" ON public.generated_reports;
DROP POLICY IF EXISTS "Users can delete their own reports" ON public.generated_reports;

DROP POLICY IF EXISTS "Users can view their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can insert their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can update their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can delete their own flashcards" ON public.flashcards;

-- 5. Crear nuevas políticas más permisivas (sin FK a auth.users)
-- Para generated_reports
CREATE POLICY "Allow all operations on generated_reports"
  ON public.generated_reports FOR ALL
  USING (true)
  WITH CHECK (true);

-- Para flashcards
CREATE POLICY "Allow all operations on flashcards"
  ON public.flashcards FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. Comentarios actualizados
COMMENT ON COLUMN public.generated_reports.user_id IS 'Teachable user ID (texto, no UUID)';
COMMENT ON COLUMN public.flashcards.user_id IS 'Teachable user ID (texto, no UUID)';
