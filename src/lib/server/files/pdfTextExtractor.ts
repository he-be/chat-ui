import { PDFParse } from "pdf-parse";

/**
 * PDF からテキストを抽出する。
 *
 * @param buffer - PDF のバイナリデータ（Buffer または Uint8Array）
 * @param options - 抽出オプション
 * @returns 抽出したテキスト
 */
export async function getTextFromPdf(
	buffer: Buffer | Uint8Array,
	options?: {
		/** 抽出するページ数（先頭から）。未指定または 0 の場合は全ページ */
		firstPages?: number;
		/** 特定のページのみ抽出（1-indexed）。指定すると firstPages は無視される */
		pages?: number[];
	}
): Promise<string> {
	const parser = new PDFParse({
		data: buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer),
	});

	const textParams: Record<string, unknown> = {
		disableNormalization: true,
	};

	if (options?.pages && options.pages.length > 0) {
		textParams.partial = options.pages;
	} else if (options?.firstPages && options.firstPages > 0) {
		textParams.first = options.firstPages;
	}

	const result = await parser.getText(textParams);
	await parser.destroy();

	return normalizeJapaneseSpaces(result.text);
}

/**
 * 日本語PDFの文字間スペースを除去する後処理。
 *
 * PDFの仕様上、日本語文字は個別の位置情報で配置され、
 * 抽出時に文字間にスペースが入ることがある。
 * この関数は CJK 文字間の不要なスペースを除去する。
 *
 * @example
 * "ミ ニ 四 駆" → "ミニ四駆"
 * "A I カ ー" → "A I カー"
 */
function normalizeJapaneseSpaces(text: string): string {
	// CJK 統一表意文字、ひらがな、カタカナ、全角記号・句読点
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
