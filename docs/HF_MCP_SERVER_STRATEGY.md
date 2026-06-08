# Hugging Face Hub MCP Server 統合戦略

> 作成日: 2026-06-08
> 状態: 📋 プラン段階

---

## 1. 概要

Hugging Face Hub MCP Server (`https://hf.co/mcp?login`) を本アプリの MCP サーバーリストに追加する。既存の検索ツール（Exa / Tavily / Jina）と同様、MCP プロトコル経由で統合する。

### HF MCP Server が提供するツール

| カテゴリ            | ツール名                      | 説明                                                   |
| ------------------- | ----------------------------- | ------------------------------------------------------ |
| **Spaces**          | Spaces Semantic Search        | 自然言語で Spaces 検索                                 |
|                     | Dynamic Spaces                | MCP Spaces の動的呼び出し                              |
| **Papers**          | Papers Semantic Search        | ML 研究論文の検索                                      |
| **Repository**      | Repository Search             | モデル・データセット・Spaces のフィルタ検索            |
| **Documentation**   | Documentation Semantic Search | HF ドキュメントの検索                                  |
| **Jobs**            | Run and Manage Jobs           | HF 上のジョブ実行・監視・スケジュール                  |
| **Hub**             | Hub Query (Experimental)      | 自然言語でリポジトリ・ソーシャルグラフなどを探索       |
|                     | Hub Repository Details        | モデル・データセット・Spaces の詳細情報                |
| **File Management** | File Management               | リポジトリ・バケットへのファイルアップロード・書き込み |

---

## 2. 既存のインフラとの関係

### 2.1 既に実装済みの部分

HF MCP サーバーの統合には**専用の API キー不要**であり、ログインユーザーの HF アクセストークンをそのまま使用する。この仕組みは既に実装済み:

| 要素                           | 実装場所                                            | 状態        |
| ------------------------------ | --------------------------------------------------- | ----------- |
| URL 判定ヘルパー               | `src/lib/server/mcp/hf.ts` → `isStrictHfMcpLogin()` | ✅ 実装済み |
| トークン転送ロジック           | `runMcpFlow.ts` (L181-205)                          | ✅ 実装済み |
| ヘルスチェックでのトークン転送 | `health/+server.ts` (L113-123)                      | ✅ 実装済み |
| 環境変数                       | `MCP_FORWARD_HF_USER_TOKEN`                         | ✅ 定義済み |
| OIDC スコープ                  | `read-mcp` (`.env` の `OPENID_SCOPES`)              | ✅ 定義済み |

### 2.2 検索ツールとの違い

| 比較項目           | Exa / Tavily / Jina              | HF Hub MCP                                      |
| ------------------ | -------------------------------- | ----------------------------------------------- |
| 認証方式           | 各サービスの API キー (env 変数) | HF アクセストークン (2 パターン)                |
| キー注入           | URL param / Authorization header | Authorization header                            |
| トークンソース (A) | `config.EXA_API_KEY` 等          | `locals.token` (OIDC ログインユーザー)          |
| トークンソース (B) | —                                | `config.HF_MCP_TOKEN` (自己ホスティング)        |
| 有効化条件 (A)     | API キーが設定されていること     | `MCP_FORWARD_HF_USER_TOKEN=true` + ログイン済み |
| 有効化条件 (B)     | —                                | `HF_MCP_TOKEN` が設定されていること             |

---

## 3. 実装計画

### Phase 1: 環境設定 + ドキュメント

**Step 1: `.env` に HF MCP サーバーを追加**

既存の `MCP_SERVERS` のコメント例に HF MCP サーバーを含める。`?login` クエリパラマータは必須（トークン転送のトリガー）。

```env
# Base servers list (JSON array). Example:
MCP_SERVERS=[
  {"name": "Hugging Face Hub", "url": "https://hf.co/mcp?login"},
  {"name": "Web Search (Exa)", "url": "https://mcp.exa.ai/mcp"}
]
# When true, forward the logged-in user's Hugging Face access token
# to https://hf.co/mcp?login servers (required for HF Hub MCP tools)
MCP_FORWARD_HF_USER_TOKEN=
```

**Step 2: `.env` の `MCP_FORWARD_HF_USER_TOKEN` コメントを改善**

既存のコメントをより明確にする:

```env
# When true, forward the logged-in user's Hugging Face access token
# to HF MCP servers (https://hf.co/mcp?login). Required for HF Hub MCP tools
# (Spaces search, Papers search, Repository search, etc.)
MCP_FORWARD_HF_USER_TOKEN=
```

### Phase 2: URL ヘルパーの拡張 (オプション)

`isStrictHfMcpLogin()` は既に `https://hf.co/mcp?login` および `https://huggingface.co/mcp?login` を判定できるが、`?login` がない場合のフォールバック判定も検討する。

**現状:** `isStrictHfMcpLogin()` は `u.search === "?login"` を要求する。
**問題点:** ユーザーが `?login` を忘れた場合、トークン転送がスキップされる。
**検討事項:** `?login` なしでも `hf.co/mcp` へのリクエストにはトークンを転送するかどうか。

→ **結論:** 現状維持。`?login` は明示的なオプトインであり、意図しないトークン転送を防ぐ。

### Phase 3: UI 例の追加

**Step 3: `mcpExamples.ts` に HF Hub 関連の例を追加**

既存の "Trending models" と "Find a dataset" は既に HF Hub MCP を想定しているが、より明示的な例を追加する:

```ts
{
  title: "Search ML papers",
  prompt: "Search for recent papers on diffusion models for image generation",
},
{
  title: "Browse Spaces",
  prompt: "Find Hugging Face Spaces that demonstrate real-time translation",
},
{
  title: "Repository details",
  prompt: "Get details about the meta-llama/Llama-3.1-8B model repository",
},
```

### Phase 4: ツールプロンプトの改善 (オプション)

`toolPrompt.ts` に HF Hub MCP ツール向けのガイドラインを追加する:

- Spaces 検索 → "Spaces Semantic Search"
- 論文検索 → "Papers Semantic Search"
- モデル/データセット検索 → "Repository Search"
- ドキュメント検索 → "Documentation Semantic Search"

---

## 4. 設定例

### パターン A: OIDC ログインあり (HuggingChat 向け)

ログインユーザーの HF トークンを自動転送する。

```env
MCP_SERVERS=[{"name": "Hugging Face Hub", "url": "https://hf.co/mcp?login"}]
MCP_FORWARD_HF_USER_TOKEN=true
```

### パターン B: 自己ホスティング (OIDC なし)

`HF_MCP_TOKEN` に HF アクセストークンを直接設定する。`?login` は不要。

```env
MCP_SERVERS=[{"name": "Hugging Face Hub", "url": "https://hf.co/mcp"}]
HF_MCP_TOKEN=hf_***
```

### 検索ツール + HF Hub MCP の組み合わせ

```env
MCP_SERVERS=[
  {"name": "Hugging Face Hub", "url": "https://hf.co/mcp?login"},
  {"name": "Tavily Search", "url": "https://mcp.tavily.com/mcp/"},
  {"name": "Jina AI", "url": "https://mcp.jina.ai/v1?exclude_tags=read,parallel,rerank&exclude_tools=search_web,search_jina_blog,classify_text"}
]
MCP_FORWARD_HF_USER_TOKEN=true
TAVILY_API_KEY=
JINA_API_KEY=
```

---

## 5. 動作フロー

```
ユーザー (HF アカウントでログイン済み)
  → LLM (tool_choice: auto)
    → HF MCP Server (https://hf.co/mcp?login)
      [Authorization: Bearer {ユーザーのHFトークン}]
      → HF Hub API
      ← 結果返却
    ← LLM が回答を生成
```

### トークン転送の条件

**パターン A (OIDC ログイン):**

1. `MCP_FORWARD_HF_USER_TOKEN=true` であること
2. ユーザーがログイン済み (`locals.token` または `locals.hfAccessToken` が存在)
3. サーバー URL が `https://hf.co/mcp?login` または `https://huggingface.co/mcp?login`
4. サーバーに明示的な `Authorization` ヘッダーが未設定

**パターン B (自己ホスティング):**

1. `HF_MCP_TOKEN` が設定されていること
2. サーバー URL が `https://hf.co/mcp` または `https://huggingface.co/mcp` (`?login` 不要)
3. サーバーに明示的な `Authorization` ヘッダーが未設定

---

## 6. To-Do

### Phase 1 (環境設定)

- [x] `.env` の `MCP_SERVERS` コメント例に HF MCP サーバーを追加
- [x] `.env` の `MCP_FORWARD_HF_USER_TOKEN` コメントを改善

### Phase 2 (URL ヘルパー — 現状維持)

- [x] `isStrictHfMcpLogin()` の動作確認 (追加変更不要)

### Phase 3 (UI 例)

- [x] `mcpExamples.ts` に HF Hub 関連のプロンプト例を追加

### Phase 4 (ツールプロンプト)

- [x] `toolPrompt.ts` に HF Hub MCP 向けのツール選択ガイドラインを追加

### 実装済みコミット

| Phase   | ファイル                                            | 内容                                                                     |
| ------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| Phase 1 | `.env`                                              | `MCP_SERVERS` 例 + `MCP_FORWARD_HF_USER_TOKEN` / `HF_MCP_TOKEN` コメント |
| Phase 2 | `src/lib/server/mcp/hf.ts`                          | `isHfMcpServer()` を追加 (`?login` 不要の広域判定)                       |
| Phase 2 | `src/lib/server/config.ts`                          | `HF_MCP_TOKEN` を `ExtraConfigKeys` に追加                               |
| Phase 2 | `src/lib/server/textGeneration/mcp/runMcpFlow.ts`   | `HF_MCP_TOKEN` の Authorization ヘッダー注入を追加                       |
| Phase 2 | `src/routes/api/mcp/health/+server.ts`              | `HF_MCP_TOKEN` の Authorization ヘッダー注入を追加                       |
| Phase 3 | `src/lib/constants/mcpExamples.ts`                  | 論文検索・Spaces 検索・リポジトリ詳細・ドキュメント検索の例追加          |
| Phase 4 | `src/lib/server/textGeneration/utils/toolPrompt.ts` | `HF HUB` / `WEB SEARCH` / `PRIORITY` ガイドライン追加                    |

---

## 7. 手動 E2E テスト手順

### 前提条件

1. HF アクセストークンが `read-mcp` スコープを含むこと
   - https://huggingface.co/settings/tokens で確認・作成
2. `OPENAI_BASE_URL` に tools 対応モデルが利用可能

### Step 1: 環境変数の設定

**自己ホスティング (OIDC なし) の場合:**

`.env.local` に以下を設定:

```env
MCP_SERVERS=[{"name": "Hugging Face Hub", "url": "https://hf.co/mcp"}]
HF_MCP_TOKEN=hf_***
```

**OIDC ログインあり (HuggingChat) の場合:**

```env
MCP_SERVERS=[{"name": "Hugging Face Hub", "url": "https://hf.co/mcp?login"}]
MCP_FORWARD_HF_USER_TOKEN=true
```

検索ツールを併用する場合:

```env
MCP_SERVERS=[
  {"name": "Hugging Face Hub", "url": "https://hf.co/mcp"},
  {"name": "Tavily Search", "url": "https://mcp.tavily.com/mcp/"}
]
HF_MCP_TOKEN=hf_***
TAVILY_API_KEY=sk-xxx
```

### Step 2: 開発サーバー起動

```bash
npm run dev
```

### Step 3: ヘルスチェック (API 直接テスト)

ブラウザで `http://localhost:5173/api/mcp/health` に POST:

```bash
curl -X POST http://localhost:5173/api/mcp/health \
  -H "Content-Type: application/json" \
  -d '{"url": "https://hf.co/mcp?login"}'
```

**期待される結果:**

- `ready: true` が返ること
- `tools` 配列に HF Hub ツール一覧が含まれること
  - `spaces_semantic_search` (または類似名)
  - `papers_semantic_search`
  - `repository_search`
  - `documentation_semantic_search`
  - `hub_repository_details`
  - など

**失敗する場合:**

- `authRequired: true` → `MCP_FORWARD_HF_USER_TOKEN=true` が設定されていない、またはログインしていない
- `error` が返る → URL が `https://hf.co/mcp?login` か確認 (`?login` が必須)

### Step 4: UI での確認

1. `http://localhost:5173` にアクセス
2. HF アカウントでログイン
3. チャット画面で MCP サーバー設定を確認
   - 「Hugging Face Hub」サーバーがリストに表示される
   - ステータスが "connected" になる
4. ツール一覧に HF Hub のツールが表示される

### Step 5: 各ツールの動作テスト

| テストケース         | プロンプト                                                  | 期待される動作                                                 |
| -------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| **Spaces 検索**      | "Find Hugging Face Spaces for real-time translation"        | Spaces Semantic Search が呼び出され、関連 Spaces が返る        |
| **論文検索**         | "Search for recent papers on diffusion models"              | Papers Semantic Search が呼び出され、論文リストが返る          |
| **リポジトリ検索**   | "Find sentiment analysis datasets on Hugging Face"          | Repository Search が呼び出され、データセットが返る             |
| **リポジトリ詳細**   | "Get details about meta-llama/Llama-3.1-8B"                 | Hub Repository Details が呼び出され、リポジトリ詳細が返る      |
| **ドキュメント検索** | "How to deploy a model with Inference Endpoints?"           | Documentation Semantic Search が呼び出され、ドキュメントが返る |
| **Hub Query**        | "Who are the top contributors to the transformers library?" | Hub Query が呼び出され、ソーシャルグラフ情報が返る             |

### Step 6: HF Hub vs Web Search の優先度テスト

| プロンプト                               | 期待されるツール選択       | 理由            |
| ---------------------------------------- | -------------------------- | --------------- |
| "Find the Llama 3 model on Hugging Face" | Repository Search (HF Hub) | HF 固有のクエリ |
| "What is the latest news about AI?"      | Web search (Tavily/Jina)   | 一般ニュース    |
| "Compare Llama 3 and Mistral models"     | Repository Search (HF Hub) | HF モデル比較   |
| "Search for Rust programming tutorials"  | Web search (Tavily/Jina)   | 一般検索        |

### Step 7: 複数サーバー併用テスト

`MCP_SERVERS` に HF Hub + Tavily/Jina を設定し、以下のテスト:

1. HF 関連クエリ → HF Hub ツールが選択される
2. 一般検索クエリ → Web search ツールが選択される
3. 両方のツールが同時に見える状態でも、LLM が適切に選択する

### トラブルシューティング

| 症状                      | 原因                          | 解決策                                                                |
| ------------------------- | ----------------------------- | --------------------------------------------------------------------- |
| `authRequired: true`      | トークン転送が効いていない    | `HF_MCP_TOKEN` または `MCP_FORWARD_HF_USER_TOKEN=true` + ログイン確認 |
| ツール一覧が空            | 接続エラー                    | URL が `https://hf.co/mcp` か確認                                     |
| 401 Unauthorized          | HF トークンのスコープ不足     | `read-mcp` スコープを含むトークンに更新                               |
| MCP flow がスキップされる | モデルが tools 非対応         | `supportsTools: true` のモデルを使用                                  |
| 403 Forbidden             | トークンに MCP 利用権限がない | HF の MCP 設定ページで有効化                                          |

## 8. 参考

- [Hugging Face Hub MCP Server](https://huggingface.co/settings/mcp) — 設定ページ
- [MCP Protocol Spec](https://modelcontextprotocol.io)
- 本リポジトリの MCP 実装: `src/lib/server/mcp/`
- 検索ツール統合戦略: `docs/SEARCH_TOOL_STRATEGY.md`
