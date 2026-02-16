-- ============================================================
-- TABLAS PARA FLASHCARDS - TEST-OPOSICIONES
-- ============================================================
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. TABLA GENERATED_REPORTS (Mazos de flashcards)
-- Esta tabla almacena los "mazos" o conjuntos de flashcards
-- Cada mazo se genera a partir de un test fallado

CREATE TABLE IF NOT EXISTS public.generated_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_type text NOT NULL,
  storage_path text NOT NULL DEFAULT '',
  file_name text NOT NULL,
  test_result_id bigint NULL,
  questions_analyzed jsonb NULL,
  num_questions integer NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  user_email text NULL,
  report_title text NULL,
  CONSTRAINT generated_reports_pkey PRIMARY KEY (id),
  CONSTRAINT generated_reports_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT valid_report_type CHECK (
    report_type = ANY (ARRAY['infografia'::text, 'reporte_pdf'::text, 'flashcards'::text])
  )
) TABLESPACE pg_default;

-- Indices para generated_reports
CREATE INDEX IF NOT EXISTS idx_generated_reports_user
  ON public.generated_reports USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_generated_reports_created
  ON public.generated_reports USING btree (created_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_generated_reports_email
  ON public.generated_reports USING btree (user_email) TABLESPACE pg_default;


-- 2. TABLA FLASHCARDS (Tarjetas individuales)
-- Cada flashcard pertenece a un mazo (report_id) y a un usuario

CREATE TABLE IF NOT EXISTS public.flashcards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id uuid NULL,
  anverso text NOT NULL,
  reverso text NOT NULL,
  nivel integer NULL DEFAULT 0,
  repeticiones_correctas integer NULL DEFAULT 0,
  ultima_revision timestamp with time zone NULL,
  proxima_revision timestamp with time zone NULL DEFAULT now(),
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT flashcards_pkey PRIMARY KEY (id),
  CONSTRAINT flashcards_report_id_fkey FOREIGN KEY (report_id)
    REFERENCES public.generated_reports (id) ON DELETE CASCADE,
  CONSTRAINT flashcards_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Indices para flashcards
CREATE INDEX IF NOT EXISTS idx_flashcards_user
  ON public.flashcards USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_flashcards_report
  ON public.flashcards USING btree (report_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_flashcards_proxima
  ON public.flashcards USING btree (proxima_revision) TABLESPACE pg_default;


-- ============================================================
-- RLS (Row Level Security) - IMPORTANTE
-- ============================================================

-- Habilitar RLS en las tablas
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Politicas para generated_reports
CREATE POLICY "Users can view their own reports"
  ON public.generated_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reports"
  ON public.generated_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports"
  ON public.generated_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports"
  ON public.generated_reports FOR DELETE
  USING (auth.uid() = user_id);

-- Politicas para flashcards
CREATE POLICY "Users can view their own flashcards"
  ON public.flashcards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own flashcards"
  ON public.flashcards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flashcards"
  ON public.flashcards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flashcards"
  ON public.flashcards FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- COMENTARIOS DESCRIPTIVOS
-- ============================================================

COMMENT ON TABLE public.generated_reports IS 'Almacena mazos de flashcards y otros reportes generados';
COMMENT ON TABLE public.flashcards IS 'Tarjetas individuales de estudio con repeticion espaciada';

COMMENT ON COLUMN public.flashcards.nivel IS '0=nuevo, 1=fallo, 2=duda, 3=justo, 4=claro, 5=pro';
COMMENT ON COLUMN public.flashcards.repeticiones_correctas IS 'Contador de aciertos consecutivos para la curva de espaciado';
COMMENT ON COLUMN public.flashcards.proxima_revision IS 'Fecha calculada para la proxima revision segun el algoritmo de espaciado';
