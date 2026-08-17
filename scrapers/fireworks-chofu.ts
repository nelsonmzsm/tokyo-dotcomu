import { fetchStaticHtml, hashHtml } from "./fetchHtml";
import { ScrapedEvent } from "./types";

// 第41回調布花火: https://hanabi.csa.gr.jp/
// meta descriptionに "2026/9/12 (土) at 調布市多摩川周辺 開会式18:00- | 打ち上げ18:15-19:15 ※荒天等中止"
// の形式で開催日・開始/終了時刻がまとまって掲載されている。

export const venueId = "fireworks-chofu";
const URL = "https://hanabi.csa.gr.jp/";
const EVENT_NAME = "第41回調布花火";

export async function run(): Promise<{ events: ScrapedEvent[]; pageHash: string }> {
  const html = await fetchStaticHtml(URL);
  const pageHash = hashHtml(html);

  const descMatch = html.match(/name="description"\s+content="([^"]+)"/);
  const desc = descMatch ? descMatch[1] : "";
  const dateMatch = desc.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  const timeMatch = desc.match(/打ち上げ(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);

  if (!dateMatch || !timeMatch) {
    console.warn(`[${venueId}] meta descriptionから日時を特定できませんでした`);
    return { events: [], pageHash };
  }

  const date = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
  const start = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
  const end = `${timeMatch[3].padStart(2, "0")}:${timeMatch[4]}`;

  const events: ScrapedEvent[] = [
    { venueId, name: EVENT_NAME, genre: "fireworks", date, start, end, scale: "large", sourceUrl: URL },
  ];
  return { events, pageHash };
}
