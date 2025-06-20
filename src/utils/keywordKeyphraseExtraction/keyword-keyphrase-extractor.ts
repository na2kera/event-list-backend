import fetchFiveEventData from "./fetchFiveEventData";
import { cosineSimilarityKeyphraseExtractor } from "./keysentence_method/cosine-similarity-library";
import { extractKeyphrasesWithMultipartiteRank } from "./keysentence_method/multipartite-rank-library";
import { textrankKeyphraseExtractor } from "./keysentence_method/textrank-library-with-ai-v1";
import { textrankKeySentenceExtractor } from "./keysentence_method/textrank-library-with-ai-v1-2";
import { textrankKeywordExtractor as textrankKeywordExtractorV3 } from "./keysentence_method/textrank-library-with-ai-v1-3";
import { geminiSummaryToTextRankExtractor } from "./keysentence_method/textrank-library-with-ai-v2";
import { aiDrivenKeyphraseExtractor } from "./keysentence_method/textrank-library-with-ai-v3";
import { hybridKeyphraseExtractor } from "./keysentence_method/textrank-library-with-ai-v4";
import { stagedAIEnhancement } from "./keysentence_method/textrank-library-with-ai-v5";

import tfidfKeyphraseExtractor from "./keysentence_method/tf-idf-library";
import { keywordExtractorMethod } from "./keyword_method/keyword-extractor-library";
import { textrankKeywordExtractor } from "./keyword_method/textrank-library";
import { tfidfKeywordExtractor } from "./keyword_method/tf-idf-library";
import { topicrankKeywordExtractor } from "./keyword_method/topicrank-library";

// 非同期関数として実装
async function extractKeywordsAndKeyphrases() {
  //イベントを取ってくる
  // const fiveData = await fetchFiveEventData();
  // console.log(fiveData);

  //descriptionのみの5個の配列を作成
  // const descriptions = fiveData.map((event) => event.description || "");
  // console.log("Description配列:", descriptions);

  const descriptions = [
    `📋 イベント概要
Power BI 実演ライブでは【DX塾】講師の大畑が、オープンデータやスポーツデータを題材に、Power BI を使ったデータ分析・可視化の実演を行います。

ゼロからレポートを作成しながら、Power BIの操作方法や分析の進め方をリアルタイムでわかりやすく解説。
視聴者の質問やアイデアを取り入れながら、インタラクティブに学べるライブ配信となっています。

💻 一緒に手を動かして学ぼう！
イベントページの資料として、使用データやBIレポートファイルが公開されている場合は、ぜひご自身のPCにダウンロードして、一緒にPower BI Desktopを操作しながらご覧ください。より一層学習効果が高まります。
🙋 参加方法

本イベントは YouTube Live にて公開配信します。
参加登録なしでも視聴可能ですが、TECH PLAYで登録いただくと次回以降のイベント通知が届きます。

🔗 チャンネルはこちら： https://www.youtube.com/@dx_study
✍️ 扱ってほしいテーマ募集中！
「こんなデータを分析してほしい」「このテーマでやってほしい」など、リクエストはいつでも歓迎です！📩 X（旧Twitter）@ohata_ds まで！
🙏 注意事項

本イベントはYouTube Liveで公開配信されるため、表示名やコメントは公開を前提にご配慮ください。
一般的なマナーを守って、みんなで楽しく学びましょう！`,
  ];

  //descriptionを入れたらキーワードorキーセンテンスを返す配列を戻り値とする関数を指定
  for (const [index, description] of descriptions.entries()) {
    if (description) {
      // // keyword-extractorの結果
      // const keywordArray = keywordExtractorMethod(description);
      // console.log(
      //   `イベント${index + 1}のキーワード(keyword-extractor):`,
      //   keywordArray
      // );
      // // TF-IDFの結果（awaitを追加）
      // const tfidfArray = await tfidfKeywordExtractor(description);
      // console.log(`イベント${index + 1}のキーワード(TF-IDF):`, tfidfArray);
      // console.log("---");
      // // TextRankの結果;
      // const textrankArray = await textrankKeywordExtractor(description);
      // console.log(`イベント${index + 1}のキーワード(TextRank):`, textrankArray);
      // console.log("---");
      // // TopicRankの結果;
      // const topicrankArray = await topicrankKeywordExtractor(description);
      // console.log(
      //   `イベント${index + 1}のキーワード(TopicRank):`,
      //   topicrankArray
      // );
      // console.log("---");
      // //cosine-similarity-libraryのキーセンテンス;
      // const cosineArray = await cosineSimilarityKeyphraseExtractor(description);
      // console.log(
      //   `イベント${index + 1}のキーワード(Cosine Similarity):`,
      //   cosineArray
      // );
      // console.log("---");
      // //tf-idf-libraryのキーセンテンス;
      // const tfidfArray = await tfidfKeyphraseExtractor(description);
      // console.log(`イベント${index + 1}のキーワード(TF-IDF):`, tfidfArray);
      // console.log("---");
      // //multipartite-rank-libraryのキーセンテンス;
      // const multipartiteArray = await extractKeyphrasesWithMultipartiteRank(
      //   description
      // );
      // console.log(
      //   `イベント${index + 1}のキーワード(Multipartite Rank):`,
      //   multipartiteArray
      // );
      // console.log("---");
      // //textrank-libraryのキーセンテンス;
      // const textrankArray = await textrankKeyphraseExtractor(description);
      // console.log(`イベント${index + 1}のキーワード(TextRank):`, textrankArray);
      // console.log("---");
      // //gemini-summary-to-textrank-extractorのキーセンテンス（アプローチ5: AI サマリー前処理型）;
      // const geminiSummaryArray = await geminiSummaryToTextRankExtractor(
      //   description
      // );
      // console.log(
      //   `イベント${index + 1}のアプローチ5（AI サマリー前処理型）結果:`,
      //   geminiSummaryArray
      // );
      // console.log("---");

      // //Gemini AI主導型抽出のキーセンテンス（アプローチ2: AI 主導型抽出）;
      // const aiDrivenResult = await aiDrivenKeyphraseExtractor(description);
      // console.log(
      //   `イベント${index + 1}のアプローチ2（AI 主導型抽出）結果:`,
      //   aiDrivenResult.map(
      //     (p) =>
      //       `${p.phrase} (${p.source}: ${p.score.toFixed(3)}) [${
      //         p.category || "N/A"
      //       }]`
      //   )
      // );
      // console.log("---");

      // //ハイブリッド並列処理のキーセンテンス（アプローチ3: ハイブリッド並列処理）;
      // const hybridResult = await hybridKeyphraseExtractor(description);
      // console.log(
      //   `イベント${index + 1}のアプローチ3（ハイブリッド並列処理）結果:`,
      //   hybridResult.keyphrases.map(
      //     (p) => `${p.text} (${p.source}: ${p.hybridScore.toFixed(3)})`
      //   )
      // );
      // console.log(`処理時間: ${hybridResult.processingTime}ms`);
      // console.log(`信頼度: ${(hybridResult.confidence * 100).toFixed(1)}%`);
      // console.log("TextRank結果:", hybridResult.textRankResults);
      // console.log("AI結果:", hybridResult.aiResults);
      // console.log("---");

      // //段階的AI強化のキーセンテンス（アプローチ4: 段階的 AI 強化）;
      // const stagedResult = await stagedAIEnhancement(description);
      // console.log(
      //   `イベント${index + 1}のアプローチ4（段階的 AI 強化）結果:`,
      //   stagedResult.finalKeyphrases
      // );
      // console.log(
      //   `総処理時間: ${stagedResult.performanceMetrics.totalProcessingTime}ms`
      // );
      // console.log(
      //   `前処理AI: ${stagedResult.performanceMetrics.preprocessingTime}ms`
      // );
      // console.log(
      //   `TextRank: ${stagedResult.performanceMetrics.textrankTime}ms`
      // );
      // console.log(
      //   `後処理AI: ${stagedResult.performanceMetrics.postprocessingTime}ms`
      // );
      // console.log(
      //   `API呼び出し回数: ${stagedResult.performanceMetrics.aiApiCalls}回`
      // );
      // console.log("処理段階:");
      // console.log(
      //   "  前処理後:",
      //   stagedResult.processStages.preprocessed.substring(0, 100) + "..."
      // );
      // console.log(
      //   "  TextRank結果:",
      //   stagedResult.processStages.textrankResults
      // );
      // console.log("  最終結果:", stagedResult.processStages.postprocessed);
      // console.log("---");

      //textrank-library-with-ai-v1のキーセンテンス（v1手法）;
      const textrankArray = await textrankKeyphraseExtractor(description);
      console.log(
        `イベント${index + 1}のキーフレーズ(TextRank v1):`,
        textrankArray
      );
      console.log("---");

      //textrank-library-with-ai-v1-2のキーセンテンス（v1-2手法：完全な文章生成）;
      const keySentenceArray = await textrankKeySentenceExtractor(description);
      console.log(
        `イベント${index + 1}のキーセンテンス(TextRank v1-2):`,
        keySentenceArray
      );
      console.log("---");

      //textrank-library-with-ai-v1-3のキーセンテンス（v1-3手法：重要キーワード抽出）;
      const keywords3 = await textrankKeywordExtractorV3(description);
      console.log(
        `イベント${index + 1}のキーワード(TextRank v1-3):`,
        keywords3
      );
      console.log("---");
    }
  }
}

// 関数を実行
extractKeywordsAndKeyphrases().catch(console.error);

//descriptionを入れたらキーワードorキーセンテンスを返す配列を戻り値とする関数を指定
//これを量産する（関数を手法ごとに作る）
