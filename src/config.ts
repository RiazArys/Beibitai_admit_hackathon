/** Общие настройки поведения приложения. */
export const HOLD_MS = 350;
/** Одинаковая поза должна держаться несколько кадров подряд, иначе это шум камеры. */
export const MIN_STABLE_GESTURE_FRAMES = 5;
export const FLASH_MS = 480;
export const ROUND_DURATION_SECONDS = 60;

/** Локальные статические файлы: на деплое не зависят от внешних CDN. */
export const MEDIAPIPE_WASM_URL = "/wasm";
export const HAND_LANDMARKER_MODEL_URL = "/models/hand_landmarker.task";
