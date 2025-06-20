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
    `<p>当講座では、実際に自分で書いたプログラムを実行して、プログラミング学習のポイントを体感していただきます。</p>
<p>また、学習時に立ちはだかるトラブルに対して、ChatGPTを活用した解決法も伝授いたします。</p>
<h2>■みんなで一緒に1行ずつコードを書いていきます。</h2>
<p>講師が1行ずつゆっくり解説しながら、正しい順序でコードを書いていきます。</p>
<p>みなさんも一緒にコードを書いて、プログラムを動かしてみましょう。</p>
<p>プログラミングの実行にはエラーがつきものです。</p>
<p>その際に、出てくるエラーをみんなで共有しながら、具体的に解決していきます。</p>
<h2>■当講座で学ぶこと</h2>
<p>・プログラミングの基礎（関数、if文、for文、リスト、辞書）</p>
<p>・効率的なプログラミング学習方法</p>
<p>・ChatGPTの効果的な使い方</p>
<h2>■チャットGPTを積極的に使ってみよう！</h2>
<p>チャットGPTはプログラミング学習においても抜群の効力を発揮します。</p>
<p>・わからない文法の解説</p>
<p>・ミスの指摘と修正（デバッグ）</p>
<p>・ダイナミックな仕様変更</p>
<p>当講座でも、上記にチャレンジしていただきます。</p>
<h2>■対象者</h2>
<p>□中学生以上の学生、社会人、シニア</p>
<p>□パソコンが普通に使える方</p>
<h2>■ご用意いただくもの</h2>
<p>□Gmailアカウント（チャットGPT、コラボラトリーを使用します）</p>
<p>□PC（Zoom、VSコードをインストールしておいてください）</p>
<p>→申し込み後にご案内します。</p>
<h2>■講師紹介：みんなのグラさん</h2>
<p><img alt="グラさん小.jpg" src="https://techgym.doorkeeper.jp/files/f391de5fd67e35b8779f4d5bd3ec5e72761bb873/%E3%82%AF%E3%82%99%E3%83%A9%E3%81%95%E3%82%93%E5%B0%8F.jpg"></p>
<p>早稲田大学在学中にi-modeコンテンツ開発の会社を創業。
世界初の位置ゲームの企画開発に携わる。</p>
<p>2009年、スマホアプリ開発の会社を創業。
自社アプリは1,000万ダウンロードを突破。</p>
<p>2019年、未経験学生をプログラマーに育成してきた経験をもとに「テックジム」を創業。</p>
<p>「授業」や「チュートリアル」をなぞるだけでは「適切な学習方法」は会得できない。
「本人がコーディングする瞬間にアドバイスする方式」こそスキル定着することを提唱。
さらに、受験テクニックのようなコツを絡めた効率学習で3ヶ月で開発現場に送り込む。</p>
<p>無料開催のPython講座を全国100都市で開催。参加者は2万人を突破。
今までのキャリアを通じて育てた学生エンジニアは約300名。</p>
<p>人生最強チートの「プログラミング」をエンジニアだけのオモチャにしない!!
今後は老若男女「誰でもプログラミングができる社会」をつくり「日本復活」に寄与するのが目標。</p>
<h2>■もっとも効率的なスキル習得「テックジム方式」とは？</h2>
<p>「テックジム」のカリキュラムは、基礎知識なしでも効率よく学べるように細部に渡って設計されています。</p>
<p>何度かやっていくうちに自然に習得できますので「暗記」は不要です。</p>
<p>百聞は一見に如かず。実際に講座に参加して「魔法体験」をしてみてください。</p>
<h2>■参加者の声</h2>
<p>「基本的な事を実際に確認しながら進められたのが良かったです。」</p>
<p>「プログラム自体の書き方、考え方のポイントを少し理解できました。」</p>
<p>「実際にコーディングをするうちに、色々とわかってきました。」</p>
<p>「手を動かすのが一番という思いが強くなりました。」</p>
<p>「レベルが上がるごとの問題設定が適切であるように感じました。」</p>
<p>「この形式なら続けられそうです！」</p>`,
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
