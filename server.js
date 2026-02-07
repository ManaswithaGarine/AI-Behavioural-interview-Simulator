const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory sessions storage (no DB). Keyed by sessionId.
const sessions = {};

// Predefined behavioural questions (3-5 as requested).
const QUESTIONS = [
  "Tell me about a time you faced a conflict while working on a team. How did you handle it?",
  "Describe a project where you had to learn something quickly to complete a task. What did you do?",
  "Give an example of a goal you set that you didn't meet. What happened and what did you learn?",
  "Tell me about a time you took the lead on a difficult problem. What actions did you take?",
  "Describe a time when you improved a process. What was the impact?"
];

// Simple id generator for sessions.
function genId() {
  return Math.random().toString(36).substr(2, 9);
}

// ------------------ Agent Modules (all rule-based) ------------------

/*
 * Question Manager Agent
 * - Serves predefined questions and helps start a new interview session.
 */
function createSession() {
  const id = genId();
  sessions[id] = { entries: [] };
  return id;
}

/*
 * Answer Analyzer Agent
 * - Performs lightweight text normalization and extracts clues
 * - Returns structured data to feed into the STAR Scoring Agent
 */
function analyzeAnswerText(answer) {
  const text = (answer || '').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const lowercase = text.toLowerCase();

  // Heuristics to detect elements
  const hasI = /\bI\b|\bI\'ve|\bI\'d|\bI\'ll/.test(answer);
  const pastTense = /ed\b|\bcompleted|\bmanaged|\bled|\bresolved/.test(lowercase);
  const metric = /%|percent|\d+\s*(days|weeks|months|hours|people|users|customers)/.test(lowercase);
  const actionWords = /implemented|designed|created|built|led|coordinated|negotiated|resolved|automated/;
  const hasActionWords = actionWords.test(lowercase);

  return { text, wordCount, hasI, pastTense, metric, hasActionWords };
}

/*
 * STAR Scoring Agent
 * - Rule-based scoring for Situation, Task, Action, Result
 * - Each element scored 0..2
 * - Returns breakdown and total (out of 8)
 */
function scoreSTAR(answerAnalysis) {
  const { text, wordCount, pastTense, metric, hasActionWords } = answerAnalysis;

  // Situation: presence of context (who/when/where) -> prefer at least 8-12 words and references
  let situation = 0;
  if (wordCount >= 12 && /\bwhen\b|\bwhile\b|\bat\b|\bduring\b|\bfor\b/.test(text.toLowerCase())) situation = 2;
  else if (wordCount >= 6) situation = 1;

  // Task: clear responsibility/goal -> look for goal/responsibility words
  let task = 0;
  if (/\bresponsible|\bgoal|\bobjective|\btask|\bmy role|\bwas to\b/.test(text.toLowerCase())) task = 2;
  else if (wordCount >= 8) task = 1;

  // Action: concrete actions taken -> look for action words and past tense
  let action = 0;
  if (hasActionWords && pastTense) action = 2;
  else if (hasActionWords || pastTense) action = 1;

  // Result: measurable outcome or learned lesson -> metrics or result words
  let result = 0;
  if (metric || /\bresulted in\b|\boutcome\b|\bimproved\b|\bincreased\b|\breduced\b|\bsaved\b/.test(text.toLowerCase())) result = 2;
  else if (wordCount >= 10 && /\blearned|\bimproved|\bimpact|\boutcome\b/.test(text.toLowerCase())) result = 1;

  const total = situation + task + action + result;
  return { situation, task, action, result, total };
}

/*
 * Feedback Generator Agent
 * - Generates actionable suggestions based on missing/weak STAR elements
 */
function generateFeedback(answerAnalysis, starScores) {
  const suggestions = [];
  const { text, wordCount, hasI, metric } = answerAnalysis;

  if (starScores.situation <= 0) suggestions.push('Add context: where and when this happened and who was involved.');
  else if (starScores.situation === 1) suggestions.push('Expand the situation with a bit more context (timeframe, scale, or setting).');

  if (starScores.task <= 0) suggestions.push('Clarify your task: state your responsibility or the goal you were trying to achieve.');
  else if (starScores.task === 1) suggestions.push('Make your role or goal more explicit (e.g., "My responsibility was to...").');

  if (starScores.action <= 0) suggestions.push('Describe concrete actions you personally took; use action verbs (implemented, led, coordinated).');
  else if (starScores.action === 1) suggestions.push('Be more specific about steps you took and the reasoning behind them.');

  if (starScores.result <= 0) suggestions.push('Add an outcome or result—quantify impact if possible (metrics, time saved, feedback).');
  else if (starScores.result === 1 && !metric) suggestions.push('If possible, add a metric or specific result to strengthen the impact statement.');

  if (!hasI) suggestions.push('Use first-person language to clarify your personal contribution ("I did X").');
  if (answerAnalysis.wordCount < 8) suggestions.push('Try to provide a fuller answer—aim for a few sentences covering STAR.');

  return suggestions;
}

// ------------------ REST API ------------------

// Serve questions
app.get('/questions', (req, res) => {
  res.json({ questions: QUESTIONS });
});

// Start a new interview session
app.post('/start', (req, res) => {
  const sessionId = createSession();
  res.json({ sessionId });
});

// Submit an answer and get analysis
app.post('/answer', (req, res) => {
  const { sessionId, questionIndex, question, answer } = req.body || {};
  if (!sessionId || !sessions[sessionId]) return res.status(400).json({ error: 'Invalid or missing sessionId' });
  if (typeof questionIndex !== 'number') return res.status(400).json({ error: 'Missing questionIndex' });

  const analysis = analyzeAnswerText(answer);
  const star = scoreSTAR(analysis);
  const suggestions = generateFeedback(analysis, star);

  const entry = { questionIndex, question, answer, analysis, star, suggestions };
  sessions[sessionId].entries.push(entry);

  res.json({ entry });
});

// Get final summary for a session
app.get('/summary', (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId || !sessions[sessionId]) return res.status(400).json({ error: 'Invalid or missing sessionId' });

  const entries = sessions[sessionId].entries;
  const perQuestion = entries.map(e => ({ questionIndex: e.questionIndex, question: e.question, star: e.star, suggestions: e.suggestions }));
  const totalScore = entries.reduce((s, e) => s + e.star.total, 0);
  const maxScore = entries.length * 8;

  res.json({ totalScore, maxScore, perQuestion });
});

// Serve packaged project ZIP for easy download (created by demo step)
// This provides a single-file convenient download for judges or reviewers.
const zipPath = path.join(__dirname, 'behavioural-interview-simulator.zip');
app.get('/download', (req, res) => {
  const fs = require('fs');
  if (fs.existsSync(zipPath)) {
    // Express will set appropriate headers and stream the file
    return res.download(zipPath, 'behavioural-interview-simulator.zip');
  }
  return res.status(404).json({ error: 'ZIP not found. Run the packaging step on the server.' });
});

// Fallback: serve index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Behavioural Interview Simulator running on http://localhost:${PORT}`));
