# PDF入力機能の検討

## 概要

UIからPDFファイルをチャット入力できるようにする。
サーバー側でPDFからテキストを抽出し、既存のテキストファイル処理パイプラインに統合する。
**対象環境: セルフホストのみ。**

---

## 1. 現状のファイル処理

### 1.1 ファイルアップロードの流れ

```
ユーザー → PDF アップロード → サーバー(GridFS保存) → PDFテキスト抽出 → OpenAI API
```

### 1.2 現在サポートされているファイルタイプ

| カテゴリ       | MIME タイプ                                                        | 処理方法                                        |
| -------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| テキスト       | `text/*`, `application/json`, `application/xml`, `application/csv` | 本文に `<document>` タグで注入                  |
| 画像           | `image/jpeg`, `image/png` (モデル依存)                             | base64 data URL で `image_url` コンテンツパーツ |
| クリップボード | `application/vnd.chatui.clipboard` (内部)                          | 本文に直接注入                                  |

**出典:** `src/lib/constants/mime.ts`

### 1.3 PDF に関する現状

- `src/lib/utils/mime.ts` に `pdf: "application/pdf"` のマッピングは存在する（URLフェッチ時の推論用）
- **PDF は `TEXT_MIME_ALLOWLIST` に含まれておらず、アップロード時に拒否される**
- PDFパーサーライブラリの依存関係は存在しない

---

## 2. 実装パターン

### サーバー側 PDF テキスト抽出

PDF をアップロードし、サーバー側でテキストを抽出してメッセージ本文に注入する。

**変更箇所:**

| ファイル                                              | 変更内容                                          |
| ----------------------------------------------------- | ------------------------------------------------- |
| `src/lib/constants/mime.ts`                           | `PDF_MIME_ALLOWLIST = ["application/pdf"]` を追加 |
| `src/lib/components/chat/ChatInput.svelte`            | ドロップダウンに「Add PDF」メニューを追加         |
| `src/lib/components/chat/ChatWindow.svelte`           | `activeMimeTypes` に PDF を含める                 |
| `src/lib/server/files/pdfTextExtractor.ts` (新)       | PDF → テキスト抽出モジュール                      |
| `src/lib/server/textGeneration/utils/prepareFiles.ts` | PDF ファイルのテキスト抽出ロジックを追加          |
| `src/lib/components/chat/UploadedFile.svelte`         | PDF アイコン表示を追加                            |
| `src/routes/conversation/[id]/+server.ts`             | ファイルサイズ制限の確認                          |

**必要な依存関係:**

- `pdf-parse`（サーバー側のみ、クライアントバンドルに影響なし）

**prepareFiles.ts への追加例:**

```ts
import { getTextFromPdf } from "$lib/server/files/pdfTextExtractor";

const pdfFiles = files.filter((file) => file.mime === "application/pdf");

if (pdfFiles.length > 0) {
	const pdfTexts = await Promise.all(
		pdfFiles.map(async (file) => {
			const pdfBuffer = Buffer.from(file.value, "base64");
			const text = await getTextFromPdf(pdfBuffer);
			return `<document name="${file.name}" type="application/pdf">\n${text}\n</document>`;
		})
	);
	textContent = (textContent ? textContent + "\n\n" : "") + pdfTexts.join("\n\n");
}
```

**メリット:**

- 既存のテキストファイル処理パターンと統一
- クライアントに負担をかけない
- すべてのモデルで動作（multimodal 不要）
- PDF のページ数・サイズに応じた制限をサーバー側で管理可能

**デメリット:**

- 追加のサーバー依存関係が必要
- 複雑なレイアウト（表、図、2カラム等）のテキスト抽出精度はライブラリに依存
- PDF 内の画像は抽出できない

---

## 3. 実装フェーズ

### フェーズ 1: PDF テキスト抽出モジュール ✅ 完了

**完了した作業:**

1. `pdf-parse` を依存関係に追加
2. `src/lib/server/files/pdfTextExtractor.ts` を実装
   - `getTextFromPdf(buffer, options)` API
   - `disableNormalization: true` で日本語文字の正規化を抑制
   - `normalizeJapaneseSpaces()` でCJK文字間の不要なスペースを除去
   - `firstPages` / `pages` オプションでページ単位抽出をサポート
3. `src/lib/server/files/pdfTextExtractor.test.ts`（Vitest 7件全通過）
4. サンプルPDF（英語・日本語計4ファイル）で抽出精度を検証
   - 英語PDF: 8,696文字、正常抽出 ✅
   - 日本語PDF（チラシ）: 431文字、CJKスペース除去 ✅
   - 日本語PDF（予算資料）: 18,900文字、CJKスペース除去 ✅
   - 日本語PDF（領収書）: 571文字、互換性文字処理 ✅

**検証用ファイル:**

- `docs/sample_pdfs/*.txt` — 各PDFから抽出したテキスト（人力チェック用）

### フェーズ 2: UI統合（未着手）

1. `PDF_MIME_ALLOWLIST` を `mime.ts` に追加
2. `ChatInput.svelte` に PDF アップロードメニューを追加
3. `ChatWindow.svelte` の `activeMimeTypes` に PDF を含める
4. `prepareFiles.ts` に PDF テキスト抽出ロジックを追加
5. `UploadedFile.svelte` に PDF の表示処理を追加

---

## 4. 考慮事項

### 4.1 ファイルサイズ制限

- 現在の制限: 10MB（`FileDropzone.svelte`、`+server.ts`）
- テキスト抽出後のトークン数を考慮し、ページ数制限も検討

### 4.2 セキュリティ

- PDF は悪意のあるコンテンツを含む可能性がある
- `pdf-parse` は読み取り専用で安全だが、バージョン更新は定期的に実施

### 4.3 アクセシビリティ

- `UploadedFile.svelte` で PDF ファイルのプレビュー表示
- PDF アイコン（Carbon `document-text` アイコン等）を使用

---

## 5. 関連ファイル一覧

### 変更済みのファイル

| ファイル                                        | 役割                   | ステータス  |
| ----------------------------------------------- | ---------------------- | ----------- |
| `src/lib/server/files/pdfTextExtractor.ts`      | PDF → テキスト抽出     | ✅ 実装済み |
| `src/lib/server/files/pdfTextExtractor.test.ts` | 抽出モジュールのテスト | ✅ 実装済み |
| `package.json`                                  | `pdf-parse` 依存追加   | ✅ 追加済み |

### 変更が必要なファイル（フェーズ 2）

| ファイル                                              | 役割                           |
| ----------------------------------------------------- | ------------------------------ |
| `src/lib/constants/mime.ts`                           | MIME 型アローリスト            |
| `src/lib/components/chat/ChatInput.svelte`            | ファイルアップロード UI        |
| `src/lib/components/chat/ChatWindow.svelte`           | MIME タイプ統合                |
| `src/lib/components/chat/FileDropzone.svelte`         | ドラッグ＆ドロップ検証         |
| `src/lib/components/chat/UploadedFile.svelte`         | アップロード済みファイルの表示 |
| `src/lib/server/textGeneration/utils/prepareFiles.ts` | ファイル→プロンプト変換        |
| `src/lib/server/files/uploadFile.ts`                  | ファイルアップロード           |
| `src/routes/conversation/[id]/+server.ts`             | ファイル検証・保存             |

### 参考ファイル

| ファイル                                         | 役割                            |
| ------------------------------------------------ | ------------------------------- |
| `src/lib/server/files/downloadFile.ts`           | GridFS からファイルダウンロード |
| `src/lib/server/endpoints/preprocessMessages.ts` | メッセージ前処理                |
| `src/lib/server/endpoints/openai/endpointOai.ts` | OpenAI API 呼び出し             |
| `src/lib/types/Message.ts`                       | MessageFile タイプ定義          |
| `src/lib/utils/file2base64.ts`                   | クライアント側 base64 変換      |
| `src/lib/utils/mime.ts`                          | MIME 型推論ユーティリティ       |
