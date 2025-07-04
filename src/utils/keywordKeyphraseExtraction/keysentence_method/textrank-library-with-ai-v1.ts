// ファイルの最初に追加
import dotenv from "dotenv";
dotenv.config();

// Gemini APIのimport追加
import { GoogleGenerativeAI } from "@google/generative-ai";

// kuromoji.jsの型定義（既存ライブラリから流用）
interface KuromojiToken {
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2: string;
  pos_detail_3: string;
  basic_form: string;
  reading: string;
  pronunciation: string;
}

interface KuromojiTokenizer {
  tokenize(text: string): KuromojiToken[];
}

// 文情報のインターフェース
interface SentenceInfo {
  id: number;
  text: string;
  words: string[];
  score: number;
  originalPosition: number;
}

// AI精製結果のインターフェース
interface EnhancedKeyphrase {
  phrase: string;
  score: number;
  confidence: number;
  aiEnhanced: boolean;
  originalLength?: number;
  originalRank?: number;
  category?: "technology" | "skill" | "feature" | "location" | "other";
  weightedScore?: number; // カテゴリ重み適用後のスコア
}

// AI精製設定インターフェース
interface AIRefinementConfig {
  maxRetries: number;
  timeoutMs: number;
  maxKeyphrases: number;
  maxLength: number; // 最大文字数
  minLength: number; // 最小文字数
  preserveTechnicalTerms: boolean; // 技術用語保持
  targetStyle: "concise" | "detailed"; // 精製スタイル
  enableAI: boolean; // AI機能のON/OFF
  enableDeduplication: boolean; // 重複排除機能
  categoryWeights: {
    // カテゴリ別重み調整
    technology: number;
    skill: number;
    feature: number;
    location: number; // 開催地情報
    other: number; // ノイズカテゴリ
  };
  similarityThreshold: number; // 重複判定の類似度閾値
}

// TextRank設定インターフェース
interface TextRankConfig {
  dampingFactor: number; // PageRankのダンピング係数
  maxIterations: number; // 最大反復回数
  tolerance: number; // 収束判定値
  maxSentences: number; // 最大文数制限
  minSentenceLength: number; // 最小文字数制限
}

// グローバルにtokenizerとGemini APIを保持（初期化コストを削減）
let tokenizer: KuromojiTokenizer | null = null;
let genAI: GoogleGenerativeAI | null = null;

// デフォルト設定（日本語最適化）
const DEFAULT_CONFIG: TextRankConfig = {
  dampingFactor: 0.85, // PageRankの標準値
  maxIterations: 50, // 最大反復回数
  tolerance: 0.0001, // 収束判定値
  maxSentences: 10, // 最大10文まで
  minSentenceLength: 10, // 10文字未満の文は除外
};

// AI精製のデフォルト設定（キーフレーズ数増加版）
const DEFAULT_AI_CONFIG: AIRefinementConfig = {
  maxRetries: 3,
  timeoutMs: 8000,
  maxKeyphrases: 8, // 5個→8個に増加
  maxLength: 30, // 最適長さ上限を拡大
  minLength: 6, // 最適長さ下限を緩和
  preserveTechnicalTerms: true,
  targetStyle: "concise",
  enableAI: true,
  enableDeduplication: true,
  categoryWeights: {
    location: 0.0, // 地名情報は完全除外
    technology: 1.5, // 技術要素を最重視
    skill: 1.2, // スキル要素を向上
    feature: 0.9, // 特徴要素の重みを向上（除外されすぎを防ぐ）
    other: 0.5, // otherカテゴリの重みを向上（完全除外を防ぐ）
  },
  similarityThreshold: 0.75, // 重複判定を少し厳しくして品質維持
};

/**
 * Gemini API初期化
 */
const initializeGeminiAPI = (): GoogleGenerativeAI => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY環境変数が設定されていません");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
};

/**
 * キーフレーズのカテゴリを自動検出
 */
const detectCategory = (
  phrase: string
): "technology" | "skill" | "feature" | "location" | "other" => {
  const lowerPhrase = phrase.toLowerCase();

  // ノイズとなりやすいキーワード（開発ツール・準備ツール・事務的要素）
  const noiseKeywords = [
    "vscode",
    "vs code",
    "visual studio code",
    "zoom",
    "gmail",
    "slack",
    "notion",
    "figma",
    "pc",
    "パソコン",
    "インストール",
    "ダウンロード",
    "申し込み",
    "案内",
    "準備",
    "用意",
    "アカウント",
    // 大学名・固有名詞
    "早稲田大学",
    "慶應大学",
    "東京大学",
    "大学",
    "株式会社",
    "有限会社",
    "i-mode",
    // 一般的すぎるツール名
    "chrome",
    "safari",
    "firefox",
    "excel",
    "word",
    "powerpoint",
  ];

  // ノイズ判定
  for (const keyword of noiseKeywords) {
    if (lowerPhrase.includes(keyword)) {
      return "other"; // ノイズはotherカテゴリに分類
    }
  }

  // 開催地・地名のキーワード（最優先）
  const locationKeywords = [
    // 都道府県
    "北海道",
    "青森",
    "岩手",
    "宮城",
    "秋田",
    "山形",
    "福島",
    "茨城",
    "栃木",
    "群馬",
    "埼玉",
    "千葉",
    "東京",
    "神奈川",
    "新潟",
    "富山",
    "石川",
    "福井",
    "山梨",
    "長野",
    "岐阜",
    "静岡",
    "愛知",
    "三重",
    "滋賀",
    "京都",
    "大阪",
    "兵庫",
    "奈良",
    "和歌山",
    "鳥取",
    "島根",
    "岡山",
    "広島",
    "山口",
    "徳島",
    "香川",
    "愛媛",
    "高知",
    "福岡",
    "佐賀",
    "長崎",
    "熊本",
    "大分",
    "宮崎",
    "鹿児島",
    "沖縄",
    // 主要都市・エリア
    "札幌",
    "仙台",
    "名古屋",
    "神戸",
    "福岡市",
    "横浜",
    "川崎",
    "渋谷",
    "新宿",
    "池袋",
    "秋葉原",
    "品川",
    "丸の内",
    "六本木",
    "梅田",
    "難波",
    "天神",
    "博多",
    "中洲",
    "栄",
    "金山",
    // 地域名
    "関東",
    "関西",
    "東海",
    "九州",
    "北陸",
    "中国",
    "四国",
    "東北",
    "首都圏",
    "近畿",
    "中部",
    "山陰",
    "山陽",
    // オンライン関連（除外用）
    "オンライン",
    "リモート",
    "配信",
    "ウェビナー",
    "zoom開催",
  ];

  // オンライン除外キーワードをチェック（locationから除外）
  const onlineKeywords = [
    "オンライン",
    "リモート",
    "配信",
    "ウェビナー",
    "zoom開催",
  ];
  const isOnline = onlineKeywords.some((keyword) =>
    lowerPhrase.includes(keyword)
  );

  // 地名判定（オンラインでない場合のみ）
  if (!isOnline) {
    for (const keyword of locationKeywords) {
      if (lowerPhrase.includes(keyword)) return "location";
    }
  }

  // 技術要素のキーワード（価値の高い技術のみ）
  const technologyKeywords = [
    // プログラミング言語
    "python",
    "javascript",
    "typescript",
    "java",
    "c#",
    "golang",
    "rust",
    "swift",
    "kotlin",
    "php",
    "ruby",
    "scala",
    "dart",
    "elixir",
    // フレームワーク・ライブラリ
    "react",
    "vue",
    "angular",
    "svelte",
    "next.js",
    "nuxt.js",
    "express",
    "fastapi",
    "django",
    "flask",
    "spring",
    "laravel",
    "rails",
    // データベース・インフラ
    "postgresql",
    "mysql",
    "mongodb",
    "redis",
    "elasticsearch",
    "aws",
    "azure",
    "gcp",
    "docker",
    "kubernetes",
    "terraform",
    // AI・機械学習
    "chatgpt",
    "gpt",
    "openai",
    "gemini",
    "claude",
    "ai",
    "機械学習",
    "ml",
    "llm",
    // API・プロトコル
    "api",
    "rest",
    "graphql",
    "websocket",
    "grpc",
    // プログラミング概念
    "if文",
    "for文",
    "関数",
    "リスト",
    "辞書",
    "クラス",
    "オブジェクト",
    "アルゴリズム",
    "データ構造",
    "非同期",
    "並行処理",
  ];

  // スキル要素のキーワード
  const skillKeywords = [
    "学習",
    "習得",
    "解説",
    "解決",
    "デバッグ",
    "エラー解決",
    "コード",
    "プログラミング",
    "コーディング",
    "開発",
    "実装",
    "設計",
    "1行ずつ",
    "共有",
    "体験",
    "実践",
    "手法",
    "方法",
    "スキル",
    "効率",
    "最適化",
    "リファクタリング",
    "レビュー",
    "テスト",
    "ペアプログラミング",
    "チーム開発",
    "アジャイル",
    "スクラム",
  ];

  // 特徴要素のキーワード（イベント形式・対象者）
  const featureKeywords = [
    "講座",
    "セミナー",
    "ワークショップ",
    "研修",
    "勉強会",
    "ハンズオン",
    "初心者",
    "中級者",
    "上級者",
    "未経験",
    "入門",
    "基礎",
    "応用",
    "オフライン",
    "対面",
    "無料",
    "有料",
    "テックジム",
    "アカデミー",
    "スクール",
    "ブートキャンプ",
    "中学生",
    "高校生",
    "学生",
    "社会人",
    "シニア",
  ];

  // カテゴリ判定（location → technology → skill → feature → other の優先順）
  for (const keyword of technologyKeywords) {
    if (lowerPhrase.includes(keyword)) return "technology";
  }

  for (const keyword of skillKeywords) {
    if (lowerPhrase.includes(keyword)) return "skill";
  }

  for (const keyword of featureKeywords) {
    if (lowerPhrase.includes(keyword)) return "feature";
  }

  return "other";
};

/**
 * 文字列の類似度を計算（編集距離ベース）
 */
const calculateTextSimilarity = (str1: string, str2: string): number => {
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 || len2 === 0) return 0;

  // 正規化Levenshtein距離
  const maxLen = Math.max(len1, len2);
  const distance = levenshteinDistance(str1, str2);

  return 1 - distance / maxLen;
};

/**
 * Levenshtein距離の計算
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,
        matrix[j][i - 1] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  return matrix[str2.length][str1.length];
};

/**
 * 重複排除機能（類似度ベース）
 */
const removeDuplicates = (
  keyphrases: EnhancedKeyphrase[],
  config: AIRefinementConfig
): EnhancedKeyphrase[] => {
  if (!config.enableDeduplication) {
    return keyphrases;
  }

  console.log("🔄 重複排除処理開始...");

  const uniquePhrases: EnhancedKeyphrase[] = [];

  for (const phrase of keyphrases) {
    let isDuplicate = false;

    for (const existing of uniquePhrases) {
      const similarity = calculateTextSimilarity(
        phrase.phrase.toLowerCase(),
        existing.phrase.toLowerCase()
      );

      if (similarity >= config.similarityThreshold) {
        isDuplicate = true;
        console.log(
          `🔍 重複検出: "${phrase.phrase}" ≈ "${
            existing.phrase
          }" (類似度: ${similarity.toFixed(3)})`
        );

        // より高いスコアの方を残す
        if (
          phrase.weightedScore &&
          existing.weightedScore &&
          phrase.weightedScore > existing.weightedScore
        ) {
          const index = uniquePhrases.indexOf(existing);
          uniquePhrases[index] = phrase;
        }
        break;
      }
    }

    if (!isDuplicate) {
      uniquePhrases.push(phrase);
    }
  }

  console.log(
    `✅ 重複排除完了: ${keyphrases.length} → ${uniquePhrases.length}フレーズ`
  );
  return uniquePhrases;
};

/**
 * 日本語形態素解析器の初期化
 */
const initializeTokenizer = async (): Promise<KuromojiTokenizer> => {
  if (tokenizer) {
    return tokenizer;
  }
  console.log("🚀 kuromoji tokenizer を初期化中...");
  const kuromoji = require("kuromoji");
  return new Promise((resolve, reject) => {
    kuromoji
      .builder({ dicPath: "node_modules/kuromoji/dict" })
      .build((err: any, _tokenizer: KuromojiTokenizer) => {
        if (err) {
          console.error("❌ kuromoji初期化エラー:", err);
          reject(err);
        } else {
          console.log("✅ kuromoji tokenizer 初期化完了");
          tokenizer = _tokenizer;
          resolve(_tokenizer);
        }
      });
  });
};

/**
 * 日本語テキストを文に分割
 */
const splitIntoSentences = (text: string): string[] => {
  // 基本的な文区切り記号で分割
  let sentences = text
    .replace(/([。！？\.\!\?])/g, "$1\n") // 文末記号の後に改行
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // 短すぎる文や記号のみの文を除外
  sentences = sentences.filter((sentence) => {
    const cleanSentence = sentence.replace(/[。！？\.\!\?\s]/g, "");
    return cleanSentence.length >= DEFAULT_CONFIG.minSentenceLength;
  });

  return sentences;
};

/**
 * 文を単語に分解（形態素解析）
 */
const tokenizeSentence = async (sentence: string): Promise<string[]> => {
  try {
    const _tokenizer = await initializeTokenizer();
    const tokens = _tokenizer.tokenize(sentence);

    // 名詞、動詞、形容詞のみを抽出
    const words = tokens
      .filter((token) => {
        const pos = token.pos;
        const detail1 = token.pos_detail_1;
        return (
          (pos === "名詞" &&
            !["接続詞的", "数", "非自立", "代名詞"].includes(detail1)) ||
          (pos === "動詞" && detail1 !== "非自立") ||
          (pos === "形容詞" && detail1 !== "非自立")
        );
      })
      .map((token) => token.basic_form || token.surface_form)
      .filter((word) => word && word.length > 1);

    return words;
  } catch (error) {
    console.error("❌ 形態素解析エラー:", error);
    // フォールバック: 簡単な分割
    return sentence
      .replace(/[、。！？\.\!\?,\s]/g, " ")
      .split(" ")
      .filter((word) => word.length > 1)
      .slice(0, 10); // 最大10語まで
  }
};

/**
 * 文間の類似度を計算（Jaccard係数）
 */
const calculateSimilarity = (wordsA: string[], wordsB: string[]): number => {
  if (wordsA.length === 0 || wordsB.length === 0) {
    return 0;
  }

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return union.size === 0 ? 0 : intersection.size / union.size;
};

/**
 * 類似度行列を構築
 */
const buildSimilarityMatrix = (sentences: SentenceInfo[]): number[][] => {
  const n = sentences.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        matrix[i][j] = calculateSimilarity(
          sentences[i].words,
          sentences[j].words
        );
      }
    }
  }

  return matrix;
};

/**
 * PageRankアルゴリズムを実行
 */
const runPageRank = (
  similarityMatrix: number[][],
  config: TextRankConfig
): number[] => {
  const n = similarityMatrix.length;
  if (n === 0) return [];

  // 初期スコア
  let scores = new Array(n).fill(1.0);

  for (let iter = 0; iter < config.maxIterations; iter++) {
    const newScores = new Array(n).fill(0);
    let maxChange = 0;

    for (let i = 0; i < n; i++) {
      let sum = 0;
      let totalWeight = 0;

      // i番目の文に接続している文からのスコア計算
      for (let j = 0; j < n; j++) {
        if (i !== j && similarityMatrix[j][i] > 0) {
          // j番目の文から出ている全ての重みの合計
          let outgoingWeights = 0;
          for (let k = 0; k < n; k++) {
            if (j !== k) {
              outgoingWeights += similarityMatrix[j][k];
            }
          }

          if (outgoingWeights > 0) {
            sum += (similarityMatrix[j][i] / outgoingWeights) * scores[j];
          }
        }
      }

      newScores[i] = 1 - config.dampingFactor + config.dampingFactor * sum;
      maxChange = Math.max(maxChange, Math.abs(newScores[i] - scores[i]));
    }

    scores = newScores;

    // 収束判定
    if (maxChange < config.tolerance) {
      console.log(`✅ PageRank収束: ${iter + 1}回目の反復で完了`);
      break;
    }
  }

  return scores;
};

/**
 * AI精製用プロンプト生成
 */
const generateRefinementPrompt = (
  originalText: string,
  textRankResults: string[],
  config: AIRefinementConfig
): string => {
  return `
あなたは日本のIT・技術イベントの専門家です。以下のイベント説明文と、TextRankアルゴリズムで抽出されたキーセンテンスを分析し、イベント推薦システム向けの短縮キーフレーズに精製してください。

【イベント説明文】
${originalText.substring(0, 2000)}

【TextRank抽出結果】
${textRankResults.map((phrase, index) => `${index + 1}. ${phrase}`).join("\n")}

【精製指示】
1. **技術用語・フレームワーク名を最優先で保持**
2. **${config.minLength}〜${config.maxLength}文字の範囲内に調整**
3. **冗長な表現を削除**（「について学ぶ」「を開催します」等）
4. **具体的なスキル・技術要素を抽出**
5. **必ず${config.maxKeyphrases}個のキーフレーズを生成してください**
6. **イベント推薦に有用な情報を優先**
7. **内容が大きく異なる限り、類似表現も許容**
8. **多様性を重視：技術・スキル・地域・形式など様々な角度から抽出**

【重要な除外指示】
❌ 以下の開発ツール・準備ツール・地名情報は除外：
- VSCode、Visual Studio Code、Zoom、Gmail、Slack等
- PC、パソコン、インストール、ダウンロード等の準備要件
- 大学名（早稲田大学、東京大学等）や古い技術名（i-mode等）
- 一般的なブラウザ名（Chrome、Safari等）
- **開催地・地名情報（東京、大阪、渋谷、関東等）は技術的価値が低いため除外**

✅ 以下の価値ある情報を優先（多角的に抽出）：
- **プログラミング言語・フレームワーク（Python、React等）** ← 最重要
- **技術概念・スキル（API、デバッグ、関数等）**
- **学習手法・教育メソッド（テックジム、実践学習等）**
- **対象者・レベル（初心者、中級者、未経験者等）**
- **イベント形式（ワークショップ、ハンズオン、座談会等）**
- **業界・分野（スタートアップ、AI、Web開発等）**
- **具体的なツール・サービス名（GitHub、AWS等）**

【出力形式】（JSON形式で回答）
{
  "refined_keyphrases": [
    {
      "phrase": "精製後のキーフレーズ",
      "score": 0.85,
      "original_length": 50,
      "refined_length": 15,
      "reason": "精製理由"
    }
  ]
}
`;
};

/**
 * Gemini APIでキーフレーズを精製
 */
const refineWithGemini = async (
  originalText: string,
  textRankResults: string[],
  config: AIRefinementConfig
): Promise<EnhancedKeyphrase[]> => {
  try {
    console.log("🤖 Gemini APIでキーフレーズ精製開始...");

    const genAI = initializeGeminiAPI();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = generateRefinementPrompt(
      originalText,
      textRankResults,
      config
    );

    // タイムアウト制御
    const refinePromise = model.generateContent(prompt);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("AI API タイムアウト")),
        config.timeoutMs
      )
    );

    const result = (await Promise.race([refinePromise, timeoutPromise])) as any;
    const responseText = result.response.text();

    console.log("📝 Gemini API レスポンス受信");

    // JSON解析
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSON形式のレスポンスが見つかりません");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    let refinedPhrases: EnhancedKeyphrase[] = parsed.refined_keyphrases
      .map((item: any, index: number) => {
        const phrase = item.phrase;
        const category = detectCategory(phrase);
        const baseScore = item.score || 0.5;
        const categoryWeight =
          config.categoryWeights[
            category as keyof typeof config.categoryWeights
          ] || 0.5;
        const weightedScore = baseScore * categoryWeight;

        return {
          phrase,
          score: baseScore,
          confidence: Math.max(0.1, Math.min(1.0, baseScore)),
          aiEnhanced: true,
          originalLength: item.original_length,
          originalRank: index,
          category,
          weightedScore,
        };
      })
      // 長さフィルタリング
      .filter((item) => {
        const length = item.phrase.length;
        return length >= config.minLength && length <= config.maxLength;
      });

    // ノイズフィルタリング（otherカテゴリの極低スコアのみ除外）
    refinedPhrases = refinedPhrases.filter((phrase) => {
      if (phrase.category === "other" && (phrase.weightedScore || 0) < 0.3) {
        console.log(`🗑️ ノイズ除外: "${phrase.phrase}"`);
        return false;
      }
      return true;
    });

    // 重複排除
    refinedPhrases = removeDuplicates(refinedPhrases, config);

    // 重み付きスコアでソート
    refinedPhrases.sort(
      (a, b) => (b.weightedScore || 0) - (a.weightedScore || 0)
    );

    console.log(`✅ AI精製完了: ${refinedPhrases.length}個のキーフレーズ`);
    console.log("🔍 精製結果:");
    refinedPhrases.forEach((p) => {
      console.log(
        `  📋 "${p.phrase}" (${p.category}, score: ${p.score.toFixed(
          3
        )}, weighted: ${(p.weightedScore || 0).toFixed(3)})`
      );
    });

    return refinedPhrases.slice(0, config.maxKeyphrases);
  } catch (error) {
    console.error("❌ Gemini API エラー:", error);
    throw error;
  }
};

/**
 * AI精製を適用（リトライ機能付き）
 */
const applyAIRefinement = async (
  originalText: string,
  textRankResults: string[],
  config: AIRefinementConfig
): Promise<EnhancedKeyphrase[]> => {
  let retryCount = 0;

  while (retryCount < config.maxRetries) {
    try {
      return await refineWithGemini(originalText, textRankResults, config);
    } catch (error) {
      retryCount++;
      console.warn(
        `⚠️ AI精製失敗 (${retryCount}/${config.maxRetries}):`,
        error
      );

      if (retryCount >= config.maxRetries) {
        console.log("🔄 AI精製失敗、TextRank結果にフォールバック");

        // フォールバック：TextRank結果にカテゴリ検出と重み調整を適用
        let fallbackPhrases: EnhancedKeyphrase[] = textRankResults
          .map((phrase, index) => {
            const category = detectCategory(phrase);
            const baseScore = Math.max(0.1, 1.0 - index * 0.1);
            const categoryWeight =
              config.categoryWeights[
                category as keyof typeof config.categoryWeights
              ] || 0.5;
            const weightedScore = baseScore * categoryWeight;

            return {
              phrase,
              score: baseScore,
              confidence: 0.6,
              aiEnhanced: false,
              originalRank: index,
              category,
              weightedScore,
            };
          })
          // 長さフィルタリング
          .filter((item) => {
            const length = item.phrase.length;
            return length >= config.minLength && length <= config.maxLength;
          });

        // ノイズフィルタリング（フォールバック時はより緩和）
        fallbackPhrases = fallbackPhrases.filter((phrase) => {
          if (
            phrase.category === "other" &&
            (phrase.weightedScore || 0) < 0.25
          ) {
            console.log(`🗑️ フォールバック時ノイズ除外: "${phrase.phrase}"`);
            return false;
          }
          return true;
        });

        // 重複排除
        fallbackPhrases = removeDuplicates(fallbackPhrases, config);

        // 重み付きスコアでソート
        fallbackPhrases.sort(
          (a, b) => (b.weightedScore || 0) - (a.weightedScore || 0)
        );

        return fallbackPhrases;
      } else {
        // 指数バックオフで待機
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retryCount) * 1000)
        );
      }
    }
  }

  // フォールバック（ここに到達することはないはずですが、安全のため）
  let finalFallbackPhrases: EnhancedKeyphrase[] = textRankResults
    .map((phrase, index) => {
      const category = detectCategory(phrase);
      const baseScore = Math.max(0.1, 1.0 - index * 0.1);
      const categoryWeight =
        config.categoryWeights[
          category as keyof typeof config.categoryWeights
        ] || 0.5;
      const weightedScore = baseScore * categoryWeight;

      return {
        phrase,
        score: baseScore,
        confidence: 0.6,
        aiEnhanced: false,
        originalRank: index,
        category,
        weightedScore,
      };
    })
    // 長さフィルタリング
    .filter((item) => {
      const length = item.phrase.length;
      return length >= config.minLength && length <= config.maxLength;
    });

  // ノイズフィルタリング（最終フォールバック時は最も緩和）
  finalFallbackPhrases = finalFallbackPhrases.filter((phrase) => {
    if (phrase.category === "other" && (phrase.weightedScore || 0) < 0.2) {
      console.log(`🗑️ 最終フォールバック時ノイズ除外: "${phrase.phrase}"`);
      return false;
    }
    return true;
  });

  // 重複排除
  finalFallbackPhrases = removeDuplicates(finalFallbackPhrases, config);

  // 重み付きスコアでソート
  finalFallbackPhrases.sort(
    (a, b) => (b.weightedScore || 0) - (a.weightedScore || 0)
  );

  return finalFallbackPhrases;
};

/**
 * TextRankを使用したキーセンテンス抽出メイン関数（AI精製拡張版）
 * @param text 分析対象の文章
 * @param aiConfig AI精製設定（オプション）
 * @returns 精製されたキーフレーズの配列
 */
export const textrankKeyphraseExtractor = async (
  text: string,
  aiConfig: Partial<AIRefinementConfig> = {}
): Promise<string[]> => {
  const startTime = Date.now();

  // HTMLタグ除去ユーティリティ（関数全体で使えるように関数スコープに配置）
  const stripHtml = (html: string): string =>
    html
      .replace(/<[^>]*>/g, " ") // タグ削除
      .replace(/&[a-z]+;/g, " ") // エンティティ簡易除去
      .replace(/\s+/g, " ")
      .trim();

  // 最低返却数を保証するユーティリティ
  const ensureMinResults = (
    primary: string[],
    secondary: string[],
    min = 3
  ): string[] => {
    const combined = [...primary];
    for (const cand of secondary) {
      if (combined.length >= min) break;
      if (!combined.includes(cand)) combined.push(cand);
    }
    return combined.slice(0, Math.max(min, combined.length));
  };

  try {
    console.log("\n🎯 TextRank + AI精製 キーセンテンス抽出開始");

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.log("⚠️ 入力テキストが無効です。");
      return [];
    }

    // AI設定をマージ
    const finalAIConfig: AIRefinementConfig = {
      ...DEFAULT_AI_CONFIG,
      ...aiConfig,
    };

    // ===== 1. TextRank処理 =====

    // 1-1. 文分割
    const rawSentences = splitIntoSentences(text);

    if (rawSentences.length < 2) {
      console.log("⚠️ 分析に十分な文がありません。");
      return ensureMinResults(
        rawSentences.slice(0, 5),
        splitIntoSentences(text).map(stripHtml),
        3
      );
    }

    console.log(`📊 ${rawSentences.length}文を分析します...`);

    // 1-2. 各文を単語に分解
    const sentences: SentenceInfo[] = [];
    for (let i = 0; i < rawSentences.length; i++) {
      const words = await tokenizeSentence(rawSentences[i]);
      if (words.length > 0) {
        sentences.push({
          id: i,
          text: rawSentences[i],
          words: words,
          score: 0,
          originalPosition: i,
        });
      }
    }

    if (sentences.length < 2) {
      console.log("⚠️ 有効な文が少なすぎます。");
      return ensureMinResults(
        sentences.map((s) => s.text).slice(0, 5),
        splitIntoSentences(text).map(stripHtml),
        3
      );
    }

    // 1-3. 類似度行列を構築
    const similarityMatrix = buildSimilarityMatrix(sentences);

    // 1-4. PageRankアルゴリズムを実行
    const scores = runPageRank(similarityMatrix, DEFAULT_CONFIG);

    // 1-5. スコアを文情報に反映
    sentences.forEach((sentence, index) => {
      sentence.score = scores[index] || 0;
    });

    // 1-6. スコア順にソートして上位を選択
    const rankedSentences = sentences
      .sort((a, b) => b.score - a.score)
      .slice(
        0,
        Math.min(DEFAULT_CONFIG.maxSentences, Math.ceil(sentences.length * 0.4))
      );

    // 1-7. 元の順序でソート（読みやすさのため）
    const textRankResults = rankedSentences
      .sort((a, b) => a.originalPosition - b.originalPosition)
      .map((s) => s.text);

    console.log(`🏆 TextRank抽出完了: ${textRankResults.length}文を抽出`);
    console.log("📋 TextRank結果:", textRankResults);

    // ===== 2. AI精製処理 =====

    if (!finalAIConfig.enableAI) {
      console.log("🔄 AI精製無効化：TextRank結果のみ返却");
      return ensureMinResults(
        textRankResults.map(stripHtml).filter((p) => p.length > 0),
        splitIntoSentences(text).map(stripHtml),
        3
      );
    }

    try {
      const enhancedResults = await applyAIRefinement(
        text,
        textRankResults,
        finalAIConfig
      );

      const finalResults = enhancedResults
        .map((result) => stripHtml(result.phrase))
        .filter((p) => p.length > 0);

      const processingTime = Date.now() - startTime;
      console.log(
        `✅ TextRank + AI精製完了 (${processingTime}ms): ${finalResults.length}個のキーフレーズ`
      );
      console.log("🎯 最終結果（カテゴリ別分析）:");

      // カテゴリ別に整理して表示
      const categoryCounts = {
        technology: 0,
        skill: 0,
        feature: 0,
        location: 0,
        other: 0,
      };
      enhancedResults.forEach((result) => {
        const category = result.category || "other";
        categoryCounts[category]++;
        console.log(
          `  🏷️ [${category.toUpperCase()}] "${
            result.phrase
          }" (重み付きスコア: ${(result.weightedScore || 0).toFixed(3)})`
        );
      });

      console.log("📊 カテゴリ分布:", categoryCounts);
      console.log("🎯 抽出されたキーフレーズ:", finalResults);

      return ensureMinResults(finalResults, textRankResults.map(stripHtml), 3);
    } catch (aiError) {
      console.error("❌ AI精製処理エラー:", aiError);
      console.log("🔄 AI精製失敗：TextRank結果のみ返却");
      return ensureMinResults(
        textRankResults.map(stripHtml).filter((p) => p.length > 0),
        splitIntoSentences(text).map(stripHtml),
        3
      );
    }
  } catch (error) {
    console.error("❌ TextRank抽出処理で予期せぬエラー:", error);

    // フォールバック処理：簡易的な文抽出
    try {
      console.log("🔄 フォールバック処理を実行中...");
      const fallbackSentences = splitIntoSentences(text).slice(0, 5);
      return ensureMinResults(
        fallbackSentences.map(stripHtml).filter((p) => p.length > 0),
        splitIntoSentences(text).map(stripHtml),
        3
      );
    } catch (fallbackError) {
      console.error("❌ フォールバック処理もエラー:", fallbackError);
      return [];
    }
  }
};

// エクスポート型定義
export type { EnhancedKeyphrase, AIRefinementConfig, TextRankConfig };
