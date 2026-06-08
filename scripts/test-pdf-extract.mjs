/**
 * PDF テキスト抽出モジュールのテストスクリプト
 *
 * 使い方:
 *   node scripts/test-pdf-extract.mjs [PDFのパス...]
 *
 * パスを指定しない場合は docs/sample_pdfs/ 内の全PDFをテストする。
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// TypeScript モジュールを直接実行するために、同等のロジックを JS で実装
import { PDFParse } from "pdf-parse";

const SAMPLE_DIR = resolve("docs/sample_pdfs");

/**
 * PDF からテキストを抽出する（pdfTextExtractor.ts と同等）
 */
async function getTextFromPdf(buffer) {
	const parser = new PDFParse({
		data: buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer),
		disableNormalization: true,
	});
	const result = await parser.getText();
	await parser.destroy();
	return normalizeJapaneseSpaces(result.text);
}

/**
 * 日本語PDFの文字間スペースを除去する後処理
 */
function normalizeJapaneseSpaces(text) {
	const reCjk = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u3000-\u303f\uff00-\uffef]/;

	const chars = text.split("");
	for (let i = 1; i < chars.length - 1; i++) {
		if (chars[i] === " ") {
			const prev = chars[i - 1];
			const next = chars[i + 1];
			if (reCjk.test(prev) && reCjk.test(next)) {
				chars[i] = "";
			}
		}
	}

	return chars.join("");
}

async function extractPdf(filePath) {
	const raw = readFileSync(filePath);
	const text = await getTextFromPdf(raw);
	const parser = new PDFParse({ data: new Uint8Array(raw) });
	const info = await parser.getInfo();
	await parser.destroy();
	return {
		path: filePath,
		numPages: info.totalPages || 0,
		textLength: text.length,
		text,
	};
}

async function main() {
	const targets = process.argv.slice(2);
	let files;

	if (targets.length > 0) {
		files = targets.map((f) => resolve(f));
	} else {
		const entries = await readdir(SAMPLE_DIR);
		files = entries.filter((n) => n.endsWith(".pdf")).map((n) => resolve(SAMPLE_DIR, n));
	}

	console.log(`テスト対象: ${files.length} ファイル\n`);

	let allPassed = true;

	for (const file of files) {
		const name = file.split("/").pop();
		console.log(`▶ ${name}`);

		try {
			const result = await extractPdf(file);
			console.log(`  ページ数: ${result.numPages}`);
			console.log(`  テキスト長: ${result.textLength} 文字`);

			// 日本語ファイルの検証
			const isJapaneseFile =
				name.includes("京都") || name.includes("yosan") || name.includes("注文");

			if (isJapaneseFile) {
				// 日本語文字が含まれているか
				const hasJapanese = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(result.text);
				console.log(`  日本語文字: ${hasJapanese ? "✅ 含まれる" : "❌ 含まれない"}`);

				// 文字間スペースの残存チェック（CJK文字間のスペース）
				const reCjkSpace = /[\u4e00-\u9fff\u3040-\u30ff] [\u4e00-\u9fff\u3040-\u30ff]/;
				const remainingSpaces = result.text.match(reCjkSpace);
				if (remainingSpaces) {
					console.log(`  ⚠️  文字間スペース残存: ${remainingSpaces[0]}`);
				} else {
					console.log(`  文字間スペース: ✅ 除去済み`);
				}
			} else {
				// 英語ファイルの検証
				const hasEnglish = /[a-zA-Z]{3,}/.test(result.text);
				console.log(`  英語テキスト: ${hasEnglish ? "✅ 含まれる" : "❌ 含まれない"}`);
			}

			// テキスト長チェック（空でないこと）
			if (result.textLength < 50) {
				console.log(`  ⚠️  テキストが短い (${result.textLength} 文字)`);
				allPassed = false;
			}

			console.log(`  抽出サンプル（先頭 300 文字）:`);
			console.log(`  ${result.text.slice(0, 300).replace(/\n/g, "\\n")}`);
		} catch (err) {
			console.error(`  ❌ エラー: ${err.message}`);
			allPassed = false;
		}
		console.log();
	}

	console.log(allPassed ? "✅ 全テスト通過" : "⚠️  一部の問題あり");
}

main().catch(console.error);
