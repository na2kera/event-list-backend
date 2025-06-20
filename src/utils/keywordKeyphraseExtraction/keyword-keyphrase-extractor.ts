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
    `Qlik TECH TALK セミナー：What's New In Qlik ～ 2025年5月リリース最新機能のご紹介 ～
Qlik 製品について、5月にリリースされた新機能をご紹介します。主要な機能についてはデモも併せてご覧いただきます。Qlik Cloud の分析機能、データ統合機能、管理機能、開発者向け機能など、また、Talendや適宜オンプレミス製品についても取り上げる予定です。是非、ご参加覧いただき、Qlikのさまざまな新しい機能をご活用ください。

当セミナーは無料でご参加いただけます。

登壇者

川畑　英貴
クリックテック・ジャパン株式会社ソリューション技術部プリセールスチームリード
日本大学理工学部（機械工学科）卒業後、半導体製造装置メーカーのSE、3D CADシステムのプログラマー、商社の営業、SIベンダーのプログラマー、製薬会社向けSFAメーカーのオペレーションマネージャー、インメモリーBI（Business Intelligence）ツールベンダーTIBCO Spotfireのシニア・ソリューション・アーキテクトを経て、今に至る。なかでもインメモリーBIには15年以上携わっている。

参加対象
Qlik Sense、QlikViewを既にお使いのお客様、また利用をご検討頂いているユーザー様、データ分析にご興味がある方、Qlik製品をお取り扱い頂いているパートナー様など、どなたでもご参加いただけます。お気軽にご参加ください。
これまでQlik Senseをご利用されたことのない方は、事前に下記よりQlik Sense 入門ハンズオンWebセミナーをご利用いただいてご体験頂くと、さらに当セミナーの内容をご活用いただけます。Qlik Sense 入門 ハンズオン Web セミナー
事前準備
Zoom（Web会議ツール）を使用します。あらかじめご利用のPCやタブレット、スマートフォンにインストールをお願いします。当セミナーのURLはお申込みいただいた方に、セミナー開催日前日までにお知らせいたします。`,
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
