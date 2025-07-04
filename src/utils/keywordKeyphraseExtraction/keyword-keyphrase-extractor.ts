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
    `<h1>YUMEMI × やさしい Swift 勉強会 とは</h1>
<p>株式会社ゆめみで社内向けに開催している勉強会で、Swift の言語そのものに着目して基礎をみんなでじっくり見ていく時間になります。技術面でも業界貢献したいと願う片岡さんの意向を汲んで、そんなゆめみの社内勉強会に外の人にも参加してもらえるように「熊谷さんのやさしい Swift 勉強会」として一般公募を開始したのがこの勉強会の始まりです。</p>
<p>社内のジュニアエンジニアがメインターゲットになっていますが、日頃から Swift 言語を使っている人はもちろん、普段は Swift に親しみがないけどなんとなく気になった人など、プログラミングに携わる人も携わらない人もどなたでも歓迎です。</p>
<p>詳細は <a href="https://yumemi.notion.site/Swift-687334bd0b844dcab35f360f3df75b9b" rel="nofollow">ゆめみオープンハンドブック</a> をご覧ください。</p>
<h4>オンライン開催</h4>
<p>Zoom を使ったオンライン開催になりますけれど、おとなしく聞いているだけでも大丈夫ですし、カメラは ON でも OFF でも大丈夫ですので、どうぞ気兼ねなくご参加くださいね。途中入退室も自由です。</p>
<h1>進め方</h1>
<p>Apple の Swift 公式解説書 <a href="https://docs.swift.org/swift-book/documentation/the-swift-programming-language/" rel="nofollow">The Swift Programming Language</a> の流れに沿いながら、Swift 言語の基礎的なところを広く深く、時間をかけて眺めていきます。</p>
<p>単に読書するだけでなく、ときにみんなと自由に話したりしながら Swift に親しみ、その素養を高めて自身で考える力を養うきっかけにしてもらうのを目的としています。特に業務等で Swift に携わる中ではなかなか触れられない話題を、広く・深く・何度でも、視点を変えながら Swift を俯瞰していく会で、連続で参加できなくても差し支えないので、都合の良いときにいつでもいらしてください。</p>
<h1>タイムスケジュール</h1>
<table>
<thead>
<tr>
<th>時間</th>
<th>内容</th>
<th>担当</th>
</tr>
</thead>
<tbody>
<tr>
<td>13:05 - 適宜</td>
<td>準備・談笑タイム（通常は 20 分ほど）</td>
<td></td>
</tr>
<tr>
<td>- 13:50</td>
<td>やさしい Swift 勉強会</td>
<td>@es_kumagai</td>
</tr>
</tbody>
</table>
<p>基本的には 13:05 から 13:50 までが勉強会の時間になります。それでもこの時間にきっちり居ないといけないことはないので、遅れて入室してもらっても早めに退室してもらっても大丈夫です。近ごろは最初の 20 分くらいは雑談しながら人が集まるのを待っていたりする感じですので、それを見越して遅くから来てくれる人もふつうにいます。</p>
<h1>近ごろの話題</h1>
<p>最近は <a href="https://www.swift.org" rel="nofollow">Swift.org</a> &gt; <a href="https://www.swift.org/migration/documentation/migrationguide/" rel="nofollow">Migrating to Swift 6</a> を読み進めていっています。</p>
<h1>オリエンテーション</h1>
<p>勉強会の様子についてもう少し詳しく知りたい方は、こちらの <a href="https://www.dropbox.com/scl/fi/s0x2o9sjn9kazb20l77ry/for-Publish.pdf?rlkey=avlqrgtftnwl6syc4chg2ycou&amp;st=n4sgy57o&amp;dl=0" rel="nofollow">オリエンテーション</a> 資料に会の趣旨などを記していますので、こちらも合わせてご覧ください。</p>
<h1>これまでの動画</h1>
<p>これまでの開催録画は、今のところは株式会社ゆめみの YouTube チャンネル <a href="https://www.youtube.com/playlist?list=PL3Utf2i5RcCxpuECdfLlXJnF_TsTUVIf6" rel="nofollow">Channel Yumemi</a> にて幾つか公開しています。以降の動画も準備が整い次第、どこかで順次公開していく予定です。</p>
<p>どの動画まで公開されているかや、どの話題がどの回で取り上げられたかなどの情報は <a href="https://yumemi.notion.site/9c4420a3f27a4817b8f0d9eae487fe02?v=be82d85362f44779bd4f9384c7bbdeae" rel="nofollow">ゆめみオープンハンドブック</a> から確認できるようになっています。</p>
<h1>参加する際の留意点</h1>
<p>勉強会の内容は、後日に映像として YouTube を通して一般公開される予定です。</p>
<p>姿は映像に含まれませんが、声は基本的に含まれますので、差し障りのある場合は話すのを控えるようにお気をつけください。ライブ配信ではありませんので収録されると都合の良くない話題をうっかり話してしまった場合は後でカットできますので、萎縮せず会話にも参加してもらえます。</p>
<h1>YUMEMI.grow</h1>
<p>株式会社ゆめみが開催する勉強会の総称です。
最新の技術や業務で得た知見・ベストプラクティスなどの情報共有、
エンジニア同士の交流を目的としています。</p>`,
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
