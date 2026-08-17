import { fetchStaticHtml, hashHtml } from "./fetchHtml";
import { ScrapedEvent } from "./types";

// 第48回世田谷区たまがわ花火大会: https://www.tamagawa-hanabi.com/
// 公式サイトは開催日時をトップページの画像バナーのみで告知しており、開催日そのものは
// 本文テキストに一切登場しない（2026年8月時点で確認。ページ内の日付らしきテキストは
// すべて「新着情報」ブログ記事の投稿日であり、それを拾うと誤った日付になる）。
// そのため発表済みの日程を固定値として保持する。取得自体は変更検知(raw_html_hash)や
// 将来的な構造変化の監視のために行う。
export const venueId = "fireworks-setagaya";
const URL = "https://www.tamagawa-hanabi.com/";
const EVENT_NAME = "第48回世田谷区たまがわ花火大会";
const ANNOUNCED_DATE = "2026-10-03";
const ANNOUNCED_START = "18:00";

export async function run(): Promise<{ events: ScrapedEvent[]; pageHash: string }> {
  const html = await fetchStaticHtml(URL);
  const pageHash = hashHtml(html);

  const events: ScrapedEvent[] = [
    {
      venueId,
      name: EVENT_NAME,
      genre: "fireworks",
      date: ANNOUNCED_DATE,
      start: ANNOUNCED_START,
      end: null,
      scale: "large",
      sourceUrl: URL,
    },
  ];
  return { events, pageHash };
}
