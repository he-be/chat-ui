import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTextFromPdf } from "./pdfTextExtractor";

const SAMPLE_DIR = resolve("docs/sample_pdfs");

function samplePdf(name: string): Buffer {
	return readFileSync(resolve(SAMPLE_DIR, name));
}

describe("getTextFromPdf", () => {
	it("英語PDFからテキストを正しく抽出する", async () => {
		const buffer = samplePdf("Guys, it just happened _ r_LocalLLaMA.pdf");
		const text = await getTextFromPdf(buffer);

		expect(text.length).toBeGreaterThan(5000);
		expect(text).toContain("Guys, it just happened");
		expect(text).toContain("LocalLLaMA");
		expect(text).toContain("Did you try turning it off and back on again");
	});

	it("日本語PDF（チラシ）からテキストを正しく抽出する", async () => {
		const buffer = samplePdf("NT京都説明チラシ (2) (1).pdf");
		const text = await getTextFromPdf(buffer);

		expect(text.length).toBeGreaterThan(200);
		// 文字間スペースが除去されていることを確認
		expect(text).toContain("ミニ四駆");
		expect(text).toContain("自動運転");
		expect(text).toContain("ドローン用バッテリー");

		// CJK文字間のスペースが残っていないことを確認
		const reCjkSpace = /[\u4e00-\u9fff\u3040-\u30ff] [\u4e00-\u9fff\u3040-\u30ff]/;
		expect(reCjkSpace.test(text)).toBe(false);
	});

	it("日本語PDF（予算資料）からテキストを正しく抽出する", async () => {
		const buffer = samplePdf("yosan_20251226_summary.pdf");
		const text = await getTextFromPdf(buffer);

		expect(text.length).toBeGreaterThan(10000);
		expect(text).toContain("防衛省");
		expect(text).toContain("Ministry of Defense");
		expect(text).toContain("防衛力抜本的強化");

		// CJK文字間のスペースが残っていないことを確認
		const reCjkSpace = /[\u4e00-\u9fff\u3040-\u30ff] [\u4e00-\u9fff\u3040-\u30ff]/;
		expect(reCjkSpace.test(text)).toBe(false);
	});

	it("日本語PDF（領収書）からテキストを正しく抽出する", async () => {
		const buffer = samplePdf("注文の詳細_monitor.pdf");
		const text = await getTextFromPdf(buffer);

		expect(text.length).toBeGreaterThan(300);
		expect(text).toContain("領収書");
		// PDF内の文字は互換性文字（U+2Fxx）を含むため、CJK文字の存在で確認
		expect(text).toMatch(/[\u6000-\u9fff\u2E80-\u2EFF]/);
		// PDF内の円記号は全角（￥ U+FFE5）
		expect(text).toMatch(/[\u00A5\uFFE5]12,999/);
		expect(text).toContain("モバイルモニター");
	});

	it("firstPages オプションで先頭ページのみ抽出できる", async () => {
		const buffer = samplePdf("yosan_20251226_summary.pdf");
		const text = await getTextFromPdf(buffer, { firstPages: 1 });
		const fullText = await getTextFromPdf(buffer);

		// 全ページ抽出より短い
		expect(text.length).toBeLessThan(fullText.length);
		// 先頭ページの内容が含まれる
		expect(text).toContain("防衛省");
	});

	it("pages オプションで特定ページのみ抽出できる", async () => {
		const buffer = samplePdf("yosan_20251226_summary.pdf");
		const text = await getTextFromPdf(buffer, { pages: [1] });

		expect(text).toContain("防衛省");
		expect(text.length).toBeGreaterThan(0);
	});

	it("Uint8Array でも正しく動作する", async () => {
		const buffer = samplePdf("注文の詳細_monitor.pdf");
		const uint8 = new Uint8Array(buffer);
		const text = await getTextFromPdf(uint8);

		expect(text).toContain("領収書");
	});
});
