-- Create table for questions
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  pregunta TEXT NOT NULL,
  opciones TEXT[] NOT NULL,
  respuesta_correcta INTEGER NOT NULL,
  explicacion_correcta TEXT,
  explicacion_errada TEXT,
  tema INTEGER NOT NULL,
  categoria TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_questions_tema ON questions(tema);
CREATE INDEX IF NOT EXISTS idx_questions_categoria ON questions(categoria);

-- Enable Row Level Security (RLS)
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access" ON questions
  FOR SELECT
  USING (true);

-- Create policy to allow service role full access
CREATE POLICY "Allow service role full access" ON questions
  FOR ALL
  USING (auth.role() = 'service_role');
