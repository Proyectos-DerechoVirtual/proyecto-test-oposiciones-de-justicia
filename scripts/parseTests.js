import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseTestFile(content, tema, categoria) {
  const questions = [];
  const blocks = content.split('###').filter(b => b.trim());

  blocks.forEach((block, index) => {
    const lines = block.trim().split('\n').filter(l => l.trim());

    if (lines.length < 7) return; // Skip incomplete blocks

    // Parse question
    const preguntaLine = lines.find(l => l.startsWith('Pregunta:'));
    if (!preguntaLine) return;
    const pregunta = preguntaLine.replace('Pregunta:', '').trim();

    // Parse options
    const opciones = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(\d+)\)(.*)/);
      if (match) {
        opciones.push(match[2].trim());
      }
    }

    // Parse correct answer
    const respuestaLine = lines.find(l => l.startsWith('Respuesta:'));
    if (!respuestaLine) return;
    const respuestaCorrecta = parseInt(respuestaLine.replace('Respuesta:', '').trim());

    // Parse explanations
    const correctaLine = lines.find(l => l.startsWith('Correcta:'));
    const erradaLine = lines.find(l => l.startsWith('Errada:'));

    const explicacionCorrecta = correctaLine ? correctaLine.replace('Correcta:', '').trim() : '';
    const explicacionErrada = erradaLine ? erradaLine.replace('Errada:', '').trim() : '';

    if (pregunta && opciones.length === 4 && respuestaCorrecta) {
      questions.push({
        pregunta,
        opciones,
        respuesta_correcta: respuestaCorrecta - 1, // Convert to 0-based index
        explicacion_correcta: explicacionCorrecta,
        explicacion_errada: explicacionErrada,
        tema,
        categoria
      });
    }
  });

  return questions;
}

function getAllQuestions() {
  const allQuestions = [];
  const testDir = path.join(__dirname, '..', 'Test');

  // Get all category folders (Gestión 1, 2, 3)
  const categorias = fs.readdirSync(testDir).filter(f => {
    const fullPath = path.join(testDir, f);
    return fs.statSync(fullPath).isDirectory();
  });

  categorias.forEach(categoria => {
    const categoriaPath = path.join(testDir, categoria);
    const files = fs.readdirSync(categoriaPath).filter(f => f.endsWith('.txt'));

    files.forEach(file => {
      // Match both formats: "test_tema_7.txt" and "Test tema 17 corregido.txt"
      let match = file.match(/test_tema_(\d+)\.txt/i);
      if (!match) {
        match = file.match(/Test tema (\d+)/i);
      }

      if (match) {
        const tema = parseInt(match[1]);
        const filePath = path.join(categoriaPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const questions = parseTestFile(content, tema, categoria);
        allQuestions.push(...questions);
        console.log(`  ✓ Parsed ${file}: ${questions.length} questions`);
      }
    });
  });

  return allQuestions;
}

// Parse all questions
const questions = getAllQuestions();
console.log(`✅ Parsed ${questions.length} questions from all test files`);

// Save to JSON for review
const outputPath = path.join(__dirname, 'parsed_questions.json');
fs.writeFileSync(outputPath, JSON.stringify(questions, null, 2));
console.log(`📄 Saved to: ${outputPath}`);

export { getAllQuestions };
