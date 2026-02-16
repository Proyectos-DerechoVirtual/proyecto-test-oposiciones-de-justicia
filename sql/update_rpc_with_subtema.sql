-- Actualizar la función RPC para incluir subtema
-- Ejecuta este SQL en el SQL Editor de Supabase

DROP FUNCTION IF EXISTS get_distinct_categoria_tema();

CREATE OR REPLACE FUNCTION get_distinct_categoria_tema()
RETURNS TABLE (categoria TEXT, tema INTEGER, subtema TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT q.categoria, q.tema, q.subtema
  FROM questions_test q
  ORDER BY q.categoria, q.tema;
END;
$$ LANGUAGE plpgsql;
