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
  type HandGesture,
} from "./hand-gestures";
import { MORSE_TO_CYRILLIC, formatMorse, getRandomMorseLetter } from "./morse";
import { WORD_BANK } from "./words";
import {
  FLASH_MS,
  HAND_LANDMARKER_MODEL_URL,
  HOLD_MS,
  MEDIAPIPE_WASM_URL,
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

let handLandmarker: HandLandmarker | null = null;
let currentSignal = "";
let currentMessage = "";
type AppGesture = HandGesture | "reset" | "send";

let candidate: AppGesture = "none";
let candidateSince = 0;
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
// История нужна только в текущем сеансе: после обновления страницы она очищается.
localStorage.removeItem("morsemotion-transmissions");

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
function flashTerminal() {
  terminalCard.classList.remove("wrong-letter");
  void terminalCard.offsetWidth;
  terminalCard.classList.add("wrong-letter");
  window.setTimeout(() => terminalCard.classList.remove("wrong-letter"), FLASH_MS);
}
function flashSuccess() {
  terminalCard.classList.remove("right-letter");
  void terminalCard.offsetWidth;
  terminalCard.classList.add("right-letter");
  window.setTimeout(() => terminalCard.classList.remove("right-letter"), FLASH_MS);
}
function setMode(mode: "transmit" | "training" | "words") {
  trainingMode = mode === "training";
  wordMode = mode === "words";
  currentSignal = "";
  transmitMode.classList.toggle("hidden", trainingMode || wordMode);
  trainingModeElement.classList.toggle("hidden", !trainingMode);
  wordModeElement.classList.toggle("hidden", !wordMode);
  transmitModeButton.classList.toggle("active", !trainingMode && !wordMode);
  trainingModeButton.classList.toggle("active", trainingMode);
  wordModeButton.classList.toggle("active", wordMode);
  if (trainingMode) {
    chooseTrainingLetter();
    setFeedback("Повтори код буквы и раскрой ладонь для проверки");
  } else if (wordMode) {
    chooseWord();
    setFeedback(
      "Набери слово по одной букве и заверши каждую открытой ладонью",
    );
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
  const result = handLandmarker.detectForVideo(video, performance.now());
  const hand = result.landmarks[0];
  if (!hand) {
    gestureState.textContent = "Рука не найдена";
    gestureHint.textContent = "Покажи кисть целиком";
    setFeedback("Поднеси руку в кадр: должны быть видны все пальцы");
    candidate = "none";
    latched = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
  } else {
    drawHand(hand);
    const bothPalmsOpen =
      result.landmarks.length >= 2 &&
      result.landmarks.every(
        (detectedHand) => classifyHandGesture(detectedHand) === "open",
      );
    const bothFists =
      result.landmarks.length >= 2 &&
      result.landmarks.every(
        (detectedHand) => classifyHandGesture(detectedHand) === "fist",
      );
    const next: AppGesture = bothFists
      ? "send"
      : bothPalmsOpen
        ? "reset"
        : classifyHandGesture(hand);
    const now = performance.now();
    gestureState.textContent = getGestureLabel(next);
    gestureHint.textContent =
      next === "none"
        ? "Покажи только нужные пальцы"
        : `Удерживай жест ${HOLD_MS / 1000} сек`;
    // Новый жест — это новая команда. Не требуем убирать руку из кадра,
    // достаточно сменить форму пальцев и удержать её 500 мс.
    if (next !== candidate) {
      candidate = next;
      candidateSince = now;
      latched = false;
    }
    if (next !== "none" && !latched && now - candidateSince > HOLD_MS) {
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
      },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    const vision = await FilesetResolver.forVisionTasks(
      MEDIAPIPE_WASM_URL,
    );
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
exitTraining.addEventListener("click", () => setMode("transmit"));
exitWords.addEventListener("click", () => setMode("transmit"));
renderTerminal();
