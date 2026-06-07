
  // ---------- QUESTIONS DATA (10 questions) ----------
  const QUESTIONS = [
    { text: "What does HTML stand for?", options: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyperlink and Text Markup", "Home Tool Markup Language"], correct: 0 },
    { text: "Which CSS property is used to change the background color?", options: ["bgcolor", "background-color", "color", "background"], correct: 1 },
    { text: "What does the 'DOM' stand for in JavaScript?", options: ["Document Object Model", "Data Object Model", "Document Oriented Model", "Desktop Object Model"], correct: 0 },
    { text: "Which JavaScript keyword is used to declare a variable?", options: ["var", "let", "const", "All of the above"], correct: 3 },
    { text: "How do you write a conditional statement in JavaScript?", options: ["if i=5 then", "if (i==5)", "if i=5", "if i==5 then"], correct: 1 },
    { text: "What does localStorage in web API do?", options: ["Stores data with expiry", "Stores data persistently", "Stores session data only", "Stores data on server"], correct: 1 },
    { text: "Which HTML tag is used to link an external JavaScript file?", options: ["<script>", "<js>", "<javascript>", "<link>"], correct: 0 },
    { text: "What does the 'flex' property do in CSS?", options: ["Creates grid layout", "Enables flexible box layout", "Adds shadow", "Changes font"], correct: 1 },
    { text: "What will `console.log(typeof [])` output?", options: ["array", "object", "undefined", "null"], correct: 1 },
    { text: "Which method is used to add an element at the end of an array?", options: ["push()", "pop()", "shift()", "unshift()"], correct: 0 }
  ];

  // ---------- GLOBAL STATE ----------
  let userAnswers = new Array(QUESTIONS.length).fill(null);     // store selected option index (0-3) or null if unanswered/expired
  let answerLocked = new Array(QUESTIONS.length).fill(false);   // whether question is locked (answered or expired)
  let currentIndex = 0;                  // 0-based
  let timerInterval = null;
  let timeLeft = 30;                     // seconds for current question
  let quizCompleted = false;

  // DOM elements
  const quizContentDiv = document.getElementById('quizContent');
  const progressFill = document.getElementById('progressFill');
  const questionCounterSpan = document.getElementById('questionCounter');
  const timerDisplaySpan = document.getElementById('timerDisplay');
  const darkToggle = document.getElementById('darkModeToggle');

  // Helper: Save state to localStorage
  function persistState() {
    const state = {
      userAnswers,
      answerLocked,
      currentIndex,
      quizCompleted,
      // timer related: we won't persist active timer seconds because page refresh resets timer for current question (requirement: progress saved)
      // but also we need to keep track if current question was locked? We'll just restore locked answers correctly.
      // For timer, we reset on load: but we need time left? It's acceptable to reset to 30 sec on refresh for current question if not locked.
      // Better to preserve timeLeft? Not mandatory, but we store timestamp? But requirement: current question index and selected answers. Timer restarts.
      // I will also preserve if question is locked and answered, timer shouldn't run. So on restore: if current question is locked, stop timer.
    };
    localStorage.setItem('quiz_system_state', JSON.stringify(state));
  }

  function loadPersistedState() {
    const saved = localStorage.getItem('quiz_system_state');
    if (!saved) return false;
    try {
      const data = JSON.parse(saved);
      if (data.userAnswers && data.userAnswers.length === QUESTIONS.length) {
        userAnswers = data.userAnswers;
        answerLocked = data.answerLocked || new Array(QUESTIONS.length).fill(false);
        currentIndex = (data.currentIndex !== undefined && data.currentIndex < QUESTIONS.length) ? data.currentIndex : 0;
        quizCompleted = data.quizCompleted || false;
        // re-evaluate locked status consistency: if userAnswers[i] !== null but answerLocked false, set locked true
        for (let i = 0; i < QUESTIONS.length; i++) {
          if (userAnswers[i] !== null && !answerLocked[i]) answerLocked[i] = true;
          if (answerLocked[i] && userAnswers[i] === null) userAnswers[i] = null; // expired but locked no answer
        }
        return true;
      }
    } catch(e) { console.warn(e); }
    return false;
  }

  // Stop active timer
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Start timer for current question (if not locked & quiz not completed)
  function startTimerForCurrent() {
    stopTimer();
    if (quizCompleted) return;
    if (answerLocked[currentIndex]) {
      // already answered or expired, show timer as 0 or disabled style
      timeLeft = 0;
      updateTimerDisplayUI();
      return;
    }
    timeLeft = 30;
    updateTimerDisplayUI();
    timerInterval = setInterval(() => {
      if (quizCompleted) {
        stopTimer();
        return;
      }
      if (answerLocked[currentIndex]) {
        // question locked because answer selected externally, clear timer
        stopTimer();
        return;
      }
      if (timeLeft <= 1) {
        // time expired
        timeLeft = 0;
        updateTimerDisplayUI();
        stopTimer();
        // Mark as unanswered / expired: lock question, no answer selected (userAnswers remains null)
        if (!answerLocked[currentIndex]) {
          answerLocked[currentIndex] = true;
          userAnswers[currentIndex] = null;   // unanswered
          persistState();
          // re-render current question (disable options, show timeout message)
          renderCurrentQuestion();
          // if not last question? Automatically move to next after expiry
          if (!quizCompleted && currentIndex + 1 < QUESTIONS.length) {
            setTimeout(() => {
              if (!quizCompleted && currentIndex + 1 < QUESTIONS.length) {
                goToNextQuestion();
              }
            }, 600);
          } else if (!quizCompleted && currentIndex + 1 === QUESTIONS.length) {
            // last question expired, maybe finish quiz if all locked?
            checkAndCompleteQuiz();
          }
        }
      } else {
        timeLeft--;
        updateTimerDisplayUI();
        if (timeLeft <= 5) {
          timerDisplaySpan.classList.add('timer-danger');
        } else if (timeLeft <= 10) {
          timerDisplaySpan.classList.add('timer-warning');
        } else {
          timerDisplaySpan.classList.remove('timer-warning', 'timer-danger');
        }
      }
    }, 1000);
  }

  function updateTimerDisplayUI() {
    if (quizCompleted) {
      timerDisplaySpan.innerHTML = `--`;
      return;
    }
    if (answerLocked[currentIndex]) {
      timerDisplaySpan.innerHTML = `⏱️ locked`;
      timerDisplaySpan.classList.remove('timer-warning', 'timer-danger');
    } else {
      timerDisplaySpan.innerHTML = `⏱️ ${timeLeft}s`;
    }
  }

  // when user selects an answer
  function selectAnswer(optionIndex) {
    if (quizCompleted) return;
    if (answerLocked[currentIndex]) return; // already answered/expired
    // record answer
    userAnswers[currentIndex] = optionIndex;
    answerLocked[currentIndex] = true;
    stopTimer();   // stop ticking
    persistState();
    renderCurrentQuestion();  // re-render with highlight & disabled
    // auto move to next after short delay for better UX
    if (currentIndex + 1 < QUESTIONS.length) {
      setTimeout(() => {
        if (!quizCompleted && currentIndex + 1 < QUESTIONS.length) {
          goToNextQuestion();
        }
      }, 500);
    } else {
      // last question, after answering check completion
      setTimeout(() => {
        checkAndCompleteQuiz();
      }, 400);
    }
  }

  function goToNextQuestion() {
    if (quizCompleted) return;
    if (currentIndex + 1 >= QUESTIONS.length) {
      checkAndCompleteQuiz();
      return;
    }
    currentIndex++;
    stopTimer();
    // start fresh timer for new index if not locked
    if (!answerLocked[currentIndex]) {
      startTimerForCurrent();
    } else {
      updateTimerDisplayUI();
    }
    renderCurrentQuestion();
    persistState();
  }

  function goToPrevQuestion() {
    if (quizCompleted) return;
    if (currentIndex - 1 >= 0) {
      currentIndex--;
      stopTimer();
      if (!answerLocked[currentIndex]) {
        startTimerForCurrent();
      } else {
        updateTimerDisplayUI();
      }
      renderCurrentQuestion();
      persistState();
    }
  }

  function checkAndCompleteQuiz() {
    // check if all questions are locked (answered or expired)
    let allLocked = answerLocked.every(locked => locked === true);
    if (allLocked || (!allLocked && currentIndex === QUESTIONS.length-1)) {
      // if not all locked but we are at end, force lock any remaining? but they would be unanswered if timer didn't expire? We'll force lock unanswered if reaching final
      for (let i = 0; i < QUESTIONS.length; i++) {
        if (!answerLocked[i]) {
          answerLocked[i] = true;
          if (userAnswers[i] === null) userAnswers[i] = null;
        }
      }
      persistState();
      quizCompleted = true;
      stopTimer();
      renderResultsScreen();
    } else {
      renderCurrentQuestion(); // safe render
    }
  }

  // Show final results
  function renderResultsScreen() {
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    for (let i = 0; i < QUESTIONS.length; i++) {
      const selected = userAnswers[i];
      if (selected === null || selected === undefined) {
        unansweredCount++;
      } else {
        if (selected === QUESTIONS[i].correct) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
    }
    const total = QUESTIONS.length;
    const percentage = Math.round((correctCount / total) * 100);
    let message = "";
    if (percentage <= 40) message = " Needs Improvement";
    else if (percentage <= 70) message = " Good Effort";
    else if (percentage <= 90) message = " Great Work";
    else message = " Excellent";

    quizContentDiv.innerHTML = `
      <div class="results-container">
        <h2 style="color: var(--text-primary)">📊 Quiz Completed!</h2>
        <div class="score-card">
          <div class="stat"><strong>Correct</strong><br>${correctCount}</div>
          <div class="stat"><strong>Incorrect</strong><br>${incorrectCount}</div>
          <div class="stat"><strong>Unanswered</strong><br>${unansweredCount}</div>
          <div class="stat"><strong>Score</strong><br>${correctCount}/${total}</div>
          <div class="stat"><strong>Percentage</strong><br>${percentage}%</div>
        </div>
        <div class="message-box">${message}</div>
        <button class="restart-btn" id="restartQuizBtn">🔄 Restart Quiz</button>
      </div>
    `;
    document.getElementById('restartQuizBtn')?.addEventListener('click', () => resetAndRestart());
    updateProgressAndCounter();
  }

  function resetAndRestart() {
    // full reset
    userAnswers = new Array(QUESTIONS.length).fill(null);
    answerLocked = new Array(QUESTIONS.length).fill(false);
    currentIndex = 0;
    quizCompleted = false;
    stopTimer();
    timeLeft = 30;
    localStorage.removeItem('quiz_system_state');
    persistState(); // save fresh
    startTimerForCurrent();
    renderCurrentQuestion();
  }

  function renderCurrentQuestion() {
    if (quizCompleted) {
      renderResultsScreen();
      return;
    }
    const q = QUESTIONS[currentIndex];
    const selectedIdx = userAnswers[currentIndex];
    const isLocked = answerLocked[currentIndex];
    const correctAnswerIdx = q.correct;

    let optionsHtml = '';
    q.options.forEach((opt, idx) => {
      let additionalClass = '';
      let prefixLetter = String.fromCharCode(65+idx);
      if (isLocked) {
        if (selectedIdx === idx) {
          // user selected this option
          if (idx === correctAnswerIdx) additionalClass = 'selected-correct';
          else additionalClass = 'selected-wrong';
        } else if (idx === correctAnswerIdx && selectedIdx !== null && selectedIdx !== correctAnswerIdx) {
          // show correct answer highlight when user was wrong
          additionalClass = 'selected-correct';
        }
      }
      const disabledAttr = isLocked ? 'disabled-opt' : '';
      optionsHtml += `
        <div class="option ${additionalClass} ${disabledAttr}" data-opt-index="${idx}">
          <span class="prefix">${prefixLetter}</span>
          <span>${escapeHtml(opt)}</span>
        </div>
      `;
    });

    const progressPercent = ((currentIndex + 1) / QUESTIONS.length) * 100;
    progressFill.style.width = `${progressPercent}%`;
    questionCounterSpan.innerText = `Question ${currentIndex+1} of ${QUESTIONS.length}`;
    
    const navigationHtml = `
      <div class="nav-buttons">
        <button id="prevBtn" class="btn-secondary" ${currentIndex === 0 ? 'disabled' : ''}>◀ Previous</button>
        <button id="nextBtn" ${quizCompleted ? 'disabled' : ''}>Next ▶</button>
      </div>
    `;

    quizContentDiv.innerHTML = `
      <div class="question-text">${escapeHtml(q.text)}</div>
      <div class="options-list" id="optionsList">
        ${optionsHtml}
      </div>
      ${navigationHtml}
    `;

    // attach option listeners only if not locked
    if (!isLocked && !quizCompleted) {
      const opts = document.querySelectorAll('.option');
      opts.forEach(opt => {
        opt.addEventListener('click', (e) => {
          if (answerLocked[currentIndex] || quizCompleted) return;
          const idx = parseInt(opt.dataset.optIndex);
          if (!isNaN(idx)) selectAnswer(idx);
        });
      });
    } else {
      // even locked, we can keep view but no click action
      document.querySelectorAll('.option').forEach(el => {
        el.style.cursor = 'default';
      });
    }

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => goToPrevQuestion());
    if (nextBtn) nextBtn.addEventListener('click', () => goToNextQuestion());
    
    updateTimerDisplayUI();
    if (!isLocked && !quizCompleted && !timerInterval) startTimerForCurrent();
    if (isLocked && timerInterval) stopTimer();
  }

  function updateProgressAndCounter() {
    if (!quizCompleted) {
      const percent = ((currentIndex + 1) / QUESTIONS.length) * 100;
      progressFill.style.width = `${percent}%`;
      questionCounterSpan.innerText = `Question ${currentIndex+1} of ${QUESTIONS.length}`;
    }
  }

  function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  // Dark mode
  function initDarkMode() {
    const isDark = localStorage.getItem('quiz_theme') === 'dark';
    if (isDark) document.body.classList.add('dark');
    darkToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('quiz_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
      darkToggle.innerHTML = document.body.classList.contains('dark') ? 'Light Mode' : 'Dark Mode';
    });
    darkToggle.innerHTML = isDark ? 'Light Mode' : 'Dark Mode';
  }

  // Initialize application
  function init() {
    initDarkMode();
    const loaded = loadPersistedState();
    if (!loaded) {
      // fresh start
      userAnswers.fill(null);
      answerLocked.fill(false);
      quizCompleted = false;
      currentIndex = 0;
    }
    // if quizCompleted flag from storage, show results
    if (quizCompleted) {
      renderResultsScreen();
    } else {
      // ensure consistency: if any answer present but not locked fix
      for (let i = 0; i < QUESTIONS.length; i++) {
        if (userAnswers[i] !== null && !answerLocked[i]) answerLocked[i] = true;
      }
      startTimerForCurrent();
      renderCurrentQuestion();
    }
    persistState();
  }
  
  init();
