-- Tabla para mapear course_id de Teachable → oposicion
CREATE TABLE public.course_oposicion_mapping_test (
  id SERIAL PRIMARY KEY,
  course_id TEXT NOT NULL UNIQUE,
  course_name TEXT,
  oposicion TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_course_id_test ON course_oposicion_mapping_test(course_id);

-- Ejemplo: Insertar tus cursos de Teachable
-- REEMPLAZA con los IDs reales de tus cursos
-- Para encontrar el course_id:
-- 1. Ve a Teachable admin → Courses
-- 2. La URL es: https://derechovirtual.teachable.com/admin-app/courses/COURSE_ID/...
-- 3. COURSE_ID es el número en la URL

INSERT INTO course_oposicion_mapping_test (course_id, course_name, oposicion) VALUES
  ('2895236', 'Curso Principal', 'Oposicion Justicia');

-- Añade más cursos según necesites:
-- ('OTRO_ID', 'Nombre del Curso', 'Oposicion Correspondiente');
