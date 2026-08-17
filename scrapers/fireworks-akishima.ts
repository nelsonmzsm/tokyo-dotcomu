import * as cheerio from "cheerio";
import { fetchStaticHtml, hashHtml } from "./fetchHtml";
import { ScrapedEvent } from "./types";

// 第54回昭島市民くじら祭 夢花火: https://akishima-kujiramatsuri.jp/
// 公式サイトのトップページは開催日時を画像バナーでしか告知しておらず、本文テキストには
// 「お知らせ」記事タイトル（例:「夢花火（8月29日）における交通規制について」）経由でしか
// 日付が現れない。時刻はサイト内どこにもテキストで書かれていないため、例年の開始時刻を
// フォールバックとして用いる（構造が変わったら要見直し）。

export const venueId = "fireworks-akishima";
const URL = "https://akishima-kujiramatsuri.jp/";
const EVENT_NAME = "第54回昭島市民くじら祭 夢花火";
const FALLBACK_START = "20:00";

export async function run(): Promise<{ events: ScrapedEvent[]; pageHash: string }> {
  const html = await fetchStaticHtml(URL);
  const pageHash = hashHtml(html);
  const $ = cheerio.load(html);

  let date: string | null = null;
  $("h2.p-postList__title").each((_, h2) => {
    if (date) return;
    const title = $(h2).text();
    const m = title.match(/夢花火.*?(\d{1,2})月(\d{1,2})日/);
    if (!m) return;
    const dt = $(h2).closest(".p-postList__body").find("time.c-postTimes__posted").attr("datetime");
    const year = dt ? Number(dt.slice(0, 4)) : new Date().getFullYear();
    date = `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  });

  if (!date) {
    console.warn(`[${venueId}] 開催日をお知らせ記事タイトルから特定できませんでした（サイト構造変化の可能性）`);
    return { events: [], pageHash };
  }

  const events: ScrapedEvent[] = [
    { venueId, name: EVENT_NAME, genre: "fireworks", date, start: FALLBACK_START, end: null, scale: "medium", sourceUrl: URL },
  ];
  return { events, pageHash };
}
