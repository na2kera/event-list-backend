import { textrankKeyphraseExtractor } from "./keywordKeyphraseExtraction/keysentence_method/textrank-library-with-ai-v1";
import { textrankKeySentenceExtractor } from "./keywordKeyphraseExtraction/keysentence_method/textrank-library-with-ai-v1-2";
import { textrankKeywordExtractor as textrankKeywordExtractorV3 } from "./keywordKeyphraseExtraction/keysentence_method/textrank-library-with-ai-v1-3";

/**
 * イベント説明文からキーワード・キーフレーズ・キーセンテンスを抽出します。
 * 返却オブジェクトのプロパティ名は DB のカラム (keywords, keyPhrases, keySentences) に対応。
 */
export const extractEventKeyData = async (description: string) => {
  const safeText = description ?? "";

  try {
    const [keyPhrases, keySentences, keywords] = await Promise.all([
      textrankKeyphraseExtractor(safeText),
      textrankKeySentenceExtractor(safeText),
      textrankKeywordExtractorV3(safeText),
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
