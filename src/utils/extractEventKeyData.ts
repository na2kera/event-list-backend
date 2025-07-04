import { textrankKeyphraseExtractor } from "./keywordKeyphraseExtraction/keysentence_method/textrank-library-with-ai-v1";
import { textrankKeySentenceExtractor } from "./keywordKeyphraseExtraction/keysentence_method/textrank-library-with-ai-v1-2";
import { textrankKeywordExtractor as textrankKeywordExtractorV3 } from "./keywordKeyphraseExtraction/keysentence_method/textrank-library-with-ai-v1-3";

/**
 * イベント説明文からキーワード・キーフレーズ・キーセンテンスを抽出します。
 * 返却オブジェクトのプロパティ名は DB のカラム (keywords, keyPhrases, keySentences) に対応。
 */
export const extractEventKeyData = async (description: string) => {
  // const stripHtml = (html: string): string =>
  //   html
  //     .replace(/<[^>]*>/g, " ") // タグ削除
  //     .replace(/&[a-z]+;/g, " ") // エンティティ簡易除去
  //     .replace(/\s+/g, " ")
  //     .trim();
  // const safeText = description ? stripHtml(description) : "";

  try {
    const [keyPhrases, keySentences, keywords] = await Promise.all([
      textrankKeyphraseExtractor(description),
      textrankKeySentenceExtractor(description),
      textrankKeywordExtractorV3(description),
    ]);

    return {
      keywords,
      keyPhrases,
      keySentences,
    };
  } catch (error) {
    console.error("テキストメタ抽出エラー:", error);
    return {
      keywords: [],
      keyPhrases: [],
      keySentences: [],
    };
  }
};
