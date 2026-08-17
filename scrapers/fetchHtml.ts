import { createHash } from "node:crypto";

// 連絡先を明記したUser-Agent（実運用時は実際の連絡先に差し替える）
// HTTPヘッダーはASCII(ByteString)のみ許容されるため、日本語の説明文は入れない
export const USER_AGENT = "TokyoDotComuBot/0.1 (+mailto:contact@example.com; non-commercial referral service)";

const FETCH_TIMEOUT_MS = 15000;
// 会場サイトへの負荷配慮のため、同一クローラ実行内のリクエスト間隔を空ける
const REQUEST_INTERVAL_MS = 1500;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hashHtml(html: string): string {
  return createHash("sha256").update(html).digest("hex");
}

// 静的HTML取得（Cheerioでパースする前段）。取得失敗時は例外を投げる。
export async function fetchStaticHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ja,en;q=0.8",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const html = await res.text();
    if (!html || html.length < 100) {
      throw new Error(`Empty/too-short response body for ${url}`);
    }
    return html;
  } finally {
    clearTimeout(timer);
  }
}

// JS描画が必要なページ用のフォールバック。
// devDependencies の playwright が未インストールの環境でも他のスクレイパーが
// 動くよう、動的importで遅延解決する。
export async function fetchRenderedHtml(url: string): Promise<string> {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      `Playwrightが未インストールのため ${url} のレンダリング取得にフォールバックできません（npm install playwright を実行してください）`
    );
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: USER_AGENT });
    await page.goto(url, { waitUntil: "networkidle", timeout: FETCH_TIMEOUT_MS });
    return await page.content();
  } finally {
    await browser.close();
  }
}

// まず静的取得を試み、失敗した場合のみPlaywrightにフォールバックする共通インターフェース
export async function fetchHtmlWithFallback(url: string): Promise<string> {
  try {
    return await fetchStaticHtml(url);
  } catch (err) {
    console.warn(`[fetchHtml] static fetch failed for ${url}, falling back to Playwright:`, err);
    return await fetchRenderedHtml(url);
  }
}

// 複数URLを順番に、間隔を空けながら取得する（会場サイトへの負荷配慮）
export async function fetchSequentially(
  urls: string[],
  fetcher: (url: string) => Promise<string> = fetchHtmlWithFallback
): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    if (i > 0) await sleep(REQUEST_INTERVAL_MS);
    results.push(await fetcher(urls[i]));
  }
  return results;
}
