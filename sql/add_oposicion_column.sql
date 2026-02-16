-- Añadir columna 'oposicion' a la tabla questions_test
ALTER TABLE public.questions_test ADD COLUMN IF NOT EXISTS oposicion TEXT;

-- Crear índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_questions_oposicion ON public.questions_test USING btree (oposicion);

-- Actualizar registros existentes con valor por defecto
UPDATE public.questions_test
SET oposicion = 'General'
WHERE oposicion IS NULL;
