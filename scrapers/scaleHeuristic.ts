import { Genre, Scale } from "./types";

// 仕様書「5. データモデル」の規模(scale)推定ロジック。
// 公式サイトに動員数が明記されないため、会場特性とジャンルからヒューリスティックに推定する。

const GENRE_DEFAULT_SCALE: Record<Genre, Scale> = {
  music: "medium",
  sports: "medium",
  expo: "medium",
  other: "small",
  fireworks: "medium",
};

// キャパシティが常に大きい会場（規模はほぼ会場に支配される）
const VENUE_LARGE_BY_DEFAULT = new Set(["tokyo-dome", "kokuritsu", "ariake-arena"]);
// キャパシティが小〜中規模で固定の会場（例: Zeppはライブハウス規模）
const VENUE_SMALL_BY_DEFAULT = new Set(["zepp-diver"]);

export function estimateScale(
  venueId: string,
  genre: Genre,
  opts: { hallsUsedCount?: number } = {}
): Scale {
  if (VENUE_LARGE_BY_DEFAULT.has(venueId)) return "large";
  if (VENUE_SMALL_BY_DEFAULT.has(venueId)) return "small";

  // ビッグサイトのように複数ホールを持つ会場は、利用ホール数の割合で按分
  if (opts.hallsUsedCount !== undefined) {
    if (genre === "expo" && opts.hallsUsedCount >= 6) return "large";
    if (opts.hallsUsedCount >= 3) return "medium";
    return "small";
  }

  return GENRE_DEFAULT_SCALE[genre];
}

// イベント名・説明文からジャンルを推定する簡易マッピング（会場別スクレイパーで利用）
const GENRE_KEYWORD_MAP: [RegExp, Genre][] = [
  [/花火/, "fireworks"],
  [/野球|サッカー|バスケ|バレー|格闘技|ハンドボール|試合|大会|グランプリ/, "sports"],
  [/ライブ|コンサート|ツアー|フェス|単独公演/, "music"],
  [/展示会|見本市|EXPO|エキスポ|即売会/i, "expo"],
];

export function guessGenre(text: string, fallback: Genre = "other"): Genre {
  for (const [re, genre] of GENRE_KEYWORD_MAP) {
    if (re.test(text)) return genre;
  }
  return fallback;
}

// ジャンル別のデフォルト開始時刻（フォーラムのように開始時刻が非公開の会場向け）
export const DEFAULT_START_TIME: Record<Genre, string> = {
  music: "18:00",
  sports: "14:00",
  expo: "10:00",
  other: "13:00",
  fireworks: "19:00",
};
