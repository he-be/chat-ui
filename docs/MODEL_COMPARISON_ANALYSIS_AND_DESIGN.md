# HF モデル比較タスク: 誤答構造分析と機能設計

> 作成日: 2026-06-08
> 状態: 📋 設計段階

---

## 1. タスクの再定義

### 1.1 ユーザーの依頼

```
https://huggingface.co/nex-agi/Nex-N2-mini
https://huggingface.co/Qwen/Qwen3.6-35B-A3B
https://huggingface.co/Qwen/Qwen3.5-35B-A3B-Base

この3つを定量比較して。
Nex-N2は3.5-35b がベースで４日前にリリース、
3.6-35bが驚異的なエージェント性能で話題の中心になり続けている、という背景
```

### 1.2 期待される出力

単なるスコア並べ替えではなく:

- 各数値の**出所と信頼性**の判定（自己申告か独立ハネスか）
- モデルカードの比較表で**意図的に省略されている対戦相手**の特定
- モデル間の**出自関係**（アーキテクチャ、pretrain → post-train）の検証
- 「何を比較していないか」の明示
- ハネスバージョンの不一致（例: Terminal-Bench 2.0 vs 2.1）の指摘
- ベンチマークカバレッジの差（片方のカードにしかないベンチの存在）

---

## 2. 誤答（Gemma-4）の構造分析

### 2.1 数値は正しい（捏造は起きていない）

Gemma-4 の回答に記載の数値をモデルカードと逐一検証した結果、**すべて一致**。

| ベンチマーク       | Gemma-4 の値                         | モデルカード実値                     | 判定 |
| ------------------ | ------------------------------------ | ------------------------------------ | ---- |
| SWE-bench Verified | 70.0 / 73.4 / 74.4                   | 70.0 / 73.4 / 74.4                   | ✅   |
| SWE-bench Pro      | 44.6 / 49.5 / 50.2                   | 44.6 / 49.5 / 50.2                   | ✅   |
| Terminal-Bench     | 40.5(v2.0) / 51.5(v2.0) / 60.7(v2.1) | 40.5(v2.0) / 51.5(v2.0) / 60.7(v2.1) | ✅   |
| WideSearch         | 59.1 / 60.1 / 62.0                   | 59.1 / 60.1 / 62.0                   | ✅   |
| GPQA               | 84.2 / 86.0 / 82.6                   | 84.2 / 86.0 / 82.6                   | ✅   |
| MMLU-Pro           | 85.3 / 85.2 / -                      | 85.3 / 85.2 / 記載なし               | ✅   |
| AIME 26            | 91.0 / 92.7 / -                      | 91.0 / 92.7 / 記載なし               | ✅   |

**データは MCP ツール経由で正しく取得されている。** 問題は「データをどう解釈・分析するか」の段階にある。

### 2.2 根本問題: メタ分析の欠如

Gemma-4 は「数字を並べて大小を比較する」ことだけを行い、**データそのものを分析するメタ認知**を一切行っていない。

#### 問題 A: ハネスバージョンの不一致を「差」として報告

```
Terminal-Bench:
  Qwen3.5 / Qwen3.6 → v2.0
  Nex-N2-mini       → v2.1

Gemma-4 の結論: 「Nex-N2の圧勝ですわね」（60.7 vs 51.5 = 9点差）
実際の状況: v2.0 → v2.1 でハネス自体が変更されている。
            9点差の大部分はバージョン差の影響であり、モデルの実力差ではない可能性が高い。
            → 「同じベンチではない」と指摘すべき。
```

#### 問題 B: ベンチマークカバレッジの非対称性を無視

```
Nex-N2-mini のカードに記載のベンチ: 15 項目
  BrowseComp, GDPval, Toolathlon, WildClawBench, WideSearch, TAU3,
  SWE-Bench Pro, Terminal-Bench 2.1, DeepSWE, SWE-Bench Verified,
  SWE Atlas QnA/RF/TW, GPQA Diamond, IFEval, Apex

Qwen3.6-35B-A3B のカードに記載のベンチ: 28 項目
  （上記の共通分 + Claw-Eval, SkillsBench, QwenClawBench, NL2Repo,
   QwenWebBench, VITA-Bench, DeepPlanning, Tool Decathlon, MCPMark,
   MCP-Atlas, MMLU-Pro, MMLU-Redux, SuperGPQA, C-Eval, HLE,
   LiveCodeBench v6, HMMT 4回分, IMOAnswerBench, AIME26）

Gemma-4 の問題: 共通するベンチだけを選んで比較し、
               Qwen3.6 固有の 13 項目以上を一切無視。
               → 「Nex-N2 はこれらのベンチを報告していない」と明記すべき。
```

#### 問題 C: 比較表の cherry-picking を検出しない

Nex-N2-mini のモデルカードの比較表の対戦相手:

```
GPT-5.5, Opus 4.7, Kimi-K2.6, GLM-5.1, MiniMax M3, DeepSeek-V4-Pro
```

**含まれていない:**

- ❌ Qwen3.6-35B-A3B（同じ 35B-A3B クラスの唯一の正面競合）
- ❌ Qwen3.5-35B-A3B（自身の素体の instruct 版）

Gemma-4 はこの cherry-picking を一切指摘していない。

#### 問題 D: 「記載なし」を「劣勢」として結論づけている

```
Gemma-4: 「GPQA / MMLU-Pro (一般知識・推論) → Qwen3.6が知の頂点ですわ」

実際の状況:
  GPQA:     Qwen3.6 (86.0) > Nex-N2 (82.6) → 両方記載あり、比較可能 ✅
  MMLU-Pro: Qwen3.6 (85.2) > Nex-N2 (記載なし) → 比較不能 ❌
  AIME 26:  Qwen3.6 (92.7) > Nex-N2 (記載なし) → 比較不能 ❌

「記載なし」は「弱い」ではなく「計測していない（または公表していない）」。
これを「Qwen3.6が知の頂点」と結論づけるのは誤った推論。
```

### 2.3 誤答の発生メカニズム（システムレベル）

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐     ┌────────────┐
│ ユーザー入力 │────▶│ MCP ツール実行    │────▶│ LLM (Gemma-4)│────▶│ 回答生成   │
│             │     │                  │     │              │     │            │
│ 3つのURL    │     │ HF Hub Query     │     │ 数字を受け   │     │ 数字を     │
│ + 背景情報  │     │ Repository       │     │ 入れ         │     │ 並べて     │
│             │     │ Details          │     │              │     │ 大小比較   │
│             │     │                  │     │              │     │            │
│             │     │ 結果: 数字の羅列  │     │ 以下の       │     │ 「圧勝」   │
│             │     │ + README（一部）  │     │ メタ分析を   │     │ 「頂点」   │
│             │     │                  │     │ 跳过         │     │ 「完勝」   │
└─────────────┘     └──────────────────┘     └──────────────┘     └────────────┘
                                              ↑
                                    ここに以下のステップがない:
                                    1. 「この数字はどのハネスバージョンか」
                                    2. 「片方のカードしかないベンチは何か」
                                    3. 「比較表から誰が除外されているか」
                                    4. 「記載なし ≠ 劣勢」
```

**根本原因は新しいツールが必要だからではない。LLM に「何を分析すべきか」を指示していないから。**

---

## 3. 正答（Claude）の構造分析

### 3.1 正答がやったこと

```
Step 1: 出自検証
  └─ モデルカードのアーキテクチャタグ (qwen3_5_moe) → Qwen 系と確認
  └─ Transformers コードが Qwen ボイラープレートのコピー → 検証
  └─ 結論: 「アーキテクチャには指一本触れていない」

Step 2: 定量比較（共通ベンチのみ）
  └─ 「ハーネスは別物なので注意」と明記
  └─ SWE-Bench Verified / Pro / GPQA の3つに限定

Step 3: Cherry-picking 検出
  └─ 比較表の対戦相手を列挙 → Qwen3.6 が含まれていないことを指摘
  └─ 「統制された比較を最も意味のある相手に対してだけ意図的に避けている」

Step 4: 採用状況
  └─ DL 数、いいね、finetune 数 → 客観的比較
  └─ 「4日前リリースだから採用数で殴るのはフェアじゃない」と自己制限

Step 5: 結論
  └─ 証拠を並べてから評価。不確実性を表現。
```

### 3.2 Claude が Gemma-4 と違う点

| 分析ステップ             | Gemma-4                                                      | Claude                               |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------ |
| ハネスバージョンの注記   | していない                                                   | 「ハーネスは別物なので注意」         |
| 共通ベンチに限定         | していない（MMLU-Pro/AIME の記載なしを比較対象に含めている） | している（共通3つのみ）              |
| Cherry-picking 検出      | していない                                                   | している（核心）                     |
| 「記載なし」の扱い       | 「劣勢」として結論                                           | 言及していない（共通ベンチのみ比較） |
| 出自のアーキテクチャ検証 | していない                                                   | している                             |
| 採用状況の考慮           | していない                                                   | している（新しさを考慮）             |
| 不確実性の表現           | していない（「圧勝」「頂点」「完勝」）                       | している                             |

---

## 4. 現状 chat-ui のギャップ分析

### 4.1 ツール面: データ取得は十分

| 情報                                                     | 取得手段                               | 状態 |
| -------------------------------------------------------- | -------------------------------------- | ---- |
| モデルメタデータ（tags, architecture, likes, downloads） | `Hub Repository Details`               | ✅   |
| モデルカード README（ベンチマーク表含む）                | `Hub Repository Details` / `Hub Query` | ✅   |
| Web 検索（ニュース、独立ベンチ）                         | Tavily / Exa / Jina                    | ✅   |

**データ取得に大きなギャップはない。** LLM は MCP ツールで必要な情報を取得できる。

### 4.2 真のギャップ: 分析プロンプトの欠如

`toolPrompt.ts` の現状:

```
ANSWER: State only facts explicitly in the results.
        If info is missing or results conflict, say so.
        Never fabricate URLs or facts.
```

この指示は「事実をそのまま報告せよ」までしか言及していない。以下がない:

| 欠けている指示                                                 | 影響                            |
| -------------------------------------------------------------- | ------------------------------- |
| 「ハネスバージョンの不一致を指摘せよ」                         | v2.0 vs v2.1 を無視して「圧勝」 |
| 「共通ベンチのみを比較せよ。片方しかないベンチは別途報告せよ」 | 記載なしを劣勢として結論        |
| 「比較表から除外されている競合を特定せよ」                     | Cherry-picking に気づかない     |
| 「"not reported" は "worse" ではない」                         | MMLU-Pro/AIME で誤った結論      |
| 「出自のアーキテクチャを検証せよ」                             | 前提をそのまま受け入れる        |
| 「小さな差（<2点）は "marginally" と表現せよ」                 | 1点差を「勝利」と断定           |

---

## 5. 設計: プロンプト改善が核心

### 5.1 前提: 構造化パースは現実的ではない

モデルカードのベンチマーク表は形式が多様であり、構造化パース（JSON 化）は実用的ではない。

```
Qwen のカード:    | ベンチ | Q3.5-27B | Gemma4-31B | Q3.5-35BA3B | ... |
Nex-N2 のカード:  | ベンチ | Nex-N2-mini | Nex-N2-Pro | GPT-5.5 | ... |
他のカード:       自由形式の箇条書き、画像埋め込み、脚注付き、etc.
```

ベンチマーク名の名前合わせ（"SWE-bench Verified" vs "SWE-Bench Verified"）、
バージョン抽出（"Terminal-Bench 2.1" → "2.1"）、セクション分類（"Coding" vs "Agent"）
——これらは結局 LLM の自然言語理解に依存する。

**結論: 構造化パースツールを作るのではなく、LLM に適切な分析指示を出す。**

### 5.2 改善案: `toolPrompt.ts` の MODEL COMPARISON ガイドライン追加

```typescript
// toolPrompt.ts への追加分

`MODEL COMPARISON: When asked to compare models quantitatively:

  STEP 1 — Gather: Fetch each model's card details (use Hub Repository Details).
    Read the README to find benchmark tables and comparison tables.

  STEP 2 — Lineage: Before comparing scores, verify the relationship between models.
    Check architecture tags (e.g., "qwen3_5_moe"), library, parameter counts.
    If one model claims to be based on another, verify by comparing architecture tags
    and checking if the code examples are copied from the parent model.
    State clearly: "Model X uses the same architecture as Model Y, meaning its
    capability ceiling is inherited from Y's pre-training."

  STEP 3 — Common benchmarks only: Build a comparison table using ONLY benchmarks
    that ALL models report scores for. For each benchmark:
    - Note the harness version (e.g., "Terminal-Bench 2.0" vs "2.1").
    - If versions differ across models, flag it: "Not directly comparable — different harness versions."
    - Note the source: "self-reported by [team]" or "independent evaluation".
    - Scores from different teams' harnesses may not be directly comparable even with the same benchmark name.

  STEP 4 — Coverage asymmetry: List benchmarks that are reported by only some models.
    For each: "Model X reports [benchmark] = [score]; Model Y does not report this benchmark."
    NEVER conclude that a model is worse on a dimension just because it didn't report a benchmark.
    "Not reported" means "not reported" — it does not mean "zero" or "worse".

  STEP 5 — Cherry-picking detection: For each model's comparison table in its card:
    - List which competitors are included.
    - Check if same-class competitors (similar parameter count, similar architecture)
      are excluded. If so, explicitly note: "Model X's comparison table excludes Model Y,
      which is the same class (N parameters). It compares itself only to much larger models."
    - This is a key analytical insight: a model card that only compares against stronger
      models is curating a favorable narrative.

  STEP 6 — Adoption metrics: Compare downloads, likes, community activity.
    Adjust for recency: a model released days ago should not be judged harshly on adoption.
    Note: "Model X was released [N] days ago, so adoption metrics are not yet meaningful."

  STEP 7 — Conclusion: Structure as:
    a) What the data clearly shows (common benchmarks, verified differences)
    b) What we cannot determine (missing data, version mismatches)
    c) What each model's card omits (cherry-picking, coverage gaps)
    Use "marginally" for differences < 2 points. Use "approximately tied" for < 1 point.
    Never say "X dominates" or "X is the best" based on a subset of benchmarks.
    Always separate verified facts from inferences.`,
```

### 5.3 改善案: モデル比較クエリの自動検出 + 強化プロンプト

#### 検出ロジック

`runMcpFlow.ts` 内で、ユーザーメッセージがモデル比較リクエストかを検出:

```typescript
function isModelComparisonQuery(messages: EndpointMessage[]): boolean {
	const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
	if (!lastUserMsg) return false;
	const text =
		typeof lastUserMsg.content === "string"
			? lastUserMsg.content
			: Array.isArray(lastUserMsg.content)
				? lastUserMsg.content
						.map((p) => (typeof p === "object" ? (p.text ?? "") : String(p)))
						.join(" ")
				: "";

	const hfUrlPattern = /huggingface\.co\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/g;
	const hfUrls = text.match(hfUrlPattern) ?? [];

	const comparisonKeywords = [
		"比較",
		"compare",
		"versus",
		"vs",
		"対比",
		"どちら",
		"which is better",
		"定量",
		"quantitative",
		"スコア",
		"score",
		"性能",
		"performance",
	];
	const hasComparisonIntent = comparisonKeywords.some((kw) =>
		text.toLowerCase().includes(kw.toLowerCase())
	);

	return hfUrls.length >= 2 && hasComparisonIntent;
}
```

#### 強化プロンプトの注入

モデル比較クエリが検出された場合、既存の `buildToolPreprompt` の出力に追加:

```typescript
const modelComparisonPreprompt = `
You are comparing Hugging Face models. Follow this analysis framework strictly:

1. LINEAGE: Verify architectural relationship between models before comparing scores.
2. COMMON BENCHMARKS: Compare only benchmarks ALL models report. Flag version mismatches.
3. COVERAGE GAPS: List benchmarks reported by only some models. "Not reported" ≠ "worse".
4. CHERRY-PICKING: Check each model's comparison table for excluded same-class competitors.
5. ADOPTION: Compare downloads/likes, adjusted for recency.
6. CONCLUSION: Separate "what data shows" from "what we cannot determine".
   Use "marginally" for <2pt differences. Never overstate based on partial data.

Structure your response with clear section headers for each step above.
`;
```

### 5.4 改善案: ツール呼び出し順序の強制（オプション）

モデル比較クエリの場合、LLM に以下のツール呼び出し順序を推奨する:

```
1. [並列] Hub Repository Details × N（各モデルのメタデータ + README）
2. [並列] Hub Repository Details の結果からアーキテクチャタグを比較
3. [必要に応じて] Web Search → 独立ベンチマーク結果の検索
4. 分析 → 構造化テンプレートに従って回答
```

これは `toolPrompt.ts` の指示で実現可能。専用ツールは不要。

---

## 6. 実装計画

### Phase 1: プロンプト改善（最小実装）

| 項目                                  | 内容                                     | 対象ファイル                                        | 工数        |
| ------------------------------------- | ---------------------------------------- | --------------------------------------------------- | ----------- |
| **MODEL COMPARISON ガイドライン追加** | `toolPrompt.ts` に上記ガイドラインを追記 | `src/lib/server/textGeneration/utils/toolPrompt.ts` | 小（1時間） |

**期待効果:**

- 「記載なし ≠ 劣勢」→ MMLU-Pro/AIME の誤った結論が改善
- ハネスバージョンの不一致 → Terminal-Bench v2.0/v2.1 の指摘が改善
- Cherry-picking 検出 → 比較表の欠落が指摘される
- 不確実性の表現 → 「圧勝」「完勝」→ 「僅差」「ほぼ同等」

### Phase 2: 比較クエリの自動検出 + 強化プロンプト

| 項目                   | 内容                                           | 対象ファイル                                      | 工数        |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------- | ----------- |
| **比較クエリ検出**     | HF URL × 2以上 + 比較キーワードで検出          | `src/lib/server/textGeneration/mcp/runMcpFlow.ts` | 小（2時間） |
| **強化プロンプト注入** | 検出時に追加プロンプトを system message に挿入 | 同上                                              | 小（1時間） |

**期待効果:**

- 比較クエリの場合のみ強化プロンプトが有効（通常クエリに影響なし）
- 構造化セクション出力が強制される

### Phase 3: 評価・改善

| 項目                   | 内容                                                       | 工数 |
| ---------------------- | ---------------------------------------------------------- | ---- |
| **評価セット作成**     | 既知の比較タスク（Nex-N2 vs Qwen3.6 など）で回答品質を評価 | 中   |
| **プロンプトの微調整** | 評価結果に基づいてガイドラインを改善                       | 小   |

---

## 7. やらないこと（明確化）

### 構造化ベンチマークパースツール

モデルカードのベンチマーク表を自動パースして JSON 化するツールは**作らない**。

理由:

- モデルカードの形式が多様すぎ（Markdown テーブル、画像埋め込み、自由形式、脚注付き）
- ベンチマーク名の名前合わせは fuzzy matching が必要（"SWE-bench" vs "SWE_Bench" vs "SWE Bench"）
- 結局 LLM の自然言語理解に依存するので、ツールで作ってもプロンプトに頼るだけ
- コスト対効果が悪すぎる

### 独立ベンチマークデータベース

外部の独立ベンチマーク結果を収集・管理するデータベースは**作らない**（Phase 3 のオプション除く）。

理由:

- 維持コストが高い（ベンチマークは常に新しいものが登場）
- 現状の Web 検索ツールで代替可能

---

## 8. 検証記録

### 8.1 Gemma-4 回答の数値検証

2026-06-08 に Nex-N2-mini と Qwen3.6-35B-A3B のモデルカードを直接確認。

**検証結果: 数値捏造は起きていない。** 全数値がモデルカードと一致。

### 8.2 HF API のデータ確認

```
GET /api/models/nex-agi/Nex-N2-mini
  - cardData: { license, pipeline_tag, library_name } ← YAML frontmatter のみ
  - model-index: null ← ベンチマークデータなし
  - tags: ["qwen3_5_moe", ...] ← アーキテクチャタグあり
  - safetensors: { parameters: { BF16: 35107181936 } } ← パラメータ数あり
  - README 全文: API レスポンスに含まれない
    → HF MCP サーバーの Hub Repository Details が別途取得している可能性あり

GET /hf.co/nex-agi/Nex-N2-mini/raw/main/README.md
  - README 全文取得可能（9021バイト）
  - ベンチマーク表: 15 項目
  - 比較表の対戦相手: GPT-5.5, Opus 4.7, Kimi-K2.6, GLM-5.1, MiniMax M3, DeepSeek-V4-Pro
  - Qwen3.6-35B-A3B は含まれていない
```

### 8.3 実際のベンチマークカバレッジ

| モデル          | 総ベンチ数 | エージェント                                                                                                                                          | コーディング                                                                 | 知識                                    | 推論・数学                                 |
| --------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| Nex-N2-mini     | 15         | BrowseComp, GDPval, Toolathlon, WildClawBench, WideSearch, TAU3                                                                                       | SWE-Bench Pro, Terminal-Bench 2.1, DeepSWE, SWE-Bench Verified, SWE Atlas ×3 | GPQA Diamond                            | IFEval, Apex                               |
| Qwen3.6-35B-A3B | 28         | TAU3-Bench, VITA-Bench, DeepPlanning, Tool Decathlon, MCPMark, MCP-Atlas, WideSearch, Claw-Eval ×2, SkillsBench, QwenClawBench, NL2Repo, QwenWebBench | SWE-bench Verified/Multilingual/Pro, Terminal-Bench 2.0, LiveCodeBench v6    | MMLU-Pro, MMLU-Redux, SuperGPQA, C-Eval | GPQA, HLE, HMMT ×4, IMOAnswerBench, AIME26 |
| **共通ベンチ**  | **5**      | WideSearch, TAU3                                                                                                                                      | SWE-bench Verified, SWE-bench Pro, Terminal-Bench (v2.0/v2.1)                | GPQA                                    | —                                          |

**共通ベンチはわずか 5 項目。** そのうち Terminal-Bench はバージョンが異なる。
実質「同じ条件で比較可能」なのは **SWE-bench Verified, SWE-bench Pro, GPQA, WideSearch, TAU3** の 4〜5 項目のみ。

---

## 9. 参考

- 誤答例: `docs/memo_0608_1.txt`（Gemma-4 の回答）
- 正答例: `docs/memo_0608_1.txt`（Claude 4.8 Opus の回答）
- 既存 MCP 戦略: `docs/HF_MCP_SERVER_STRATEGY.md`
- 既存検索戦略: `docs/SEARCH_TOOL_STRATEGY.md`
- ツールプロンプト: `src/lib/server/textGeneration/utils/toolPrompt.ts`
- MCP フロー: `src/lib/server/textGeneration/mcp/runMcpFlow.ts`
