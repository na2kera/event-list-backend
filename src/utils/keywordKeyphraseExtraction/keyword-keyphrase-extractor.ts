import fetchFiveEventData from "./fetchFiveEventData";
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
      // keyword-extractorの結果
      // const keywordArray = keywordExtractorMethod(description);
      // console.log(
      //   `イベント${index + 1}のキーワード(keyword-extractor):`,
      //   keywordArray
      // );
      // TF-IDFの結果（awaitを追加）
      // const tfidfArray = await tfidfKeywordExtractor(description);
      // console.log(`イベント${index + 1}のキーワード(TF-IDF):`, tfidfArray);
      // console.log("---");
      // TextRankの結果
      // const textrankArray = await textrankKeywordExtractor(description);
      // console.log(`イベント${index + 1}のキーワード(TextRank):`, textrankArray);
      // console.log("---");

      // TopicRankの結果
      const topicrankArray = await topicrankKeywordExtractor(description);
      console.log(
        `イベント${index + 1}のキーワード(TopicRank):`,
        topicrankArray
      );
      console.log("---");
    }
  }
}

// 関数を実行
extractKeywordsAndKeyphrases().catch(console.error);

//descriptionを入れたらキーワードorキーセンテンスを返す配列を戻り値とする関数を指定
//これを量産する（関数を手法ごとに作る）
