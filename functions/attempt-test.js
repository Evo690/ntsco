/**
 * Attempt Test - NTSC Online Exam Hall Interface
 * Supports real-time exam simulation, timer countdown, question palette,
 * auto-saving responses via SaveExamAnswer, and official reattempt submission via FinishExam.
 */

(function () {
    'use strict';

    const CLOUDFLARE_PROXY = 'https://frosty-frog-31f9.evodev.workers.dev/';

    // State Management
    let token = '';
    let studentId = 0;
    let studentName = 'Student';
    let academicYear = new Date().getFullYear();

    let testId = '';
    let examGuid = '';
    let studentExamId = 0;
    let paperInstructions = null;
    let testPaper = null;
    let subjectPapers = [];
    let allQuestions = [];
    let currentQIndex = 0;
    let currentSubjectIdx = 0;

    // Map: questionId -> { markedAnswer, status, isReviewLater, timeTaken, localTimestamp }
    const answersMap = {};
    let questionStartTime = Date.now();

    // Timer state
    let totalDurationSeconds = 180 * 60;
    let timeRemainingSeconds = 180 * 60;
    let timerInterval = null;
    let currentZoom = 1.0;

    // Helper: JWT Decoding
    function parseJwt(jwtToken) {
        try {
            if (!jwtToken || typeof jwtToken !== 'string') return null;
            const parts = jwtToken.split('.');
            if (parts.length !== 3) return null;
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            return JSON.parse(jsonPayload);
        } catch (_) {
            return null;
        }
    }

    function initAuth() {
        // Read token from available storage or opener
        token = sessionStorage.getItem('fy_token') ||
            localStorage.getItem('fy_token') ||
            (window.opener && window.opener.API_CONFIG && window.opener.API_CONFIG.token) ||
            '';

        const yrStr = sessionStorage.getItem('fy_academic_year') ||
            (window.opener && window.opener.API_CONFIG && window.opener.API_CONFIG.academicYear);
        if (yrStr) academicYear = Number(yrStr);

        if (token) {
            const payload = parseJwt(token);
            if (payload) {
                studentId = Number(
                    payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/sid'] ||
                    payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
                    payload.sid ||
                    0
                );
                studentName = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
                    sessionStorage.getItem('fy_user_name') ||
                    'Student';
            }
        }

        const nameEl = document.getElementById('candidate-name');
        const avatarEl = document.getElementById('candidate-avatar');
        if (nameEl) nameEl.textContent = studentName;
        if (avatarEl) {
            const initials = studentName.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
            avatarEl.textContent = initials || 'ST';
        }
    }

    function applyUserTheme() {
        try {
            const rawName = sessionStorage.getItem('fy_user_name');
            const user = (rawName && rawName.trim() !== 'Student') ? rawName.trim() : (sessionStorage.getItem('fy_logged_in_user') || '');
            const cleanId = user ? user.replace(/[^a-zA-Z0-9_]/g, '_') : '';
            const modeKey = cleanId ? `fy_theme_mode_${cleanId}` : 'fy_theme_mode';
            const presetKey = cleanId ? `fy_theme_preset_${cleanId}` : 'fy_theme_preset';

            const mode = localStorage.getItem(modeKey);
            const preset = localStorage.getItem(presetKey);

            if (mode !== 'dark') {
                document.body.classList.add('light-mode');
            } else {
                document.body.classList.remove('light-mode');
            }

            document.body.classList.remove('theme-ocean', 'theme-purple', 'theme-emerald');
            if (preset && preset !== 'default') {
                document.body.classList.add(`theme-${preset}`);
            }
        } catch (_) {}
    }

    // Proxy Fetch
    async function proxyFetch(url, options = {}) {
        return fetch(CLOUDFLARE_PROXY + '?url=' + encodeURIComponent(url), {
            ...options,
            headers: {
                ...(options.headers || {}),
                'x-key': 'ntsc-123'
            }
        });
    }

    function getAuthHeaders() {
        return {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://ntsc.narayanatalent.com',
            'Referer': `https://ntsc.narayanatalent.com/Test-Paper/${testId || ''}`
        };
    }

    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2400);
    }

    function generateGuid() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // --- Passcode Gate ("ntscx") ---
    const REATTEMPT_PASSCODE = 'ntscx';

    function isReattemptUnlocked() {
        return sessionStorage.getItem('fy_reattempt_unlocked') === 'true';
    }

    function showPasscodeGate() {
        const loadScreen = document.getElementById('exam-loading-screen');
        if (loadScreen) loadScreen.style.display = 'none';
        const modal = document.getElementById('modal-passcode-lock');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => {
                const inp = document.getElementById('gate-passcode-input');
                if (inp) inp.focus();
            }, 100);
        }
    }

    function submitGatePasscode() {
        const inp = document.getElementById('gate-passcode-input');
        const err = document.getElementById('gate-passcode-error');
        if (!inp) return;
        const val = inp.value.trim();
        if (val === REATTEMPT_PASSCODE) {
            sessionStorage.setItem('fy_reattempt_unlocked', 'true');
            if (err) err.style.display = 'none';
            const modal = document.getElementById('modal-passcode-lock');
            if (modal) modal.style.display = 'none';
            resumeInitializationAfterUnlock();
        } else {
            if (err) {
                err.textContent = 'Incorrect passcode. Access denied.';
                err.style.display = 'block';
            }
            inp.value = '';
            inp.focus();
        }
    }

    // --- Loading & Initialization ---
    async function initPage() {
        applyUserTheme();
        initAuth();

        // Setup global keyboard shortcuts
        window.addEventListener('keydown', handleGlobalKeydown);

        // Restore user preferences
        if (sessionStorage.getItem('fy_img_invert') === 'true') {
            toggleImageInvert(true);
        }
        if (sessionStorage.getItem('fy_palette_collapsed') === 'true' && window.innerWidth > 860) {
            togglePaletteCollapse(true);
        }

        if (!isReattemptUnlocked()) {
            showPasscodeGate();
            return;
        }

        await resumeInitializationAfterUnlock();
    }

    async function resumeInitializationAfterUnlock() {
        // Check query param ?id=...
        const urlParams = new URLSearchParams(window.location.search);
        const qId = urlParams.get('id') || urlParams.get('testId');

        if (qId && qId.trim()) {
            testId = qId.trim();
            const loadScreen = document.getElementById('exam-loading-screen');
            if (loadScreen) loadScreen.style.display = 'flex';
            await loadTestPaper(testId);
        } else {
            // Hide loading screen and show launcher modal
            const loadScreen = document.getElementById('exam-loading-screen');
            if (loadScreen) loadScreen.style.display = 'none';
            document.getElementById('modal-launcher').style.display = 'flex';
            setTimeout(() => {
                const inp = document.getElementById('launcher-test-id');
                if (inp) inp.focus();
            }, 100);
        }
    }

    async function loadTestFromLauncher() {
        const inp = document.getElementById('launcher-test-id');
        const err = document.getElementById('launcher-error');
        const btn = document.getElementById('btn-launcher-load');
        if (!inp) return;

        const val = inp.value.trim();
        if (!val || isNaN(val)) {
            if (err) {
                err.textContent = 'Please enter a valid numeric Test ID.';
                err.style.display = 'block';
            }
            return;
        }

        if (err) err.style.display = 'none';
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Loading...';
        }

        testId = val;
        document.getElementById('exam-loading-screen').style.display = 'flex';
        document.getElementById('modal-launcher').style.display = 'none';

        try {
            await loadTestPaper(testId);
        } catch (e) {
            document.getElementById('exam-loading-screen').style.display = 'none';
            document.getElementById('modal-launcher').style.display = 'flex';
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Load Test →';
            }
            if (err) {
                err.textContent = e.message || 'Failed to load test paper.';
                err.style.display = 'block';
            }
        }
    }

    async function loadTestPaper(id) {
        const loadingMsg = document.getElementById('loading-screen-msg');
        if (loadingMsg) loadingMsg.textContent = `Fetching Paper Instructions & Test Data #${id}...`;

        if (!token) {
            throw new Error('NTSC Authentication token not found. Please log in to the main portal first.');
        }

        // Step A: Fetch Official Paper Instructions (returns official examGuid, studentExamId, duration, marks, HTML instructions)
        paperInstructions = null;
        try {
            const instRes = await proxyFetch(`https://ntsc.narayanatalent.com/attemptexam-service/api/ExaminationHall/GetPaperInstructions/${id}`, {
                method: 'GET',
                headers: {
                    ...getAuthHeaders(),
                    'Referer': `https://ntsc.narayanatalent.com/Test-Instructions/${id}/1`
                }
            });
            if (instRes.ok) {
                const instJson = await instRes.json();
                paperInstructions = instJson?.data || null;
            }
        } catch (instErr) {
            console.warn('GetPaperInstructions fetch notice:', instErr);
        }

        // Set official examGuid from server (fallback to UUID if not returned)
        if (paperInstructions && paperInstructions.examGuid) {
            examGuid = paperInstructions.examGuid;
        } else {
            examGuid = generateGuid();
        }

        studentExamId = Number(paperInstructions?.studentExamId || 0);

        // Step B: Fetch Question Paper Data
        const payload = {
            id: String(id),
            isMobile: false,
            take: 0,
            skip: 0,
            studentExamId: studentExamId
        };

        const res = await proxyFetch('https://ntsc.narayanatalent.com/attemptexam-service/api/ExaminationHall/GetTestPaper', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`GetTestPaper request failed (HTTP ${res.status}). Ensure you are logged in.`);
        }

        const json = await res.json();
        const data = json?.data;
        if (!data || !Array.isArray(data.subjectPapers) || data.subjectPapers.length === 0) {
            throw new Error('No questions returned for this Test ID. Paper may not be published or available.');
        }

        testPaper = data;
        subjectPapers = data.subjectPapers;

        // Flatten all questions and index them
        allQuestions = [];
        subjectPapers.forEach((sp, sIdx) => {
            (sp.questions || []).forEach((q, qIdx) => {
                const questionObj = {
                    ...q,
                    subjectIdx: sIdx,
                    subjectName: sp.subjectName || `Subject ${sIdx + 1}`,
                    flatIndex: allQuestions.length,
                    displayNumber: q.questionNo || (allQuestions.length + 1)
                };
                allQuestions.push(questionObj);

                // Initialize answer map entry
                answersMap[questionObj.questionId] = {
                    questionId: questionObj.questionId,
                    questionNo: questionObj.displayNumber,
                    markedAnswer: '',
                    status: 'not-visited', // 'not-visited' | 'not-answered' | 'answered' | 'review' | 'answered-review'
                    isReviewLater: false,
                    timeTaken: 0,
                    localTimestamp: ''
                };
            });
        });

        if (allQuestions.length === 0) {
            throw new Error('The test paper contains 0 questions.');
        }

        // Calculate time duration (prioritize official paper instructions, fallback to testPaper)
        let durationMinutes = Number(paperInstructions?.timeDuration || testPaper.timeDuration || testPaper.duration || 180);
        if (durationMinutes <= 0 || isNaN(durationMinutes)) durationMinutes = 180;
        totalDurationSeconds = durationMinutes * 60;
        timeRemainingSeconds = totalDurationSeconds;

        // Populate Instructions Modal
        const finalPaperTitle = paperInstructions?.paperName || testPaper.testName || `Test #${id}`;
        const finalTotalMarks = paperInstructions?.totalMarks || testPaper.totalMarks || testPaper.marks || (allQuestions.length * 4);

        const nameEl = document.getElementById('top-exam-name');
        if (nameEl) nameEl.textContent = finalPaperTitle;

        const instName = document.getElementById('inst-test-name');
        if (instName) instName.textContent = finalPaperTitle;

        const instDur = document.getElementById('inst-duration');
        if (instDur) instDur.textContent = `${durationMinutes} Mins`;

        const instMarks = document.getElementById('inst-marks');
        if (instMarks) instMarks.textContent = String(finalTotalMarks);

        // Render official paper specific HTML instructions if provided by server
        const customInstBox = document.getElementById('inst-custom-content');
        if (customInstBox) {
            if (paperInstructions && paperInstructions.instructions && paperInstructions.instructions.trim()) {
                customInstBox.innerHTML = `
                    <div style="font-weight: 700; color: var(--text); margin-bottom: 8px; font-size: 13px;">Test Paper Specific Instructions &amp; Marking Scheme:</div>
                    <div style="color: var(--text2); font-size: 13px;">${paperInstructions.instructions}</div>
                `;
                customInstBox.style.display = 'block';
            } else {
                customInstBox.style.display = 'none';
            }
        }

        // Hide loading screen, show Instructions modal
        document.getElementById('exam-loading-screen').style.display = 'none';
        document.getElementById('modal-instructions').style.display = 'flex';
    }

    function startExamSession() {
        const check = document.getElementById('inst-agree-check');
        if (check && !check.checked) {
            alert('Please check the box confirming you have read the instructions to begin.');
            return;
        }

        document.getElementById('modal-instructions').style.display = 'none';

        // Render Subject Strip
        renderSubjectTabs();

        // Start countdown timer
        startCountdown();

        // Load first question
        currentQIndex = 0;
        questionStartTime = Date.now();
        renderQuestion(0);
    }

    // --- Timer Engine ---
    function startCountdown() {
        if (timerInterval) clearInterval(timerInterval);
        updateTimerDisplay();

        timerInterval = setInterval(() => {
            timeRemainingSeconds--;
            updateTimerDisplay();

            if (timeRemainingSeconds <= 0) {
                clearInterval(timerInterval);
                autoSubmitOnTimeUp();
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const timerBox = document.getElementById('exam-timer-box');
        const display = document.getElementById('exam-timer-display');
        const fsDisplay = document.getElementById('fs-timer-text');
        const fsTimerPill = document.getElementById('fs-timer-pill');
        if (!display && !fsDisplay) return;

        const sec = Math.max(0, timeRemainingSeconds);
        const hrs = Math.floor(sec / 3600);
        const mins = Math.floor((sec % 3600) / 60);
        const s = sec % 60;

        const pad = (n) => String(n).padStart(2, '0');
        const timeStr = `${pad(hrs)}:${pad(mins)}:${pad(s)}`;

        if (display) display.textContent = timeStr;
        if (fsDisplay) fsDisplay.textContent = timeStr;

        // Visual warnings for normal mode timer
        if (timerBox) {
            if (sec < 60) {
                timerBox.className = 'exam-timer-box danger';
            } else if (sec < 300) {
                timerBox.className = 'exam-timer-box warning';
            } else {
                timerBox.className = 'exam-timer-box';
            }
        }

        // Visual warnings for small timer on top in fullscreen
        if (fsTimerPill) {
            if (sec < 60) {
                fsTimerPill.className = 'fs-timer-pill danger';
            } else if (sec < 300) {
                fsTimerPill.className = 'fs-timer-pill warning';
            } else {
                fsTimerPill.className = 'fs-timer-pill';
            }
        }
    }

    async function autoSubmitOnTimeUp() {
        showToast('Time is up! Submitting your exam automatically...');
        try {
            await finalizeExamSubmission();
        } catch (e) {
            console.error('Auto-submit error:', e);
            showToast('Auto-submit encountered network error. Retrying...');
            setTimeout(autoSubmitOnTimeUp, 3000);
        }
    }

    // --- Subject Tabs & Palette ---
    function renderSubjectTabs() {
        const container = document.getElementById('subject-tabs-container');
        if (!container) return;

        container.innerHTML = subjectPapers.map((sp, idx) => {
            const isActive = idx === currentSubjectIdx;
            return `
                <button class="subject-tab-btn ${isActive ? 'active' : ''}" id="subj-tab-${idx}" onclick="switchSubject(${idx})">
                    ${escapeHtml(sp.subjectName || `Subject ${idx + 1}`)}
                </button>
            `;
        }).join('');
    }

    function switchSubject(idx) {
        if (idx < 0 || idx >= subjectPapers.length) return;
        currentSubjectIdx = idx;

        // Update tab buttons
        document.querySelectorAll('.subject-tab-btn').forEach((btn, i) => {
            btn.classList.toggle('active', i === currentSubjectIdx);
        });

        // Find first question of this subject
        const firstQ = allQuestions.find(q => q.subjectIdx === currentSubjectIdx);
        if (firstQ) {
            navigateToQuestion(firstQ.flatIndex);
        } else {
            renderPalette();
        }
    }

    function renderPalette() {
        const grid = document.getElementById('palette-grid-circles');
        const activeSubjEl = document.getElementById('palette-active-subject');
        if (!grid) return;

        const currentSubj = subjectPapers[currentSubjectIdx];
        if (activeSubjEl && currentSubj) {
            activeSubjEl.textContent = currentSubj.subjectName || `Subject ${currentSubjectIdx + 1}`;
        }

        // Filter questions belonging to current subject
        const subjQuestions = allQuestions.filter(q => q.subjectIdx === currentSubjectIdx);

        grid.innerHTML = subjQuestions.map(q => {
            const state = answersMap[q.questionId] || {};
            const stClass = getStatusClass(state.status);
            const isCurrent = q.flatIndex === currentQIndex;

            return `
                <div class="palette-circle ${stClass} ${isCurrent ? 'active-q' : ''}"
                     id="palette-btn-${q.flatIndex}"
                     onclick="navigateToQuestion(${q.flatIndex})"
                     title="Q${q.displayNumber}: ${formatStatusLabel(state.status)}">
                    ${q.displayNumber}
                </div>
            `;
        }).join('');

        updateStatusCounts();
    }

    function getStatusClass(status) {
        switch (status) {
            case 'answered': return 'st-answered';
            case 'not-answered': return 'st-not-answered';
            case 'review': return 'st-review';
            case 'answered-review': return 'st-answered-review';
            default: return 'st-not-visited';
        }
    }

    function formatStatusLabel(status) {
        switch (status) {
            case 'answered': return 'Answered';
            case 'not-answered': return 'Not Answered';
            case 'review': return 'Marked for Review';
            case 'answered-review': return 'Answered & Review';
            default: return 'Not Visited';
        }
    }

    function updateStatusCounts() {
        let answered = 0;
        let notAnswered = 0;
        let review = 0;
        let notVisited = 0;

        Object.values(answersMap).forEach(ans => {
            if (ans.status === 'answered') answered++;
            else if (ans.status === 'not-answered') notAnswered++;
            else if (ans.status === 'review' || ans.status === 'answered-review') review++;
            else notVisited++;
        });

        const elAns = document.getElementById('stat-answered');
        const elNotAns = document.getElementById('stat-not-answered');
        const elRev = document.getElementById('stat-review');
        const elNotVis = document.getElementById('stat-not-visited');

        if (elAns) elAns.textContent = String(answered);
        if (elNotAns) elNotAns.textContent = String(notAnswered);
        if (elRev) elRev.textContent = String(review);
        if (elNotVis) elNotVis.textContent = String(notVisited);
    }

    // --- Question Navigation & Rendering ---
    function recordTimeForCurrentQuestion() {
        if (allQuestions[currentQIndex]) {
            const q = allQuestions[currentQIndex];
            const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
            if (answersMap[q.questionId]) {
                answersMap[q.questionId].timeTaken = (answersMap[q.questionId].timeTaken || 0) + Math.max(1, elapsed);
            }
        }
        questionStartTime = Date.now();
    }

    function navigateToQuestion(targetIndex) {
        if (targetIndex < 0 || targetIndex >= allQuestions.length) return;

        // Record time spent on previous question
        recordTimeForCurrentQuestion();

        currentQIndex = targetIndex;
        const q = allQuestions[currentQIndex];

        // If switching subject, update active tab
        if (q.subjectIdx !== currentSubjectIdx) {
            currentSubjectIdx = q.subjectIdx;
            document.querySelectorAll('.subject-tab-btn').forEach((btn, i) => {
                btn.classList.toggle('active', i === currentSubjectIdx);
            });
        }

        // Auto-close palette drawer on mobile screens upon question selection
        if (window.innerWidth <= 860) {
            togglePaletteCollapse(false);
        }

        renderQuestion(currentQIndex);
    }

    function renderQuestion(index) {
        const q = allQuestions[index];
        if (!q) return;

        // Update Question Header Pills
        const lblNum = document.getElementById('q-label-number');
        const lblType = document.getElementById('q-label-type');
        const lblMarks = document.getElementById('q-label-marks');

        if (lblNum) lblNum.textContent = `Question ${q.displayNumber}`;
        if (lblType) lblType.textContent = q.questionType || 'Single Choice';

        const posMarks = q.mark !== undefined ? q.mark : (q.marks !== undefined ? q.marks : 4);
        const negMarks = q.negativeMarks !== undefined ? q.negativeMarks : 1;
        if (lblMarks) lblMarks.textContent = `+${posMarks}, -${negMarks}`;

        // Update Question Image
        const imgEl = document.getElementById('q-image-element');
        if (imgEl) {
            imgEl.src = q.questionImage || '';
            imgEl.alt = `Question ${q.displayNumber}`;
            resetZoom();
        }

        // Scroll to top of content
        const scrollArea = document.getElementById('question-scroll-area');
        if (scrollArea) scrollArea.scrollTop = 0;

        // Current status update: if not visited, mark as not-answered
        const curAns = answersMap[q.questionId];
        if (curAns && curAns.status === 'not-visited') {
            curAns.status = 'not-answered';
        }

        // Render Options Area
        renderAnswerInputArea(q, curAns);

        // Previous button state
        const prevBtn = document.getElementById('btn-prev-q');
        if (prevBtn) {
            prevBtn.disabled = index === 0;
            prevBtn.style.opacity = index === 0 ? '0.5' : '1';
        }

        // Render Palette
        renderPalette();

        // Update expand pill and fullscreen if open
        updatePalettePillText();
        syncFullscreenQuestion();
    }

    function renderAnswerInputArea(q, curAns) {
        const inner = document.getElementById('options-inner-box');
        const title = document.getElementById('options-type-title');
        if (!inner) return;

        const qType = String(q.questionType || '').toLowerCase();
        const isMulti = qType.includes('multi') || qType.includes('more than one');
        const isNumerical = qType.includes('integer') || qType.includes('numeric') || qType.includes('numerical');

        const savedValue = (curAns?.markedAnswer || '').trim();

        if (isNumerical) {
            if (title) title.textContent = 'Enter Numerical Answer:';
            inner.innerHTML = `
                <div class="numerical-box">
                    <input type="text" class="numerical-input-field" id="numerical-input"
                           value="${escapeHtml(savedValue)}" placeholder="e.g. 42 or -3.5" autocomplete="off" />
                    <div class="keypad-grid">
                        <button class="keypad-btn" onclick="appendKeypad('1')">1</button>
                        <button class="keypad-btn" onclick="appendKeypad('2')">2</button>
                        <button class="keypad-btn" onclick="appendKeypad('3')">3</button>
                        <button class="keypad-btn" onclick="appendKeypad('4')">4</button>
                        <button class="keypad-btn" onclick="appendKeypad('5')">5</button>
                        <button class="keypad-btn" onclick="appendKeypad('6')">6</button>
                        <button class="keypad-btn" onclick="appendKeypad('7')">7</button>
                        <button class="keypad-btn" onclick="appendKeypad('8')">8</button>
                        <button class="keypad-btn" onclick="appendKeypad('9')">9</button>
                        <button class="keypad-btn" onclick="appendKeypad('.')">.</button>
                        <button class="keypad-btn" onclick="appendKeypad('0')">0</button>
                        <button class="keypad-btn" onclick="appendKeypad('-')">-</button>
                        <button class="keypad-btn" onclick="clearKeypad()" style="color: #ef4444; font-weight: 700;">CLR</button>
                        <button class="keypad-btn" onclick="backspaceKeypad()" style="grid-column: span 2; font-weight: 700;">⌫ DEL</button>
                    </div>
                </div>
            `;
        } else {
            // Standard Options: A, B, C, D (Options embedded in question image)
            if (title) title.textContent = isMulti ? 'Select Option(s):' : 'Select Option:';

            const optionsList = ['A', 'B', 'C', 'D'];
            const selectedList = isMulti ? savedValue.split(',').map(s => s.trim().toUpperCase()) : [savedValue.toUpperCase()];

            inner.innerHTML = `
                <div class="mcq-options-row">
                    ${optionsList.map(opt => {
                        const isSelected = selectedList.includes(opt);
                        return `
                            <div class="option-label-card ${isSelected ? 'selected' : ''}"
                                 id="opt-card-${opt}"
                                 data-opt="${opt}"
                                 onclick="handleOptionSelect('${opt}', ${isMulti})"
                                 title="Option ${opt} (Key: ${opt})">
                                <span class="opt-badge">${opt}</span>
                                <span class="opt-key-hint">${opt}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    }

    // --- Keypad & Option Interactions ---
    function handleOptionSelect(opt, isMulti) {
        const card = document.getElementById(`opt-card-${opt}`);
        const fsCard = document.getElementById(`fs-opt-card-${opt}`);

        if (isMulti) {
            // Toggle selection
            if (card) card.classList.toggle('selected');
            if (fsCard) fsCard.classList.toggle('selected');
        } else {
            // Single selection: unselect others and select this
            document.querySelectorAll('.option-label-card').forEach(c => c.classList.remove('selected'));
            document.querySelectorAll('.fs-opt-card').forEach(c => c.classList.remove('selected'));
            if (card) card.classList.add('selected');
            if (fsCard) fsCard.classList.add('selected');
        }
    }

    function appendKeypad(val) {
        const inp = document.getElementById('numerical-input');
        if (!inp) return;
        if (val === '-' && inp.value.length > 0) return; // Only at start
        if (val === '.' && inp.value.includes('.')) return; // Only single decimal
        inp.value += val;
    }

    function backspaceKeypad() {
        const inp = document.getElementById('numerical-input');
        if (!inp) return;
        inp.value = inp.value.slice(0, -1);
    }

    function clearKeypad() {
        const inp = document.getElementById('numerical-input');
        if (!inp) return;
        inp.value = '';
    }

    function getSelectedResponse(q) {
        const qType = String(q.questionType || '').toLowerCase();
        const isNumerical = qType.includes('integer') || qType.includes('numeric') || qType.includes('numerical');

        if (isNumerical) {
            const inp = document.getElementById('numerical-input');
            return inp ? inp.value.trim() : '';
        }

        const selectedCards = document.querySelectorAll('.option-label-card.selected');
        const selectedValues = [];
        selectedCards.forEach(c => {
            const badge = c.querySelector('.opt-badge');
            if (badge && badge.textContent.trim()) {
                selectedValues.push(badge.textContent.trim().toUpperCase());
            }
        });

        selectedValues.sort();
        return selectedValues.join(', ');
    }

    function clearCurrentResponse() {
        const q = allQuestions[currentQIndex];
        if (!q) return;

        // Clear UI
        document.querySelectorAll('.option-label-card').forEach(c => c.classList.remove('selected'));
        document.querySelectorAll('.fs-opt-card').forEach(c => c.classList.remove('selected'));
        const inp = document.getElementById('numerical-input');
        if (inp) inp.value = '';
        const fsInp = document.getElementById('fs-numerical-input');
        if (fsInp) fsInp.value = '';

        // Update state
        const curAns = answersMap[q.questionId];
        if (curAns) {
            curAns.markedAnswer = '';
            curAns.status = 'not-answered';
            curAns.isReviewLater = false;
        }

        renderPalette();
        showToast('Response cleared');
    }

    // --- Save & Next / Review Actions ---
    async function saveAndNext() {
        const q = allQuestions[currentQIndex];
        if (!q) return;

        recordTimeForCurrentQuestion();

        const responseVal = getSelectedResponse(q);
        const hasAnswer = responseVal.length > 0;

        const curAns = answersMap[q.questionId];
        curAns.markedAnswer = responseVal;
        curAns.status = hasAnswer ? 'answered' : 'not-answered';
        curAns.isReviewLater = false;
        curAns.localTimestamp = new Date().toLocaleString('en-IN');

        // Async dispatch to SaveExamAnswer API (no blocking UI)
        sendAnswerToNTSC(curAns);

        // Move to next question or open submit modal if on last question
        if (currentQIndex < allQuestions.length - 1) {
            navigateToQuestion(currentQIndex + 1);
        } else {
            renderPalette();
            openSubmitConfirmModal();
        }
    }

    async function markForReviewAndNext() {
        const q = allQuestions[currentQIndex];
        if (!q) return;

        recordTimeForCurrentQuestion();

        const responseVal = getSelectedResponse(q);
        const hasAnswer = responseVal.length > 0;

        const curAns = answersMap[q.questionId];
        curAns.markedAnswer = responseVal;
        curAns.status = hasAnswer ? 'answered-review' : 'review';
        curAns.isReviewLater = true;
        curAns.localTimestamp = new Date().toLocaleString('en-IN');

        // Async dispatch to SaveExamAnswer API
        sendAnswerToNTSC(curAns);

        // Move to next question
        if (currentQIndex < allQuestions.length - 1) {
            navigateToQuestion(currentQIndex + 1);
        } else {
            renderPalette();
            openSubmitConfirmModal();
        }
    }

    function goToPreviousQuestion() {
        if (currentQIndex > 0) {
            navigateToQuestion(currentQIndex - 1);
        }
    }

    // --- NTSC SaveExamAnswer API ---
    async function sendAnswerToNTSC(ans) {
        if (!token || !testId) return;

        // Student's marked answer is sent under "rightAnswer"
        const answerPayload = [{
            studentExamId: studentExamId,
            questionId: ans.questionId,
            questionNo: ans.questionNo,
            rightAnswer: ans.markedAnswer || '',
            isReviewLater: Boolean(ans.isReviewLater),
            matricesRightOption: [],
            timeTaken: ans.timeTaken || 1,
            topicPaperId: Number(testId),
            examGuid: examGuid,
            studentId: Number(studentId),
            synced: false,
            localTimestamp: ans.localTimestamp || new Date().toLocaleString('en-IN')
        }];

        try {
            await proxyFetch('https://ntsc.narayanatalent.com/attemptexam-service/api/ExaminationHall/SaveExamAnswer?disableInternetCheck=true', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(answerPayload)
            });
        } catch (err) {
            console.warn('SaveExamAnswer background sync error (will be synced on submission):', err);
        }
    }

    // --- Submit Confirmation Modal & Final Submission ---
    function openSubmitConfirmModal() {
        recordTimeForCurrentQuestion();

        const modal = document.getElementById('modal-submit-summary');
        const tbody = document.getElementById('summary-table-body');
        if (!modal || !tbody) return;

        // Build subject-wise summary breakdown
        tbody.innerHTML = subjectPapers.map((sp, idx) => {
            const subjQuestions = allQuestions.filter(q => q.subjectIdx === idx);
            let ansCount = 0;
            let notAnsCount = 0;
            let revCount = 0;

            subjQuestions.forEach(q => {
                const a = answersMap[q.questionId];
                if (!a || a.status === 'not-visited' || a.status === 'not-answered') {
                    notAnsCount++;
                } else if (a.status === 'answered') {
                    ansCount++;
                } else if (a.status === 'review' || a.status === 'answered-review') {
                    revCount++;
                }
            });

            return `
                <tr>
                    <td style="padding: 8px 10px; border: 1px solid var(--border); font-weight: 600; color: var(--text);">
                        ${escapeHtml(sp.subjectName || `Subject ${idx + 1}`)}
                    </td>
                    <td style="padding: 8px 10px; border: 1px solid var(--border); text-align: center; font-weight: 600;">
                        ${subjQuestions.length}
                    </td>
                    <td style="padding: 8px 10px; border: 1px solid var(--border); text-align: center; color: var(--green); font-weight: 700;">
                        ${ansCount}
                    </td>
                    <td style="padding: 8px 10px; border: 1px solid var(--border); text-align: center; color: var(--red); font-weight: 700;">
                        ${notAnsCount}
                    </td>
                    <td style="padding: 8px 10px; border: 1px solid var(--border); text-align: center; color: var(--purple); font-weight: 700;">
                        ${revCount}
                    </td>
                </tr>
            `;
        }).join('');

        modal.style.display = 'flex';
    }

    function closeSubmitConfirmModal() {
        const modal = document.getElementById('modal-submit-summary');
        if (modal) modal.style.display = 'none';
        questionStartTime = Date.now();
    }

    async function confirmFinalSubmit() {
        const btn = document.getElementById('btn-confirm-submit-exam');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Submitting Responses...';
        }

        try {
            await finalizeExamSubmission();
        } catch (err) {
            console.error('Submission error:', err);
            alert(`Error during exam submission: ${err.message || 'Network error'}. Please retry.`);
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Yes, Submit Exam';
            }
        }
    }

    async function finalizeExamSubmission() {
        // Stop timer
        if (timerInterval) clearInterval(timerInterval);

        // Step 1: Bulk Save all answers
        const bulkAnswersPayload = allQuestions.map(q => {
            const ans = answersMap[q.questionId] || {};
            return {
                studentExamId: studentExamId,
                questionId: q.questionId,
                questionNo: q.displayNumber,
                rightAnswer: ans.markedAnswer || '',
                isReviewLater: Boolean(ans.isReviewLater),
                matricesRightOption: [],
                timeTaken: ans.timeTaken || 0,
                topicPaperId: Number(testId),
                examGuid: examGuid,
                studentId: Number(studentId),
                synced: false,
                localTimestamp: ans.localTimestamp || new Date().toLocaleString('en-IN')
            };
        });

        try {
            await proxyFetch('https://ntsc.narayanatalent.com/attemptexam-service/api/ExaminationHall/SaveExamAnswer?disableInternetCheck=true', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(bulkAnswersPayload)
            });
        } catch (e) {
            console.warn('Bulk SaveExamAnswer notice:', e);
        }

        // Step 2: Call FinishExam endpoint
        // curl: https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/FinishExam/${examGuid}?status=Submitted
        const finishRes = await proxyFetch(`https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/FinishExam/${examGuid}?status=Submitted`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!finishRes.ok) {
            console.warn(`FinishExam responded with HTTP ${finishRes.status}, proceeding with completion confirmation.`);
        }

        // Close Summary modal and display Success Modal
        const summaryModal = document.getElementById('modal-submit-summary');
        if (summaryModal) summaryModal.style.display = 'none';

        const successModal = document.getElementById('modal-submit-success');
        if (successModal) successModal.style.display = 'flex';
    }

    function viewTestResult() {
        // Open main portal or test result viewer
        if (window.opener) {
            try {
                window.opener.location.href = `../index.html`;
            } catch (_) {}
            window.close();
        } else {
            window.location.href = `test-ids.html`;
        }
    }

    // --- Zoom Controls ---
    function zoomImage(factor) {
        const img = document.getElementById('q-image-element');
        if (!img) return;
        currentZoom = Math.max(0.6, Math.min(3.0, currentZoom * factor));
        img.style.transform = `scale(${currentZoom})`;
    }

    function resetZoom() {
        currentZoom = 1.0;
        const img = document.getElementById('q-image-element');
        if (img) img.style.transform = 'scale(1.0)';
    }

    // --- Palette Minimizing & Mobile Toggle ---
    function togglePaletteCollapse(forceState) {
        const pal = document.getElementById('palette-sidebar');
        const btn = document.getElementById('btn-toggle-palette');
        const pill = document.getElementById('palette-expand-pill');
        const backdrop = document.getElementById('palette-backdrop');
        if (!pal) return;

        if (window.innerWidth <= 860) {
            // Mobile drawer behavior
            if (forceState === false) {
                pal.classList.remove('open');
                if (backdrop) backdrop.classList.remove('open');
                if (btn) btn.classList.remove('active');
                return;
            }
            const isOpen = pal.classList.toggle('open');
            if (backdrop) backdrop.classList.toggle('open', isOpen);
            if (btn) btn.classList.toggle('active', isOpen);
        } else {
            // Desktop minimizable sidebar
            const shouldCollapse = (typeof forceState === 'boolean') ? forceState : !pal.classList.contains('collapsed');
            pal.classList.toggle('collapsed', shouldCollapse);
            if (pill) pill.classList.toggle('visible', shouldCollapse);
            if (btn) btn.classList.toggle('active', !shouldCollapse);
            sessionStorage.setItem('fy_palette_collapsed', shouldCollapse ? 'true' : 'false');
            updatePalettePillText();
        }
    }

    function togglePaletteMobile(forceClose) {
        togglePaletteCollapse(forceClose ? false : undefined);
    }

    function updatePalettePillText() {
        const pillText = document.getElementById('pill-q-label');
        if (!pillText) return;
        const q = allQuestions[currentQIndex];
        if (q) {
            pillText.textContent = `Question ${q.displayNumber} of ${allQuestions.length}`;
        }
    }

    // --- Invert Colors Mode ---
    function toggleImageInvert(forceState) {
        const card = document.getElementById('q-img-card');
        const fsWrapper = document.getElementById('fs-img-wrapper');
        const btn = document.getElementById('btn-toggle-invert');
        const fsBtn = document.getElementById('fs-btn-invert');

        const isCurrentlyInverted = card ? card.classList.contains('inverted') : false;
        const nextState = (typeof forceState === 'boolean') ? forceState : !isCurrentlyInverted;

        if (card) card.classList.toggle('inverted', nextState);
        if (fsWrapper) fsWrapper.classList.toggle('inverted', nextState);
        if (btn) btn.classList.toggle('active', nextState);
        if (fsBtn) fsBtn.classList.toggle('active', nextState);

        sessionStorage.setItem('fy_img_invert', nextState ? 'true' : 'false');
    }

    // --- Interactive Fullscreen Image Lightbox ---
    let fsZoom = 1.0;
    let fsPanX = 0;
    let fsPanY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let fsInteractionsAttached = false;

    function openImageFullscreen() {
        const modal = document.getElementById('image-fullscreen-modal');
        const q = allQuestions[currentQIndex];
        if (!modal || !q) return;

        modal.style.display = 'flex';
        resetFullscreenZoom();
        syncFullscreenQuestion();
        updateTimerDisplay();
        setupFullscreenInteractions();
    }

    function closeImageFullscreen() {
        const modal = document.getElementById('image-fullscreen-modal');
        if (modal) modal.style.display = 'none';
    }

    function syncFullscreenQuestion() {
        const q = allQuestions[currentQIndex];
        const modal = document.getElementById('image-fullscreen-modal');
        if (!q || !modal || modal.style.display === 'none') return;

        const badge = document.getElementById('fs-q-badge');
        const typeEl = document.getElementById('fs-q-type');
        const imgEl = document.getElementById('fs-image-element');
        const prevBtn = document.getElementById('fs-btn-prev');

        if (badge) badge.textContent = `Q${q.displayNumber}`;
        if (typeEl) typeEl.textContent = q.questionType || 'Single Choice';
        if (imgEl) {
            imgEl.src = q.questionImage || '';
            imgEl.alt = `Question ${q.displayNumber}`;
        }
        if (prevBtn) {
            prevBtn.disabled = currentQIndex === 0;
            prevBtn.style.opacity = currentQIndex === 0 ? '0.35' : '1';
        }

        renderFullscreenOptions(q);
    }

    function renderFullscreenOptions(q) {
        const container = document.getElementById('fs-options-container');
        if (!container) return;

        const qType = String(q.questionType || '').toLowerCase();
        const isMulti = qType.includes('multi') || qType.includes('more than one');
        const isNumerical = qType.includes('integer') || qType.includes('numeric') || qType.includes('numerical');
        const curAns = answersMap[q.questionId];
        const savedValue = (curAns?.markedAnswer || '').trim();

        if (isNumerical) {
            container.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 12px; font-weight: 700; color: var(--text2);">Ans:</span>
                    <input type="text" id="fs-numerical-input" value="${escapeHtml(savedValue)}"
                           placeholder="Type answer..."
                           style="font-family: var(--font-mono); font-size: 15px; font-weight: 700; height: 36px; padding: 0 12px; background: var(--bg3); border: 1.5px solid var(--border); border-radius: 8px; color: var(--text); width: 130px; outline: none;" />
                </div>
            `;
            const fsInp = document.getElementById('fs-numerical-input');
            const mainInp = document.getElementById('numerical-input');
            if (fsInp) {
                fsInp.addEventListener('input', () => {
                    if (mainInp) mainInp.value = fsInp.value;
                });
            }
        } else {
            const optionsList = ['A', 'B', 'C', 'D'];
            const selectedList = isMulti ? savedValue.split(',').map(s => s.trim().toUpperCase()) : [savedValue.toUpperCase()];

            container.innerHTML = `
                <div class="fs-abcd-group">
                    ${optionsList.map(opt => {
                        const isSelected = selectedList.includes(opt);
                        return `
                            <button type="button" class="fs-opt-btn ${isSelected ? 'selected' : ''}"
                                    id="fs-opt-card-${opt}"
                                    onclick="handleOptionSelect('${opt}', ${isMulti})"
                                    title="Select Option ${opt} (Key: ${opt})">
                                ${opt}
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        }
    }

    function zoomFullscreenImage(factor) {
        fsZoom = Math.max(0.5, Math.min(4.0, fsZoom * factor));
        applyFsTransform();
    }

    function resetFullscreenZoom() {
        fsZoom = 1.0;
        fsPanX = 0;
        fsPanY = 0;
        applyFsTransform();
    }

    function applyFsTransform() {
        const wrapper = document.getElementById('fs-img-wrapper');
        const levelEl = document.getElementById('fs-zoom-level');
        if (wrapper) {
            wrapper.style.transform = `translate(${fsPanX}px, ${fsPanY}px) scale(${fsZoom})`;
        }
        if (levelEl) {
            levelEl.textContent = `${Math.round(fsZoom * 100)}%`;
        }
    }

    function setupFullscreenInteractions() {
        if (fsInteractionsAttached) return;
        fsInteractionsAttached = true;

        const body = document.getElementById('fs-body');
        if (!body) return;

        body.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.15 : 0.85;
            zoomFullscreenImage(factor);
        }, { passive: false });

        body.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isDragging = true;
            dragStartX = e.clientX - fsPanX;
            dragStartY = e.clientY - fsPanY;
            body.classList.add('dragging');
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            fsPanX = e.clientX - dragStartX;
            fsPanY = e.clientY - dragStartY;
            applyFsTransform();
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                body.classList.remove('dragging');
            }
        });
    }

    // --- Global Keyboard Shortcuts ---
    function handleGlobalKeydown(e) {
        const target = e.target;
        const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

        if (e.key === 'Escape') {
            const fsModal = document.getElementById('image-fullscreen-modal');
            if (fsModal && fsModal.style.display !== 'none') {
                closeImageFullscreen();
                return;
            }
            const submitModal = document.getElementById('modal-submit-summary');
            if (submitModal && submitModal.style.display !== 'none') {
                closeSubmitConfirmModal();
                return;
            }
        }

        if (isInput) return;

        const fsModal = document.getElementById('image-fullscreen-modal');
        const isFsOpen = fsModal && fsModal.style.display !== 'none';

        // Fullscreen toggle: 'f' or 'F'
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            if (isFsOpen) {
                closeImageFullscreen();
            } else {
                openImageFullscreen();
            }
            return;
        }

        // Toggle Palette Sidebar: 'p', 'P', or 'Ctrl+B' (only in normal mode)
        if (!isFsOpen && (e.key === 'p' || e.key === 'P' || (e.ctrlKey && (e.key === 'b' || e.key === 'B')))) {
            e.preventDefault();
            togglePaletteCollapse();
            return;
        }

        // Invert colors: 'i' or 'I'
        if (e.key === 'i' || e.key === 'I') {
            e.preventDefault();
            toggleImageInvert();
            return;
        }

        // Zoom keys: '+' or '='
        if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            if (isFsOpen) {
                zoomFullscreenImage(1.2);
            } else {
                zoomImage(1.15);
            }
            return;
        }

        // Zoom out keys: '-' or '_'
        if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            if (isFsOpen) {
                zoomFullscreenImage(0.8);
            } else {
                zoomImage(0.85);
            }
            return;
        }

        // Reset zoom: '0'
        if (e.key === '0') {
            e.preventDefault();
            if (isFsOpen) {
                resetFullscreenZoom();
            } else {
                resetZoom();
            }
            return;
        }

        // Option Selection: 'a'-'d' or '1'-'4'
        const q = allQuestions[currentQIndex];
        if (q) {
            const qType = String(q.questionType || '').toLowerCase();
            const isMulti = qType.includes('multi') || qType.includes('more than one');
            const isNumerical = qType.includes('integer') || qType.includes('numeric') || qType.includes('numerical');

            if (!isNumerical) {
                const optMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', 'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D' };
                const chosen = optMap[e.key.toLowerCase()];
                if (chosen) {
                    e.preventDefault();
                    handleOptionSelect(chosen, isMulti);
                    return;
                }
            }
        }

        // Fast Next navigation via Enter, Space (in fullscreen), or ArrowRight
        if (e.key === 'ArrowRight' || (isFsOpen && (e.key === 'Enter' || e.key === ' '))) {
            e.preventDefault();
            saveAndNext();
            syncFullscreenQuestion();
            return;
        }

        // Navigation: ArrowLeft for Previous
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goToPreviousQuestion();
            syncFullscreenQuestion();
            return;
        }
    }

    function escapeHtml(str) {
        return String(str !== null && str !== undefined ? str : '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function exitExam() {
        if (examGuid && timeRemainingSeconds > 0) {
            const leave = confirm('Are you sure you want to exit the exam hall? Your recorded answers so far have been saved, but the timer will continue.');
            if (!leave) return;
        }
        if (window.opener && !window.opener.closed) {
            window.close();
        } else {
            window.location.href = '../index.html?module=settings&panel=functions';
        }
    }

    // Expose global methods for HTML onclick attributes
    window.loadTestFromLauncher = loadTestFromLauncher;
    window.startExamSession = startExamSession;
    window.switchSubject = switchSubject;
    window.navigateToQuestion = navigateToQuestion;
    window.handleOptionSelect = handleOptionSelect;
    window.appendKeypad = appendKeypad;
    window.backspaceKeypad = backspaceKeypad;
    window.clearKeypad = clearKeypad;
    window.clearCurrentResponse = clearCurrentResponse;
    window.saveAndNext = saveAndNext;
    window.markForReviewAndNext = markForReviewAndNext;
    window.goToPreviousQuestion = goToPreviousQuestion;
    window.openSubmitConfirmModal = openSubmitConfirmModal;
    window.closeSubmitConfirmModal = closeSubmitConfirmModal;
    window.confirmFinalSubmit = confirmFinalSubmit;
    window.viewTestResult = viewTestResult;
    window.zoomImage = zoomImage;
    window.resetZoom = resetZoom;
    window.togglePaletteCollapse = togglePaletteCollapse;
    window.togglePaletteMobile = togglePaletteMobile;
    window.toggleImageInvert = toggleImageInvert;
    window.openImageFullscreen = openImageFullscreen;
    window.closeImageFullscreen = closeImageFullscreen;
    window.zoomFullscreenImage = zoomFullscreenImage;
    window.resetFullscreenZoom = resetFullscreenZoom;
    window.syncFullscreenQuestion = syncFullscreenQuestion;
    window.submitGatePasscode = submitGatePasscode;
    window.exitExam = exitExam;

    // Run on page load
    document.addEventListener('DOMContentLoaded', initPage);

})();
