import fetchFiveEventData from "./fetchFiveEventData";
import { cosineSimilarityKeyphraseExtractor } from "./keyphrase_method/cosine-similarity-library";
import { extractKeyphrasesWithMultipartiteRank } from "./keyphrase_method/multipartite-rank-library";
import { textrankKeyphraseExtractor } from "./keyphrase_method/textrank-library-with-ai-v1";
import { geminiSummaryToTextRankExtractor } from "./keyphrase_method/textrank-library-with-ai-v2";
import { aiDrivenKeyphraseExtractor } from "./keyphrase_method/textrank-library-with-ai-v3";
import { hybridKeyphraseExtractor } from "./keyphrase_method/textrank-library-with-ai-v4";
import { stagedAIEnhancement } from "./keyphrase_method/textrank-library-with-ai-v5";

import tfidfKeyphraseExtractor from "./keyphrase_method/tf-idf-library";
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
    `当講座では、実際に自分で書いたプログラムを実行して、プログラミング学習のポイントを体感していただきます。また、学習時に立ちはだかるトラブルに対して、ChatGPTを活用した解決法も伝授いたします。
■みんなで一緒に1行ずつコードを書いていきます。
講師が1行ずつゆっくり解説しながら、正しい順序でコードを書いていきます。みなさんも一緒にコードを書いて、プログラムを動かしてみましょう。
プログラミングの実行にはエラーがつきものです。その際に、出てくるエラーをみんなで共有しながら、具体的に解決していきます。
■当講座で学ぶこと
・プログラミングの基礎（関数、if文、for文、リスト、辞書）・効率的なプログラミング学習方法・ChatGPTの効果的な使い方
■チャットGPTを積極的に使ってみよう！
チャットGPTはプログラミング学習においても抜群の効力を発揮します。
・わからない文法の解説・ミスの指摘と修正（デバッグ）・ダイナミックな仕様変更
当講座でも、上記にチャレンジしていただきます。
■対象者
□中学生以上の学生、社会人、シニア□パソコンが普通に使える方
■ご用意いただくもの
□Gmailアカウント（チャットGPT、コラボラトリーを使用します）□PC（Zoom、VSコードをインストールしておいてください）　→申し込み後にご案内します。
【講師プロフィール】みんなのグラさん

■みんなのグラさん（X）
早稲田大学在学中にi-modeコンテンツ開発の会社を創業。世界初の位置ゲームの企画開発に携わる。
2009年、スマホアプリ開発の会社を創業。自社アプリは1,000万ダウンロードを突破。
2019年、未経験学生をプログラマーに育成してきた経験をもとに「テックジム」を創業。「授業」や「チュートリアル」をなぞるだけでは「適切な学習方法」は会得できない。「本人がコーディングする瞬間にアドバイスする方式」こそスキル定着することを提唱。さらに、受験テクニックのようなコツを絡めた効率学習で3ヶ月で開発現場に送り込む。
無料開催のPython講座を全国100都市で開催。参加者は2万人を突破。今までのキャリアを通じて育てた学生エンジニアは約300名。人生最強チートの「プログラミング」をエンジニアだけのオモチャにしない!!今後は老若男女「誰でもプログラミングができる社会」をつくり「日本復活」に寄与するのが目標。

■もっとも効率的なスキル習得「テックジム方式」とは？
「テックジム」のカリキュラムは、基礎知識なしでも効率よく学べるように細部に渡って設計されています。何度かやっていくうちに自然に習得できますので「暗記」は不要です。百聞は一見に如かず。実際に講座に参加して「魔法体験」をしてみてください。
■参加者の声
「基本的な事を実際に確認しながら進められたのが良かったです。」「プログラム自体の書き方、考え方のポイントを少し理解できました。」「実際にコーディングをするうちに、色々とわかってきました。」「手を動かすのが一番という思いが強くなりました。」「レベルが上がるごとの問題設定が適切であるように感じました。」「この形式なら続けられそうです！」`,
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
      //gemini-summary-to-textrank-extractorのキーセンテンス（アプローチ5: AI サマリー前処理型）;
      const geminiSummaryArray = await geminiSummaryToTextRankExtractor(
        description
      );
      console.log(
        `イベント${index + 1}のアプローチ5（AI サマリー前処理型）結果:`,
        geminiSummaryArray
      );
      console.log("---");

      //Gemini AI主導型抽出のキーセンテンス（アプローチ2: AI 主導型抽出）;
      const aiDrivenResult = await aiDrivenKeyphraseExtractor(description);
      console.log(
        `イベント${index + 1}のアプローチ2（AI 主導型抽出）結果:`,
        aiDrivenResult.map(
          (p) =>
            `${p.phrase} (${p.source}: ${p.score.toFixed(3)}) [${
              p.category || "N/A"
            }]`
        )
      );
      console.log("---");

      //ハイブリッド並列処理のキーセンテンス（アプローチ3: ハイブリッド並列処理）;
      const hybridResult = await hybridKeyphraseExtractor(description);
      console.log(
        `イベント${index + 1}のアプローチ3（ハイブリッド並列処理）結果:`,
        hybridResult.keyphrases.map(
          (p) => `${p.text} (${p.source}: ${p.hybridScore.toFixed(3)})`
        )
      );
      console.log(`処理時間: ${hybridResult.processingTime}ms`);
      console.log(`信頼度: ${(hybridResult.confidence * 100).toFixed(1)}%`);
      console.log("TextRank結果:", hybridResult.textRankResults);
      console.log("AI結果:", hybridResult.aiResults);
      console.log("---");

      //段階的AI強化のキーセンテンス（アプローチ4: 段階的 AI 強化）;
      const stagedResult = await stagedAIEnhancement(description);
      console.log(
        `イベント${index + 1}のアプローチ4（段階的 AI 強化）結果:`,
        stagedResult.finalKeyphrases
      );
      console.log(
        `総処理時間: ${stagedResult.performanceMetrics.totalProcessingTime}ms`
      );
      console.log(
        `前処理AI: ${stagedResult.performanceMetrics.preprocessingTime}ms`
      );
      console.log(
        `TextRank: ${stagedResult.performanceMetrics.textrankTime}ms`
      );
      console.log(
        `後処理AI: ${stagedResult.performanceMetrics.postprocessingTime}ms`
      );
      console.log(
        `API呼び出し回数: ${stagedResult.performanceMetrics.aiApiCalls}回`
      );
      console.log("処理段階:");
      console.log(
        "  前処理後:",
        stagedResult.processStages.preprocessed.substring(0, 100) + "..."
      );
      console.log(
        "  TextRank結果:",
        stagedResult.processStages.textrankResults
      );
      console.log("  最終結果:", stagedResult.processStages.postprocessed);
      console.log("---");
    }
  }
}

// 関数を実行
extractKeywordsAndKeyphrases().catch(console.error);

//descriptionを入れたらキーワードorキーセンテンスを返す配列を戻り値とする関数を指定
//これを量産する（関数を手法ごとに作る）
