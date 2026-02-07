// Behavioural Interview Simulator - Enhanced Frontend
// Scoring logic preserved. UI enhancements added for progress visualization,
// quality tagging, and strengths/weaknesses analysis.

let questions = [];
let sessionId = null;
let current = 0;
let pastAnswers = []; // Track all completed answers

const startBtn = document.getElementById('startBtn');
const intro = document.getElementById('intro');
const questionPanel = document.getElementById('questionPanel');
const questionText = document.getElementById('questionText');
const answerInput = document.getElementById('answerInput');
const submitBtn = document.getElementById('submitBtn');
const feedback = document.getElementById('feedback');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const starVisualization = document.getElementById('starVisualization');
const summaryPanel = document.getElementById('summaryPanel');
const summaryContent = document.getElementById('summaryContent');
const restartBtn = document.getElementById('restartBtn');
const overviewCard = document.getElementById('overviewCard');
const totalScore = document.getElementById('totalScore');
const scorePercentage = document.getElementById('scorePercentage');
const strengthsWeaknesses = document.getElementById('strengthsWeaknesses');
const strengthCard = document.getElementById('strengthCard');
const strengthText = document.getElementById('strengthText');
const weaknessCard = document.getElementById('weaknessCard');
const weaknessText = document.getElementById('weaknessText');
const micBtn = document.getElementById('micBtn');
const pastAnswersPanel = document.getElementById('pastAnswersPanel');
const pastAnswersCount = document.getElementById('pastAnswersCount');
const pastAnswersList = document.getElementById('pastAnswersList');

// ========================================
// Web Speech API Setup (Voice Input)
// ========================================
let recognition = null;
let isListening = false;
let lastResultIndex = -1; // Track the last result we added to prevent duplicates

function initSpeechRecognition() {
  // Check browser support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micBtn.title = 'Speech recognition not supported in your browser';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  // When speech is detected
  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add('listening');
    micBtn.classList.remove('stopped');
    micBtn.title = 'Listening... Click to stop';
    lastResultIndex = -1; // Reset tracking
  };

  // Process FINAL results only to prevent duplication
  recognition.onresult = (event) => {
    let finalTranscript = '';

    // Only process final results, skip interim
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      
      // Only append FINAL results (isFinal = true)
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
        lastResultIndex = i; // Track that we've processed this result
      }
    }

    // Append final transcription to textarea only if there are new final results
    if (finalTranscript.trim()) {
      const currentText = answerInput.value.trim();
      const newText = currentText ? currentText + ' ' + finalTranscript.trim() : finalTranscript.trim();
      answerInput.value = newText;
    }
  };

  // When speech ends
  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove('listening');
    micBtn.classList.add('stopped');
    micBtn.title = 'Click to record voice answer';
  };

  // Handle errors gracefully
  recognition.onerror = (event) => {
    isListening = false;
    micBtn.classList.remove('listening');
    micBtn.classList.add('stopped');

    if (event.error === 'network') {
      alert('Network error. Please check your internet connection.');
    } else if (event.error === 'no-speech') {
      // No speech detected; allow retry
    } else if (event.error === 'not-allowed') {
      alert('Microphone access denied. Please enable microphone permissions in your browser.');
      micBtn.disabled = true;
    } else {
      console.log('Speech recognition error:', event.error);
    }
  };
}

// Toggle voice input on/off
function toggleVoiceInput() {
  if (!recognition) return;

  if (isListening) {
    recognition.stop();
  } else {
    answerInput.focus();
    lastResultIndex = -1; // Reset result tracking for new recording
    recognition.start();
  }
}

micBtn.addEventListener('click', toggleVoiceInput);

async function loadQuestions() {
  const res = await fetch('/questions');
  const data = await res.json();
  questions = data.questions || [];
}

async function startSession() {
  const res = await fetch('/start', { method: 'POST' });
  const data = await res.json();
  sessionId = data.sessionId;
}

function updateProgressBar() {
  const pct = ((current) / questions.length) * 100;
  progressBar.style.width = pct + '%';
}

// ========================================
// Past Answers History Tracking
// ========================================
function addToPastAnswers(questionIndex, question, answer, star) {
  pastAnswers.push({
    questionIndex,
    question,
    answer,
    star
  });
  updatePastAnswersDisplay();
}

function updatePastAnswersDisplay() {
  if (pastAnswers.length === 0) {
    pastAnswersPanel.style.display = 'none';
    return;
  }

  pastAnswersPanel.style.display = 'block';
  pastAnswersCount.textContent = pastAnswers.length;

  let html = '';
  pastAnswers.forEach(pa => {
    html += `
      <div class="past-answer-item">
        <span class="answer-q-number">Q${pa.questionIndex + 1}</span>
        <div class="answer-question-text">${pa.question}</div>
        <div class="answer-user-text">"${pa.answer}"</div>
        <div class="answer-scores-row">
          <div class="answer-score-item">
            <div class="answer-score-label">Situation</div>
            <div class="answer-score-value">${pa.star.situation}</div>
          </div>
          <div class="answer-score-item">
            <div class="answer-score-label">Task</div>
            <div class="answer-score-value">${pa.star.task}</div>
          </div>
          <div class="answer-score-item">
            <div class="answer-score-label">Action</div>
            <div class="answer-score-value">${pa.star.action}</div>
          </div>
          <div class="answer-score-item">
            <div class="answer-score-label">Result</div>
            <div class="answer-score-value">${pa.star.result}</div>
          </div>
        </div>
      </div>
    `;
  });

  pastAnswersList.innerHTML = html;
}

function showQuestion(idx) {
  const q = questions[idx];
  progress.textContent = `Question ${idx + 1} of ${questions.length}`;
  questionText.textContent = q;
  answerInput.value = '';
  feedback.style.display = 'none';
  feedback.innerHTML = '';
  starVisualization.style.display = 'none';
  lastResultIndex = -1; // Reset result tracking for new question
  if (recognition && isListening) {
    recognition.stop();
  }
  micBtn.classList.remove('listening', 'stopped');
  updateProgressBar();
}

function getQualityTag(score) {
  if (score >= 6) return { tag: '✅ Strong Answer', class: 'quality-strong' };
  if (score >= 4) return { tag: '⚠️ Average', class: 'quality-average' };
  return { tag: '❌ Needs Improvement', class: 'quality-needs-improvement' };
}

function updateSTARVisualization(star) {
  const components = starVisualization.querySelectorAll('.star-component');
  const scores = [star.situation, star.task, star.action, star.result];
  const labels = ['Situation', 'Task', 'Action', 'Result'];

  components.forEach((comp, i) => {
    const score = scores[i];
    comp.className = 'star-component filled-' + score;
    const scoreEl = comp.querySelector('.star-score');
    scoreEl.className = 'star-score score-' + score;
    scoreEl.textContent = score;
  });

  starVisualization.style.display = 'grid';
}

async function submitAnswer() {
  const answer = answerInput.value.trim();
  if (!answer) return alert('Please type an answer before submitting.');
  submitBtn.disabled = true;

  const payload = { sessionId, questionIndex: current, question: questions[current], answer };
  const res = await fetch('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();

  // Enhanced feedback with STAR visualization and quality tag
  const star = data.entry.star;
  const suggestions = data.entry.suggestions;
  const quality = getQualityTag(star.total);

  // Track this answer in history
  addToPastAnswers(current, questions[current], answer, star);

  updateSTARVisualization(star);

  feedback.innerHTML = `
    <div style="margin-bottom: 12px;">
      <strong style="color: var(--text-primary);">STAR Breakdown:</strong>
      <span class="${quality.class}" style="margin-left: 12px;">${quality.tag}</span>
    </div>
    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
      Total Score: <span class="starScore">${star.total}/8</span>
    </div>
  `;

  if (suggestions && suggestions.length) {
    feedback.innerHTML += '<div><strong style="color: var(--text-primary); display: block; margin-bottom: 8px;">How to Improve:</strong>';
    const ul = document.createElement('ul');
    suggestions.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      li.className = 'suggestion';
      ul.appendChild(li);
    });
    feedback.appendChild(ul);
    feedback.innerHTML += '</div>';
  }

  feedback.style.display = 'block';

  // Move to next after a short delay
  setTimeout(() => {
    current += 1;
    if (current < questions.length) {
      showQuestion(current);
      submitBtn.disabled = false;
    } else {
      showSummary();
    }
  }, 900);
}

function deriveStrengthsAndWeaknesses(perQuestion) {
  let componentScores = { situation: 0, task: 0, action: 0, result: 0 };
  perQuestion.forEach(p => {
    componentScores.situation += p.star.situation;
    componentScores.task += p.star.task;
    componentScores.action += p.star.action;
    componentScores.result += p.star.result;
  });

  const components = [
    { name: 'Situation', score: componentScores.situation },
    { name: 'Task', score: componentScores.task },
    { name: 'Action', score: componentScores.action },
    { name: 'Result', score: componentScores.result }
  ];

  components.sort((a, b) => b.score - a.score);
  const strongest = components[0];
  const weakest = components[components.length - 1];

  return { strongest, weakest };
}

async function showSummary() {
  const res = await fetch(`/summary?sessionId=${sessionId}`);
  const data = await res.json();
  questionPanel.classList.add('hidden');
  summaryPanel.classList.remove('hidden');

  const pct = Math.round((data.totalScore / data.maxScore) * 100 || 0);
  totalScore.textContent = `${data.totalScore} / ${data.maxScore}`;
  scorePercentage.textContent = `${pct}% Complete`;
  overviewCard.style.display = 'block';

  // Derive and display strengths/weaknesses
  const { strongest, weakest } = deriveStrengthsAndWeaknesses(data.perQuestion);
  strengthText.textContent = strongest.name + ' (' + strongest.score + ' pts)';
  weaknessText.textContent = weakest.name + ' (' + weakest.score + ' pts)';
  strengthCard.style.display = 'block';
  weaknessCard.style.display = 'block';
  strengthsWeaknesses.style.display = 'block';

  // Generate per-question feedback cards
  let html = '';
  data.perQuestion.forEach(p => {
    const quality = getQualityTag(p.star.total);
    html += `
      <div class="summary-entry">
        <div class="summary-entry-header">
          <div class="summary-entry-question">Q${p.questionIndex + 1}: ${p.question}</div>
          <span class="answer-quality-tag ${quality.class}">${quality.tag}</span>
        </div>
        <div class="summary-entry-scores">
          <div class="score-box">
            <div class="score-label">Situation</div>
            <div class="score-value">${p.star.situation}</div>
          </div>
          <div class="score-box">
            <div class="score-label">Task</div>
            <div class="score-value">${p.star.task}</div>
          </div>
          <div class="score-box">
            <div class="score-label">Action</div>
            <div class="score-value">${p.star.action}</div>
          </div>
          <div class="score-box">
            <div class="score-label">Result</div>
            <div class="score-value">${p.star.result}</div>
          </div>
        </div>
        <div class="summary-entry-total">
          Question Score: <span class="score">${p.star.total}/8</span>
        </div>
    `;

    if (p.suggestions && p.suggestions.length) {
      html += `
        <div class="summary-suggestions">
          <strong>Improvement Suggestions:</strong>
          <ul style="margin: 8px 0 0 20px; padding: 0;">
            ${p.suggestions.map(s => `<li class="suggestion">${s}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    html += '</div>';
  });

  summaryContent.innerHTML = html;
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  pastAnswers = []; // Reset past answers for new session
  await loadQuestions();
  await startSession();
  intro.classList.add('hidden');
  questionPanel.classList.remove('hidden');
  showQuestion(0);
});

submitBtn.addEventListener('click', submitAnswer);
restartBtn.addEventListener('click', () => location.reload());

// Initialize voice input on page load
window.addEventListener('DOMContentLoaded', initSpeechRecognition);
