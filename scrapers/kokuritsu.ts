import * as cheerio from "cheerio";
import { fetchStaticHtml, hashHtml } from "./fetchHtml";
import { Genre, ScrapedEvent } from "./types";
import { estimateScale, guessGenre } from "./scaleHeuristic";

// 国立競技場: https://jns-e.com/event/ （2025年4月に運営移管、新公式サイト）
// 静的HTML、li > a > div.p-event-list__content が1イベント1ブロック。
// robots.txt: 2026-08時点で /robots.txt は404（明示的な制限なし）

export const venueId = "kokuritsu";
const EVENT_URL = "https://jns-e.com/event/";

const ICON_GENRE_MAP: Record<string, Genre> = {
  sport: "sports",
  music: "music",
  expo: "expo",
};

function parseStartTime(text: string): string | null {
  const m = text.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

export async function run(): Promise<{ events: ScrapedEvent[]; pageHash: string }> {
  const html = await fetchStaticHtml(EVENT_URL);
  const pageHash = hashHtml(html);
  const $ = cheerio.load(html);

  const events: ScrapedEvent[] = [];

  $(".p-event-list__content").each((_, content) => {
    const $content = $(content);
    const $anchor = $content.closest("a");
    const href = $anchor.attr("href");
    const sourceUrl = href ? new URL(href, EVENT_URL).toString() : EVENT_URL;

    const name = $content.find(".p-event-list__head").first().text().trim();
    if (!name) return;

    const iconClass = $content.find(".p-event-list__icon p").first().attr("class")?.trim() ?? "";
    const iconLabel = $content.find(".p-event-list__icon p span").last().text().trim();

    let start: string | null = null;
    let dateStr = "";
    $content.find("dl.p-event-list__data > div").each((__, row) => {
      const dt = $(row).find("dt").first().text().trim();
      if (dt === "日程") {
        const year = $(row).find(".year").first().text().trim();
        const monthDay = $(row).find(".date").first().text().trim(); // "08/01"
        if (year && monthDay.includes("/")) {
          const [mm, dd] = monthDay.split("/");
          dateStr = `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
        }
      } else if (dt === "開始時間") {
        start = parseStartTime($(row).find("dd").first().text().trim());
      }
    });
    if (!dateStr) return;

    const genre = ICON_GENRE_MAP[iconClass] ?? guessGenre(`${iconLabel} ${name}`);
    const scale = estimateScale(venueId, genre);

    events.push({ venueId, name, genre, date: dateStr, start, end: null, scale, sourceUrl });
  });

  return { events, pageHash };
}
