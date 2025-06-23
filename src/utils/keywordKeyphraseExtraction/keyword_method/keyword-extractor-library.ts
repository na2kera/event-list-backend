export type KeywordExtractorMethod = (text: string) => string[];

/**
 * keyword-extractorライブラリを使用したキーワード抽出メソッド
 * ストップワード除去と3-gramまでの語句抽出を行う
 * @param text 分析対象の文章
 * @returns キーワード配列
 */
export const keywordExtractorMethod: KeywordExtractorMethod = (
  text: string
): string[] => {
  const keyword_extractor = require("keyword-extractor");

  const extraction_result = keyword_extractor.extract(text, {
    language: "english", // 英語のストップワードリストを使用
    remove_digits: false, // 数字を除去しない
    return_changed_case: false, // 元の大文字小文字を保持
    remove_duplicates: false, // 重複を除去しない
    return_max_ngrams: 3, // 3-gramまでの語句を含める
  });

  return extraction_result;
};
