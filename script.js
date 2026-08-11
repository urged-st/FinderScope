const canvas = document.getElementById('skyCanvas');
const ctx = canvas.getContext('2d');
const label = document.getElementById('label');
const feedback = document.getElementById('feedback');
const statsReadout = document.getElementById('statsReadout');
const guessInput = document.getElementById('guessInput');
const guessBtn = document.getElementById('guessBtn');
const giveUpBtn = document.getElementById('giveUpBtn');
const difficultyInputs = document.querySelectorAll('input[name="difficulty"]');
const difficultySwitch = document.getElementById('difficultySwitch');

const quizModeBtn = document.getElementById('quizModeBtn');
const learnModeBtn = document.getElementById('learnModeBtn');
const testModeBtn = document.getElementById('testModeBtn');
const quizControls = document.getElementById('quizControls');
const learnControls = document.getElementById('learnControls');
const testControls = document.getElementById('testControls');
const hemisphereInputs = document.querySelectorAll('input[name="hemisphere"]');
const constellationSelect = document.getElementById('constellationSelect');
const prevConsBtn = document.getElementById('prevConsBtn');
const nextConsBtn = document.getElementById('nextConsBtn');
const learnInfo = document.getElementById('learnInfo');

const testStatus = document.getElementById('testStatus');
const testTimer = document.getElementById('testTimer');
const startTestBtn = document.getElementById('startTestBtn');
const testGuessRow = document.getElementById('testGuessRow');
const testGuessInput = document.getElementById('testGuessInput');
const testGuessBtn = document.getElementById('testGuessBtn');
const testFeedback = document.getElementById('testFeedback');

const W = canvas.width;
const H = canvas.height;

// how wide the camera fov is, w how far out we pull neighbours from
let FOV_RADIUS_DEG = 40;
const FOV_MIN_DEG = 12;
const FOV_MAX_DEG = 75;

function includeRadius()
{
    return FOV_RADIUS_DEG + 5; // down from a flat 55
}

let SCALE = (0.9 * Math.min(W, H) / 2) / rhoForAngle(FOV_RADIUS_DEG);

function toRad(deg)
{
    return deg * Math.PI / 180;
}

// angular distance between two points on the sky, in degrees
function angularSep(ra, dec, ra0, dec0)
{
    const rar = toRad(ra);
    const decr = toRad(dec);
    const ra0r = toRad(ra0);
    const dec0r = toRad(dec0);

    const cosc = Math.sin(dec0r) * Math.sin(decr) + Math.cos(dec0r) * Math.cos(decr) * Math.cos(rar - ra0r);
    return Math.acos(Math.max(-1, Math.min(1, cosc))) * 180 / Math.PI;
}

// stereographic projection centred on (ra0, dec0), degrees in, unitless out
function project(ra, dec, ra0, dec0)
{
    const rar = toRad(ra);
    const decr = toRad(dec);
    const ra0r = toRad(ra0);
    const dec0r = toRad(dec0);

    const cosc = Math.sin(dec0r) * Math.sin(decr) + Math.cos(dec0r) * Math.cos(decr) * Math.cos(rar - ra0r);
    const k = 2 / (1 + cosc);

    // flip x since we're looking up from inside the sphere, not down at a flat map
    const x = -k * Math.cos(decr) * Math.sin(rar - ra0r);
    const y = k * (Math.cos(dec0r) * Math.sin(decr) - Math.sin(dec0r) * Math.cos(decr) * Math.cos(rar - ra0r));

    return { x, y };
}

// projected radius for a given angle from centre, keeps the camera zoom fixed
function rhoForAngle(deg)
{
    return 2 * Math.tan(toRad(deg) / 2);
}

// how close (in degrees) a constellation's actual boundary gets to a point
function boundaryDistance(cons, ra0, dec0)
{
    let min = Infinity;
    for (const ring of cons.bounds)
    {
        for (const [ra, dec] of ring)
        {
            const d = angularSep(ra, dec, ra0, dec0);
            if (d < min) min = d;
        }
    }
    return min;
}

// grabs every constellation whose actual bounded territory comes within includeRadius() of the camera, closest first
function findInView(ra0, dec0)
{
    return CONSTELLATIONS
        .map(cons => ({ cons, dist: boundaryDistance(cons, ra0, dec0) }))
        .filter(({ dist }) => dist <= includeRadius())
        .sort((a, b) => a.dist - b.dist);
}

function drawBoundary(cons, ra0, dec0, color)
{
    function toCanvas(ra, dec)
    {
        const p = project(ra, dec, ra0, dec0);
        return {
            x: W / 2 + p.x * SCALE,
            y: H / 2 - p.y * SCALE
        };
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (const ring of cons.bounds)
    {
        ctx.beginPath();
        ring.forEach(([ra, dec], i) =>
        {
            const c = toCanvas(ra, dec);
            if (i === 0) ctx.moveTo(c.x, c.y);
            else ctx.lineTo(c.x, c.y);
        });
        ctx.closePath();
        ctx.stroke();
    }

    ctx.setLineDash([]); // back to solid for whatever draws next
}

function drawLines(cons, ra0, dec0, color, lineWidth, showLines)
{
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;

    function toCanvas(ra, dec)
    {
        const p = project(ra, dec, ra0, dec0);
        return {
            x: W / 2 + p.x * SCALE,
            y: H / 2 - p.y * SCALE // flip y cus canvas y grows downward
        };
    }

    for (const line of cons.lines)
    {
        if (showLines)
        {
            ctx.beginPath();
            line.forEach(([ra, dec], i) =>
            {
                const c = toCanvas(ra, dec);
                if (i === 0) ctx.moveTo(c.x, c.y);
                else ctx.lineTo(c.x, c.y);
            });
            ctx.stroke();
        }

        // stars always show, lines depend on difficulty
        for (const [ra, dec] of line)
        {
            const c = toCanvas(ra, dec);
            ctx.beginPath();
            ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// draws whatever's currently in view around (camRA, camDec), target highlighted, rest fades w distance
function drawScene(camRA, camDec, difficulty)
{
    ctx.clearRect(0, 0, W, H);

    const inView = findInView(camRA, camDec);

    // learn mode always shows every line, quiz mode goes off difficulty
    const showNeighbourLines = mode === 'learn' ? true : difficulty !== 'hard';
    const showTargetLines = mode === 'learn' ? true : difficulty === 'easy';

    for (const { cons, dist } of inView)
    {
        const isTarget = cons.id === current.id;

        if (isTarget)
        {
            drawLines(cons, camRA, camDec, '#5a8dee', 1.8, showTargetLines);
            continue;
        }

        // closer neighbours stay clearer, distant ones fade out
        ctx.globalAlpha = Math.max(0.15, 1 - dist / includeRadius());
        drawLines(cons, camRA, camDec, '#2e3d5c', 1, showNeighbourLines);
        ctx.globalAlpha = 1;
    }

    if (mode === 'learn')
    {
        drawBoundary(current, camRA, camDec, '#d4a15c');
    }

    label.textContent = `${inView.length} constellations in frame`;
}

function pickRandomConstellation()
{
    const list = filteredList();
    return list[Math.floor(Math.random() * list.length)];
}

function currentDifficulty()
{
    return document.querySelector('input[name="difficulty"]:checked').value;
}

// strips punctuation/case so "Ursa Major" matches "ursa major" etc
function normalise(str)
{
    return str.toLowerCase().replace(/[^a-z]/g, '').trim();
}

function checkGuess(guess, target)
{
    const g = normalise(guess);
    return g === normalise(target.name) || g === normalise(target.en);
}

// streak resets on any wrong guess or giving up, best streak w overall accuracy persist across sessions
const STATS_KEY = 'finderscope_stats';
let streak = 0;

function loadStats()
{
    try
    {
        const raw = localStorage.getItem(STATS_KEY);
        if (raw) return JSON.parse(raw);
    }
    catch (e) { /* private browsing or w/e, just start fresh */ }

    return { bestStreak: 0, totalCorrect: 0, totalGuesses: 0 };
}

function saveStats()
{
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }
    catch (e) { /* not the end of the world if it doesn't persist */ }
}

function updateStatsDisplay()
{
    const accuracy = stats.totalGuesses ? Math.round(100 * stats.totalCorrect / stats.totalGuesses) : 0;
    statsReadout.textContent = `streak: ${streak} · best: ${stats.bestStreak} · accuracy: ${accuracy}%`;
}

const stats = loadStats();
updateStatsDisplay();

let mode = 'quiz';
let current = pickRandomConstellation();
let cameraRA = current.center[0];
let cameraDec = current.center[1];

drawScene(cameraRA, cameraDec, currentDifficulty());

difficultyInputs.forEach(input =>
{
    input.addEventListener('change', () =>
    {
        if (mode === 'test' && testActive)
        {
            stopTest(); // round count depends on difficulty
            startTest();
            return;
        }

        drawScene(cameraRA, cameraDec, currentDifficulty());
    });
});

function submitGuess()
{
    const guess = guessInput.value.trim();
    if (!guess) return;

    feedback.classList.remove('success', 'warn');
    stats.totalGuesses++;

    if (checkGuess(guess, current))
    {
        feedback.textContent = `correct! it's ${current.name} (${current.en})`;
        feedback.classList.add('success');
        streak++;
        stats.totalCorrect++;
        if (streak > stats.bestStreak) stats.bestStreak = streak;
        autoAdvanceTimer = setTimeout(startNewRound, 2000);
    }
    else
    {
        feedback.textContent = 'nope, try again';
        feedback.classList.add('warn');
        streak = 0;
    }

    saveStats();
    updateStatsDisplay();
    guessInput.value = '';
}

guessBtn.addEventListener('click', submitGuess);
guessInput.addEventListener('keydown', e =>
{
    if (e.key === 'Enter') submitGuess();
});

let autoAdvanceTimer = null;

giveUpBtn.addEventListener('click', () =>
{
    clearTimeout(autoAdvanceTimer);
    feedback.classList.remove('success', 'warn');
    feedback.textContent = `it's ${current.name} (${current.en})`;
    feedback.classList.add('warn');
    streak = 0;
    saveStats();
    updateStatsDisplay();
    autoAdvanceTimer = setTimeout(startNewRound, 2000);
});

function startNewRound()
{
    clearTimeout(autoAdvanceTimer); // cancel a pending auto-advance if we're jumping rounds manually
    current = pickRandomConstellation();
    cameraRA = current.center[0];
    cameraDec = current.center[1];
    feedback.textContent = ''; feedback.classList.remove('success', 'warn');
    drawScene(cameraRA, cameraDec, currentDifficulty());
}

// drag to pan, mouse + touch. small angle approx per move, fine since steps are tiny
let dragging = false;
let lastX = 0;
let lastY = 0;

function panBy(dxPix, dyPix)
{
    const decRad = toRad(cameraDec);
    const dRaDeg = (dxPix / (SCALE * Math.cos(decRad))) * (180 / Math.PI);
    const dDecDeg = (dyPix / SCALE) * (180 / Math.PI);

    cameraRA = (cameraRA + dRaDeg + 360) % 360;
    cameraDec = Math.max(-89.5, Math.min(89.5, cameraDec + dDecDeg)); // clamp so we don't divide by ~0 near the pole

    drawScene(cameraRA, cameraDec, currentDifficulty());
}

// zooming just means a narrower/wider fov
function setZoom(newFov)
{
    FOV_RADIUS_DEG = Math.max(FOV_MIN_DEG, Math.min(FOV_MAX_DEG, newFov));
    SCALE = (0.9 * Math.min(W, H) / 2) / rhoForAngle(FOV_RADIUS_DEG);
    drawScene(cameraRA, cameraDec, currentDifficulty());
}

function pointerPos(e, isTouch)
{
    const rect = canvas.getBoundingClientRect();
    const point = isTouch ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
}

canvas.style.cursor = 'grab';

canvas.addEventListener('wheel', e =>
{
    e.preventDefault();
    // scroll down = zoom out (wider fov), scroll up = zoom in, step scales w current zoom
    const step = FOV_RADIUS_DEG * 0.08;
    setZoom(FOV_RADIUS_DEG + (e.deltaY > 0 ? step : -step));
}, { passive: false });

canvas.addEventListener('mousedown', e =>
{
    dragging = true;
    canvas.style.cursor = 'grabbing';
    const p = pointerPos(e, false);
    lastX = p.x;
    lastY = p.y;
});

window.addEventListener('mousemove', e =>
{
    if (!dragging) return;
    const p = pointerPos(e, false);
    panBy(p.x - lastX, p.y - lastY);
    lastX = p.x;
    lastY = p.y;
});

window.addEventListener('mouseup', () =>
{
    dragging = false;
    canvas.style.cursor = 'grab';
});

// pinch distance between two touch points, for zoom
function touchDistance(touches)
{
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

let pinching = false;
let lastPinchDist = 0;

canvas.addEventListener('touchstart', e =>
{
    if (e.touches.length === 2)
    {
        dragging = false;
        pinching = true;
        lastPinchDist = touchDistance(e.touches);
        return;
    }

    pinching = false;
    dragging = true;
    const p = pointerPos(e, true);
    lastX = p.x;
    lastY = p.y;
});

canvas.addEventListener('touchmove', e =>
{
    e.preventDefault(); // stop the page scrolling while dragging/pinching the sky

    if (pinching && e.touches.length === 2)
    {
        const dist = touchDistance(e.touches);
        // fingers spreading apart = zooming in (narrower fov), pinching together = zooming out
        const ratio = lastPinchDist / dist;
        setZoom(FOV_RADIUS_DEG * ratio);
        lastPinchDist = dist;
        return;
    }

    if (!dragging) return;
    const p = pointerPos(e, true);
    panBy(p.x - lastX, p.y - lastY);
    lastX = p.x;
    lastY = p.y;
}, { passive: false });

window.addEventListener('touchend', () =>
{
    dragging = false;
    pinching = false;
});

// learn mode: hemisphere filter + browsable list
function currentHemisphere()
{
    return document.querySelector('input[name="hemisphere"]:checked').value;
}

// north/south split just off the sign of the centre's dec
// uses the real boundary centroid rather than the line-figure centre
function inHemisphere(cons, hemisphere)
{
    if (hemisphere === 'all') return true;
    if (hemisphere === 'north') return cons.boundaryCenter[1] >= 0;
    return cons.boundaryCenter[1] < 0;
}

function filteredList()
{
    const hemisphere = currentHemisphere();
    return CONSTELLATIONS.filter(c => inHemisphere(c, hemisphere)).sort((a, b) => a.name.localeCompare(b.name));
}

function populateSelect()
{
    const list = filteredList();
    constellationSelect.innerHTML = '';
    for (const cons of list)
    {
        const opt = document.createElement('option');
        opt.value = cons.id;
        opt.textContent = cons.name;
        constellationSelect.appendChild(opt);
    }
}

function showLearnTarget(cons)
{
    current = cons;
    cameraRA = cons.center[0];
    cameraDec = cons.center[1];
    constellationSelect.value = cons.id;
    learnInfo.textContent = `${cons.name} — ${cons.en}`;
    drawScene(cameraRA, cameraDec, currentDifficulty());
}

hemisphereInputs.forEach(input =>
{
    input.addEventListener('change', () =>
    {
        if (mode === 'learn')
        {
            populateSelect();
            showLearnTarget(filteredList()[0]);
        }
        else if (mode === 'test')
        {
            if (testActive)
            {
                stopTest(); // bail without logging
                startTest();
            }
        }
        else
        {
            current = pickRandomConstellation();
            cameraRA = current.center[0];
            cameraDec = current.center[1];
            feedback.textContent = ''; feedback.classList.remove('success', 'warn');
            drawScene(cameraRA, cameraDec, currentDifficulty());
        }
    });
});

constellationSelect.addEventListener('change', () =>
{
    const cons = CONSTELLATIONS.find(c => c.id === constellationSelect.value);
    showLearnTarget(cons);
});

function stepList(delta)
{
    const list = filteredList();
    const i = list.findIndex(c => c.id === current.id);
    const nextIndex = (i + delta + list.length) % list.length;
    showLearnTarget(list[nextIndex]);
}

prevConsBtn.addEventListener('click', () => stepList(-1));
nextConsBtn.addEventListener('click', () => stepList(1));

function setMode(newMode)
{
    clearTimeout(autoAdvanceTimer);
    stopTest();
    mode = newMode;

    quizControls.style.display = mode === 'quiz' ? 'flex' : 'none';
    learnControls.style.display = mode === 'learn' ? 'flex' : 'none';
    testControls.style.display = mode === 'test' ? 'flex' : 'none';
    difficultySwitch.style.display = mode === 'learn' ? 'none' : 'flex';
    quizModeBtn.classList.toggle('active', mode === 'quiz');
    learnModeBtn.classList.toggle('active', mode === 'learn');
    testModeBtn.classList.toggle('active', mode === 'test');

    if (mode === 'learn')
    {
        populateSelect();
        showLearnTarget(filteredList()[0]);
    }
    else if (mode === 'quiz')
    {
        startNewRound();
    }
    else
    {
        resetTestUI();
    }
}

quizModeBtn.addEventListener('click', () => setMode('quiz'));
learnModeBtn.addEventListener('click', () => setMode('learn'));
testModeBtn.addEventListener('click', () => setMode('test'));

// test mode: timed, fixed rounds, no hints, logged to localStorage
function roundCountForDifficulty(difficulty)
{
    if (difficulty === 'easy') return 10;
    return 15; // medium and hard both get 15
}

const TEST_TIME_LIMIT = 10; // seconds per round
const TEST_LOG_KEY = 'finderscope_test_log';

let testActive = false;
let testRoundNum = 0;
let testRoundCount = 10;
let testScore = 0;
let testTimeLeft = 0;
let testIntervalId = null;
let testHemisphereAtStart = 'all';

function updateTestStatus()
{
    testStatus.textContent = testActive
        ? `round ${testRoundNum}/${testRoundCount} · score ${testScore}`
        : '';
}

function updateTestTimerDisplay()
{
    testTimer.textContent = testTimeLeft > 0 ? `${testTimeLeft}s` : '';
    testTimer.classList.toggle('flash', testTimeLeft > 0 && testTimeLeft <= 5);
}

function nextTestRound()
{
    clearInterval(testIntervalId);
    testRoundNum++;

    if (testRoundNum > testRoundCount)
    {
        endTest();
        return;
    }

    current = pickRandomConstellation();
    cameraRA = current.center[0];
    cameraDec = current.center[1];
    drawScene(cameraRA, cameraDec, currentDifficulty()); // same difficulty rules as quiz mode

    testTimeLeft = TEST_TIME_LIMIT;
    testFeedback.textContent = '';
    testFeedback.classList.remove('success', 'warn');
    testGuessInput.value = '';
    testGuessInput.focus();

    updateTestStatus();
    updateTestTimerDisplay();
    testIntervalId = setInterval(tickTestTimer, 1000);
}

function tickTestTimer()
{
    testTimeLeft--;
    updateTestTimerDisplay();

    if (testTimeLeft <= 0)
    {
        clearInterval(testIntervalId);
        testFeedback.textContent = `time's up, it was ${current.name}`;
        testFeedback.classList.add('warn');
        setTimeout(nextTestRound, 1200);
    }
}

function submitTestGuess()
{
    if (!testActive) return;

    const guess = testGuessInput.value.trim();
    if (!guess) return;

    clearInterval(testIntervalId);

    if (checkGuess(guess, current))
    {
        testScore++;
        testFeedback.textContent = 'correct!';
        testFeedback.classList.add('success');
    }
    else
    {
        testFeedback.textContent = `nope, it was ${current.name}`;
        testFeedback.classList.add('warn');
    }

    updateTestStatus();
    setTimeout(nextTestRound, 1200);
}

function saveTestResult(score, hemisphere)
{
    try
    {
        const raw = localStorage.getItem(TEST_LOG_KEY);
        const log = raw ? JSON.parse(raw) : [];
        log.unshift({
            date: new Date().toLocaleDateString(),
            score: `${score}/${testRoundCount}`,
            category: hemisphere[0] // 'all'/'north'/'south' -> a/n/s
        });
        localStorage.setItem(TEST_LOG_KEY, JSON.stringify(log));
    }
    catch (e) { /* not the end of the world if it doesn't persist */ }
}

function endTest()
{
    testActive = false;
    clearInterval(testIntervalId);
    testGuessRow.style.display = 'none';
    startTestBtn.style.display = 'inline-block';
    startTestBtn.textContent = 'test again';
    testTimer.textContent = '';
    testTimer.classList.remove('flash');
    testStatus.textContent = `final score: ${testScore}/${testRoundCount}`;
    saveTestResult(testScore, testHemisphereAtStart);
}

function stopTest()
{
    testActive = false;
    clearInterval(testIntervalId);
}

function resetTestUI()
{
    testStatus.textContent = '';
    testTimer.textContent = '';
    testTimer.classList.remove('flash');
    startTestBtn.style.display = 'inline-block';
    startTestBtn.textContent = 'start test';
    testGuessRow.style.display = 'none';
    testFeedback.textContent = '';
    testFeedback.classList.remove('success', 'warn');
}

function startTest()
{
    testActive = true;
    testRoundNum = 0;
    testScore = 0;
    testRoundCount = roundCountForDifficulty(currentDifficulty());
    testHemisphereAtStart = currentHemisphere();
    startTestBtn.style.display = 'none';
    testGuessRow.style.display = 'flex';
    nextTestRound();
}

startTestBtn.addEventListener('click', startTest);
testGuessBtn.addEventListener('click', submitTestGuess);
testGuessInput.addEventListener('keydown', e =>
{
    if (e.key === 'Enter') submitTestGuess();
});