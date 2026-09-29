import "./style.css";
import morseChart from "../assets/morze.jpg";
import {
  FilesetResolver,
  FaceDetector,
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
  FACE_DETECTOR_MODEL_URL,
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
      <div class="topbar-tools">
        <div class="appearance-control" role="group" aria-label="Тема оформления">
          <span class="appearance-label">ТЕМА</span>
          <div class="theme-switcher">
            <button class="theme-button active" data-theme="dark" type="button" aria-pressed="true" aria-label="Тёмная тема" title="Тёмная тема">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.8 12.8A7.1 7.1 0 0 1 7.2 3.2a7.4 7.4 0 1 0 9.6 9.6Z" /></svg>
              <span>Тёмная</span>
            </button>
            <button class="theme-button" data-theme="light" type="button" aria-pressed="false" aria-label="Светлая тема" title="Светлая тема">
              <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.5" /><path d="M10 1.8v2M10 16.2v2M18.2 10h-2M3.8 10h-2m14-5.8-1.4 1.4M5.6 14.4l-1.4 1.4m11.6 0-1.4-1.4M5.6 5.6 4.2 4.2" /></svg>
              <span>Светлая</span>
            </button>
          </div>
        </div>
        <button class="a11y-button" id="accessibilityToggle" type="button" aria-pressed="false">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" /><circle cx="10" cy="10" r="2.1" /><path d="m4 17 12-14" class="a11y-slash" /></svg>
          <span>Доступность</span>
        </button>
      </div>
      <div class="top-status" id="cameraStatus"><span class="status-dot"></span> КАМЕРА НЕ ПОДКЛЮЧЕНА</div>
      <button class="privacy-toggle active" id="privacyToggle" type="button">ЛИЦО: СКРЫТО</button>
      <button class="sound-toggle" id="soundToggle" type="button">ЗВУК: ВКЛ</button>
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
        <div class="camera-actions"><button class="camera-stop-button hidden" id="stopCamera" type="button">ВЫКЛЮЧИТЬ КАМЕРУ</button></div>
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
        <button class="clear-button" id="clearSignal" type="button" aria-label="Удалить последний введённый символ">УДАЛИТЬ СИМВОЛ</button>
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
          <div class="speed-round-status hidden" id="speedRoundStatus">РАУНД ЗАВЕРШЁН</div>
          <button class="speed-start" id="startSpeed" type="button">НАЧАТЬ 2-МИНУТНЫЙ РАУНД</button>
          <button class="speed-stop hidden" id="stopSpeed" type="button">ОСТАНОВИТЬ РАУНД</button>
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
        <article class="gesture active" role="button" tabindex="0" aria-pressed="true"><div class="gesture-icon">👍</div><div><span>ТОЧКА</span><strong>Большой палец</strong><p>Подними только большой палец</p></div><b>·</b></article>
        <article class="gesture" role="button" tabindex="0" aria-pressed="false"><div class="gesture-icon">☝</div><div><span>ТИРЕ</span><strong>Указательный палец</strong><p>Подними только указательный палец</p></div><b>—</b></article>
        <article class="gesture" role="button" tabindex="0" aria-pressed="false"><div class="gesture-icon">✌</div><div><span>ПРОБЕЛ</span><strong>Два пальца</strong><p>Большой и указательный вместе</p></div><b>␣</b></article>
        <article class="gesture" role="button" tabindex="0" aria-pressed="false"><div class="gesture-icon">✋</div><div><span>ГОТОВО</span><strong>Открытая ладонь</strong><p>Завершить текущую букву</p></div><b>↵</b></article>
        <article class="gesture" role="button" tabindex="0" aria-pressed="false"><div class="gesture-icon">🙌</div><div><span>СБРОС</span><strong>Две ладони</strong><p>Очистить всё сообщение</p></div><b>×</b></article>
        <article class="gesture" role="button" tabindex="0" aria-pressed="false"><div class="gesture-icon">✊✊</div><div><span>ОТПРАВИТЬ</span><strong>Два кулака</strong><p>Передать радиограмму</p></div><b>↗</b></article>
      </div>
    </section>

    <section class="feedback"><div class="feedback-icon">!</div><div><span>ПОДСКАЗКА</span><strong id="feedbackText">Включите камеру и покажите руку целиком</strong></div><div class="accuracy"><span>ТОЧНОСТЬ</span><b id="accuracy">—</b></div></section>
    <section class="result-panel hidden" id="resultPanel" aria-live="polite"><span>РАДИОГРАММА ПЕРЕДАНА</span><strong id="sentMessage"></strong><small>Сигнал успешно отправлен в эфир</small></section>
    <section class="round-modal hidden" id="roundModal" role="dialog" aria-modal="true" aria-labelledby="roundModalTitle">
      <div class="round-modal-card">
        <span>РЕЖИМ СКОРОСТИ</span>
        <strong id="roundModalTitle">РАУНД ЗАВЕРШЁН</strong>
        <dl class="round-modal-stats" id="roundModalStats">
          <div><dt>ВЕРНО</dt><dd id="roundCorrect">0</dd></div>
          <div><dt>ОШИБКИ</dt><dd id="roundErrors">0</dd></div>
          <div><dt>ТОЧНОСТЬ</dt><dd id="roundAccuracy">—</dd></div>
          <div><dt>СРЕДНЕЕ ВРЕМЯ</dt><dd id="roundAverageTime">—</dd></div>
          <div><dt>ЛУЧШЕЕ ВРЕМЯ</dt><dd id="roundBestTime">—</dd></div>
        </dl>
        <p class="round-record" id="roundRecord">Рекорд: 0</p>
        <div class="round-modal-actions">
          <button class="speed-start" id="restartSpeedRound" type="button">ЕЩЁ РАЗ</button>
          <button class="clear-button" id="closeRoundModal" type="button">ЗАКРЫТЬ</button>
        </div>
      </div>
    </section>
  </main>
`;

const themeButtons = [...document.querySelectorAll<HTMLButtonElement>(".theme-button")];
const accessibilityToggle = document.querySelector<HTMLButtonElement>("#accessibilityToggle")!;

function applyTheme(theme: "dark" | "light") {
  document.body.dataset.theme = theme;
  themeButtons.forEach((button) => {
    const isActive = button.dataset.theme === theme;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  localStorage.setItem("morsemotion-theme", theme);
}

function speakText(text: string) {
  if (!document.body.classList.contains("accessibility-mode") || !("speechSynthesis" in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function setAccessibilityMode(enabled: boolean) {
  if (!enabled) {
    speakText("Режим для незрячих выключен");
  }
  document.body.classList.toggle("accessibility-mode", enabled);
  accessibilityToggle.classList.toggle("active", enabled);
  accessibilityToggle.setAttribute("aria-pressed", String(enabled));
  accessibilityToggle.querySelector("span")!.textContent = enabled ? "Доступность: вкл." : "Доступность";
  accessibilityToggle.setAttribute(
    "aria-label",
    enabled ? "Выключить режим доступности" : "Включить режим доступности",
  );
  accessibilityToggle.querySelector(".a11y-slash")?.classList.toggle("hidden", enabled);
  localStorage.setItem("morsemotion-accessibility", String(enabled));
  if (enabled) {
    speakText("Включён режим для незрячих");
  }
}

const storedTheme = localStorage.getItem("morsemotion-theme");
const savedTheme: "dark" | "light" = storedTheme === "light" ? "light" : "dark";
const savedAccessibilityMode = localStorage.getItem("morsemotion-accessibility") === "true";
applyTheme(savedTheme);
setAccessibilityMode(savedAccessibilityMode);

if (themeButtons.length) {
  themeButtons.forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.theme as "dark" | "light"));
  });
}

accessibilityToggle.addEventListener("click", () => {
  const enabled = !document.body.classList.contains("accessibility-mode");
  setAccessibilityMode(enabled);
});

const gestureCards = [...document.querySelectorAll<HTMLElement>(".gesture[role='button']")];
function selectGestureCard(selectedCard: HTMLElement) {
  gestureCards.forEach((card) => {
    const isSelected = card === selectedCard;
    card.classList.toggle("active", isSelected);
    card.setAttribute("aria-pressed", String(isSelected));
  });
  const name = selectedCard.querySelector("span")?.textContent?.trim();
  const instruction = selectedCard.querySelector("p")?.textContent?.trim();
  if (name && instruction) {
    speakText(`${name}. ${instruction}`);
  }
}
gestureCards.forEach((card) => {
  card.addEventListener("click", () => selectGestureCard(card));
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.code !== "Space") return;
    event.preventDefault();
    selectGestureCard(card);
  });
});

const video = document.querySelector<HTMLVideoElement>("#webcam")!;
const canvas = document.querySelector<HTMLCanvasElement>("#handCanvas")!;
const context = canvas.getContext("2d")!;
const startCamera = document.querySelector<HTMLButtonElement>("#startCamera")!;
const stopCamera = document.querySelector<HTMLButtonElement>("#stopCamera")!;
const placeholder =
  document.querySelector<HTMLDivElement>("#cameraPlaceholder")!;
const cameraStatus = document.querySelector<HTMLDivElement>("#cameraStatus")!;
const privacyToggle = document.querySelector<HTMLButtonElement>("#privacyToggle")!;
const soundToggle = document.querySelector<HTMLButtonElement>("#soundToggle")!;
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
const roundModal = document.querySelector<HTMLElement>("#roundModal")!;
const roundCorrect = document.querySelector<HTMLElement>("#roundCorrect")!;
const roundErrors = document.querySelector<HTMLElement>("#roundErrors")!;
const roundAccuracy = document.querySelector<HTMLElement>("#roundAccuracy")!;
const roundAverageTime =
  document.querySelector<HTMLElement>("#roundAverageTime")!;
const roundBestTime = document.querySelector<HTMLElement>("#roundBestTime")!;
const roundRecord = document.querySelector<HTMLElement>("#roundRecord")!;
const restartSpeedRound =
  document.querySelector<HTMLButtonElement>("#restartSpeedRound")!;
const closeRoundModal =
  document.querySelector<HTMLButtonElement>("#closeRoundModal")!;
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
const speedRoundStatus =
  document.querySelector<HTMLElement>("#speedRoundStatus")!;
const startSpeed = document.querySelector<HTMLButtonElement>("#startSpeed")!;
const stopSpeed = document.querySelector<HTMLButtonElement>("#stopSpeed")!;
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
let faceDetector: FaceDetector | null = null;
type FaceBox = { originX: number; originY: number; width: number; height: number };
let detectedFaces: FaceBox[] = [];
let lastFaceDetectionAt = 0;
let lastFaceSeenAt = 0;
let facePrivacyEnabled = true;
const faceMosaicCanvas = document.createElement("canvas");
const faceMosaicContext = faceMosaicCanvas.getContext("2d")!;
let videoFrameRequest: number | null = null;
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
let speedFinished = false;
let speedSeconds = ROUND_DURATION_SECONDS;
let speedCorrect = 0;
let speedErrors = 0;
let speedBest = 0;
let speedTarget = "";
let speedTyped = "";
let speedInterval: number | undefined;
let speedEndAt: number | null = null;
let speedChallenge: "words" | "letters" = "words";
let speedDuration = ROUND_DURATION_SECONDS;
let targetShownAt = 0;
let answerTimes: number[] = [];
let soundEnabled = loadSoundEnabled();
let audioContext: AudioContext | null = null;
type CalibrationGesture = Exclude<HandGesture, "none">;
type CalibrationTemplates = Partial<Record<CalibrationGesture, number[]>>;
// Версия 2: скелет нормализуется по повороту ладони, поэтому старые образцы
// намеренно не используются — их нужно записать заново.
const CALIBRATION_STORAGE_KEY = "morsemotion-gesture-calibration-v2";
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
let calibrationCountdown = 3;
let calibrationCountdownInterval: number | undefined;
// История нужна только в текущем сеансе: после обновления страницы она очищается.
try {
  localStorage.removeItem("morsemotion-transmissions");
} catch {}

function loadSoundEnabled(): boolean {
  try {
    return localStorage.getItem("morsemotion-sound-enabled") !== "false";
  } catch {
    return true;
  }
}

function renderSoundToggle() {
  soundToggle.textContent = `ЗВУК: ${soundEnabled ? "ВКЛ" : "ВЫКЛ"}`;
  soundToggle.classList.toggle("muted", !soundEnabled);
}

async function prepareAudio() {
  if (!soundEnabled) return;
  audioContext ??= new AudioContext();
  if (audioContext.state === "suspended") await audioContext.resume();
}

function playTone(frequency: number, duration: number, type: OscillatorType = "sine") {
  if (!soundEnabled || !audioContext || audioContext.state !== "running") return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const start = audioContext.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.11, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function getSpeedRecordKey() {
  return `morsemotion-best-speed-${speedChallenge}-${speedDuration}`;
}

function loadSpeedBest() {
  try {
    const stored = Number(localStorage.getItem(getSpeedRecordKey()) ?? 0);
    return Number.isFinite(stored) && stored >= 0 ? stored : 0;
  } catch {
    return 0;
  }
}

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
  const palm = {
    x: hand[9].x - wrist.x,
    y: hand[9].y - wrist.y,
    z: hand[9].z - wrist.z,
  };
  const scale = Math.max(Math.hypot(palm.x, palm.y, palm.z), 0.01);
  const angle = Math.atan2(palm.y, palm.x);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Сохраняем не кадр, а форму скелета. Поворот ладони приводим к одному
  // направлению, поэтому одинаковый жест не «ломается», если наклонить руку.
  return hand.flatMap((point) => {
    const x = (point.x - wrist.x) / scale;
    const y = (point.y - wrist.y) / scale;
    return [x * cos + y * sin, -x * sin + y * cos, (point.z - wrist.z) / scale];
  });
}

function averageSignatures(samples: number[][]): number[] {
  return samples[0].map(
    (_, index) => samples.reduce((sum, sample) => sum + sample[index], 0) / samples.length,
  );
}

function getCalibratedGesture(hand: NormalizedLandmark[]): HandGesture | null {
  const signature = getHandSignature(hand);
  const matches = (Object.entries(calibrationTemplates) as Array<
    [CalibrationGesture, number[]]
  >)
    .map(([gesture, template]) => ({
      gesture,
      distance: Math.sqrt(
        template.reduce((sum, value, index) => sum + (value - signature[index]) ** 2, 0) /
          template.length,
      ),
    }))
    .sort((first, second) => first.distance - second.distance);
  const [match, nextMatch] = matches;

  // Принимаем только очень близкий и однозначный шаблон. Это не даёт похожей
  // случайной позе превратиться в команду.
  return match && match.distance < 0.22 && (!nextMatch || match.distance < nextMatch.distance * 0.86)
    ? match.gesture
    : null;
}

function currentHandGesture(hand: NormalizedLandmark[]): HandGesture {
  // Базовые правила пальцев надёжнее для уже понятных поз. Персональный
  // образец нужен только как запасной вариант для нестандартной формы руки,
  // иначе похожий шаблон мог перебить корректно распознанный жест.
  const defaultGesture = classifyHandGesture(hand);
  return defaultGesture !== "none"
    ? defaultGesture
    : (getCalibratedGesture(hand) ?? "none");
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
  calibrationSamplesElement.textContent =
    calibrationCountdown > 0
      ? `ПРИГОТОВЬСЯ: СКАНИРОВАНИЕ ЧЕРЕЗ ${calibrationCountdown} СЕК.`
      : calibrationSamples.length
        ? `СЧИТАНО КАДРОВ: ${calibrationSamples.length} — МОЖНО СОХРАНЯТЬ`
        : "СКАНИРУЮ ЖЕСТ — ДЕРЖИ РУКУ В КАДРЕ";
  saveCalibration.textContent = "СОХРАНИТЬ ЖЕСТ";
}

function startCalibrationCountdown() {
  if (calibrationCountdownInterval) {
    window.clearInterval(calibrationCountdownInterval);
  }
  calibrationCountdown = 3;
  calibrationCountdownInterval = window.setInterval(() => {
    calibrationCountdown--;
    renderCalibration();
    if (calibrationCountdown <= 0 && calibrationCountdownInterval) {
      window.clearInterval(calibrationCountdownInterval);
      calibrationCountdownInterval = undefined;
      setFeedback("Сканирование началось. Держи жест неподвижно.");
    }
  }, 1000);
}

function beginCalibration() {
  calibrationStepIndex = 0;
  calibrationSamples = [];
  startCalibrationCountdown();
  renderCalibration();
  const step = calibrationSteps[calibrationStepIndex];
  setFeedback(
    step
      ? `Первый жест для калибровки: ${step.name}. ${step.help} Сканирование начнётся через 3 секунды.`
      : "Калибровка завершена.",
  );
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
  if (calibrationStepIndex < calibrationSteps.length) startCalibrationCountdown();
  else calibrationCountdown = 0;
  renderCalibration();
  const nextStep = calibrationSteps[calibrationStepIndex];
  setFeedback(
    nextStep
      ? `Образец сохранён. Следующий жест: ${nextStep.name}. ${nextStep.help}`
      : "Калибровка завершена: персональные жесты сохранены в этом браузере.",
  );
}

function setFeedback(text: string) {
  if (feedbackText.textContent === text) return;
  feedbackText.textContent = text;
  speakText(text);
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
  speedRoundStatus.classList.toggle("hidden", !speedFinished);
  startSpeed.classList.toggle("hidden", speedActive);
  stopSpeed.classList.toggle("hidden", !speedActive);
  oneMinuteButton.disabled = speedActive;
  twoMinutesButton.disabled = speedActive;
  threeMinutesButton.disabled = speedActive;
  speedWordsButton.disabled = speedActive;
  speedLettersButton.disabled = speedActive;
}
function chooseTrainingLetter() {
  trainingTarget = getRandomMorseLetter(trainingTarget.letter);
  trainingLetter.textContent = trainingTarget.letter;
  trainingCode.textContent = formatMorse(trainingTarget.code);
}
function chooseWord(): string {
  const available = WORD_BANK.filter((word) => word !== wordTarget);
  wordTarget = available[Math.floor(Math.random() * available.length)];
  wordTyped = "";
  wordTargetElement.textContent = wordTarget;
  return wordTarget;
}
function chooseSpeedTarget() {
  const options =
    speedChallenge === "letters"
      ? Object.values(MORSE_TO_CYRILLIC)
      : WORD_BANK.filter((word) => word.length <= 8);
  const filtered = options.filter((item) => item !== speedTarget);
  speedTarget = filtered[Math.floor(Math.random() * filtered.length)];
  speedTyped = "";
  targetShownAt = performance.now();
}
function setSpeedChallenge(challenge: "words" | "letters") {
  if (speedActive) return;
  speedChallenge = challenge;
  speedWordsButton.classList.toggle("active", challenge === "words");
  speedLettersButton.classList.toggle("active", challenge === "letters");
  setFeedback(`В режиме скорости выбраны ${challenge === "words" ? "слова" : "буквы"}.`);
  if (!speedActive) {
    speedBest = loadSpeedBest();
    chooseSpeedTarget();
    renderTerminal();
  }
}
function setSpeedDuration(seconds: number) {
  if (speedActive) return;
  speedDuration = seconds;
  const minutes = seconds / 60;
  oneMinuteButton.classList.toggle("active", seconds === 60);
  twoMinutesButton.classList.toggle("active", seconds === 120);
  threeMinutesButton.classList.toggle("active", seconds === 180);
  startSpeed.textContent = `НАЧАТЬ ${minutes}-МИНУТНЫЙ РАУНД`;
  setFeedback(`Выбрано время: ${minutes} ${minutes === 1 ? "минута" : "минуты"}.`);
  if (!speedActive) {
    speedBest = loadSpeedBest();
    speedSeconds = seconds;
    renderTerminal();
  }
}
function startSpeedRound() {
  if (speedInterval) window.clearInterval(speedInterval);
  roundModal.classList.add("hidden");
  speedActive = true;
  speedFinished = false;
  speedSeconds = speedDuration;
  speedEndAt = Date.now() + speedDuration * 1000;
  speedCorrect = 0;
  speedErrors = 0;
  answerTimes = [];
  speedBest = loadSpeedBest();
  currentSignal = "";
  chooseSpeedTarget();
  speedInterval = window.setInterval(() => {
    updateSpeedTimer();
  }, 250);
  setFeedback(
    `Раунд начался! Набирай ${speedChallenge === "letters" ? "буквы" : "слова"} и заверши каждую ладонью.`,
  );
  renderTerminal();
}
function finishSpeedRound() {
  if (!speedActive) return;
  if (speedInterval) window.clearInterval(speedInterval);
  speedInterval = undefined;
  speedEndAt = null;
  speedSeconds = 0;
  speedActive = false;
  speedFinished = true;
  const isNewRecord = speedCorrect > speedBest;
  if (isNewRecord) {
    speedBest = speedCorrect;
    try {
      localStorage.setItem(getSpeedRecordKey(), String(speedBest));
    } catch {}
  }
  setFeedback(
    `Раунд завершён: ${speedCorrect} ${speedChallenge === "letters" ? "букв" : "слов"}, ошибок: ${speedErrors}. Нажми «Начать», чтобы повторить.`,
  );
  const totalAnswers = speedCorrect + speedErrors;
  const averageTime = answerTimes.length
    ? answerTimes.reduce((sum, time) => sum + time, 0) / answerTimes.length
    : null;
  const bestTime = answerTimes.length ? Math.min(...answerTimes) : null;
  roundCorrect.textContent = String(speedCorrect);
  roundErrors.textContent = String(speedErrors);
  roundAccuracy.textContent = totalAnswers
    ? `${Math.round((speedCorrect / totalAnswers) * 100)}%`
    : "—";
  roundAverageTime.textContent = averageTime === null ? "—" : `${(averageTime / 1000).toFixed(1)} с`;
  roundBestTime.textContent = bestTime === null ? "—" : `${(bestTime / 1000).toFixed(1)} с`;
  roundRecord.textContent = isNewRecord ? "НОВЫЙ РЕКОРД!" : `Рекорд: ${speedBest}`;
  roundRecord.classList.toggle("new-record", isNewRecord);
  roundModal.classList.remove("hidden");
  renderTerminal();
}
function updateSpeedTimer() {
  if (!speedActive || speedEndAt === null) return;
  const remainingMilliseconds = speedEndAt - Date.now();
  speedSeconds = Math.max(0, Math.ceil(remainingMilliseconds / 1000));
  if (remainingMilliseconds <= 0) {
    finishSpeedRound();
    return;
  }
  renderTerminal();
}
function flashTerminal() {
  playTone(180, 0.24, "sawtooth");
  terminalCard.classList.remove("wrong-letter");
  void terminalCard.offsetWidth;
  terminalCard.classList.add("wrong-letter");
  window.setTimeout(
    () => terminalCard.classList.remove("wrong-letter"),
    FLASH_MS,
  );
}
function flashSuccess() {
  playTone(880, 0.12);
  window.setTimeout(() => playTone(1100, 0.14), 100);
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
  if (!calibrationMode && calibrationCountdownInterval) {
    window.clearInterval(calibrationCountdownInterval);
    calibrationCountdownInterval = undefined;
  }
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
    setFeedback(`Буква для тренировки: ${trainingTarget.letter}. Повтори её код и раскрой ладонь для проверки.`);
  } else if (wordMode) {
    setFeedback("Режим слов включён. Слушай целевое слово.");
    speakText(`Твоё слово: ${chooseWord()}`);
  } else if (speedMode) {
    speedBest = loadSpeedBest();
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
      const completedLetter = trainingTarget.letter;
      currentSignal = "";
      chooseTrainingLetter();
      setFeedback(`Верно: ${completedLetter}. Следующая буква: ${trainingTarget.letter}.`);
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
        answerTimes.push(performance.now() - targetShownAt);
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
        const completedWord = wordTarget;
        const nextWord = chooseWord();
        setFeedback(`Верно! Слово «${completedWord}» набрано. Следующее слово: ${nextWord}.`);
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
    playTone(650, 0.08);
    acceptedSignals++;
    setFeedback("Точка принята. Покажи следующий жест");
  }
  if (gesture === "dash") {
    currentSignal += "-";
    playTone(650, 0.24);
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
function drawFaceMosaic() {
  for (const face of detectedFaces) {
    const padding = Math.max(face.width, face.height) * 0.16;
    const x = Math.max(0, face.originX - padding);
    const y = Math.max(0, face.originY - padding);
    const width = Math.min(canvas.width - x, face.width + padding * 2);
    const height = Math.min(canvas.height - y, face.height + padding * 2);
    const mosaicWidth = Math.max(1, Math.ceil(width / 13));
    const mosaicHeight = Math.max(1, Math.ceil(height / 13));

    faceMosaicCanvas.width = mosaicWidth;
    faceMosaicCanvas.height = mosaicHeight;
    faceMosaicContext.imageSmoothingEnabled = false;
    faceMosaicContext.drawImage(video, x, y, width, height, 0, 0, mosaicWidth, mosaicHeight);
    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(faceMosaicCanvas, 0, 0, mosaicWidth, mosaicHeight, x, y, width, height);
    context.restore();
  }
}

function renderPrivacyToggle() {
  privacyToggle.textContent = facePrivacyEnabled ? "ЛИЦО: СКРЫТО" : "ЛИЦО: ВИДНО";
  privacyToggle.classList.toggle("active", facePrivacyEnabled);
  privacyToggle.setAttribute("aria-pressed", String(facePrivacyEnabled));
}

function drawCameraOverlay(hand?: NormalizedLandmark[]) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (facePrivacyEnabled) drawFaceMosaic();
  if (!hand) return;
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

function isFaceCoveredByHand(face: FaceBox, hand: NormalizedLandmark[]) {
  const xValues = hand.map((point) => point.x * video.videoWidth);
  const yValues = hand.map((point) => point.y * video.videoHeight);
  const handLeft = Math.min(...xValues);
  const handTop = Math.min(...yValues);
  const handRight = Math.max(...xValues);
  const handBottom = Math.max(...yValues);
  const overlapWidth = Math.max(
    0,
    Math.min(face.originX + face.width, handRight) - Math.max(face.originX, handLeft),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(face.originY + face.height, handBottom) - Math.max(face.originY, handTop),
  );
  const overlapArea = overlapWidth * overlapHeight;
  const handArea = (handRight - handLeft) * (handBottom - handTop);
  return overlapArea / Math.max(Math.min(face.width * face.height, handArea), 1) > 0.48;
}

function getFaceCenter(face: FaceBox) {
  return { x: face.originX + face.width / 2, y: face.originY + face.height / 2 };
}

function updateFaceMosaic(timestamp: number, hands: NormalizedLandmark[][]) {
  if (!facePrivacyEnabled || !faceDetector) {
    detectedFaces = [];
    return;
  }
  if (timestamp - lastFaceDetectionAt < 100) return;
  lastFaceDetectionAt = timestamp;
  const result = faceDetector.detectForVideo(video, timestamp);
  const faces = result.detections.flatMap((detection) =>
    detection.boundingBox
      ? [{
          originX: detection.boundingBox.originX,
          originY: detection.boundingBox.originY,
          width: detection.boundingBox.width,
          height: detection.boundingBox.height,
        }]
      : [],
  ).filter((face) => !hands.some((hand) => isFaceCoveredByHand(face, hand)));
  const previousFace = detectedFaces[0];
  const nearestFace = previousFace
    ? faces
        .map((face) => {
          const previousCenter = getFaceCenter(previousFace);
          const center = getFaceCenter(face);
          return { face, distance: Math.hypot(center.x - previousCenter.x, center.y - previousCenter.y) };
        })
        .sort((first, second) => first.distance - second.distance)[0]
    : undefined;
  const stableFace =
    previousFace && nearestFace
      ? nearestFace.distance < Math.max(previousFace.width, previousFace.height) * 0.9
        ? nearestFace.face
        : undefined
      : faces[0];

  if (stableFace) {
    detectedFaces = [stableFace];
    lastFaceSeenAt = timestamp;
  } else if (timestamp - lastFaceSeenAt > 450) {
    detectedFaces = [];
  }
}
function scheduleVideoProcessing() {
  if (videoFrameRequest !== null) return;
  videoFrameRequest = requestAnimationFrame(() => {
    videoFrameRequest = null;
    processVideo();
  });
}

function processVideo() {
  if (!handLandmarker || video.readyState < 2) {
    scheduleVideoProcessing();
    return;
  }

  // requestAnimationFrame может вызываться чаще, чем камера выдаёт новые кадры.
  // Не анализируем один и тот же видеокадр повторно и пропускаем каждый второй новый.
  if (video.currentTime === lastVideoTime) {
    scheduleVideoProcessing();
    return;
  }
  lastVideoTime = video.currentTime;
  receivedVideoFrames++;
  if (receivedVideoFrames % DETECTION_FRAME_INTERVAL !== 0) {
    scheduleVideoProcessing();
    return;
  }
  const timestamp = performance.now();
  const result = handLandmarker.detectForVideo(video, timestamp);
  updateFaceMosaic(timestamp, result.landmarks);
  const hand = result.landmarks[0];
  drawCameraOverlay(hand);
  if (!hand) {
    gestureState.textContent = "Рука не найдена";
    gestureHint.textContent = "Покажи кисть целиком";
    setFeedback("Поднеси руку в кадр: должны быть видны все пальцы");
    candidate = "none";
    latched = false;
    candidateFrames = 0;
  } else {
    if (calibrationMode) {
      if (
        calibrationStepIndex < calibrationSteps.length &&
        calibrationCountdown <= 0
      ) {
        calibrationSamples = [
          ...calibrationSamples.slice(-17),
          getHandSignature(hand),
        ];
        renderCalibration();
        gestureState.textContent = "Считываю образец жеста";
        gestureHint.textContent = "Держи кисть неподвижно, затем сохрани жест";
      }
      scheduleVideoProcessing();
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
  scheduleVideoProcessing();
}
async function enableCamera() {
  try {
    await prepareAudio();
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
    try {
      faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_DETECTOR_MODEL_URL },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.35,
      });
    } catch (faceError) {
      facePrivacyEnabled = false;
      renderPrivacyToggle();
      console.warn("Не удалось включить маску лица", faceError);
    }
    placeholder.classList.add("hidden");
    stopCamera.classList.remove("hidden");
    cameraStatus.innerHTML = '<span class="status-dot"></span> КАМЕРА В ЭФИРЕ';
    gestureState.textContent = "Ищу руку";
    gestureHint.textContent = "Покажите жест";
    setFeedback("Камера включена. Подними большой палец для точки");
    scheduleVideoProcessing();
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
function disableCamera() {
  if (videoFrameRequest !== null) {
    cancelAnimationFrame(videoFrameRequest);
    videoFrameRequest = null;
  }
  const stream = video.srcObject;
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  video.srcObject = null;
  handLandmarker?.close();
  handLandmarker = null;
  faceDetector?.close();
  faceDetector = null;
  detectedFaces = [];
  lastFaceDetectionAt = 0;
  lastFaceSeenAt = 0;
  lastVideoTime = -1;
  receivedVideoFrames = 0;
  candidate = "none";
  candidateFrames = 0;
  latched = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  placeholder.classList.remove("hidden");
  stopCamera.classList.add("hidden");
  startCamera.disabled = false;
  startCamera.textContent = "ВКЛЮЧИТЬ КАМЕРУ";
  cameraStatus.innerHTML = '<span class="status-dot"></span> КАМЕРА НЕ ПОДКЛЮЧЕНА';
  gestureState.textContent = "Ожидаю жест";
  gestureHint.textContent = "Покажите руку в камеру";
  setFeedback("Камера выключена");
}
startCamera.addEventListener("click", enableCamera);
stopCamera.addEventListener("click", disableCamera);
clearButton.addEventListener("click", () => {
  if (currentSignal) {
    currentSignal = currentSignal.slice(0, -1);
    setFeedback("Последний сигнал Морзе удалён");
  } else if (currentMessage) {
    currentMessage = currentMessage.slice(0, -1);
    setFeedback("Последний символ сообщения удалён");
  } else {
    setFeedback("Сообщение уже пустое");
  }
  renderTerminal();
});
transmitModeButton.addEventListener("click", () => setMode("transmit"));
trainingModeButton.addEventListener("click", () => setMode("training"));
wordModeButton.addEventListener("click", () => setMode("words"));
speedModeButton.addEventListener("click", () => setMode("speed"));
calibrationModeButton.addEventListener("click", () => setMode("calibration"));
startSpeed.addEventListener("click", startSpeedRound);
stopSpeed.addEventListener("click", finishSpeedRound);
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
closeRoundModal.addEventListener("click", () => roundModal.classList.add("hidden"));
restartSpeedRound.addEventListener("click", startSpeedRound);
soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  try {
    localStorage.setItem("morsemotion-sound-enabled", String(soundEnabled));
  } catch {}
  renderSoundToggle();
  setFeedback(soundEnabled ? "Звук включён. Включи камеру, чтобы активировать аудио." : "Звук выключен.");
});
privacyToggle.addEventListener("click", () => {
  facePrivacyEnabled = !facePrivacyEnabled;
  if (!facePrivacyEnabled) {
    detectedFaces = [];
    lastFaceSeenAt = 0;
  }
  renderPrivacyToggle();
  setFeedback(
    facePrivacyEnabled
      ? "Мозаика лица включена. Лицо скрывается только в окне камеры."
      : "Мозаика лица выключена.",
  );
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) updateSpeedTimer();
});
exitTraining.addEventListener("click", () => setMode("transmit"));
exitWords.addEventListener("click", () => setMode("transmit"));
renderTerminal();
renderSoundToggle();
renderPrivacyToggle();
