import * as cheerio from "cheerio";
import { fetchStaticHtml, hashHtml } from "./fetchHtml";
import { ScrapedEvent } from "./types";

// 東京湾大華火祭: https://tokyo-hanabi-festival.com/
// .scheduled-date-description 内に "2026年10月24日（土）17:30打上開始" の形式で掲載。

export const venueId = "fireworks-tokyobay";
const URL = "https://tokyo-hanabi-festival.com/";
const EVENT_NAME = "東京湾大華火祭";

export async function run(): Promise<{ events: ScrapedEvent[]; pageHash: string }> {
  const html = await fetchStaticHtml(URL);
  const pageHash = hashHtml(html);
  const $ = cheerio.load(html);

  const text = $(".scheduled-date-description").first().text().replace(/\s+/g, "");
  const m = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2}):(\d{2})/);
  if (!m) {
    console.warn(`[${venueId}] 開催日時を特定できませんでした`);
    return { events: [], pageHash };
  }

  const date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const start = `${m[4].padStart(2, "0")}:${m[5]}`;

  const events: ScrapedEvent[] = [
    { venueId, name: EVENT_NAME, genre: "fireworks", date, start, end: null, scale: "large", sourceUrl: URL },
  ];
  return { events, pageHash };
}
