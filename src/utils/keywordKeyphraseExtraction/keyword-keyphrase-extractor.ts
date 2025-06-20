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
    `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TS4K93N" height="0" width="0" style="display:none;visibility:hidden" ></iframe > ラクスル株式会社 | 2027年卒向けエンジニアhttps://corp.raksul.com/【データサイエンティスト｜就業型インターン】RAKSUL Real Analytics Internship 2025■はじめに ラクスルは「仕組みを変えれば、世界はもっと良くなる」というビジョンのもと、デジタル化の進んでいない伝統的な業界にインターネットを持ち込み産業構造の変革に取り組む会社です。 現在、中小企業を中心に280万人を超えるお客さまにご利用いただいています。 第2創業期を迎えた弊社が次のステージとして目指しているのはこの280万人超の顧客基盤と共通IDを活かした「End-to-Endで中小企業の経営課題を解決するテクノロジープラットフォーム」の構築です。 エンジニアは「会社が目指す壮大な未来」の実現における重要な役割を担っています。 今回、27卒に向けた実務型・有給のデータサイエンティスト就業インターンシップを開催します。 ラクスルのデータ分析の実務を体験できる機会となっておりますので、興味がある方は是非お申込ください！ ■就業型インターンの特長 ◉チームの一員としてラクスルのデータサイエンティスト実業務を経験できる 実際にデータ部門組織の一員として部門に所属しワークいただくので、ラクスルデータサイエンティストの実態を知ることができます。 また現場メンバーや関係部門とのランチを設定します。役員や新卒メンバーなど、様々なロールのメンバーから情報を得られる機会として活用してください。 他、期間中に社内外で実施する勉強会や社内イベントなどにも参加いただけます。 ◉事業会社におけるデータ分析の解像度が上がる ラクスルの就業型インターンは単なる「体験」ではなく「実務経験」です。 ラクスルの情報インプットだけではなく、インパクトの大きいアウトプットを生み出すことを期待しています。 ■応募要件 ■必須 ・2027年3月に大学、大学院、専門学校、高等専門学校を卒業見込の方 ・Pythonを用いたデータ分析・統計解析や機械学習モデル開発等の経験 ・SQLを用いたデータ集計の経験 ・基礎的な機械学習や統計の知識がある方 ■こんな方におすすめ ・他者と協力できる人／チームワークを大切にできる人 ・自分の考えを積極的に発言できる人 ・新しい技術に興味を持ち、業務に活用することができる人 ・サービスや技術の課題を設定し、自ら解決に向けて動くことができる人 ■就業型インターン詳細 ■実施期間 2025年8月～2025年9月の間で10～20営業日 ※実施時期・日数は応相談 ■実施方法 出社・在宅を交えたハイブリットワーク ■実施場所 本社(麻布台オフィス)：東京都港区麻布台一丁目3番1号 麻布台ヒルズ 森JPタワー 19階 ■報酬 時給2,000円 ■待遇 ・交通費支給あり ・遠方の方は当社で宿泊先を手配します ■持ち物 特になし（PC貸与あり） ■服装 指定なし（私服推奨） ■お申込後の対応について お申し込み後、3営業日以内にサポーターズにご登録のメールアドレスへマイページのご案内をお送りいたします。 メールは迷惑メールボックスに入ってしまう事がありますので、併せてご確認いただけますと幸いです。 万が一メールが届かない場合やインターンに関するお問い合わせは、お申し込み後に表示される緊急連絡先までお問い合わせください。 ■インターン参加までのフロー ①本ページよりお申込 ↓ ②技術課題・エントリーシート提出 ↓ ③選考通過 ↓ ④人事面接 ↓ ⑤コードレビュー会 ↓ ⑥インターン参加 ■他インターンも募集中です！ ラクスルでは下記インターンも募集中です。 別インターンとの併願が可能となりますが、応募後に併願について確認するので、まずは興味のあるインターンページからご応募ください。 ※基本的に同一のマイページをご案内するため、他ページから重ねての応募は不要です。 【WEBエンジニア｜就業型インターン】RAKSUL Real Dev internship 2025 【1Dayインターン】RAKSUL Tech 1Day internship 2025 【ハッカソン】RAKSUL Hackathon Internship 2025 枠数に限りがあり充足次第終了となりますので、少しでも興味がある方は早めにご応募ください。 ■事業内容・サービス詳細 私たちが運営する事業・サービス印刷事業の「ラクスル」や広告事業の「ノバセル」をはじめ、内製での立ち上げとM&Aを通じてさまざまな領域で事業・サービスを展開しています。 【印刷事業】 ◉ラクスル ネット印刷を中心に、新聞折込やポスティング、アパレル・ユニフォーム、ノベルティ・グッズ制作等のサービスを展開する、印刷・集客支援のプラットフォーム ◉ダンボールワン 小ロット・短納期・低価格で梱包に必要なものが何でも揃う、ダンボール・梱包材の受発注プラットフォーム ◉ハンコヤドットコム 法人・個人向けの印鑑やスタンプを販売する、ハンコの総合ECサイト ◉トートバッグ工房 トートバッグ・エコバッグのオリジナルプリントに特化したECサイト 【広告事業】 ◉ノバセル 広告代理店事業とマーケティングDX事業を展開する、マーケティングのプラットフォーム ◉ペライチ 誰でもスピーディーかつ簡単にウェブサイトや決済機能を構築できる、ホームページ制作SaaS 【グループ会社】 ◉ハコベル 荷主と運送会社をつなぐマッチングプラットフォーム事業と、荷主向けのオペレーションDX事業を展開する、物流のプラットフォーム ◉ジョーシス 情報システム部門のアナログ業務を自動化し、業務コスト削減とセキュリティレベル向上を支える、ITデバイスとSaaSの統合管理サービス ■キャンセルについて 理由のないイベントのキャンセルは、原則禁止しております。 キャンセルが続く場合、 今後イベントへの参加をお断り、または強制的に退会とさせて頂くこともありますのでご注意下さい。 やむを得ずイベントをキャンセルされる場合は、イベントページからキャンセル手続きをするか、サポーターズまでご連絡をお願いいたします。 ■サポーターズからの支援金支給について 本インターンは参加前に選考があるため、支援金支給の対象外となります。 インターンに参加しても支援金は支給されませんのでご注意ください。 ●オフライン参加の場合 開催地区在住の方：1,000円、その他地域在住の方：3,000円 ●オンライン開催の場合 在住地域問わず、支援金の支給はありません ●支援金支給条件 下記を満たした場合、支援金支給の対象となります。（※オンライン開催・参加を除く） ・プロフィールの顔写真、基本情報、志望職種、学歴情報、志向性、経験情報（経験者のみ）、スキル情報（経験者のみ）を記入している方 ・本イベントページで申込し、実際に参加した方 ・今までイベント主催企業と接点の無い方 ・本イベントに別ルートから申込をしていない方 その他支援金に関する質問は よくあるご質問 をご覧ください。企業情報 私たちは、 「仕組みを変えれば、世界はもっと良くなる」 をビジョンに、 テクノロジーの力を生かして、まだデジタル化が進んでいない伝統的な産業の構造を変革し、業界全体に大きな価値を生み出す「仕組み」、つまりプラットフォームの提供を進めています。 ビジョンを実現するためには、現場の解像度を高く持ち続ける事が必須です。ただ開発するというだけではなく、プロダクトを中心に考え「どのようなニーズがあるのか」「これを開発することでどんなインパクトにつながるのか」を議論し、プロダクトの成長や顧客価値に貢献し「産業の課題をプロダクトで解決する会社」でありたいと考えています。 ＜サービス一覧＞ ■印刷・広告のシェアリングプラットフォーム「ラクスル」（https://raksul.com/）では、全国の提携印刷会社の非稼働時間で印刷することにより、高品質な商品をお安く提供しています。 さらに、ポスティングや新聞折込、TVCM制作・放映などの広告サービスも展開しお客様の集客活動をトータルで支援しています。 ■物流シェアリングプラットフォーム「ハコベル」（https://hacobell.com/）では、全国の提携運送会社の非稼動時間を有効活用する運配送の仕組みを開発。物流問題を解決し、新たな日本の物流インフラづくりにチャレンジしています。 ■運用型テレビCMのシェアリングプラットフォーム「ノバセル」（http://novasell.com/）では、従来、難しいとされていたテレビCMの広告効果測定可能にし、広告投資の最適化を通して、企業の成長を実現。デジタルマーケティング領域、クリエイティブ領域、ファイナンス領域におけるパートナー提携等を通じて、企業の事業成長を最大限に伸ばすサポートをしています。 ■2021年9月には、第4の事業としてITデバイス＆SaaSの統合管理クラウド「ジョーシス」（https://josys.it/）をリリース。 コーポレートITのアナログ業務を自動化し、業務コスト削減とセキュリティレベル向上を支えるITデバイス & SaaS統合管理サービスで従業員の入社〜在籍中〜退社にともない発生するITデバイスの購入・返却やSaaSアカウントの発行・削除といった業務を効率化し、台帳管理を自動化することで、業務コスト削減とセキュリティ向上を実現します。 ＜参考資料＞ ■RAKSUL 新卒採用サイト https://recruit.raksul.com/newgrads/ ■RAKSUL 会社紹介資料 https://speakerdeck.com/raksulrecruiting/raksul-introduction ■RAKSUL TechBlog https://techblog.raksul.com/開催日程このイベントに関する問い合わせ8月1日~9月30日0:00〜0:00東京都 締切6月30日(月) 23:59申込へ8月1日~9月30日0:00〜0:00東京都 締切4月30日(水) 23:59受付終了関連するイベント【26卒/本選考/エンジニア職】累計2億DL突破 ！アプリ開発のノーコードプラットフォーム「Yappli (ヤプリ)」株式会社ヤプリ10月1日(火)オンライン事例を通して学ぶ AWSクラウドアーキテクチャ入門 / 技育CAMPアカデミア株式会社サポーターズ6月11日(水)オンライン【プログラミング初心者も大歓迎！】14年連続シェアNo.1のサービスを始め、日本初・世界初のサービスも多数開発★プログラミング言語開発者・技術書著者などスペシャリストが在籍する環境で世界にイノベーションを起こしませんか？《オンライン開催》株式会社オプティム6月5日(木)オンラインサポーターズとはよくあるご質問お問い合わせ運営会社利用規約プライバシーポリシー採用担当者様はこちらCopyright © Supporterz, Inc. All Rights Reserved. サポーターズのサービス提供外のブラウザです Internet Explorer等の古いブラウザではサポーターズをご利用いただくことが出来ません。 Google Chromeやその他のブラウザをご利用いただくか、お使いのブラウザを最新のバージョンへアップデートしてください。 © Supporterz, Inc. All Rights Reserved. <img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=1445940102380667&amp;ev=PageView&amp;noscript=1"> <img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=505932882046460&amp;ev=PageView&amp;noscript=1">`,
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
