import * as cheerio from "cheerio";
import { fetchStaticHtml, hashHtml } from "./fetchHtml";
import { ScrapedEvent } from "./types";
import { estimateScale, guessGenre } from "./scaleHeuristic";

// Zepp DiverCity: https://www.zepp.co.jp/hall/divercity/schedule/
// 静的HTML、a.sch-content が1公演1ブロック。開場・開演時刻まで明記され精度が最も高い。
// robots.txt: /wp-admin/ のみDisallow（対象パスは制限なし）

export const venueId = "zepp-diver";
const SCHEDULE_URL = "https://www.zepp.co.jp/hall/divercity/schedule/";

export async function run(): Promise<{ events: ScrapedEvent[]; pageHash: string }> {
  const html = await fetchStaticHtml(SCHEDULE_URL);
  const pageHash = hashHtml(html);
  const $ = cheerio.load(html);

  const events: ScrapedEvent[] = [];

  $("a.sch-content").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    if (!href) return;
    const sourceUrl = new URL(href, SCHEDULE_URL).toString();

    const performer = $el.find(".sch-content-text__performer").first().text().trim();
    const title = $el.find(".sch-content-text__ttl").first().text().trim();
    const name = title || performer;
    if (!name) return;

    const year = $el.find(".sch-content-date__year").first().text().trim();
    const monthDay = $el.find(".sch-content-date__month").first().text().trim(); // "8.4"
    if (!year || !monthDay.includes(".")) return;
    const [mm, dd] = monthDay.split(".");
    const date = `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;

    const start = $el.find(".sch-content-text-date__start").first().text().trim() || null;

    const genre = guessGenre(`${performer} ${title}`, "music");
    const scale = estimateScale(venueId, genre);

    events.push({ venueId, name, genre, date, start, end: null, scale, sourceUrl });
  });

  return { events, pageHash };
}
