import * as cheerio from "cheerio";
import { fetchStaticHtml, hashHtml } from "./fetchHtml";
import { ScrapedEvent } from "./types";
import { estimateScale, guessGenre } from "./scaleHeuristic";

// 東京ビッグサイト: https://www.bigsight.jp/visitor/event/
// 静的HTML、article.lyt-event-01 が1イベント1ブロック。直近3ヶ月程度のみ掲載。
// robots.txt: 2026-08時点で /robots.txt は404（明示的な制限なし）

export const venueId = "bigsight";
const LIST_URL = "https://www.bigsight.jp/visitor/event/";

function expandDateRange(startYmd: string, endYmd: string): string[] {
  const dates: string[] = [];
  const cur = new Date(startYmd + "T00:00:00");
  const end = new Date(endYmd + "T00:00:00");
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function parseDateRange(text: string): string[] {
  const matches = [...text.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日/g)];
  if (matches.length === 0) return [];
  const toYmd = (m: RegExpMatchArray) =>
    `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const start = toYmd(matches[0]);
  const end = matches.length > 1 ? toYmd(matches[matches.length - 1]) : start;
  return expandDateRange(start, end);
}

function parseStartTime(text: string): string | null {
  const m = text.match(/(\d{1,2}):(\d{2})\s*-/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function countHalls(facilityText: string): number {
  // 「東1-3・7・8ホール、西1-4ホール」のような表記からホール数を概算する
  const hallGroups = facilityText.split(/[、,]/).filter((s) => s.includes("ホール") || s.includes("展示場"));
  let count = 0;
  for (const group of hallGroups) {
    const numbers = group.match(/\d+/g);
    count += numbers ? numbers.length : 1;
  }
  return count || 1;
}

export async function run(): Promise<{ events: ScrapedEvent[]; pageHash: string }> {
  const html = await fetchStaticHtml(LIST_URL);
  const pageHash = hashHtml(html);
  const $ = cheerio.load(html);

  const events: ScrapedEvent[] = [];

  $("article.lyt-event-01").each((_, el) => {
    const $el = $(el);
    const linkEl = $el.find("h3.hdg-01 a").first();
    const name = linkEl.clone().find("svg").remove().end().text().trim();
    if (!name) return;
    const sourceUrl = linkEl.attr("href") || LIST_URL;
    const description = $el.find("> p").first().text().trim();

    const fields: Record<string, string> = {};
    $el.find("dl.list-01 > div").each((__, row) => {
      const dt = $(row).find("dt").text().trim();
      const dd = $(row).find("dd").text().trim();
      if (dt) fields[dt] = dd;
    });

    const dates = parseDateRange(fields["開催期間"] || "");
    if (dates.length === 0) return;
    const start = parseStartTime(fields["開催時間"] || "");
    const hallsUsedCount = countHalls(fields["利用施設"] || "");
    const genre = guessGenre(`${name} ${description}`, "expo");
    const scale = estimateScale(venueId, genre, { hallsUsedCount });

    for (const date of dates) {
      events.push({ venueId, name, genre, date, start, end: null, scale, sourceUrl });
    }
  });

  return { events, pageHash };
}
