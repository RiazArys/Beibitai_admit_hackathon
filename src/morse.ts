/**
 * Таблица перевода кода Морзе в кириллические буквы.
 * Значения совпадают с таблицей, показанной в интерфейсе приложения.
 */
export const MORSE_TO_CYRILLIC: Readonly<Record<string, string>> = {
  ".-": "А",
  "-...": "Б",
  ".--": "В",
  "--.": "Г",
  "-..": "Д",
  ".": "Е",
  "...-": "Ж",
  "--..": "З",
  "..": "И",
  ".---": "Й",
  "-.-": "К",
  ".-..": "Л",
  "--": "М",
  "-.": "Н",
  "---": "О",
  ".--.": "П",
  ".-.": "Р",
  "...": "С",
  "-": "Т",
  "..-": "У",
  "..-.": "Ф",
  "....": "Х",
  "-.-.": "Ц",
  "---.": "Ч",
  "----": "Ш",
  "--.-": "Щ",
  ".--.-.": "Ъ",
  "-.--": "Ы",
  "-..-": "Ь",
  "...-...": "Э",
  "..--": "Ю",
  ".-.-": "Я",
};

/** Преобразует технические символы . и - в типографские · и — для экрана. */
export function formatMorse(signal: string): string {
  return signal.replaceAll(".", "·").replaceAll("-", "—");
}

export type MorseLetter = { code: string; letter: string };

export function getRandomMorseLetter(except?: string): MorseLetter {
  const letters = Object.entries(MORSE_TO_CYRILLIC)
    .map(([code, letter]) => ({ code, letter }))
    .filter(({ letter }) => letter !== except);

  return letters[Math.floor(Math.random() * letters.length)];
}
