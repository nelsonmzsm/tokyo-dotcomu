import * as cheerio from "cheerio";
import { fetchStaticHtml, hashHtml } from "./fetchHtml";
import { ScrapedEvent } from "./types";
import { estimateScale, guessGenre, DEFAULT_START_TIME } from "./scaleHeuristic";

// 東京国際フォーラム: https://www.t-i-forum.co.jp/visitors/event/
// 静的HTML「イベントカレンダー」。日付ごとに dl.p-news が並び、1日に複数イベントがあり得る。
// 開始時刻・ホール名はこの一覧には掲載されないため、開始時刻はジャンル別デフォルト値で補う
// （仕様書6.2の予測ロジックと同様の考え方。UI側の混雑計算には開始時刻が必須のため）。
// robots.txt: 2026-08時点で /robots.txt は404（明示的な制限なし）

export const venueId = "forum";
const CALENDAR_URL = "https://www.t-i-forum.co.jp/visitors/event/";

export async function run(): Promise<{ events: ScrapedEvent[]; pageHash: string }> {
  const html = await fetchStaticHtml(CALENDAR_URL);
  const pageHash = hashHtml(html);
  const $ = cheerio.load(html);

  const events: ScrapedEvent[] = [];

  $("dl.p-news.p-eventTop_date_table").each((_, dl) => {
    const $dl = $(dl);
    const ariaLabel = $dl.find("dt.p-news__pubdate").attr("aria-label") || "";
    const dateMatch = ariaLabel.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!dateMatch) return;
    const date = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;

    $dl.find(".js-sort-item").each((__, item) => {
      const $item = $(item);
      const category = $item.attr("data-sort-category") || "";
      // 「関係者」限定イベントは一般来場者の混雑要因としては扱わない
      if (category && category !== "一般") return;

      const linkEl = $item.find("a[href]").first();
      const name = linkEl.text().replace(/\s+/g, " ").trim();
      if (!name) return;
      const href = linkEl.attr("href");
      const sourceUrl = href ? new URL(href, CALENDAR_URL).toString() : CALENDAR_URL;

      const genre = guessGenre(name);
      const scale = estimateScale(venueId, genre);
      const start = DEFAULT_START_TIME[genre];

      events.push({ venueId, name, genre, date, start, end: null, scale, sourceUrl });
    });
  });

  return { events, pageHash };
}
