import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type HandGesture = "dot" | "dash" | "space" | "open" | "fist" | "none";
export type FingerStates = Record<
  "thumb" | "index" | "middle" | "ring" | "pinky",
  boolean
>;

export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

const gestureLabels: Record<HandGesture | "reset" | "send", string> = {
  dot: "Точка: большой палец",
  dash: "Тире: указательный палец",
  space: "Пробел: большой и указательный",
  open: "Завершить букву: открытая ладонь",
  fist: "Удалить: кулак",
  reset: "Сброс: две открытые ладони",
  send: "Отправить: два кулака",
  none: "Согни лишние пальцы — жест сейчас неоднозначен",
};

export function getGestureLabel(gesture: keyof typeof gestureLabels): string {
  return gestureLabels[gesture];
}

function jointAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark,
): number {
  const fromJointToFirst = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const fromJointToSecond = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dotProduct =
    fromJointToFirst.x * fromJointToSecond.x +
    fromJointToFirst.y * fromJointToSecond.y +
    fromJointToFirst.z * fromJointToSecond.z;
  const lengths =
    Math.hypot(fromJointToFirst.x, fromJointToFirst.y, fromJointToFirst.z) *
    Math.hypot(fromJointToSecond.x, fromJointToSecond.y, fromJointToSecond.z);

  return (
    (Math.acos(Math.min(1, Math.max(-1, dotProduct / lengths))) * 180) / Math.PI
  );
}

function isFingerRaised(
  hand: NormalizedLandmark[],
  tip: number,
  pip: number,
  dip: number,
): boolean {
  return (
    hand[tip].y < hand[pip].y - 0.035 &&
    jointAngle(hand[pip], hand[dip], hand[tip]) > 150
  );
}

function isThumbRaised(hand: NormalizedLandmark[]): boolean {
  // При жесте с одним указательным большой палец часто виден сбоку.
  // Поэтому для точки он должен быть прямым и выше основания указательного.
  return (
    hand[4].y < hand[2].y - 0.05 &&
    hand[4].y < hand[5].y - 0.02 &&
    jointAngle(hand[2], hand[3], hand[4]) > 155
  );
}

/** Возвращает состояние каждого пальца с теми же порогами, что у классификатора. */
export function getFingerStates(hand: NormalizedLandmark[]): FingerStates {
  return {
    thumb: isThumbRaised(hand),
    index: isFingerRaised(hand, 8, 6, 7),
    middle: isFingerRaised(hand, 12, 10, 11),
    ring: isFingerRaised(hand, 16, 14, 15),
    pinky: isFingerRaised(hand, 20, 18, 19),
  };
}

/**
 * Распознаёт только позы, которые использует MorseMotion.
 * Большой палец проверяется по высоте и углу сустава, чтобы согнутый палец
 * не ошибочно считался точкой.
 */
export function classifyHandGesture(hand: NormalizedLandmark[]): HandGesture {
  const {
    thumb: thumbRaised,
    index: indexRaised,
    middle: middleRaised,
    ring: ringRaised,
    pinky: pinkyRaised,
  } = getFingerStates(hand);

  if (
    thumbRaised &&
    !indexRaised &&
    !middleRaised &&
    !ringRaised &&
    !pinkyRaised
  )
    return "dot";
  if (
    !thumbRaised &&
    indexRaised &&
    !middleRaised &&
    !ringRaised &&
    !pinkyRaised
  )
    return "dash";
  if (
    thumbRaised &&
    indexRaised &&
    !middleRaised &&
    !ringRaised &&
    !pinkyRaised
  )
    return "space";
  if (thumbRaised && indexRaised && middleRaised && ringRaised && pinkyRaised)
    return "open";
  if (
    !thumbRaised &&
    !indexRaised &&
    !middleRaised &&
    !ringRaised &&
    !pinkyRaised
  )
    return "fist";

  return "none";
}

const targetGestures: Record<Exclude<HandGesture, "none">, FingerStates> = {
  dot: { thumb: true, index: false, middle: false, ring: false, pinky: false },
  dash: { thumb: false, index: true, middle: false, ring: false, pinky: false },
  space: { thumb: true, index: true, middle: false, ring: false, pinky: false },
  open: { thumb: true, index: true, middle: true, ring: true, pinky: true },
  fist: {
    thumb: false,
    index: false,
    middle: false,
    ring: false,
    pinky: false,
  },
};
const fingerNames: Record<keyof FingerStates, string> = {
  thumb: "большой",
  index: "указательный",
  middle: "средний",
  ring: "безымянный",
  pinky: "мизинец",
};
const targetNames: Record<Exclude<HandGesture, "none">, string> = {
  dot: "точка",
  dash: "тире",
  space: "пробел",
  open: "открытая ладонь",
  fist: "кулак",
};

function joinNames(names: string[]): string {
  if (names.length < 2) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} и ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} и ${names.at(-1)}`;
}

/** Даёт конкретную подсказку для неоднозначной позы, не меняя классификацию. */
export function getPoseHint(hand: NormalizedLandmark[]): string {
  const current = getFingerStates(hand);
  const fingers = Object.keys(current) as Array<keyof FingerStates>;
  const nearest = (
    Object.keys(targetGestures) as Array<Exclude<HandGesture, "none">>
  )
    .map((gesture) => ({
      gesture,
      differences: fingers.filter(
        (finger) => current[finger] !== targetGestures[gesture][finger],
      ),
    }))
    .sort((a, b) => a.differences.length - b.differences.length)[0];

  const toRaise = nearest.differences
    .filter((finger) => targetGestures[nearest.gesture][finger])
    .map((finger) => fingerNames[finger]);
  const toFold = nearest.differences
    .filter((finger) => !targetGestures[nearest.gesture][finger])
    .map((finger) => fingerNames[finger]);
  const parts = [
    toRaise.length ? `Выпрями ${joinNames(toRaise)} палец` : "",
    toFold.length ? `согни ${joinNames(toFold)} палец` : "",
  ].filter(Boolean);
  return `${parts.join(" и ")}, чтобы получилась ${targetNames[nearest.gesture]}`;
}
