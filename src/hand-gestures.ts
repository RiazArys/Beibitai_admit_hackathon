import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type HandGesture = "dot" | "dash" | "space" | "open" | "fist" | "none";

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

/**
 * Распознаёт только позы, которые использует MorseMotion.
 * Большой палец проверяется по высоте и углу сустава, чтобы согнутый палец
 * не ошибочно считался точкой.
 */
export function classifyHandGesture(hand: NormalizedLandmark[]): HandGesture {
  const thumbRaised =
    hand[4].y < hand[2].y - 0.05 && jointAngle(hand[2], hand[3], hand[4]) > 155;
  const indexRaised = isFingerRaised(hand, 8, 6, 7);
  const middleRaised = isFingerRaised(hand, 12, 10, 11);
  const ringRaised = isFingerRaised(hand, 16, 14, 15);
  const pinkyRaised = isFingerRaised(hand, 20, 18, 19);

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
