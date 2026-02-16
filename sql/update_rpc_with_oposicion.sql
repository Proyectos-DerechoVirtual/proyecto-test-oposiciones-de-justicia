-- Eliminar función anterior si existe
DROP FUNCTION IF EXISTS get_distinct_categoria_tema();

-- Crear nueva función RPC con 3 niveles: oposicion, categoria, tema
CREATE OR REPLACE FUNCTION get_distinct_oposicion_categoria_tema()
RETURNS TABLE (oposicion TEXT, categoria TEXT, tema INTEGER, subtema TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT q.oposicion, q.categoria, q.tema, q.subtema
  FROM questions_test q
  WHERE q.oposicion IS NOT NULL
  ORDER BY q.oposicion, q.categoria, q.tema;
END;
$$ LANGUAGE plpgsql;

-- Verificar que funciona
-- SELECT * FROM get_distinct_oposicion_categoria_tema();
