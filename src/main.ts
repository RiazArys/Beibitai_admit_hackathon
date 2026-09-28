import "./style.css";
import morseChart from "../assets/morze.jpg";
import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  HAND_CONNECTIONS,
  classifyHandGesture,
  getGestureLabel,
  getPoseHint,
  type HandGesture,
} from "./hand-gestures";
import { MORSE_TO_CYRILLIC, formatMorse, getRandomMorseLetter } from "./morse";
import { WORD_BANK } from "./words";
import {
  FLASH_MS,
  HAND_LANDMARKER_MODEL_URL,
  HOLD_MS,
  MEDIAPIPE_WASM_URL,
  MIN_STABLE_GESTURE_FRAMES,
  ROUND_DURATION_SECONDS,
  CAMERA_FRAME_RATE,
  DETECTION_FRAME_INTERVAL,
} from "./config";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) throw new Error("Application root was not found");

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="MorseMotion">
        <span class="brand-mark"><i></i><i></i><i></i></span>
        <span>MORSE<span>MOTION</span></span>
      </a>
      <div class="top-status" id="cameraStatus"><span class="status-dot"></span> КАМЕРА НЕ ПОДКЛЮЧЕНА</div>
    </header>

    <section class="hero">
      <div>
        <p class="eyebrow">GESTURE TRANSMISSION TRAINER</p>
        <h1>Передавай сигналы.<br><em>Без клавиатуры.</em></h1>
        <p class="hero-copy">Управляй азбукой Морзе движениями пальцев перед камерой. Освой код и передай сообщение в эфир.</p>
      </div>
      <div class="mission-chip"><span>СВОБОДНЫЙ РЕЖИМ</span><strong>Напиши сообщение</strong><small>Кириллицей через Морзе</small></div>
    </section>

    <nav class="mode-switch" aria-label="Режим приложения">
      <button class="mode-button active" id="transmitModeButton" type="button">РАДИОГРАММА</button>
      <button class="mode-button" id="trainingModeButton" type="button">ТРЕНИРОВКА БУКВ</button>
      <button class="mode-button" id="wordModeButton" type="button">СЛОВА</button>
      <button class="mode-button" id="speedModeButton" type="button">СКОРОСТЬ</button>
      <button class="mode-button" id="calibrationModeButton" type="button">КАЛИБРОВКА</button>
    </nav>

    <section class="dashboard">
      <article class="camera-card">
        <div class="card-label"><span class="live-dot"></span> LIVE HAND TRACKING</div>
        <div class="camera-stage">
          <video id="webcam" autoplay muted playsinline></video><canvas id="handCanvas"></canvas>
          <div class="grid"></div>
          <div class="hand-placeholder" id="cameraPlaceholder">
            <div class="scanner"></div>
            <span class="hand-icon">☝</span>
            <p>ВКЛЮЧИТЕ КАМЕРУ</p>
            <small>Разрешите доступ, чтобы начать передачу</small>
            <button class="camera-button" id="startCamera" type="button">ВКЛЮЧИТЬ КАМЕРУ</button>
          </div>
          <div class="camera-corner top-left"></div><div class="camera-corner top-right"></div>
          <div class="camera-corner bottom-left"></div><div class="camera-corner bottom-right"></div>
        </div>
        <div class="recognition-state"><span class="pulse"></span><span id="gestureState">Ожидаю жест</span><small id="gestureHint">Покажите руку в камеру</small></div>
      </article>

      <aside class="terminal-card" id="terminalCard">
        <div id="transmitMode">
        <div class="card-label">SIGNAL TERMINAL <span>01</span></div>
        <div class="morse-output">
          <small>ТЕКУЩАЯ БУКВА</small>
          <div class="signal" id="signal">_</div>
          <div class="decoded" id="decoded">_ _ _</div>
        </div>
        <div class="message"><small>СООБЩЕНИЕ</small><strong id="message">_ _ _</strong></div>
        <button class="clear-button" id="clearSignal" type="button">СБРОСИТЬ СИГНАЛ</button>
        <div class="history"><small>ПОСЛЕДНИЕ РАДИОГРАММЫ</small><div id="historyList"></div></div>
        </div>
        <div class="training-mode hidden" id="trainingMode">
          <div class="card-label">TRAINING MODE <span id="trainingScore">0 ВЕРНО</span></div>
          <p class="training-kicker">ПОВТОРИ КОД БУКВЫ</p>
          <strong class="training-letter" id="trainingLetter">А</strong>
          <div class="training-code" id="trainingCode">·—</div>
          <p class="training-help">Покажи точки и тире, затем раскрой ладонь, чтобы завершить букву.</p>
          <div class="training-progress"><span>ТЕКУЩИЙ ВВОД</span><strong id="trainingInput">_</strong></div>
          <button class="clear-button" id="exitTraining" type="button">ВЕРНУТЬСЯ К РАДИОГРАММЕ</button>
        </div>
        <div class="training-mode hidden" id="wordMode">
          <div class="card-label">WORD CHALLENGE <span id="wordScore">0 СЛОВ</span></div>
          <p class="training-kicker">НАБЕРИ СЛОВО ЖЕСТАМИ</p>
          <strong class="word-target" id="wordTarget">МОРЗЕ</strong>
          <p class="training-help">Вводи каждую букву и раскрывай ладонь для подтверждения. Ошибка не засчитывается.</p>
          <div class="word-signal"><span>ТЕКУЩИЙ СИГНАЛ</span><strong id="wordSignal">_</strong></div>
          <div class="training-progress"><span>НАБРАНО</span><strong id="wordInput">_ _ _ _ _</strong></div>
          <button class="clear-button" id="exitWords" type="button">ВЕРНУТЬСЯ К РАДИОГРАММЕ</button>
        </div>
        <div class="training-mode hidden" id="speedMode">
          <div class="card-label">РАУНД НА СКОРОСТЬ <span id="speedTimer">02:00</span></div>
          <div class="speed-type"><button class="speed-type-button" id="oneMinute" type="button">1 МИН</button><button class="speed-type-button active" id="twoMinutes" type="button">2 МИН</button><button class="speed-type-button" id="threeMinutes" type="button">3 МИН</button></div>
          <div class="speed-type"><button class="speed-type-button active" id="speedWords" type="button">СЛОВА</button><button class="speed-type-button" id="speedLetters" type="button">БУКВЫ</button></div>
          <p class="training-kicker">НАБЕРИ КАК МОЖНО БОЛЬШЕ СЛОВ</p>
          <strong class="word-target" id="speedWord">ГОТОВ?</strong>
          <div class="word-signal"><span>ТЕКУЩИЙ СИГНАЛ</span><strong id="speedSignal">_</strong></div>
          <div class="training-progress"><span>НАБРАНО</span><strong id="speedInput">_</strong></div>
          <div class="speed-stats">
            <div class="speed-stat correct"><span>ВЕРНО</span><strong id="speedCorrect">0</strong></div>
            <div class="speed-stat errors"><span>ОШИБКИ</span><strong id="speedErrors">0</strong></div>
            <div class="speed-stat best"><span>РЕКОРД</span><strong id="speedBest">0</strong></div>
          </div>
          <button class="speed-start" id="startSpeed" type="button">НАЧАТЬ 2-МИНУТНЫЙ РАУНД</button>
        </div>
        <div class="training-mode hidden" id="calibrationMode">
          <div class="card-label">PERSONAL CALIBRATION <span id="calibrationStep">1 / 5</span></div>
          <p class="training-kicker">ПОКАЖИ ЖЕСТ ПЕРЕД КАМЕРОЙ</p>
          <strong class="calibration-icon" id="calibrationIcon">👍</strong>
          <strong class="calibration-name" id="calibrationName">ТОЧКА</strong>
          <p class="training-help" id="calibrationHelp">Подними только большой палец, удерживай руку спокойно и сохрани образец.</p>
          <div class="calibration-meter"><span id="calibrationSamples">КАМЕРА ЖДЁТ РУКУ</span></div>
          <button class="speed-start" id="saveCalibration" type="button">СОХРАНИТЬ ЖЕСТ</button>
          <button class="clear-button" id="resetCalibration" type="button">СБРОСИТЬ МОИ НАСТРОЙКИ</button>
        </div>
      </aside>
      <aside class="alphabet-card"><img src="${morseChart}" alt="Справочная таблица кириллической азбуки Морзе" /></aside>
    </section>

    <section class="guide-section">
      <div class="section-heading"><p class="eyebrow">КАК УПРАВЛЯТЬ</p><h2>Твой язык жестов</h2></div>
      <div class="gesture-grid">
        <article class="gesture active"><div class="gesture-icon">👍</div><div><span>ТОЧКА</span><strong>Большой палец</strong><p>Подними только большой палец</p></div><b>·</b></article>
        <article class="gesture"><div class="gesture-icon">☝</div><div><span>ТИРЕ</span><strong>Указательный палец</strong><p>Подними только указательный палец</p></div><b>—</b></article>
        <article class="gesture"><div class="gesture-icon">✌</div><div><span>ПРОБЕЛ</span><strong>Два пальца</strong><p>Большой и указательный вместе</p></div><b>␣</b></article>
        <article class="gesture"><div class="gesture-icon">✋</div><div><span>ГОТОВО</span><strong>Открытая ладонь</strong><p>Завершить текущую букву</p></div><b>↵</b></article>
        <article class="gesture"><div class="gesture-icon">🙌</div><div><span>СБРОС</span><strong>Две ладони</strong><p>Очистить всё сообщение</p></div><b>×</b></article>
        <article class="gesture"><div class="gesture-icon">✊✊</div><div><span>ОТПРАВИТЬ</span><strong>Два кулака</strong><p>Передать радиограмму</p></div><b>↗</b></article>
      </div>
    </section>

    <section class="feedback"><div class="feedback-icon">!</div><div><span>ПОДСКАЗКА</span><strong id="feedbackText">Включите камеру и покажите руку целиком</strong></div><div class="accuracy"><span>ТОЧНОСТЬ</span><b id="accuracy">—</b></div></section>
    <section class="result-panel hidden" id="resultPanel" aria-live="polite"><span>РАДИОГРАММА ПЕРЕДАНА</span><strong id="sentMessage"></strong><small>Сигнал успешно отправлен в эфир</small></section>
  </main>
`;

const video = document.querySelector<HTMLVideoElement>("#webcam")!;
const canvas = document.querySelector<HTMLCanvasElement>("#handCanvas")!;
const context = canvas.getContext("2d")!;
const startCamera = document.querySelector<HTMLButtonElement>("#startCamera")!;
const placeholder =
  document.querySelector<HTMLDivElement>("#cameraPlaceholder")!;
const cameraStatus = document.querySelector<HTMLDivElement>("#cameraStatus")!;
const gestureState = document.querySelector<HTMLSpanElement>("#gestureState")!;
const gestureHint = document.querySelector<HTMLElement>("#gestureHint")!;
const feedbackText = document.querySelector<HTMLElement>("#feedbackText")!;
const signalElement = document.querySelector<HTMLElement>("#signal")!;
const decodedElement = document.querySelector<HTMLElement>("#decoded")!;
const messageElement = document.querySelector<HTMLElement>("#message")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clearSignal")!;
const accuracyElement = document.querySelector<HTMLElement>("#accuracy")!;
const historyList = document.querySelector<HTMLElement>("#historyList")!;
const resultPanel = document.querySelector<HTMLElement>("#resultPanel")!;
const sentMessage = document.querySelector<HTMLElement>("#sentMessage")!;
const transmitMode = document.querySelector<HTMLElement>("#transmitMode")!;
const trainingModeElement =
  document.querySelector<HTMLElement>("#trainingMode")!;
const transmitModeButton = document.querySelector<HTMLButtonElement>(
  "#transmitModeButton",
)!;
const trainingModeButton = document.querySelector<HTMLButtonElement>(
  "#trainingModeButton",
)!;
const exitTraining =
  document.querySelector<HTMLButtonElement>("#exitTraining")!;
const trainingLetter = document.querySelector<HTMLElement>("#trainingLetter")!;
const trainingCode = document.querySelector<HTMLElement>("#trainingCode")!;
const trainingInput = document.querySelector<HTMLElement>("#trainingInput")!;
const trainingScore = document.querySelector<HTMLElement>("#trainingScore")!;
const terminalCard = document.querySelector<HTMLElement>("#terminalCard")!;
const wordModeElement = document.querySelector<HTMLElement>("#wordMode")!;
const wordModeButton =
  document.querySelector<HTMLButtonElement>("#wordModeButton")!;
const exitWords = document.querySelector<HTMLButtonElement>("#exitWords")!;
const wordTargetElement = document.querySelector<HTMLElement>("#wordTarget")!;
const wordInput = document.querySelector<HTMLElement>("#wordInput")!;
const wordScore = document.querySelector<HTMLElement>("#wordScore")!;
const wordSignal = document.querySelector<HTMLElement>("#wordSignal")!;
const speedModeElement = document.querySelector<HTMLElement>("#speedMode")!;
const speedModeButton =
  document.querySelector<HTMLButtonElement>("#speedModeButton")!;
const speedTimer = document.querySelector<HTMLElement>("#speedTimer")!;
const speedWord = document.querySelector<HTMLElement>("#speedWord")!;
const speedSignal = document.querySelector<HTMLElement>("#speedSignal")!;
const speedInput = document.querySelector<HTMLElement>("#speedInput")!;
const speedCorrectElement =
  document.querySelector<HTMLElement>("#speedCorrect")!;
const speedErrorsElement = document.querySelector<HTMLElement>("#speedErrors")!;
const speedBestElement = document.querySelector<HTMLElement>("#speedBest")!;
const startSpeed = document.querySelector<HTMLButtonElement>("#startSpeed")!;
const speedWordsButton =
  document.querySelector<HTMLButtonElement>("#speedWords")!;
const speedLettersButton =
  document.querySelector<HTMLButtonElement>("#speedLetters")!;
const oneMinuteButton =
  document.querySelector<HTMLButtonElement>("#oneMinute")!;
const twoMinutesButton =
  document.querySelector<HTMLButtonElement>("#twoMinutes")!;
const threeMinutesButton =
  document.querySelector<HTMLButtonElement>("#threeMinutes")!;
const calibrationModeElement =
  document.querySelector<HTMLElement>("#calibrationMode")!;
const calibrationModeButton =
  document.querySelector<HTMLButtonElement>("#calibrationModeButton")!;
const calibrationStepElement =
  document.querySelector<HTMLElement>("#calibrationStep")!;
const calibrationIcon = document.querySelector<HTMLElement>("#calibrationIcon")!;
const calibrationName = document.querySelector<HTMLElement>("#calibrationName")!;
const calibrationHelp = document.querySelector<HTMLElement>("#calibrationHelp")!;
const calibrationSamplesElement =
  document.querySelector<HTMLElement>("#calibrationSamples")!;
const saveCalibration =
  document.querySelector<HTMLButtonElement>("#saveCalibration")!;
const resetCalibration =
  document.querySelector<HTMLButtonElement>("#resetCalibration")!;

let handLandmarker: HandLandmarker | null = null;
let currentSignal = "";
let currentMessage = "";
type AppGesture = HandGesture | "reset" | "send";

let candidate: AppGesture = "none";
let candidateSince = 0;
let candidateFrames = 0;
let lastVideoTime = -1;
let receivedVideoFrames = 0;
let latched = false;
let acceptedSignals = 0;
let transmissions: string[] = [];
let trainingMode = false;
let trainingScoreValue = 0;
let trainingTarget = { code: ".-", letter: "А" };
let wordMode = false;
let wordScoreValue = 0;
let wordTarget = "МОРЗЕ";
let wordTyped = "";
let speedMode = false;
let speedActive = false;
let speedSeconds = ROUND_DURATION_SECONDS;
let speedCorrect = 0;
let speedErrors = 0;
let speedBest = 0;
let speedTarget = "";
let speedTyped = "";
let speedInterval: number | undefined;
let speedChallenge: "words" | "letters" = "words";
let speedDuration = ROUND_DURATION_SECONDS;
type CalibrationGesture = Exclude<HandGesture, "none">;
type CalibrationTemplates = Partial<Record<CalibrationGesture, number[]>>;
const CALIBRATION_STORAGE_KEY = "morsemotion-gesture-calibration";
const calibrationSteps: Array<{
  gesture: CalibrationGesture;
  name: string;
  icon: string;
  help: string;
}> = [
  { gesture: "dot", name: "ТОЧКА", icon: "👍", help: "Подними только большой палец." },
  { gesture: "dash", name: "ТИРЕ", icon: "☝", help: "Подними только указательный палец." },
  { gesture: "space", name: "ПРОБЕЛ", icon: "✌", help: "Подними большой и указательный пальцы." },
  { gesture: "open", name: "ГОТОВО", icon: "✋", help: "Раскрой ладонь и выпрями все пальцы." },
  { gesture: "fist", name: "УДАЛИТЬ", icon: "✊", help: "Сожми кисть в кулак." },
];
let calibrationMode = false;
let calibrationStepIndex = 0;
let calibrationSamples: number[][] = [];
let calibrationTemplates: CalibrationTemplates = loadCalibrationTemplates();
// История нужна только в текущем сеансе: после обновления страницы она очищается.
localStorage.removeItem("morsemotion-transmissions");

function loadCalibrationTemplates(): CalibrationTemplates {
  try {
    const saved = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved) as CalibrationTemplates;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, template]) =>
          Array.isArray(template) && template.length === 63 && template.every(Number.isFinite),
      ),
    ) as CalibrationTemplates;
  } catch {
    return {};
  }
}

function getHandSignature(hand: NormalizedLandmark[]): number[] {
  const wrist = hand[0];
  const scale = Math.max(
    Math.hypot(hand[9].x - wrist.x, hand[9].y - wrist.y, hand[9].z - wrist.z),
    0.01,
  );
  return hand.flatMap((point) => [
    (point.x - wrist.x) / scale,
    (point.y - wrist.y) / scale,
    (point.z - wrist.z) / scale,
  ]);
}

function averageSignatures(samples: number[][]): number[] {
  return samples[0].map(
    (_, index) => samples.reduce((sum, sample) => sum + sample[index], 0) / samples.length,
  );
}

function getCalibratedGesture(hand: NormalizedLandmark[]): HandGesture | null {
  const signature = getHandSignature(hand);
  const match = (Object.entries(calibrationTemplates) as Array<
    [CalibrationGesture, number[]]
  >)
    .map(([gesture, template]) => ({
      gesture,
      distance: Math.sqrt(
        template.reduce((sum, value, index) => sum + (value - signature[index]) ** 2, 0) /
          template.length,
      ),
    }))
    .sort((first, second) => first.distance - second.distance)[0];

  // Шаблон применяется только при близком совпадении: случайная поза не станет командой.
  return match && match.distance < 0.34 ? match.gesture : null;
}

function currentHandGesture(hand: NormalizedLandmark[]): HandGesture {
  return getCalibratedGesture(hand) ?? classifyHandGesture(hand);
}

function renderCalibration() {
  const step = calibrationSteps[calibrationStepIndex];
  if (!step) {
    calibrationStepElement.textContent = "ГОТОВО";
    calibrationIcon.textContent = "✓";
    calibrationName.textContent = "ЖЕСТЫ СОХРАНЕНЫ";
    calibrationHelp.textContent = "Теперь приложение учитывает форму твоей руки. При необходимости калибровку можно пройти заново.";
    calibrationSamplesElement.textContent = "5 ИЗ 5 ЖЕСТОВ ГОТОВЫ";
    saveCalibration.textContent = "НАЧАТЬ КАЛИБРОВКУ ЗАНОВО";
    return;
  }
  calibrationStepElement.textContent = `${calibrationStepIndex + 1} / ${calibrationSteps.length}`;
  calibrationIcon.textContent = step.icon;
  calibrationName.textContent = step.name;
  calibrationHelp.textContent = step.help;
  calibrationSamplesElement.textContent = calibrationSamples.length
    ? `СЧИТАНО КАДРОВ: ${calibrationSamples.length} — МОЖНО СОХРАНЯТЬ`
    : "ПОКАЖИ ЖЕСТ В КАМЕРУ";
  saveCalibration.textContent = "СОХРАНИТЬ ЖЕСТ";
}

function beginCalibration() {
  calibrationStepIndex = 0;
  calibrationSamples = [];
  renderCalibration();
  setFeedback("Покажи первый жест перед камерой. Когда появятся кадры, нажми «Сохранить жест».");
}

function saveCalibrationGesture() {
  if (calibrationStepIndex >= calibrationSteps.length) {
    beginCalibration();
    return;
  }
  if (calibrationSamples.length < 8) {
    setFeedback("Недостаточно данных: удерживай кисть в кадре, пока не будет минимум 8 кадров.");
    return;
  }
  const step = calibrationSteps[calibrationStepIndex];
  calibrationTemplates[step.gesture] = averageSignatures(calibrationSamples);
  try {
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(calibrationTemplates));
  } catch {}
  calibrationStepIndex++;
  calibrationSamples = [];
  renderCalibration();
  setFeedback(
    calibrationStepIndex === calibrationSteps.length
      ? "Калибровка завершена: персональные жесты сохранены в этом браузере."
      : "Образец сохранён. Покажи следующий жест и сохрани его.",
  );
}

function setFeedback(text: string) {
  feedbackText.textContent = text;
}
function renderTerminal() {
  signalElement.textContent = currentSignal
    ? currentSignal.replaceAll(".", "·").replaceAll("-", "—")
    : "_";
  const letter = currentSignal
    ? (MORSE_TO_CYRILLIC[currentSignal] ?? "?")
    : "_ _ _";
  decodedElement.textContent = letter;
  messageElement.textContent = currentMessage || "_ _ _";
  accuracyElement.textContent = acceptedSignals
    ? `${acceptedSignals} СИГН.`
    : "—";
  historyList.innerHTML = transmissions.length
    ? transmissions.map((item) => `<span>› ${item}</span>`).join("")
    : "<i>Пока нет отправленных сообщений</i>";
  trainingInput.textContent = currentSignal
    ? currentSignal.replaceAll(".", "·").replaceAll("-", "—")
    : "_";
  trainingScore.textContent = `${trainingScoreValue} ВЕРНО`;
  wordInput.textContent =
    `${wordTyped}${"_".repeat(wordTarget.length - wordTyped.length)}`
      .split("")
      .join(" ");
  wordScore.textContent = `${wordScoreValue} СЛОВ`;
  wordSignal.textContent = currentSignal
    ? currentSignal.replaceAll(".", "·").replaceAll("-", "—")
    : "_";
  speedTimer.textContent = `${String(Math.floor(speedSeconds / 60)).padStart(2, "0")}:${String(speedSeconds % 60).padStart(2, "0")}`;
  speedWord.textContent = speedActive ? speedTarget : "ГОТОВ?";
  speedSignal.textContent = currentSignal ? formatMorse(currentSignal) : "_";
  speedInput.textContent = speedTyped || "_";
  speedCorrectElement.textContent = String(speedCorrect);
  speedErrorsElement.textContent = String(speedErrors);
  speedBestElement.textContent = String(speedBest);
}
function chooseTrainingLetter() {
  trainingTarget = getRandomMorseLetter(trainingTarget.letter);
  trainingLetter.textContent = trainingTarget.letter;
  trainingCode.textContent = formatMorse(trainingTarget.code);
}
function chooseWord() {
  const available = WORD_BANK.filter((word) => word !== wordTarget);
  wordTarget = available[Math.floor(Math.random() * available.length)];
  wordTyped = "";
  wordTargetElement.textContent = wordTarget;
}
function chooseSpeedTarget() {
  const options =
    speedChallenge === "letters"
      ? Object.values(MORSE_TO_CYRILLIC)
      : WORD_BANK.filter((word) => word.length <= 8);
  const filtered = options.filter((item) => item !== speedTarget);
  speedTarget = filtered[Math.floor(Math.random() * filtered.length)];
  speedTyped = "";
}
function setSpeedChallenge(challenge: "words" | "letters") {
  speedChallenge = challenge;
  speedWordsButton.classList.toggle("active", challenge === "words");
  speedLettersButton.classList.toggle("active", challenge === "letters");
  if (!speedActive) {
    chooseSpeedTarget();
    renderTerminal();
  }
}
function setSpeedDuration(seconds: number) {
  speedDuration = seconds;
  oneMinuteButton.classList.toggle("active", seconds === 60);
  twoMinutesButton.classList.toggle("active", seconds === 120);
  threeMinutesButton.classList.toggle("active", seconds === 180);
  startSpeed.textContent = `НАЧАТЬ ${seconds / 60}-МИНУТНЫЙ РАУНД`;
  if (!speedActive) {
    speedSeconds = seconds;
    renderTerminal();
  }
}
function startSpeedRound() {
  if (speedInterval) window.clearInterval(speedInterval);
  speedActive = true;
  speedSeconds = speedDuration;
  speedCorrect = 0;
  speedErrors = 0;
  currentSignal = "";
  chooseSpeedTarget();
  speedInterval = window.setInterval(() => {
    speedSeconds--;
    if (speedSeconds <= 0) {
      window.clearInterval(speedInterval);
      speedInterval = undefined;
      speedActive = false;
      if (speedCorrect > speedBest) {
        speedBest = speedCorrect;
        try {
          localStorage.setItem("morsemotion-best-speed", String(speedBest));
        } catch {}
      }
      setFeedback(
        `Раунд завершён: ${speedCorrect} ${speedChallenge === "letters" ? "букв" : "слов"}, ошибок: ${speedErrors}. Нажми «Начать», чтобы повторить.`,
      );
    }
    renderTerminal();
  }, 1000);
  setFeedback(
    `Раунд начался! Набирай ${speedChallenge === "letters" ? "буквы" : "слова"} и заверши каждую ладонью.`,
  );
  renderTerminal();
}
function flashTerminal() {
  terminalCard.classList.remove("wrong-letter");
  void terminalCard.offsetWidth;
  terminalCard.classList.add("wrong-letter");
  window.setTimeout(
    () => terminalCard.classList.remove("wrong-letter"),
    FLASH_MS,
  );
}
function flashSuccess() {
  terminalCard.classList.remove("right-letter");
  void terminalCard.offsetWidth;
  terminalCard.classList.add("right-letter");
  window.setTimeout(
    () => terminalCard.classList.remove("right-letter"),
    FLASH_MS,
  );
}
function setMode(
  mode: "transmit" | "training" | "words" | "speed" | "calibration",
) {
  trainingMode = mode === "training";
  wordMode = mode === "words";
  speedMode = mode === "speed";
  calibrationMode = mode === "calibration";
  currentSignal = "";
  transmitMode.classList.toggle(
    "hidden",
    trainingMode || wordMode || speedMode || calibrationMode,
  );
  trainingModeElement.classList.toggle("hidden", !trainingMode);
  wordModeElement.classList.toggle("hidden", !wordMode);
  speedModeElement.classList.toggle("hidden", !speedMode);
  calibrationModeElement.classList.toggle("hidden", !calibrationMode);
  transmitModeButton.classList.toggle(
    "active",
    !trainingMode && !wordMode && !speedMode && !calibrationMode,
  );
  trainingModeButton.classList.toggle("active", trainingMode);
  wordModeButton.classList.toggle("active", wordMode);
  speedModeButton.classList.toggle("active", speedMode);
  calibrationModeButton.classList.toggle("active", calibrationMode);
  if (trainingMode) {
    chooseTrainingLetter();
    setFeedback("Повтори код буквы и раскрой ладонь для проверки");
  } else if (wordMode) {
    chooseWord();
    setFeedback(
      "Набери слово по одной букве и заверши каждую открытой ладонью",
    );
  } else if (speedMode) {
    try {
      speedBest = Number(localStorage.getItem("morsemotion-best-speed") ?? 0);
    } catch {}
    setFeedback("Выбери длительность и нажми «Начать раунд». ");
  } else if (calibrationMode) {
    beginCalibration();
  } else setFeedback("Режим радиограммы включён. Наберите сообщение жестами");
  renderTerminal();
}
function showResult(message: string) {
  sentMessage.textContent = message;
  resultPanel.classList.remove("hidden");
  window.setTimeout(() => resultPanel.classList.add("hidden"), 4000);
}
function finishLetter() {
  if (!currentSignal) {
    setFeedback("Сначала введи точку или тире для буквы");
    return;
  }
  if (trainingMode) {
    if (currentSignal === trainingTarget.code) {
      trainingScoreValue++;
      flashSuccess();
      setFeedback(
        `Верно! «${trainingTarget.letter}» — ${trainingTarget.code.replaceAll(".", "·").replaceAll("-", "—")}. Следующая буква.`,
      );
      currentSignal = "";
      chooseTrainingLetter();
      renderTerminal();
      return;
    }
    flashTerminal();
    setFeedback(
      `Почти. Для «${trainingTarget.letter}» нужен код ${trainingTarget.code.replaceAll(".", "·").replaceAll("-", "—")}. Попробуй ещё раз.`,
    );
    currentSignal = "";
    renderTerminal();
    return;
  }
  if (speedMode) {
    if (!speedActive) {
      currentSignal = "";
      setFeedback("Сначала нажми «Начать 60-секундный раунд».");
      renderTerminal();
      return;
    }
    const letter = MORSE_TO_CYRILLIC[currentSignal];
    const expected = speedTarget[speedTyped.length];
    currentSignal = "";
    if (letter === expected) {
      speedTyped += letter;
      flashSuccess();
      if (speedTyped === speedTarget) {
        speedCorrect++;
        chooseSpeedTarget();
        setFeedback("Слово принято! Следующее слово.");
      } else setFeedback(`Верно: «${letter}». Продолжай слово.`);
    } else {
      speedErrors++;
      flashTerminal();
      setFeedback(`Ошибка. Сейчас нужна буква «${expected}».`);
    }
    renderTerminal();
    return;
  }
  if (wordMode) {
    const letter = MORSE_TO_CYRILLIC[currentSignal];
    const expected = wordTarget[wordTyped.length];
    currentSignal = "";
    if (letter === expected) {
      wordTyped += letter;
      flashSuccess();
      if (wordTyped === wordTarget) {
        wordScoreValue++;
        setFeedback(`Верно! Слово «${wordTarget}» набрано. Следующее слово.`);
        chooseWord();
      } else setFeedback(`Верно: «${letter}». Продолжай слово.`);
    } else {
      flashTerminal();
      setFeedback(
        `Неверная буква. Сейчас нужна «${expected}». Попробуй её код ещё раз.`,
      );
    }
    renderTerminal();
    return;
  }
  const letter = MORSE_TO_CYRILLIC[currentSignal];
  if (!letter) {
    setFeedback("Такой комбинации нет: сбрось сигнал и попробуй снова");
    return;
  }
  currentMessage += letter;
  currentSignal = "";
  setFeedback(`Буква «${letter}» распознана. Продолжай сообщение`);
  renderTerminal();
}
function acceptGesture(gesture: string) {
  if (gesture === "dot") {
    currentSignal += ".";
    acceptedSignals++;
    setFeedback("Точка принята. Покажи следующий жест");
  }
  if (gesture === "dash") {
    currentSignal += "-";
    acceptedSignals++;
    setFeedback("Тире принято. Покажи следующий жест");
  }
  if (gesture === "space") {
    if (currentSignal) finishLetter();
    if (currentMessage && !currentMessage.endsWith(" ")) currentMessage += " ";
    setFeedback("Пробел добавлен между словами");
  }
  if (gesture === "open") finishLetter();
  if (gesture === "fist") {
    if (currentSignal) {
      currentSignal = currentSignal.slice(0, -1);
      setFeedback("Последний сигнал удалён");
    } else {
      setFeedback("Сигнал пока пуст — нечего удалять");
    }
  }
  if (gesture === "reset") {
    currentSignal = "";
    currentMessage = "";
    acceptedSignals = 0;
    setFeedback("Две ладони распознаны. Сообщение полностью сброшено");
  }
  if (gesture === "send") {
    if (currentSignal) finishLetter();
    const message = currentMessage.trim();
    if (!message) {
      setFeedback("Сначала введи хотя бы одну букву, затем покажи два кулака");
      return;
    }
    transmissions = [message, ...transmissions].slice(0, 4);
    showResult(message);
    currentMessage = "";
    currentSignal = "";
    acceptedSignals = 0;
    setFeedback("Два кулака распознаны. Радиограмма успешно передана");
  }
  renderTerminal();
}
function drawHand(hand: NormalizedLandmark[]) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 4;
  context.strokeStyle = "#63e6c5";
  context.fillStyle = "#effffb";
  for (const [start, end] of HAND_CONNECTIONS) {
    context.beginPath();
    context.moveTo(
      (1 - hand[start].x) * canvas.width,
      hand[start].y * canvas.height,
    );
    context.lineTo(
      (1 - hand[end].x) * canvas.width,
      hand[end].y * canvas.height,
    );
    context.stroke();
  }
  for (const point of hand) {
    context.beginPath();
    context.arc(
      (1 - point.x) * canvas.width,
      point.y * canvas.height,
      6,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}
function processVideo() {
  if (!handLandmarker || video.readyState < 2) {
    requestAnimationFrame(processVideo);
    return;
  }

  // requestAnimationFrame может вызываться чаще, чем камера выдаёт новые кадры.
  // Не анализируем один и тот же видеокадр повторно и пропускаем каждый второй новый.
  if (video.currentTime === lastVideoTime) {
    requestAnimationFrame(processVideo);
    return;
  }
  lastVideoTime = video.currentTime;
  receivedVideoFrames++;
  if (receivedVideoFrames % DETECTION_FRAME_INTERVAL !== 0) {
    requestAnimationFrame(processVideo);
    return;
  }
  const result = handLandmarker.detectForVideo(video, performance.now());
  const hand = result.landmarks[0];
  if (!hand) {
    gestureState.textContent = "Рука не найдена";
    gestureHint.textContent = "Покажи кисть целиком";
    setFeedback("Поднеси руку в кадр: должны быть видны все пальцы");
    candidate = "none";
    latched = false;
    candidateFrames = 0;
    context.clearRect(0, 0, canvas.width, canvas.height);
  } else {
    drawHand(hand);
    if (calibrationMode) {
      if (calibrationStepIndex < calibrationSteps.length) {
        calibrationSamples = [
          ...calibrationSamples.slice(-17),
          getHandSignature(hand),
        ];
        renderCalibration();
        gestureState.textContent = "Считываю образец жеста";
        gestureHint.textContent = "Держи кисть неподвижно, затем сохрани жест";
      }
      requestAnimationFrame(processVideo);
      return;
    }
    const bothPalmsOpen =
      result.landmarks.length >= 2 &&
      result.landmarks.every(
        (detectedHand) => currentHandGesture(detectedHand) === "open",
      );
    const bothFists =
      result.landmarks.length >= 2 &&
      result.landmarks.every(
        (detectedHand) => currentHandGesture(detectedHand) === "fist",
      );
    const next: AppGesture = bothFists
      ? "send"
      : bothPalmsOpen
        ? "reset"
        : currentHandGesture(hand);
    const now = performance.now();
    gestureState.textContent = getGestureLabel(next);
    gestureHint.textContent =
      next === "none"
        ? getPoseHint(hand)
        : `Удерживай жест ${HOLD_MS / 1000} сек`;
    // Новый жест — это новая команда. Не требуем убирать руку из кадра,
    // достаточно сменить форму пальцев и удержать её 500 мс.
    if (next !== candidate) {
      candidate = next;
      candidateSince = now;
      candidateFrames = 1;
      latched = false;
    } else {
      candidateFrames++;
    }
    if (
      next !== "none" &&
      !latched &&
      candidateFrames >= MIN_STABLE_GESTURE_FRAMES &&
      now - candidateSince > HOLD_MS
    ) {
      acceptGesture(next);
      latched = true;
      gestureHint.textContent = "Убери или смени жест для следующего сигнала";
    }
  }
  requestAnimationFrame(processVideo);
}
async function enableCamera() {
  try {
    startCamera.disabled = true;
    startCamera.textContent = "ПОДКЛЮЧЕНИЕ…";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: CAMERA_FRAME_RATE, max: CAMERA_FRAME_RATE },
      },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: HAND_LANDMARKER_MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
    placeholder.classList.add("hidden");
    cameraStatus.innerHTML = '<span class="status-dot"></span> КАМЕРА В ЭФИРЕ';
    gestureState.textContent = "Ищу руку";
    gestureHint.textContent = "Покажите жест";
    setFeedback("Камера включена. Подними большой палец для точки");
    requestAnimationFrame(processVideo);
  } catch (error) {
    startCamera.disabled = false;
    startCamera.textContent = "ПОВТОРИТЬ ДОСТУП";
    setFeedback(
      "Не удалось открыть камеру. Разреши доступ к камере в браузере и повтори.",
    );
    cameraStatus.innerHTML =
      '<span class="status-dot error"></span> НЕТ ДОСТУПА К КАМЕРЕ';
    console.error(error);
  }
}
startCamera.addEventListener("click", enableCamera);
clearButton.addEventListener("click", () => {
  currentSignal = "";
  setFeedback("Текущий сигнал сброшен");
  renderTerminal();
});
transmitModeButton.addEventListener("click", () => setMode("transmit"));
trainingModeButton.addEventListener("click", () => setMode("training"));
wordModeButton.addEventListener("click", () => setMode("words"));
speedModeButton.addEventListener("click", () => setMode("speed"));
calibrationModeButton.addEventListener("click", () => setMode("calibration"));
startSpeed.addEventListener("click", startSpeedRound);
speedWordsButton.addEventListener("click", () => setSpeedChallenge("words"));
speedLettersButton.addEventListener("click", () =>
  setSpeedChallenge("letters"),
);
oneMinuteButton.addEventListener("click", () => setSpeedDuration(60));
twoMinutesButton.addEventListener("click", () => setSpeedDuration(120));
threeMinutesButton.addEventListener("click", () => setSpeedDuration(180));
saveCalibration.addEventListener("click", saveCalibrationGesture);
resetCalibration.addEventListener("click", () => {
  calibrationTemplates = {};
  try {
    localStorage.removeItem(CALIBRATION_STORAGE_KEY);
  } catch {}
  beginCalibration();
  setFeedback("Персональные настройки удалены. Можешь записать новые жесты.");
});
exitTraining.addEventListener("click", () => setMode("transmit"));
exitWords.addEventListener("click", () => setMode("transmit"));
renderTerminal();
