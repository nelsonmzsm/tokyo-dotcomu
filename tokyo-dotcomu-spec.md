# 東京どっと混む — 開発仕様書（MVP v1.0）

対象会場からイベント情報を収集し、既存のデモUI（サーモグラフィー地図＋タイムライン）で混雑予測を可視化する、実データ版の構築仕様。

---

## 1. 概要

| 項目 | 内容 |
|---|---|
| プロダクト名 | 東京どっと混む |
| コンセプト | 都内大型イベント会場の開催情報から、周辺駅の混雑を「地図×タイムライン」でサーモグラフィー的に可視化する |
| MVPの狙い | 全会場網羅ではなく、**公式サイトにイベント情報が一覧化されている会場**に絞り、収集→予測→可視化の一連の流れを最短で動かす |
| フロントエンドの土台 | 既存デモ（Leaflet + Vanilla JS, 単一HTML）をベースに、ハードコードデータをAPI経由の実データに置き換える |

---

## 2. スコープ（MVP対象6会場）

事前調査により、公式サイトにイベント一覧ページが存在し、機械的に読み取りやすい会場を優先対象とする。

| 会場 | 情報源URL | 備考 |
|---|---|---|
| 東京ドーム | `https://www.tokyo-dome.co.jp/dome/event/schedule.html` | 日付・種別・イベント名が表形式で通年掲載。パース容易 |
| 東京ビッグサイト | `https://www.bigsight.jp/visitor/event/` | 主催者提出情報を公式が一覧化。直近3ヶ月程度 |
| 有明アリーナ | `https://ariake-arena.tokyo/event/` | 開催予定・過去分ともページあり |
| 東京国際フォーラム | `https://www.t-i-forum.co.jp/visitors/event/` | 「イベントカレンダー」として整理 |
| 国立競技場 | `https://jns-e.com/event/` | 2025年4月に運営者移管、公式サイトも移転済み（旧jpnsport.go.jpは更新停止） |
| Zepp DiverCity | `https://www.zepp.co.jp/hall/divercity/schedule/` | 開場・開演時刻・料金まで明記。精度が最も高い |

### MVP対象外（フェーズ2以降で検討）

| 会場 | 理由 | 代替案 |
|---|---|---|
| 日本武道館 | 公式サイトに一般イベントの一覧ページが存在しない | 主催者サイト／チケットサイト経由の収集、または当面は手動入力 |
| 国立代々木競技場 | 公式サイトの情報が乏しく、網羅的な一覧とは言えない | 同上 |

---

## 3. 法務・利用規約に関する前提（重要）

- 各会場のスクレイピングを実装する前に、**必ず対象サイトの利用規約とrobots.txtを確認**すること。
- 東京ドームの規約では、非営利の個人利用であっても情報の複製・公衆送信・頒布・転載には事前許諾を求める旨が明記されている。他会場も同様の規定がある前提で扱うこと。
- 本サービスは「情報を丸ごと再配信する」のではなく、**送客・広報協力**の位置づけとする。具体的には：
  - 保存するデータは「会場・イベント名（一般名称）・日付・時間帯・ジャンル・規模の目安」程度の最小限の事実情報にとどめる
  - 説明文・画像・チケット情報の文章はコピーしない
  - 各イベントに必ず「参照元」として公式ページへの外部リンク（別タブ）を表示する（実装済み）
- 商用化・本格運用の前に、各会場の運営元へ事前に趣旨を説明し、許諾または黙認の感触を得ることを強く推奨する。
- スクレイピングの実装自体も、節度を持って行うこと（後述「6. クローリング運用ルール」）。

---

## 4. システム構成

```
[ 収集層 ]                [ 保存層 ]        [ ロジック層 ]         [ 提供層 ]           [ 表示層 ]
会場別スクレイパー  →  正規化  →  DB(SQLite/Postgres) → 混雑スコア計算 → API(REST) → フロントエンド(既存UI)
  (定期実行)                                  (終了時刻予測含む)
```

- **収集層**：会場ごとのスクレイパーモジュール（Node.js + Cheerio、JS描画が必要なページのみPlaywright）
- **保存層**：正規化した `venues` / `events` テーブル。重複防止のためユニークキーは `venueId + date + eventName`
- **ロジック層**：既存デモの `evalEvent()` / `getEndInfo()` ロジックをそのまま移植（後述コード資産を参照）
- **提供層**：`GET /api/venues`, `GET /api/events` を返すREST API
- **表示層**：既存の地図・タイムラインUIは変更せず、データ取得元だけをハードコード配列からAPI fetchに差し替える

---

## 5. データモデル

### venues テーブル

| カラム | 型 | 説明 |
|---|---|---|
| id | string (PK) | `tokyo-dome` など |
| name | string | 会場名 |
| area | string | 区名 |
| lat / lng | float | 座標 |
| stations | json | `[{ name, lines: [lineId] }]` |
| official_url | string | 参照元URL |
| source_type | string | `official_table` / `official_calendar` など収集方式の分類 |

### events テーブル

| カラム | 型 | 説明 |
|---|---|---|
| id | string (PK) | ハッシュ or 連番 |
| venue_id | string (FK) | |
| name | string | イベント名 |
| genre | enum | `music` / `sports` / `expo` / `other` |
| date | date | |
| start_time | time | nullable |
| end_time | time | **nullable（未公開の場合が多い）** |
| scale | enum | `large` / `medium` / `small`（推定ロジックあり、5章参照） |
| source_url | string | 個別イベントの詳細URL（あれば） |
| scraped_at | datetime | 取得日時 |
| raw_html_hash | string | 変更検知用 |

### 規模（scale）推定ロジック

公式サイトに動員数が明記されないことが多いため、以下のヒューリスティックで推定する：

- ジャンルが `expo` かつ複数ホール／全館利用 → `large`
- 会場の最大キャパシティに対する利用ホール数の割合で按分（例: Zeppは基本 `small`〜`medium`、東京ドーム公演は基本 `large`）
- 不明な場合はジャンルごとのデフォルト値（`music`→`medium`, `sports`→`medium`, `expo`→`medium`, `other`→`small`）

---

## 6. 混雑スコア算出ロジック（既存デモから移植）

### 6.1 基礎スコア

```
baseScore = min(100, round(scaleWeight[scale] × genreMultiplier[genre]))

scaleWeight  = { large: 90, medium: 55, small: 25 }
genreMultiplier = { music: 1.15, sports: 1.10, other: 1.00, expo: 0.90 }
```

### 6.2 終了時刻の予測（未公開の場合）

```
durationTable(minutes) = {
  music:  { large: 180, medium: 150, small: 120 },
  sports: { large: 150, medium: 120, small: 90 },
  expo:   { large: 480, medium: 420, small: 360 },
  other:  { large: 240, medium: 180, small: 120 },
}
predictedEnd = startTime + durationTable[genre][scale]
```

予測値には `predicted: true` フラグを付け、UI側で「(予測)」表示と根拠を出す（実装済み）。

### 6.3 ジャンル別・時間帯係数（intensity, 0〜1）

イベントの性質によって混雑の立ち上がり方が異なるため、ジャンルごとに別カーブを持つ。

- **music（ライブ）**：終演45分前まではほぼ0。終演直前〜直後で急勾配に1.0へ、55分ピーク維持後75分で収束（出入りが少なく、退場が集中するタイプ）
- **sports**：終了時の主ピークに加え、試合中間地点（ハーフタイム相当）に小さな山（最大0.26）
- **expo（展示会）**：開場中は常時0.42のベースライン（常に人の出入りがある）、閉場60分前から上昇、閉場時に短いピーク
- **other（式典・カンファレンス）**：終了90分前から緩やかに立ち上がり、90分ピーク、100分かけて収束（ライブより裾野が広い）

### 6.4 最終スコア

```
SCORE = round(baseScore × intensity(now, event))   // 0〜100
```

この値をそのまま地図の色分け・ゲージ・タイムラインのサーモグラフィーに使用する。

> 実装詳細（`evalEvent()`, `curveMusic()`, `curveSports()`, `curveExpo()`, `curveOther()`, `getEndInfo()` 等）は、添付の既存デモHTML内のJavaScriptをそのまま流用可能。

---

## 7. スクレイピング仕様（会場別メモ）

| 会場 | 収集方式 | 頻度目安 | 留意点 |
|---|---|---|---|
| 東京ドーム | 静的HTML表パース（Cheerio） | 1日1回 | 表構造の年変わり目でセレクタが変わる可能性 |
| 東京ビッグサイト | 静的HTML + calendar.html併用 | 1日1回 | 「3ヶ月先以降は非掲載」の制約あり |
| 有明アリーナ | 静的HTML（event/, event-archive/） | 1日1回 | ページネーションの有無を要確認 |
| 東京国際フォーラム | 静的HTML（イベントカレンダー） | 1日1回 | ホール単位の掲載か要確認 |
| 国立競技場 | 静的HTML（jns-e.com/event/） | 1日1回 | 運営移管直後のため構造変化に注意 |
| Zepp DiverCity | 静的HTML（schedule/） | 1日1回 | 開演時刻まで取得可、精度良好 |

いずれもJS非依存の静的HTMLで取得できる可能性が高いため、まずはCheerioベースで実装し、取得失敗時のみPlaywrightにフォールバックする設計にする。

---

## 8. API仕様（MVP）

### `GET /api/venues`
```json
[
  { "id": "tokyo-dome", "name": "東京ドーム", "area": "文京区", "lat": 35.7056, "lng": 139.7519,
    "stations": [{ "name": "水道橋駅", "lines": ["chuo","mita"] }],
    "officialUrl": "https://www.tokyo-dome.co.jp/dome/event/schedule.html" }
]
```

### `GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD&venueId=`
```json
[
  { "id": "evt_001", "venueId": "tokyo-dome", "name": "◯◯ LIVE TOUR 2026",
    "genre": "music", "date": "2026-08-20", "start": "18:00", "end": null,
    "scale": "large", "sourceUrl": "https://www.tokyo-dome.co.jp/..." }
]
```
`end` が `null` の場合、フロントエンド側（またはAPI側）で6.2の予測ロジックを適用する。

---

## 9. フロントエンド接続方針

- 既存デモの `VENUES` / `EVENTS` 定数オブジェクトを、初期化時に `fetch('/api/venues')` / `fetch('/api/events?...')` で置き換える
- 地図描画・タイムライン・サーモグラフィー・サイドバー（会場／駅名タブ）・混雑スコア計算ロジックは変更不要
- 期間切替（1日/3日/1週間）に応じて `from`/`to` を変えてAPIを呼び直す形にすると、初回ロードのデータ量を抑えられる

---

## 10. 運用・スケジューリング

- 定期実行：GitHub Actions（`schedule` トリガー、1日1〜2回）または軽量サーバーのcron
- 重複防止：`venueId + date + eventName` でユニーク制約、既存レコードは更新（upsert）
- 変更検知：`raw_html_hash` を比較し、変化がなければDB書き込みをスキップ
- 異常系：取得失敗（構造変化・404等）はログに残し、通知（Slack Webhook等）を検討
- フィードバックループ：UI上の「ご意見」リンクから届いた指摘や、実際の終了時刻とのズレを記録し、6.3のカーブ・6.2の所要時間テーブルを定期的に見直す

---

## 11. 今後のロードマップ

1. **フェーズ1（本仕様）**：対象6会場、収集→DB→API→既存UI表示までを動かす
2. **フェーズ2**：日本武道館・国立代々木競技場の対応（主催者サイト経由 or 手動入力の仕組み化）
3. **フェーズ3**：実績データを使ったスコアリングモデルの調整、フィードバック管理画面
4. **フェーズ4**：対象会場の拡大、各会場運営元への許諾・連携の正式化

---

## 12. Claude Code 用プロンプト（コピペ用）

以下をそのままClaude Codeに貼り付けて、リポジトリ作成から着手できます。

````
あなたは「東京どっと混む」というWebサービスの開発を担当するエンジニアです。
以下の仕様に基づいて、新規リポジトリをこのディレクトリに構築してください。

# プロジェクト概要
都内の大型イベント会場の公式サイトからイベント情報を収集し、開催に伴う最寄り駅の
混雑を「地図×タイムライン」のサーモグラフィー表示で可視化するWebアプリを作る。

# 技術スタック（特に希望がなければこれで進めてよい）
- ランタイム: Node.js (TypeScript)
- APIサーバー: Express（シンプルさ優先。Next.jsでも可）
- スクレイピング: Cheerio（静的HTML）。取得失敗時のみPlaywrightにフォールバック
- DB: SQLite（better-sqlite3等）。将来Postgresに移行しやすいスキーマにする
- 定期実行: GitHub Actions の schedule トリガー（1日1〜2回、venue別ジョブ）
- フロントエンド: 既存のリファレンスHTML（Leaflet地図＋バニラJS）をベースに、
  ハードコードデータをAPI fetchに置き換える形で移植する

# 対象会場（MVP、6会場）
1. 東京ドーム: https://www.tokyo-dome.co.jp/dome/event/schedule.html
2. 東京ビッグサイト: https://www.bigsight.jp/visitor/event/
3. 有明アリーナ: https://ariake-arena.tokyo/event/
4. 東京国際フォーラム: https://www.t-i-forum.co.jp/visitors/event/
5. 国立競技場: https://jns-e.com/event/
6. Zepp DiverCity: https://www.zepp.co.jp/hall/divercity/schedule/

# 重要な前提（必ず守ること）
- 各会場のスクレイパーを実装する前に、対象サイトの robots.txt を実際に取得して
  確認し、Disallowされているパスがないかコード内コメントに明記すること。
- 取得頻度は1日1〜2回程度に抑え、User-Agentに連絡先（ダミーで可）を明記し、
  リクエスト間隔を空けるなど、サーバー負荷に配慮した実装にすること。
- 保存するデータは「会場名・イベント名（一般名称）・日付・時間帯・ジャンル・
  規模の目安・参照元URL」に限定し、本文・画像・チケット販売情報などの
  詳細コンテンツは保存・複製しないこと。
- フロントエンドの各イベント表示には、必ず参照元（公式サイト）への外部リンクを
  target="_blank" で付けること。

# フェーズ1: プロジェクト雛形とDB
- package.json, tsconfig.json, ディレクトリ構成（/scrapers, /server, /db, /public）を作成
- SQLiteスキーマを作成: venues, events テーブル（本仕様書「7. データモデル」参照）
- venues テーブルには上記6会場のマスタデータを投入するシードスクリプトを作成

# フェーズ2: スクレイパー
- /scrapers/tokyo-dome.ts のように会場ごとにファイルを分割
- 各スクレイパーは「HTML取得 → パース → 正規化 → upsert」の共通インターフェースに揃える
- 終了時刻が取得できない場合は null のまま保存する（予測はロジック層で行う）
- 実行用CLI（例: `npm run scrape -- --venue=tokyo-dome` / `--all`）を用意
- GitHub Actions workflow（.github/workflows/scrape.yml）で1日1〜2回自動実行

# フェーズ3: 混雑スコア計算ロジック
- 以下のロジックを /server/congestion.ts に実装する（本仕様書「6章」の内容そのまま）：
  - baseScore = scaleWeight[scale] × genreMultiplier[genre]（0〜100にクランプ）
  - 終了時刻未公開の場合の所要時間テーブルによる予測（ジャンル×規模）
  - ジャンル別の時間帯係数カーブ（music / sports / expo / other、本仕様書6.3参照）
  - SCORE = round(baseScore × intensity)

# フェーズ4: API
- GET /api/venues
- GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD&venueId=
- レスポンス形式は本仕様書「8章」の通り

# フェーズ5: フロントエンド接続
- 添付する既存のリファレンスHTML（東京どっと混むデモ）を /public にコピーし、
  ハードコードされた VENUES / EVENTS 定数を、初期化時の fetch('/api/venues'),
  fetch('/api/events?...') に置き換える
- 地図描画・タイムライン・サーモグラフィー・サイドバー（会場／駅名タブ）の
  ロジックとUIは変更しない

# 進め方
まずフェーズ1から着手し、各フェーズが終わるごどに簡単な動作確認方法を提示してください。
スクレイパーの具体的なCSSセレクタは、実際のページ構造を取得して都度提案してください
（会場サイトのHTML構造は変わりうるため、確認しながら進めること）。
````

> ※ プロンプト中の「添付する既存のリファレンスHTML」は、このチャットで作成した
> `tokyo-dotcomu-realmap-demo.html` を指します。Claude Codeのプロジェクトフォルダに
> このファイルをコピーしてから、上記プロンプトを貼り付けてください。
