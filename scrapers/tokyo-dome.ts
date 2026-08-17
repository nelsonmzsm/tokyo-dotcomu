import * as cheerio from "cheerio";
import { fetchStaticHtml, hashHtml } from "./fetchHtml";
import { Genre, ScrapedEvent } from "./types";
import { estimateScale, guessGenre } from "./scaleHeuristic";

// 東京ドーム: https://www.tokyo-dome.co.jp/dome/event/schedule.html
// 静的HTMLの表形式スケジュール（月タブごとに c-ttl-set-calender 見出し + table.c-mod-calender）
// robots.txt: 2026-08時点で /robots.txt は404（明示的な制限なし）

export const venueId = "tokyo-dome";
const SCHEDULE_URL = "https://www.tokyo-dome.co.jp/dome/event/schedule.html";

const TAG_GENRE_MAP: Record<string, Genre> = {
  "野球": "sports",
  "コンサート": "music",
  "イベント": "other",
  "展示会": "expo",
};

function parseStartTime(text: string): string | null {
  const m = text.match(/開始\s*(\d{1,2}:\d{2})/) || text.match(/開演\s*(\d{1,2}:\d{2})/);
  if (!m) return null;
  const [h, mi] = m[1].split(":");
  return `${h.padStart(2, "0")}:${mi}`;
}

export async function run(): Promise<{ events: ScrapedEvent[]; pageHash: string }> {
  const html = await fetchStaticHtml(SCHEDULE_URL);
  const pageHash = hashHtml(html);
  const $ = cheerio.load(html);

  const events: ScrapedEvent[] = [];
  const now = new Date();
  let currentYear = now.getFullYear();
  let currentMonth = now.getMonth() + 1;

  // 月見出しとカレンダー表が文書順に交互に現れるため、1パスで走査しながら年月を更新する
  $(".c-ttl-set-calender, table.c-mod-calender").each((_, el) => {
    const $el = $(el);
    if ($el.is(".c-ttl-set-calender")) {
      const m = $el.text().match(/(\d{4})年(\d{1,2})月/);
      if (m) {
        currentYear = Number(m[1]);
        currentMonth = Number(m[2]);
      }
      return;
    }

    $el.find("tr.c-mod-calender__item").each((__, tr) => {
      const $tr = $(tr);
      const day = $tr.find(".c-mod-calender__day").first().text().trim();
      if (!day) return;
      const date = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${day.padStart(2, "0")}`;

      $tr.find(".c-mod-calender__detail-in").each((___, detailIn) => {
        const $detail = $(detailIn);
        const tagText = $detail.find(".c-txt-tag__item").first().text().trim();
        const linkEl = $detail.find(".c-mod-calender__links a").first();
        const name = linkEl.text().trim();
        if (!name) return;
        const href = linkEl.attr("href") || null;
        const sourceUrl = href ? new URL(href, SCHEDULE_URL).toString() : SCHEDULE_URL;
        const timeText = $detail.find(".c-txt-caption-01").text();
        const start = parseStartTime(timeText);
        const genre = TAG_GENRE_MAP[tagText] ?? guessGenre(`${tagText} ${name}`);
        const scale = estimateScale(venueId, genre);

        events.push({ venueId, name, genre, date, start, end: null, scale, sourceUrl });
      });
    });
  });

  return { events, pageHash };
}
