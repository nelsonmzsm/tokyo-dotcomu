export type Genre = "music" | "sports" | "expo" | "other" | "fireworks";
export type Scale = "large" | "medium" | "small";

// スクレイパーが返す正規化済みイベント（DB保存前の中間形式）
export interface ScrapedEvent {
  venueId: string;
  name: string;
  genre: Genre;
  date: string; // YYYY-MM-DD
  start: string | null; // HH:MM
  end: string | null; // HH:MM
  scale: Scale;
  sourceUrl: string | null;
}

export interface Scraper {
  venueId: string;
  scrape(): Promise<ScrapedEvent[]>;
}
