import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

// 基本インターフェース
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

interface WordInfo {
  id: number;
  word: string;
  score: number;
  frequency: number;
  positions: number[];
  pos: string;
  originalForm: string;
}

interface EnhancedKeyword {
  keyword: string;
  score: number;
  confidence: number;
  aiEnhanced: boolean;
  frequency?: number;
  category?:
    | "technology"
    | "skill"
    | "concept"
    | "location"
    | "level"
    | "other";
  weightedScore?: number;
  originalWord?: string;
}

interface AIKeywordConfig {
  maxRetries: number;
  timeoutMs: number;
  maxKeywords: number;
  maxKeywordLength: number;
  minKeywordLength: number;
  preserveTechnicalTerms: boolean;
  targetStyle: "precise" | "comprehensive";
  enableAI: boolean;
  enableDeduplication: boolean;
  categoryWeights: {
    technology: number;
    skill: number;
    concept: number;
    location: number;
    level: number;
    other: number;
  };
  similarityThreshold: number;
}

interface TextRankConfig {
  dampingFactor: number;
  maxIterations: number;
  tolerance: number;
  maxWords: number;
  minWordLength: number;
}

// グローバル変数
let tokenizer: KuromojiTokenizer | null = null;
let genAI: GoogleGenerativeAI | null = null;

// デフォルト設定
const DEFAULT_CONFIG: TextRankConfig = {
  dampingFactor: 0.85,
  maxIterations: 50,
  tolerance: 0.0001,
  maxWords: 50,
  minWordLength: 2,
};

const DEFAULT_AI_KEYWORD_CONFIG: AIKeywordConfig = {
  maxRetries: 3,
  timeoutMs: 8000,
  maxKeywords: 10, // キーワードは多めに抽出
  maxKeywordLength: 15, // 単語レベルなので短め
  minKeywordLength: 2,
  preserveTechnicalTerms: true,
  targetStyle: "precise",
  enableAI: true,
  enableDeduplication: true,
  categoryWeights: {
    location: 1.5, // 開催地情報を最重視
    technology: 1.8, // 技術要素を大幅に重視（具体的な技術名）
    concept: 1.3, // 概念・手法を重視
    skill: 1.0, // スキル要素標準
    level: 1.1, // レベル・対象者情報重視
    other: 0.2, // ノイズカテゴリはさらに軽視
  },
  similarityThreshold: 0.8, // 単語レベルなので厳格に
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
 * キーワードのカテゴリ自動検出
 */
const detectKeywordCategory = (
  keyword: string
): "technology" | "skill" | "concept" | "location" | "level" | "other" => {
  const lowerKeyword = keyword.toLowerCase();

  // ノイズとなりやすいキーワード
  const noiseKeywords = [
    "gmail",
    "zoom",
    "pc",
    "vscode",
    "chrome",
    "safari",
    "インストール",
    "ダウンロード",
    "申し込み",
    "案内",
    "準備",
    "株式会社",
    "有限会社",
    "i-mode",
    "アカウント",
    // 基礎的なプログラミング構文（細かすぎるため除外）
    "関数",
    "function",
    "if文",
    "for文",
    "while文",
    "リスト",
    "list",
    "辞書",
    "dict",
    "クラス",
    "class",
    "オブジェクト",
    "object",
    "変数",
    "配列",
    "array",
    "ループ",
    "条件分岐",
    "メソッド",
    "インスタンス",
    // 一般的な学習用語（曖昧すぎるため除外、ただし技術的な「機械学習」等は除外しない）
    "学習法",
    "学習方法",
    "効率学習",
    "実践学習",
    "効率的学習",
    "効率的",
    "効率",
    "実践",
    "体験",
    "基礎",
    "入門",
    "習得",
  ];

  for (const noise of noiseKeywords) {
    if (lowerKeyword.includes(noise)) return "other";
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
  ];

  for (const location of locationKeywords) {
    if (lowerKeyword.includes(location)) return "location";
  }

  // レベル・対象者キーワード
  const levelKeywords = [
    "初心者",
    "初学者",
    "未経験",
    "中級者",
    "上級者",
    "入門",
    "基礎",
    "応用",
    "中学生",
    "高校生",
    "学生",
    "社会人",
    "シニア",
    "レベル",
    "難易度",
    "対象者",
    "前提知識",
  ];

  for (const level of levelKeywords) {
    if (lowerKeyword.includes(level)) return "level";
  }

  // 技術要素のキーワード（具体的な技術名を優先）
  const technologyKeywords = [
    // AI・ChatGPT関連（最高優先）
    "chatgpt",
    "gpt",
    "openai",
    "gemini",
    "claude",
    "ai",
    "人工知能",
    "機械学習",
    "深層学習",
    "ディープラーニング",
    "ml",
    "dl",
    "llm",
    "チャットgpt",
    "チャット",
    "生成ai",
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
    "パイソン",
    // フレームワーク・ライブラリ
    "react",
    "vue",
    "angular",
    "svelte",
    "nextjs",
    "nuxtjs",
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
    // API・プロトコル
    "api",
    "rest",
    "graphql",
    "websocket",
    "grpc",
    "json",
    "http",
    // 高レベル概念（保持）
    "アルゴリズム",
    "データ構造",
  ];

  for (const tech of technologyKeywords) {
    if (lowerKeyword.includes(tech)) return "technology";
  }

  // スキル要素のキーワード（具体的で技術的なスキルのみ）
  const skillKeywords = [
    "解説",
    "解決",
    "デバッグ",
    "エラー解決",
    "コード",
    "コーディング",
    "開発",
    "実装",
    "設計",
    "共有",
    "最適化",
    "テスト",
    "レビュー",
    "リファクタリング",
  ];

  for (const skill of skillKeywords) {
    if (lowerKeyword.includes(skill)) return "skill";
  }

  // 概念・手法のキーワード
  const conceptKeywords = [
    "テックジム",
    "プログラミング",
    "アジャイル",
    "スクラム",
    "ペアプログラミング",
    "チーム開発",
    "リファクタリング",
    "アーキテクチャ",
    "フレームワーク",
    "ライブラリ",
    "メソッド",
  ];

  for (const concept of conceptKeywords) {
    if (lowerKeyword.includes(concept)) return "concept";
  }

  return "other";
};

/**
 * 文字列類似度計算
 */
const calculateTextSimilarity = (str1: string, str2: string): number => {
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 || len2 === 0) return 0;

  const maxLen = Math.max(len1, len2);
  const distance = levenshteinDistance(str1, str2);

  return 1 - distance / maxLen;
};

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
 * 重複排除機能
 */
const removeDuplicateKeywords = (
  keywords: EnhancedKeyword[],
  config: AIKeywordConfig
): EnhancedKeyword[] => {
  if (!config.enableDeduplication) {
    return keywords;
  }

  console.log("🔄 キーワード重複排除処理開始...");

  const uniqueKeywords: EnhancedKeyword[] = [];

  for (const keyword of keywords) {
    let isDuplicate = false;

    for (const existing of uniqueKeywords) {
      const similarity = calculateTextSimilarity(
        keyword.keyword.toLowerCase(),
        existing.keyword.toLowerCase()
      );

      if (similarity >= config.similarityThreshold) {
        isDuplicate = true;
        console.log(
          `🔍 重複検出: "${keyword.keyword}" ≈ "${
            existing.keyword
          }" (類似度: ${similarity.toFixed(3)})`
        );

        if (
          keyword.weightedScore &&
          existing.weightedScore &&
          keyword.weightedScore > existing.weightedScore
        ) {
          const index = uniqueKeywords.indexOf(existing);
          uniqueKeywords[index] = keyword;
        }
        break;
      }
    }

    if (!isDuplicate) {
      uniqueKeywords.push(keyword);
    }
  }

  console.log(
    `✅ 重複排除完了: ${keywords.length} → ${uniqueKeywords.length}キーワード`
  );
  return uniqueKeywords;
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
 * テキストから単語を抽出・分析
 */
const extractWords = async (text: string): Promise<WordInfo[]> => {
  try {
    const _tokenizer = await initializeTokenizer();
    const tokens = _tokenizer.tokenize(text);

    const wordMap = new Map<string, WordInfo>();
    let position = 0;

    tokens.forEach((token) => {
      const word = token.basic_form || token.surface_form;
      const pos = token.pos;
      const detail1 = token.pos_detail_1;

      // 有用な品詞のみを抽出
      const isValidWord =
        ((pos === "名詞" &&
          !["接続詞的", "数", "非自立", "代名詞"].includes(detail1)) ||
          (pos === "動詞" && detail1 !== "非自立") ||
          (pos === "形容詞" && detail1 !== "非自立") ||
          pos === "記号") && // 技術用語に含まれる記号も考慮
        word.length >= DEFAULT_CONFIG.minWordLength;

      if (isValidWord) {
        const normalizedWord = word.toLowerCase();

        if (wordMap.has(normalizedWord)) {
          const existingWord = wordMap.get(normalizedWord)!;
          existingWord.frequency++;
          existingWord.positions.push(position);
        } else {
          wordMap.set(normalizedWord, {
            id: wordMap.size,
            word: normalizedWord,
            score: 0,
            frequency: 1,
            positions: [position],
            pos: pos,
            originalForm: word,
          });
        }
      }

      position++;
    });

    return Array.from(wordMap.values());
  } catch (error) {
    console.error("❌ 単語抽出エラー:", error);
    return [];
  }
};

/**
 * 単語間共起関係の計算
 */
const buildWordCooccurrenceMatrix = (
  words: WordInfo[],
  windowSize: number = 5
): number[][] => {
  const n = words.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const wordA = words[i];
        const wordB = words[j];

        // 共起回数を計算
        let cooccurrences = 0;
        for (const posA of wordA.positions) {
          for (const posB of wordB.positions) {
            if (Math.abs(posA - posB) <= windowSize) {
              cooccurrences++;
            }
          }
        }

        matrix[i][j] = cooccurrences;
      }
    }
  }

  return matrix;
};

/**
 * PageRankアルゴリズムを実行
 */
const runPageRank = (
  cooccurrenceMatrix: number[][],
  config: TextRankConfig
): number[] => {
  const n = cooccurrenceMatrix.length;
  if (n === 0) return [];

  let scores = new Array(n).fill(1.0);

  for (let iter = 0; iter < config.maxIterations; iter++) {
    const newScores = new Array(n).fill(0);
    let maxChange = 0;

    for (let i = 0; i < n; i++) {
      let sum = 0;

      for (let j = 0; j < n; j++) {
        if (i !== j && cooccurrenceMatrix[j][i] > 0) {
          let outgoingWeights = 0;
          for (let k = 0; k < n; k++) {
            if (j !== k) {
              outgoingWeights += cooccurrenceMatrix[j][k];
            }
          }

          if (outgoingWeights > 0) {
            sum += (cooccurrenceMatrix[j][i] / outgoingWeights) * scores[j];
          }
        }
      }

      newScores[i] = 1 - config.dampingFactor + config.dampingFactor * sum;
      maxChange = Math.max(maxChange, Math.abs(newScores[i] - scores[i]));
    }

    scores = newScores;

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
const generateKeywordRefinementPrompt = (
  originalText: string,
  textRankResults: string[],
  config: AIKeywordConfig
): string => {
  return `
あなたは日本のIT・技術イベントの専門家です。以下のイベント説明文と、TextRankアルゴリズムで抽出された重要キーワードを分析し、イベント推薦システム向けの「重要キーワード」を精製してください。

【イベント説明文】
${originalText.substring(0, 2000)}

【TextRank抽出結果】
${textRankResults
  .map((keyword, index) => `${index + 1}. ${keyword}`)
  .join("\n")}

 【キーワード精製指示】
 1. **このイベントで実際に学習・使用する技術のみを抽出**（例示は除外）
 2. **${config.minKeywordLength}〜${config.maxKeywordLength}文字の範囲内**
 3. **高レベルな技術概念を最優先**（ChatGPT、Python、フレームワーク名など）
 4. **基礎的なプログラミング構文は除外**（if文、for文、関数、変数等は詳細すぎるため対象外）
 5. **一般的な学習用語は除外**（学習、習得、効率学習、実践学習等は曖昧すぎるため対象外）
 6. **イベント内容に直接関連する技術・スキルのみ**
 7. **必ず${config.maxKeywords}個のキーワードを生成**
 8. **以下のカテゴリに分類**:
    - technology: プログラミング言語、AI技術、具体的ツール名
    - concept: 学習手法、プログラミング概念
    - skill: 実践的スキル、能力
    - location: 開催地、都市名、地域名
    - level: 対象レベル、難易度
    - other: その他

【重要な除外指示】
❌ 以下は絶対に含めない：
- 開発ツール名（VSCode、Zoom、Gmail等）
- 準備要件（PC、インストール、アカウント等）
- 事務的単語（申し込み、案内、準備等）
- 大学名・組織名（早稲田大学、株式会社等）
- 古い技術名（i-mode等）
- 基礎的なプログラミング構文（if文、for文、while文、関数、変数、リスト、辞書等）
- 一般的な学習用語（学習、習得、効率学習、実践学習、基礎、入門、初心者等）

 ✅ 以下を積極的に抽出：
 - **開催地情報（東京、大阪、渋谷等）** ← 最重要
 - **このイベントで実際に扱う技術**：
   * AI技術（ChatGPT、GPT等）
   * プログラミング言語（Python、JavaScript等）
   * フレームワーク・ライブラリ（実際に使用するもの）
   * 高レベル概念（アルゴリズム、データ構造等）
 - **具体的な学習内容**：
   * 実践的手法（デバッグ、エラー解決等）
   * 学習アプローチ（テックジム、実践学習等）
 - **対象レベル**（初心者、未経験、中級者等）
 
 【重要】文中で「例えば〜」「たとえば〜」「など」で紹介される技術は、実際にイベントで扱われない限り抽出しない

【出力形式】（JSON形式で回答）
{
  "keywords": [
    {
      "keyword": "精製後のキーワード",
      "category": "technology|concept|skill|location|level|other",
      "score": 0.85,
      "reason": "抽出理由"
    }
  ]
}
`;
};

/**
 * Gemini APIでキーワードを精製
 */
const refineKeywordsWithGemini = async (
  originalText: string,
  textRankResults: string[],
  config: AIKeywordConfig
): Promise<EnhancedKeyword[]> => {
  try {
    console.log("🤖 Gemini APIでキーワード精製開始...");

    const genAI = initializeGeminiAPI();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = generateKeywordRefinementPrompt(
      originalText,
      textRankResults,
      config
    );

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

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSON形式のレスポンスが見つかりません");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const keywords: EnhancedKeyword[] = parsed.keywords
      .map((item: any) => {
        const keyword = item.keyword;
        const category = item.category as
          | "technology"
          | "skill"
          | "concept"
          | "location"
          | "level"
          | "other";
        const baseScore = item.score || 0.5;
        const typeWeight = config.categoryWeights[category] || 1.0;
        const weightedScore = baseScore * typeWeight;

        return {
          keyword,
          score: baseScore,
          confidence: Math.max(0.1, Math.min(1.0, baseScore)),
          aiEnhanced: true,
          category,
          weightedScore,
        };
      })
      .filter((item: EnhancedKeyword) => {
        const length = item.keyword.length;
        return (
          length >= config.minKeywordLength && length <= config.maxKeywordLength
        );
      });

    console.log(`✅ AI精製完了: ${keywords.length}個のキーワード`);
    console.log("🔍 精製結果:");
    keywords.forEach((k) => {
      console.log(
        `  📋 "${k.keyword}" (${k.category}, score: ${k.score.toFixed(
          3
        )}, weighted: ${(k.weightedScore || 0).toFixed(3)})`
      );
    });

    return keywords;
  } catch (error) {
    console.error("❌ Gemini API エラー:", error);
    throw error;
  }
};

/**
 * AI精製処理のメイン関数
 */
const applyAIKeywordRefinement = async (
  originalText: string,
  textRankResults: string[],
  config: AIKeywordConfig
): Promise<EnhancedKeyword[]> => {
  let retryCount = 0;

  while (retryCount < config.maxRetries) {
    try {
      let keywords = await refineKeywordsWithGemini(
        originalText,
        textRankResults,
        config
      );

      keywords = removeDuplicateKeywords(keywords, config);

      // スコアでソート
      keywords.sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0));

      return keywords.slice(0, config.maxKeywords);
    } catch (error) {
      retryCount++;
      console.warn(
        `⚠️ AIキーワード精製失敗 (${retryCount}/${config.maxRetries}):`,
        error
      );

      if (retryCount >= config.maxRetries) {
        console.log("🔄 AI精製失敗、TextRank結果にフォールバック");

        const fallbackKeywords: EnhancedKeyword[] = textRankResults
          .map((keyword, index) => {
            const category = detectKeywordCategory(keyword);
            const baseScore = Math.max(0.1, 1.0 - index * 0.1);
            const typeWeight = config.categoryWeights[category] || 1.0;
            const weightedScore = baseScore * typeWeight;

            return {
              keyword,
              score: baseScore,
              confidence: 0.6,
              aiEnhanced: false,
              category,
              weightedScore,
            };
          })
          .filter((item) => {
            const length = item.keyword.length;
            return (
              length >= config.minKeywordLength &&
              length <= config.maxKeywordLength
            );
          });

        return fallbackKeywords
          .sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0))
          .slice(0, config.maxKeywords);
      } else {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retryCount) * 1000)
        );
      }
    }
  }

  return [];
};

/**
 * メイン関数：重要キーワード抽出
 */
export const textrankKeywordExtractor = async (
  text: string,
  aiConfig: Partial<AIKeywordConfig> = {}
): Promise<string[]> => {
  const startTime = Date.now();

  try {
    console.log("\n🎯 TextRank + AI 重要キーワード抽出開始");

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.log("⚠️ 入力テキストが無効です。");
      return [];
    }

    const finalAIConfig: AIKeywordConfig = {
      ...DEFAULT_AI_KEYWORD_CONFIG,
      ...aiConfig,
    };

    // 単語を抽出・分析
    const words = await extractWords(text);

    if (words.length < 2) {
      console.log("⚠️ 分析に十分な単語がありません。");
      return [];
    }

    console.log(`📊 ${words.length}個の単語を分析します...`);

    // 共起関係の行列を構築
    const cooccurrenceMatrix = buildWordCooccurrenceMatrix(words);

    // PageRankを実行
    const scores = runPageRank(cooccurrenceMatrix, DEFAULT_CONFIG);

    // スコアを単語情報に設定
    words.forEach((word, index) => {
      word.score = scores[index] || 0;
    });

    // 頻度とスコアを組み合わせてランキング
    const rankedWords = words
      .map((word) => ({
        ...word,
        combinedScore: word.score * Math.log(word.frequency + 1), // 頻度の対数を掛ける
      }))
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, Math.min(DEFAULT_CONFIG.maxWords, words.length));

    const textRankResults = rankedWords.map((w) => w.originalForm || w.word);

    console.log(`🏆 TextRank抽出完了: ${textRankResults.length}個のキーワード`);
    console.log("📋 TextRank結果（トップ10）:");
    textRankResults.slice(0, 10).forEach((keyword, index) => {
      console.log(`  ${index + 1}. ${keyword}`);
    });

    if (!finalAIConfig.enableAI) {
      console.log("🔄 AI精製無効化：TextRank結果のみ返却");
      return textRankResults.slice(0, finalAIConfig.maxKeywords);
    }

    try {
      const enhancedResults = await applyAIKeywordRefinement(
        text,
        textRankResults,
        finalAIConfig
      );

      const finalResults = enhancedResults.map((result) => result.keyword);

      const processingTime = Date.now() - startTime;
      console.log(
        `✅ TextRank + AI キーワード抽出完了 (${processingTime}ms): ${finalResults.length}個のキーワード`
      );
      console.log("🎯 最終結果（カテゴリ別分析）:");

      const categoryCounts = {
        technology: 0,
        skill: 0,
        concept: 0,
        location: 0,
        level: 0,
        other: 0,
      };
      enhancedResults.forEach((result) => {
        const category = result.category || "other";
        categoryCounts[category]++;
        console.log(
          `  🏷️ [${category.toUpperCase()}] "${
            result.keyword
          }" (重み付きスコア: ${(result.weightedScore || 0).toFixed(3)})`
        );
      });

      console.log("📊 カテゴリ分布:", categoryCounts);
      console.log("🎯 抽出されたキーワード:", finalResults);

      return finalResults;
    } catch (aiError) {
      console.error("❌ AIキーワード精製処理エラー:", aiError);
      console.log("🔄 AI精製失敗：TextRank結果のみ返却");
      return textRankResults.slice(0, finalAIConfig.maxKeywords);
    }
  } catch (error) {
    console.error("❌ キーワード抽出処理で予期せぬエラー:", error);
    return [];
  }
};

export type { EnhancedKeyword, AIKeywordConfig, TextRankConfig };
