// 混雑スコア算出ロジック（仕様書「6. 混雑スコア算出ロジック」）
// 既存デモ(tokyo-dotcomu-realmap-demo.html)の evalEvent() / curveXxx() / getEndInfo() を
// そのまま移植したもの。フロントエンドは今もこのロジックをJS側に持ったまま動く
// （仕様書9章の方針どおり、UIロジックは変更していない）ため、この実装は将来サーバー側で
// スコアを扱う機能（アラート通知・管理画面など）向けに提供する。

export type Genre = "music" | "sports" | "expo" | "other" | "fireworks";
export type Scale = "large" | "medium" | "small";

export interface CongestionEvent {
  genre: Genre;
  scale: Scale;
  start: string; // HH:MM
  end: string | null; // HH:MM、未公開ならnull
  durationHint?: number; // 分単位（テスト等での上書き用）
}

export const SCALE_WEIGHT: Record<Scale, number> = { large: 90, medium: 55, small: 25 };
export const GENRE_MULT: Record<Genre, number> = { music: 1.15, sports: 1.1, expo: 0.9, other: 1.0, fireworks: 1.2 };

export function baseScore(ev: Pick<CongestionEvent, "scale" | "genre">): number {
  return Math.max(0, Math.min(100, Math.round(SCALE_WEIGHT[ev.scale] * GENRE_MULT[ev.genre])));
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fmtMinutes(m: number): string {
  m = ((m % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

// 終了時刻が未公開の場合の所要時間（分）。ジャンル×規模別（仕様書6.2）
export const DURATION_TABLE: Record<Genre, Record<Scale, number>> = {
  music: { large: 180, medium: 150, small: 120 },
  sports: { large: 150, medium: 120, small: 90 },
  expo: { large: 480, medium: 420, small: 360 },
  other: { large: 240, medium: 180, small: 120 },
  fireworks: { large: 90, medium: 75, small: 60 },
};

export const DURATION_BASIS: Record<Genre, string> = {
  music: "音楽公演の標準的な尺(規模別)から推定",
  sports: "同規模の競技イベントの平均試合時間から推定",
  expo: "同規模展示会の標準開場時間から推定",
  other: "同種イベントの平均開催時間から推定",
  fireworks: "花火大会の標準的な打ち上げ時間から推定",
};

export interface EndInfo {
  endMinutes: number;
  label: string;
  predicted: boolean;
  basis: string;
}

export function getEndInfo(ev: CongestionEvent): EndInfo {
  if (ev.end) {
    return { endMinutes: toMinutes(ev.end), label: ev.end, predicted: false, basis: "" };
  }
  const startMinutes = toMinutes(ev.start);
  const dur = ev.durationHint ?? DURATION_TABLE[ev.genre][ev.scale];
  const endMinutes = startMinutes + dur;
  return { endMinutes, label: fmtMinutes(endMinutes), predicted: true, basis: DURATION_BASIS[ev.genre] };
}

// ---- ジャンル別・時間帯係数カーブ（仕様書6.3） ----

// music（ライブ）: 終演45分前まではほぼ0。終演直前〜直後で急勾配に1.0へ、
// 55分ピーク維持後75分で収束
function curveMusic(_sinceStart: number, fromEnd: number): number {
  if (fromEnd < -45) return 0;
  if (fromEnd < -15) return (0.1 * (fromEnd + 45)) / 30;
  if (fromEnd < 0) return 0.1 + (0.9 * (fromEnd + 15)) / 15;
  if (fromEnd <= 55) return 1.0;
  if (fromEnd <= 130) return 1.0 - (fromEnd - 55) / 75;
  return 0;
}

// sports: 終了時の主ピークに加え、試合中間地点に小さな山（最大0.26）
function curveSports(sinceStart: number, fromEnd: number, duration: number): number {
  const halfOffset = sinceStart - duration * 0.5;
  const halftimeBump = Math.max(0, 0.26 * (1 - Math.abs(halfOffset) / 18));
  if (fromEnd < -60) return halftimeBump;
  if (fromEnd < 0) return Math.max(halftimeBump, 0.3 + (0.7 * (fromEnd + 60)) / 60);
  if (fromEnd <= 80) return 1.0;
  if (fromEnd <= 170) return 1.0 - (fromEnd - 80) / 90;
  return 0;
}

// expo（展示会）: 開場中は常時0.42のベースライン、閉場60分前から上昇、閉場時に短いピーク
function curveExpo(sinceStart: number, fromEnd: number): number {
  if (sinceStart < -20) return 0;
  if (sinceStart < 0) return (0.18 * (sinceStart + 20)) / 20;
  if (fromEnd < -60) return 0.42;
  if (fromEnd < 0) return 0.42 + (0.58 * (fromEnd + 60)) / 60;
  if (fromEnd <= 40) return 1.0;
  if (fromEnd <= 120) return 1.0 - (fromEnd - 40) / 80;
  return 0;
}

// other（式典・カンファレンス）: 終了90分前から緩やかに立ち上がり、90分ピーク、100分かけて収束
function curveOther(_sinceStart: number, fromEnd: number): number {
  if (fromEnd < -90) return 0;
  if (fromEnd < 0) return 0.3 + (0.7 * (fromEnd + 90)) / 90;
  if (fromEnd <= 90) return 1.0;
  if (fromEnd <= 190) return 1.0 - (fromEnd - 90) / 100;
  return 0;
}

// fireworks（花火大会）: 開始90分前から来場ラッシュで緩やかに上昇、打ち上げ中は
// 会場に滞留するため一定水準。終了直後は一斉退場でmusicより急激かつ長時間の
// ピークが続く（駅・帰路のボトルネックにより収束が遅い）
function curveFireworks(sinceStart: number, fromEnd: number): number {
  if (sinceStart < -90) return 0;
  if (fromEnd < 0) {
    if (sinceStart < 0) return (0.35 * (sinceStart + 90)) / 90;
    return 0.35;
  }
  if (fromEnd <= 60) return 1.0;
  if (fromEnd <= 150) return 1.0 - (fromEnd - 60) / 90;
  return 0;
}

export interface EvalResult {
  score: number;
  fromEnd: number;
  sinceStart: number;
  endInfo: EndInfo;
}

// SCORE = round(baseScore × intensity(now, event))（仕様書6.4）
export function evalEvent(ev: CongestionEvent, curMinutes: number): EvalResult {
  const startMinutes = toMinutes(ev.start);
  const endInfo = getEndInfo(ev);
  const duration = endInfo.endMinutes - startMinutes;
  const sinceStart = curMinutes - startMinutes;
  const fromEnd = curMinutes - endInfo.endMinutes;

  let intensity: number;
  if (ev.genre === "music") intensity = curveMusic(sinceStart, fromEnd);
  else if (ev.genre === "sports") intensity = curveSports(sinceStart, fromEnd, duration);
  else if (ev.genre === "expo") intensity = curveExpo(sinceStart, fromEnd);
  else if (ev.genre === "fireworks") intensity = curveFireworks(sinceStart, fromEnd);
  else intensity = curveOther(sinceStart, fromEnd);

  const score = Math.round(baseScore(ev) * intensity);
  return { score, fromEnd, sinceStart, endInfo };
}

export function scoreLabel(score: number): string {
  if (score < 30) return "平常";
  if (score < 50) return "やや混雑";
  if (score < 70) return "混雑";
  if (score < 85) return "非常に混雑";
  return "大混雑注意";
}
