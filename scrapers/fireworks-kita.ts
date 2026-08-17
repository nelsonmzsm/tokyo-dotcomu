import { fetchStaticHtml, hashHtml } from "./fetchHtml";
import { ScrapedEvent } from "./types";

// 北区花火会2026 RED×BLUE SPARKLE GATE: https://hanabi-kita.com/
// <title>/og:descriptionに "2026年9月26日(土)18:30開演" の形式で開催日時が掲載されている。

export const venueId = "fireworks-kita";
const URL = "https://hanabi-kita.com/";
const EVENT_NAME = "北区花火会 RED×BLUE SPARKLE GATE";

export async function run(): Promise<{ events: ScrapedEvent[]; pageHash: string }> {
  const html = await fetchStaticHtml(URL);
  const pageHash = hashHtml(html);

  const m = html.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\([土日月火水木金]\)(\d{1,2}):(\d{2})開演/);
  if (!m) {
    console.warn(`[${venueId}] タイトル/meta descriptionから日時を特定できませんでした`);
    return { events: [], pageHash };
  }

  const date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const start = `${m[4].padStart(2, "0")}:${m[5]}`;

  const events: ScrapedEvent[] = [
    { venueId, name: EVENT_NAME, genre: "fireworks", date, start, end: null, scale: "large", sourceUrl: URL },
  ];
  return { events, pageHash };
}
