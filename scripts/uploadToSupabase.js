import { createClient } from '@supabase/supabase-js';
import { getAllQuestions } from './parseTests.js';

// Supabase credentials
const SUPABASE_URL = 'http://148.230.118.233:8000';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

// Create Supabase client with service key (admin privileges)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createTable() {
  console.log('\n📋 Creating table "questions" in Supabase...');

  // SQL to create the table
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
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

      -- Create index for faster queries
      CREATE INDEX IF NOT EXISTS idx_questions_tema ON questions(tema);
      CREATE INDEX IF NOT EXISTS idx_questions_categoria ON questions(categoria);
    `
  });

  if (error) {
    console.error('❌ Error creating table:', error.message);
    console.log('\n⚠️  Trying alternative method: direct table creation...');
    return false;
  }

  console.log('✅ Table created successfully');
  return true;
}

async function uploadQuestions() {
  console.log('\n📤 Starting upload to Supabase...\n');

  // Get all parsed questions
  const questions = getAllQuestions();
  console.log(`📊 Total questions to upload: ${questions.length}`);

  // Delete existing data
  console.log('\n🗑️  Clearing existing data...');
  const { error: deleteError } = await supabase
    .from('questions_test')
    .delete()
    .neq('id', 0); // Delete all records

  if (deleteError) {
    console.error('⚠️  Warning: Could not clear existing data:', deleteError.message);
  } else {
    console.log('✅ Existing data cleared');
  }

  // Upload in batches of 100
  const batchSize = 100;
  let uploaded = 0;
  let errors = 0;

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from('questions_test')
      .insert(batch);

    if (error) {
      console.error(`❌ Error uploading batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      errors += batch.length;
    } else {
      uploaded += batch.length;
      console.log(`✅ Uploaded batch ${Math.floor(i / batchSize) + 1}: ${uploaded}/${questions.length} questions`);
    }
  }

  console.log(`\n📊 Upload complete!`);
  console.log(`   ✅ Successfully uploaded: ${uploaded} questions`);
  if (errors > 0) {
    console.log(`   ❌ Failed: ${errors} questions`);
  }

  // Show summary by category
  console.log('\n📈 Summary by category:');
  const { data: summary } = await supabase
    .from('questions_test')
    .select('categoria, tema')
    .order('categoria');

  if (summary) {
    const categoryCounts = {};
    summary.forEach(q => {
      if (!categoryCounts[q.categoria]) {
        categoryCounts[q.categoria] = new Set();
      }
      categoryCounts[q.categoria].add(q.tema);
    });

    Object.keys(categoryCounts).sort().forEach(cat => {
      const temas = Array.from(categoryCounts[cat]).sort((a, b) => a - b);
      console.log(`   ${cat}: ${summary.filter(q => q.categoria === cat).length} questions (Temas: ${temas.join(', ')})`);
    });
  }
}

async function main() {
  console.log('🚀 Starting Supabase upload process...');
  console.log(`🔗 URL: ${SUPABASE_URL}`);

  // Try to create table (might fail if already exists, that's ok)
  await createTable();

  // Upload questions
  await uploadQuestions();

  console.log('\n✅ Process complete!\n');
}

main().catch(console.error);
