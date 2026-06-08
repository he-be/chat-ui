# WEB 検索ツール戦略

> 作成日: 2026-06-07
> 更新日: 2026-06-08
> 状態: ✅ 完了 (Phase 1 + Phase 2 実装済み、E2E テスト済み)

---

## 1. 現状の検索ツール状況

### 1.1 MCP (Model Context Protocol) アーキテクチャ

本アプリは外部ツール統合に MCP を採用している。

| 要素             | 実装場所                                          | 概要                                                      |
| ---------------- | ------------------------------------------------- | --------------------------------------------------------- |
| MCP サーバー定義 | `MCP_SERVERS` (env)                               | JSON 配列 `[{"name", "url", "headers?"}]`                 |
| ツール一覧取得   | `src/lib/server/mcp/tools.ts`                     | MCP サーバーからツール定義を OpenAI function tools に変換 |
| ツール実行       | `src/lib/server/mcp/toolInvocation.ts`            | LLM の tool_calls を MCP プロトコル経由で実行             |
| 統合フロー       | `src/lib/server/textGeneration/mcp/runMcpFlow.ts` | MCP flow → tool calls → 再帰的 completion                 |
| クライアント管理 | `src/lib/stores/mcpServers.ts`                    | localStorage にカスタムサーバー/選択状態を保持            |
| ヘルスチェック   | `src/routes/api/mcp/health/+server.ts`            | MCP サーバー接続確認 + ツール一覧取得                     |

### 1.2 既存の検索統合

| サービス    | 環境変数         | MCP サーバー URL              | 実装状況                                 |
| ----------- | ---------------- | ----------------------------- | ---------------------------------------- |
| **Exa**     | `EXA_API_KEY`    | `https://mcp.exa.ai/mcp`      | ✅ 実装済み (URL パラメータ注入)         |
| **Tavily**  | `TAVILY_API_KEY` | `https://mcp.tavily.com/mcp/` | ✅ 実装済み (URL パラメータ注入)         |
| **Jina AI** | `JINA_API_KEY`   | `https://mcp.jina.ai/v1`      | ✅ 実装済み (Authorization ヘッダー注入) |

Exa の実装パターン:

```ts
// runMcpFlow.ts (抜粋)
if (isExaMcpServer(s.url)) {
	const url = new URL(s.url);
	url.searchParams.set("exaApiKey", config.EXA_API_KEY);
	return { ...s, url: url.toString() };
}
```

### 1.3 検索関連の UI 例

`src/lib/constants/mcpExamples.ts` に検索関連のプロンプト例が定義:

- "Latest world news"
- "Search the web to compare React, Vue, and Svelte"
- "Search for unique gift ideas"
- "Search for the best resources to learn Rust"

---

## 2. 利用可能な検索サービス

### 2.1 Tavily

| 項目                      | 詳細                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **リモート MCP サーバー** | `https://mcp.tavily.com/mcp/`                                                                                                         |
| **提供ツール**            | `tavily_search` (キーワード検索), `tavily_extract` (URL 内容抽出), `tavily_map` (サイト構造マッピング), `tavily_crawl` (Web クロール) |
| **API キー**              | `TAVILY_API_KEY` (✅ `.env.local` に設定済み)                                                                                         |
| **認証方式**              | URL パラメータ (`?tavilyApiKey=`) または `Authorization: Bearer` ヘッダー                                                             |
| **特徴**                  | 検索結果に要約付き、ソース URL 付与、日付フィルタ対応                                                                                 |
| **ホスティング**          | ❌ 不要 (クラウドリモートサーバー)                                                                                                    |
| **リポジトリ**            | [tavily-ai/tavily-mcp](https://github.com/tavily-ai/tavily-mcp)                                                                       |

### 2.2 Jina AI

| 項目                      | 詳細                                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **リモート MCP サーバー** | `https://mcp.jina.ai/v1`                                                                                                                                             |
| **提供ツール**            | 全 19 ツール (`search_web`, `read_url`, `search_arxiv`, `search_ssrn`, `search_images`, `parallel_*` 系, `sort_by_relevance`, `classify_text`, `deduplicate_*` など) |
| **API キー**              | `JINA_API_KEY` (✅ `.env.local` に設定済み)                                                                                                                          |
| **認証方式**              | `Authorization: Bearer` ヘッダー                                                                                                                                     |
| **特徴**                  | 高品質なコンテンツ抽出、ツールフィルタリング (URL クエリパラメータ)、学術検索特化                                                                                    |
| **ホスティング**          | ❌ 不要 (クラウドリモートサーバー)                                                                                                                                   |
| **リポジトリ**            | [jina-ai/MCP](https://github.com/jina-ai/MCP)                                                                                                                        |

#### Jina のツールフィルタリング

Jina は URL クエリパラメータで公開するツールを制御できる。フィルタはサーバー側で適用され、除外されたツールは MCP クライアントおよび LLM には一切表示されない。

| パラメータ      | 説明           | 例                                         |
| --------------- | -------------- | ------------------------------------------ |
| `exclude_tools` | ツール名で除外 | `exclude_tools=search_web,read_url`        |
| `include_tools` | ツール名で限定 | `include_tools=search_arxiv,search_images` |
| `exclude_tags`  | タグで除外     | `exclude_tags=read`                        |
| `include_tags`  | タグで限定     | `include_tags=search,utility`              |

| タグ       | 含むツール                                                                            |
| ---------- | ------------------------------------------------------------------------------------- |
| `search`   | search_web, search_arxiv, search_ssrn, search_images, search_jina_blog, search_bibtex |
| `parallel` | parallel_search_web, parallel_read_url, parallel_search_arxiv, parallel_search_ssrn   |
| `read`     | read_url, parallel_read_url, capture_screenshot_url                                   |
| `utility`  | primer, show_api_key, expand_query, guess_datetime_url, extract_pdf                   |
| `rerank`   | sort_by_relevance, deduplicate_strings, deduplicate_images                            |

### 2.3 サービス比較

| 比較項目          | Tavily             | Jina AI                              | Exa (既存) |
| ----------------- | ------------------ | ------------------------------------ | ---------- |
| 検索精度          | 高い (要約付き)    | 高い                                 | 高い       |
| コンテンツ抽出    | `tavily_extract`   | `read_url` (フィルタで除外予定)      | なし       |
| 学術検索          | なし               | `search_arxiv`, `search_ssrn`        | なし       |
| 画像検索          | なし               | `search_images`                      | なし       |
| 並列実行          | なし               | `parallel_*` 系 (フィルタで除外予定) | なし       |
| リモート MCP 対応 | ✅                 | ✅                                   | ✅         |
| 自ホスト必要      | ❌                 | ❌                                   | ❌         |
| 認証方式          | URL param / Header | Header                               | URL param  |

---

## 3. 推奨戦略

### 3.1 アーキテクチャ: MCP を通じた統合

既存の Exa パターンと同様に、MCP プロトコル経由で統合する。

```
ユーザー入力 → LLM (tool_choice: auto) → リモート MCP サーバー → 検索API → 結果返却 → LLM 回答
```

### 3.2 ツールフィルタリングによる役割分担

Jina のツールフィルタリング機能を活用し、**各サービスの役割を明確に分離**する。これにより:

1. **LLM のツール選択混乱を防ぐ** — 機能重複するツールが同時に公開されない
2. **コンテキストウィンドウの圧迫を軽減する** — 不要なツールのスキーマを送信しない
3. **API コストを制御する** — 意図しないツール呼び出しを抑制する

#### 役割分担の設計

| サービス    | 役割                                 | 有効ツール                                                                                                                                     | フィルタリング                                                                                  |
| ----------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Tavily**  | メイン検索 + コンテンツ抽出          | `tavily_search`, `tavily_extract`, `tavily_map`, `tavily_crawl`, `tavily_research`                                                             | なし (全ツール有効)                                                                             |
| **Jina AI** | 学術検索 + 画像検索 + ユーティリティ | `show_api_key`, `primer`, `guess_datetime_url`, `expand_query`, `search_arxiv`, `search_ssrn`, `search_images`, `search_bibtex`, `extract_pdf` | `exclude_tags=read,parallel,rerank` + `exclude_tools=search_web,search_jina_blog,classify_text` |
| **Exa**     | 補完検索                             | (既存のツール)                                                                                                                                 | なし                                                                                            |

#### Jina のフィルタリング URL

```
https://mcp.jina.ai/v1?exclude_tags=read,parallel,rerank&exclude_tools=search_web,search_jina_blog,classify_text
```

適用後の Jina 有効ツール (E2E テスト済み):

| ツール               | 用途                    | API キー必須 |
| -------------------- | ----------------------- | ------------ |
| `show_api_key`       | API キー表示            | ❌           |
| `primer`             | 時刻・文脈情報取得      | ❌           |
| `guess_datetime_url` | ページの最終更新日判別  | ❌           |
| `expand_query`       | クエリ拡張・書き換え    | ✅           |
| `search_arxiv`       | 学術論文検索 (arXiv)    | ✅           |
| `search_ssrn`        | 社会科学論文検索 (SSRN) | ✅           |
| `search_images`      | 画像検索                | ✅           |
| `search_bibtex`      | BibTeX 引用検索         | ❌           |
| `extract_pdf`        | PDF からの図表数式抽出  | ✅           |

除外されたツールと理由:

| 除外ツール                                                | 理由                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `search_web`                                              | Tavily の `tavily_search` と重複                                                     |
| `read_url`, `parallel_read_url`, `capture_screenshot_url` | Tavily の `tavily_extract` と重複 (`exclude_tags=read`)                              |
| `parallel_search_*`                                       | チャット用途では並列検索の需要が低い (`exclude_tags=parallel`)                       |
| `sort_by_relevance`, `deduplicate_*`                      | チャット用途で直接的な需要が低い (`exclude_tags=rerank`)                             |
| `search_jina_blog`                                        | Jina 自社ブログ検索はチャット用途不要                                                |
| `classify_text`, `show_api_key`                           | チャット用途不要 (`classify_text` は `rerank` タグに含まれていないが `utility` タグ) |

> **注:** `classify_text` は `utility` タグに含まれるため、`exclude_tools` に明示的に追加している。

### 3.3 実装ステップ (Phased Approach)

#### Phase 1: Tavily のみ (Exa と同じパターン → 最小変更)

**Step 1: `config.ts` に `TAVILY_API_KEY` を追加**

```ts
// src/lib/server/config.ts
type ExtraConfigKeys =
	| "HF_TOKEN"
	| "OLD_MODELS"
	| "ENABLE_ASSISTANTS"
	| "METRICS_ENABLED"
	| "METRICS_PORT"
	| "MCP_SERVERS"
	| "MCP_FORWARD_HF_USER_TOKEN"
	| "MCP_TOOL_TIMEOUT_MS"
	| "EXA_API_KEY"
	| "TAVILY_API_KEY" // ← 追加
	| "JINA_API_KEY"; // ← Phase 2 で使用
```

**Step 2: `hf.ts` に判定ヘルパーを追加**

```ts
// src/lib/server/mcp/hf.ts

export const isTavilyMcpServer = (urlString: string): boolean => {
	try {
		const u = new URL(urlString);
		return u.protocol === "https:" && u.hostname.toLowerCase() === "mcp.tavily.com";
	} catch {
		return false;
	}
};

export const isJinaMcpServer = (urlString: string): boolean => {
	try {
		const u = new URL(urlString);
		return u.protocol === "https:" && u.hostname.toLowerCase() === "mcp.jina.ai";
	} catch {
		return false;
	}
};
```

**Step 3: `runMcpFlow.ts` に Tavily の API キー注入を追加**

Exa の注入ブロックの直後に追加 (URL パラメータ注入 = Exa と同じパターン)。

```ts
// --- Tavily API key injection (URL param, same pattern as Exa) ---
try {
	const tavilyApiKey = config.TAVILY_API_KEY;
	if (hasNonEmptyToken(tavilyApiKey)) {
		const overlayApplied: string[] = [];
		servers = servers.map((s) => {
			try {
				if (isTavilyMcpServer(s.url)) {
					const url = new URL(s.url);
					if (!url.searchParams.has("tavilyApiKey")) {
						url.searchParams.set("tavilyApiKey", tavilyApiKey);
						overlayApplied.push(s.name);
						return { ...s, url: url.toString() };
					}
				}
			} catch {}
			return s;
		});
		if (overlayApplied.length > 0) {
			logger.debug({ overlayApplied }, "[mcp] injected Tavily API key to servers");
		}
	}
} catch {
	// best-effort injection
}
```

**Step 4: `health/+server.ts` に Tavily の注入を追加**

Exa の注入ブロックの直後に追加。

```ts
// Tavily: URL param injection (same as Exa)
try {
	const tavilyApiKey = config.TAVILY_API_KEY;
	if (isTavilyMcpServer(url) && hasNonEmptyToken(tavilyApiKey)) {
		const urlObj = new URL(url);
		if (!urlObj.searchParams.has("tavilyApiKey")) {
			urlObj.searchParams.set("tavilyApiKey", tavilyApiKey);
			finalUrl = urlObj.toString();
			logger.debug({}, "[MCP Health] injected Tavily API key");
		}
	}
} catch {}
```

**Step 5: `.env` にドキュメントを追加**

既存の `EXA_API_KEY` の直後に追加 (同じセクション内に配置)。

```env
# Exa API key (injected at runtime into mcp.exa.ai URLs as ?exaApiKey=)
EXA_API_KEY=
# Tavily MCP server API key (injected as ?tavilyApiKey= to mcp.tavily.com URLs)
TAVILY_API_KEY=
```

**Step 6: `MCP_SERVERS` に Tavily を追加**

```env
MCP_SERVERS=[
  {"name": "Tavily Search", "url": "https://mcp.tavily.com/mcp/"},
  {"name": "Web Search (Exa)", "url": "https://mcp.exa.ai/mcp"}
]
```

**Step 7: テスト**

- `/api/mcp/health` POST で接続確認
- ツール一覧に `tavily_search`, `tavily_extract` 等が表示されるか確認
- 実際の検索クエリで end-to-end 動作確認

#### Phase 2: Jina AI を追加 (ヘッダー注入 + ツールフィルタリング)

**Step 8: `runMcpFlow.ts` に Jina の API キー注入を追加**

Tavily の注入ブロックの直後に追加 (ヘッダー注入 = 新規パターン)。

```ts
// --- Jina API key injection (Authorization header) ---
try {
	const jinaApiKey = config.JINA_API_KEY;
	if (hasNonEmptyToken(jinaApiKey)) {
		const overlayApplied: string[] = [];
		servers = servers.map((s) => {
			try {
				if (isJinaMcpServer(s.url) && !hasAuthHeader(s.headers)) {
					overlayApplied.push(s.name);
					return {
						...s,
						headers: {
							...(s.headers ?? {}),
							Authorization: `Bearer ${jinaApiKey}`,
						},
					};
				}
			} catch {}
			return s;
		});
		if (overlayApplied.length > 0) {
			logger.debug({ overlayApplied }, "[mcp] injected Jina API key to servers");
		}
	}
} catch {
	// best-effort injection
}
```

**Step 9: `health/+server.ts` に Jina の注入を追加**

HF トークン転送ブロックの直前に追加。

```ts
// Jina: Authorization header injection
try {
	const jinaApiKey = config.JINA_API_KEY;
	if (isJinaMcpServer(url) && hasNonEmptyToken(jinaApiKey) && !headersRecord["Authorization"]) {
		headersRecord["Authorization"] = `Bearer ${jinaApiKey}`;
		logger.debug({}, "[MCP Health] injected Jina API key");
	}
} catch {}
```

**Step 10: `.env` に Jina のドキュメントを追加**

```env
# Tavily MCP server API key (injected as ?tavilyApiKey= to mcp.tavily.com URLs)
TAVILY_API_KEY=
# Jina AI MCP server API key (injected as Authorization header to mcp.jina.ai)
JINA_API_KEY=
```

**Step 11: `MCP_SERVERS` に Jina を追加 (ツールフィルタリング適用)**

```env
MCP_SERVERS=[
  {"name": "Tavily Search", "url": "https://mcp.tavily.com/mcp/"},
  {"name": "Jina AI", "url": "https://mcp.jina.ai/v1?exclude_tags=read,parallel,rerank&exclude_tools=search_web,search_jina_blog,classify_text"},
  {"name": "Web Search (Exa)", "url": "https://mcp.exa.ai/mcp"}
]
```

**Step 12: テスト**

- `/api/mcp/health` POST で接続確認
- ツール一覧にフィルタリング後のツールのみが表示されるか確認
- 学術検索 (`search_arxiv`)、画像検索 (`search_images`) の end-to-end テスト
- Tavily と Jina のツールが競合しないか確認

---

## 4. 検索トリガーの戦略

### 4.1 LLM 自動判断 (現行方式)

`runMcpFlow.ts` の `tool_choice: "auto"` + `toolPrompt.ts` のシステムプロンプトで制御:

> "Do NOT call a tool unless the user's request requires capabilities you lack (e.g., real-time data, image generation, code execution) or external information you do not have."

`toolPrompt.ts` の SEARCH ガイドライン:

- 3-6 語のキーワードで検索
- 歴史的事件には年を指定
- 最新トピックには当年の年を指定
- 日付範囲パラメータがある場合は今日の日付を end date に

### 4.2 改善候補

| 改善                       | 説明                                                                                                   | 優先度                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| **ツール選択ガイドライン** | 検索には Tavily、学術には Jina の `search_arxiv` など、用途別のツール選択指針を `toolPrompt.ts` に追加 | 中                                            |
| **複数検索**               | 複雑な質問を分解し、複数の検索クエリを並列実行                                                         | 低 (フィルタリングで `parallel_*` は除外済み) |
| **結果要約**               | 検索結果を LLM で要約し、出典付きで回答生成                                                            | 低 (MCP ツールで対応可能)                     |
| **キャッシュ**             | 同じクエリの検索結果を短時間キャッシュ                                                                 | 低                                            |
| **API コスト管理**         | 1 トーンあたりの最大ツール呼び出し数に制限を設ける                                                     | 低                                            |

---

## 5. 代替案検討

### 5.1 MCP 不使用: 直接 API 呼び出し

MCP サーバーを経由せず、Chat UI 側から直接 Tavily/Jina API を呼ぶ。

**メリット:**

- 追加のインフラ不要
- 遅延が少ない

**デメリット:**

- 既存の MCP フローと整合性が取れない
- ツール定義の管理が分散する
- 将来的なツール追加時に拡張性がない

**結論:** ❌ 推奨しない。既存の MCP アーキテクチャに合わせる。

### 5.2 フィルタリングなしで Jina 全ツール有効

Jina の 19 ツールをすべて公開する。

**メリット:**

- 最大限の機能利用
- URL 設定が単純

**デメリット:**

- `search_web` vs `tavily_search`、`read_url` vs `tavily_extract` で LLM の選択が不安定
- 19 ツールのスキーマがコンテキストウィンドウを圧迫
- 不要なツール呼び出しで API コストが増加

**結論:** ❌ 推奨しない。ツールフィルタリングで役割を明確にする。

---

## 6. To-Do

### Phase 1 (Tavily)

- [x] `config.ts` に `TAVILY_API_KEY` を追加
- [x] `hf.ts` に `isTavilyMcpServer()` を追加
- [x] `runMcpFlow.ts` に Tavily の API キー注入を追加 (URL param)
- [x] `health/+server.ts` に Tavily の注入を追加
- [x] `.env` に `TAVILY_API_KEY` のドキュメントを追加 (EXA_API_KEY 直後)
- [x] `MCP_SERVERS` に Tavily を追加
- [x] E2E テスト (Tavily 検索クエリ → 結果表示)

### Phase 2 (Jina AI)

- [x] `hf.ts` に `isJinaMcpServer()` を追加
- [x] `runMcpFlow.ts` に Jina の API キー注入を追加 (Header)
- [x] `health/+server.ts` に Jina の注入を追加
- [x] `.env` に `JINA_API_KEY` のドキュメントを追加
- [x] `MCP_SERVERS` に Jina を追加 (ツールフィルタリング URL)
- [x] フィルタリング後のツール一覧確認
- [x] E2E テスト (学術検索、画像検索)

### 実装済みコミット

| Phase   | コミット SHA | 内容                                                             |
| ------- | ------------ | ---------------------------------------------------------------- |
| Phase 1 | `1e456ee6`   | Tavily 統合 (URL パラメータ注入)                                 |
| Phase 2 | `e1d7ca47`   | Jina AI 統合 (Authorization ヘッダー注入 + ツールフィルタリング) |

---

## 7. 参考リンク

- [Tavily MCP Server](https://github.com/tavily-ai/tavily-mcp) — リモート: `https://mcp.tavily.com/mcp/`
- [Jina AI MCP Server](https://github.com/jina-ai/MCP) — リモート: `https://mcp.jina.ai/v1` (ツールフィルタリング対応)
- [Exa MCP Server](https://mcp.exa.ai) — リモート: `https://mcp.exa.ai/mcp`
- [MCP Protocol Spec](https://modelcontextprotocol.io)
- 本リポジトリの MCP 実装: `src/lib/server/mcp/`
