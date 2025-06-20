import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

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

interface SentenceInfo {
  id: number;
  text: string;
  words: string[];
  score: number;
  originalPosition: number;
}

interface EnhancedKeySentence {
  sentence: string;
  score: number;
  confidence: number;
  aiEnhanced: boolean;
  originalSentences?: string[];
  sentenceType?: "summary" | "technical" | "contextual" | "actionable";
  weightedScore?: number;
  wordCount?: number;
}

interface AISentenceConfig {
  maxRetries: number;
  timeoutMs: number;
  maxSentences: number;
  maxSentenceLength: number;
  minSentenceLength: number;
  preserveTechnicalTerms: boolean;
  targetStyle: "concise" | "detailed" | "comprehensive";
  enableAI: boolean;
  enableDeduplication: boolean;
  sentenceTypeWeights: {
    summary: number;
    technical: number;
    contextual: number;
    actionable: number;
  };
  similarityThreshold: number;
}

interface TextRankConfig {
  dampingFactor: number;
  maxIterations: number;
  tolerance: number;
  maxSentences: number;
  minSentenceLength: number;
}

let tokenizer: KuromojiTokenizer | null = null;
let genAI: GoogleGenerativeAI | null = null;

const DEFAULT_CONFIG: TextRankConfig = {
  dampingFactor: 0.85,
  maxIterations: 50,
  tolerance: 0.0001,
  maxSentences: 10,
  minSentenceLength: 10,
};

const DEFAULT_AI_SENTENCE_CONFIG: AISentenceConfig = {
  maxRetries: 3,
  timeoutMs: 10000,
  maxSentences: 5,
  maxSentenceLength: 120, // レベル情報含む文章のため延長
  minSentenceLength: 20,
  preserveTechnicalTerms: true,
  targetStyle: "comprehensive",
  enableAI: true,
  enableDeduplication: true,
  sentenceTypeWeights: {
    summary: 1.4, // 要約型を最重視（レベル情報含む）
    technical: 1.2, // 技術詳細型重視
    contextual: 1.1, // 文脈説明型を重視（レベル・対象者情報のため）
    actionable: 0.6, // 行動誘導型を軽視（ノイズが多いため）
  },
  similarityThreshold: 0.8,
};

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

const detectSentenceType = (
  sentence: string
): "summary" | "technical" | "contextual" | "actionable" => {
  const lowerSentence = sentence.toLowerCase();

  // ノイズとなりやすいキーワード（事務的・準備的内容 + 固有名詞）
  const noiseKeywords = [
    "gmail",
    "zoom",
    "pc",
    "パソコン",
    "インストール",
    "申し込み",
    "案内",
    "用意",
    "準備",
    "ご用意",
    "アカウント",
    "ダウンロード",
    "設定",
    // 大学名・組織名（技術的価値より固有名詞性が強い）
    "早稲田大学",
    "慶應大学",
    "東京大学",
    "大学",
    "学部",
    "研究室",
    "大学院",
    "教授",
    "准教授",
    // その他固有名詞
    "株式会社",
    "有限会社",
    "合同会社",
    "i-mode", // 古い技術で現在の推薦価値が低い
  ];

  for (const keyword of noiseKeywords) {
    if (lowerSentence.includes(keyword)) {
      return "actionable";
    }
  }

  // 講師実績・信頼性を示すキーワード（contextual重視、大学名以外）
  const credibilityKeywords = [
    "創業",
    "起業",
    "設立",
    "開発経験",
    "実績",
    "経験年数",
    "キャリア",
    "ダウンロード",
    "突破",
    "万人",
    "参加者",
    "育成",
    "送り込む",
    "開発現場",
    "現場経験",
    "プロジェクト",
    "チーム",
    "リーダー",
  ];

  // レベル・対象者関連のキーワード（contextual重視）
  const levelKeywords = [
    "初心者",
    "初学者",
    "未経験",
    "経験者",
    "中級者",
    "上級者",
    "初級",
    "中学生",
    "高校生",
    "学生",
    "社会人",
    "シニア",
    "対象者",
    "レベル",
    "基礎知識なし",
    "基礎知識",
    "予備知識",
    "前提知識",
    "スキルレベル",
    "難易度",
    "習熟度",
    "経験年数",
    "年齢",
    "世代",
    "以上",
  ];

  const technicalKeywords = [
    "python",
    "javascript",
    "react",
    "vue",
    "api",
    "データベース",
    "アルゴリズム",
    "フレームワーク",
    "ライブラリ",
    "コード",
    "プログラミング",
    "開発",
    "実装",
    "設計",
    "アーキテクチャ",
    "インフラ",
    "aws",
    "docker",
    "kubernetes",
    "関数",
    "if文",
    "for文",
    "リスト",
    "辞書",
    "変数",
    "配列",
    "オブジェクト",
    "デバッグ",
    "エラー",
    "文法",
    "構文",
    "仕様",
  ];

  const actionableKeywords = [
    "参加",
    "体験",
    "学習",
    "習得",
    "実践",
    "挑戦",
    "取り組み",
    "活用",
    "利用",
    "受講",
    "参加者",
    "手を動かす",
    "一緒に",
    "解説",
    "指導",
    "サポート",
  ];

  const summaryKeywords = [
    "講座",
    "セミナー",
    "ワークショップ",
    "研修",
    "概要",
    "内容",
    "目的",
    "目標",
    "特徴",
    "メリット",
    "効果",
    "結果",
    "成果",
    "方式",
    "メソッド",
    "カリキュラム",
    "テックジム",
    "効率",
    "暗記不要",
    "実績",
    "創業",
    "育成",
  ];

  // レベル・対象者情報を優先的にcontextualで判定
  for (const keyword of levelKeywords) {
    if (lowerSentence.includes(keyword)) return "contextual";
  }

  // 講師実績・信頼性情報もcontextualで判定（大学名は除外済み）
  for (const keyword of credibilityKeywords) {
    if (lowerSentence.includes(keyword)) return "contextual";
  }

  for (const keyword of technicalKeywords) {
    if (lowerSentence.includes(keyword)) return "technical";
  }

  for (const keyword of summaryKeywords) {
    if (lowerSentence.includes(keyword)) return "summary";
  }

  for (const keyword of actionableKeywords) {
    if (lowerSentence.includes(keyword)) return "actionable";
  }

  return "contextual";
};

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

const removeDuplicateSentences = (
  sentences: EnhancedKeySentence[],
  config: AISentenceConfig
): EnhancedKeySentence[] => {
  if (!config.enableDeduplication) {
    return sentences;
  }

  console.log("🔄 キーセンテンス重複排除処理開始...");

  const uniqueSentences: EnhancedKeySentence[] = [];

  for (const sentence of sentences) {
    let isDuplicate = false;

    for (const existing of uniqueSentences) {
      const similarity = calculateTextSimilarity(
        sentence.sentence.toLowerCase(),
        existing.sentence.toLowerCase()
      );

      if (similarity >= config.similarityThreshold) {
        isDuplicate = true;
        console.log(
          `🔍 重複検出: "${sentence.sentence.substring(
            0,
            30
          )}..." ≈ "${existing.sentence.substring(
            0,
            30
          )}..." (類似度: ${similarity.toFixed(3)})`
        );

        if (
          sentence.weightedScore &&
          existing.weightedScore &&
          sentence.weightedScore > existing.weightedScore
        ) {
          const index = uniqueSentences.indexOf(existing);
          uniqueSentences[index] = sentence;
        }
        break;
      }
    }

    if (!isDuplicate) {
      uniqueSentences.push(sentence);
    }
  }

  console.log(
    `✅ 重複排除完了: ${sentences.length} → ${uniqueSentences.length}センテンス`
  );
  return uniqueSentences;
};

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

const splitIntoSentences = (text: string): string[] => {
  let sentences = text
    .replace(/([。！？\.\!\?])/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  sentences = sentences.filter((sentence) => {
    const cleanSentence = sentence.replace(/[。！？\.\!\?\s]/g, "");
    return cleanSentence.length >= DEFAULT_CONFIG.minSentenceLength;
  });

  return sentences;
};

const tokenizeSentence = async (sentence: string): Promise<string[]> => {
  try {
    const _tokenizer = await initializeTokenizer();
    const tokens = _tokenizer.tokenize(sentence);

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
    return sentence
      .replace(/[、。！？\.\!\?,\s]/g, " ")
      .split(" ")
      .filter((word) => word.length > 1)
      .slice(0, 10);
  }
};

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

const runPageRank = (
  similarityMatrix: number[][],
  config: TextRankConfig
): number[] => {
  const n = similarityMatrix.length;
  if (n === 0) return [];

  let scores = new Array(n).fill(1.0);

  for (let iter = 0; iter < config.maxIterations; iter++) {
    const newScores = new Array(n).fill(0);
    let maxChange = 0;

    for (let i = 0; i < n; i++) {
      let sum = 0;
      let totalWeight = 0;

      for (let j = 0; j < n; j++) {
        if (i !== j && similarityMatrix[j][i] > 0) {
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

    if (maxChange < config.tolerance) {
      console.log(`✅ PageRank収束: ${iter + 1}回目の反復で完了`);
      break;
    }
  }

  return scores;
};

const filterNoiseSentences = (
  sentences: EnhancedKeySentence[],
  config: AISentenceConfig
): EnhancedKeySentence[] => {
  console.log("🧹 ノイズセンテンス除外処理開始...");

  const filteredSentences = sentences.filter((sentence) => {
    const lowerText = sentence.sentence.toLowerCase();

    const strongNoiseKeywords = [
      "gmail",
      "zoom",
      "申し込み後",
      "ご案内",
      "インストール",
      "ダウンロード",
      // 大学名・固有名詞の除外
      "早稲田大学",
      "慶應大学",
      "東京大学",
      "大学",
      "i-mode",
      "株式会社",
    ];

    const hasStrongNoise = strongNoiseKeywords.some((keyword) =>
      lowerText.includes(keyword)
    );

    if (hasStrongNoise) {
      console.log(`🗑️ ノイズ除外: "${sentence.sentence.substring(0, 40)}..."`);
      return false;
    }

    if (
      sentence.sentenceType === "actionable" &&
      (sentence.weightedScore || 0) < 0.7
    ) {
      console.log(
        `🗑️ 低価値actionable除外: "${sentence.sentence.substring(0, 40)}..."`
      );
      return false;
    }

    return true;
  });

  console.log(
    `✅ ノイズ除外完了: ${sentences.length} → ${filteredSentences.length}センテンス`
  );
  return filteredSentences;
};

const generateSentenceRefinementPrompt = (
  originalText: string,
  textRankResults: string[],
  config: AISentenceConfig
): string => {
  return `
あなたは日本のIT・技術イベントの専門家です。以下のイベント説明文と、TextRankアルゴリズムで抽出された重要センテンスを分析し、イベント推薦システム向けの「キーセンテンス」を生成してください。

【イベント説明文】
${originalText.substring(0, 2500)}

【TextRank抽出結果】
${textRankResults
  .map((sentence, index) => `${index + 1}. ${sentence}`)
  .join("\n")}

【キーセンテンス生成指示】
1. **完全な文章として出力**（文として自然で理解しやすい）
2. **${config.minSentenceLength}〜${config.maxSentenceLength}文字の範囲内**
3. **技術用語・フレームワーク名を保持**
4. **イベントの核心的価値を表現**
5. **対象レベル・対象者情報を必ず含める**
6. **最大${config.maxSentences}個まで厳選**
7. **以下の4タイプに分類して生成**:
   - summary: イベント全体の要約・特徴（最優先）
   - technical: 技術的な詳細・内容（重要）
   - contextual: 背景・文脈・対象者・レベル情報（重要）
   - actionable: 参加者への行動誘導（最低優先）

【重要な対象レベル・対象者情報の抽出指示】
✅ 以下の情報を積極的に含める：
- 対象レベル（初心者・初学者・未経験・中級者・上級者など）
- 対象年齢・世代（中学生以上・学生・社会人・シニアなど）
- 前提知識・スキルレベル（基礎知識なし・予備知識不要など）
- 難易度・習熟度に関する情報
- 参加条件・推奨レベル

【重要な除外指示】
❌ 以下の事務的・準備的内容は絶対に含めない：
- Gmail、Zoom、PC、インストール等の技術準備要件
- 申し込み手続き、案内、連絡事項
- 単純な持ち物リスト
- アカウント作成、設定手順
- **大学名・学校名（早稲田大学、東京大学等）**
- **古い技術名（i-mode等）**
- **企業の法人格（株式会社、有限会社等）**

✅ 以下の価値ある内容を優先的に抽出：
- 学習内容・技術スキル（対象レベル含む）
- 独自の教育手法・メソッド
- 講師の技術的実績・開発経験（大学名除く）
- 学習効果・成果
- **対象者・レベル情報（特に重要）**

【出力形式】（JSON形式で回答）
{
  "key_sentences": [
    {
      "sentence": "生成されたキーセンテンス（完全な文章・対象レベル情報含む）",
      "type": "summary|technical|contextual|actionable",
      "score": 0.85,
      "original_sentences": ["基になった元の文1", "基になった元の文2"],
      "reason": "このセンテンスを生成した理由（対象レベル情報の重要性含む）"
    }
  ]
}

【重要】
- 各センテンスは独立して理解できる完全な文章にする
- **対象レベル・対象者情報を1つ以上のセンテンスに必ず含める**
- 技術的な内容は具体的に、行動誘導は魅力的に表現する
- 冗長な表現は避け、簡潔で要点を突いた文章にする
- 事務的な内容は一切含めず、イベントの教育的価値に集中する
- **大学名や古い技術名などの固有名詞は除外し、技術的実績のみ記載する**
- **「誰向けのイベントか」が明確に分かるセンテンスを生成する**
`;
};

const generateKeySentencesWithGemini = async (
  originalText: string,
  textRankResults: string[],
  config: AISentenceConfig
): Promise<EnhancedKeySentence[]> => {
  try {
    console.log("🤖 Gemini APIでキーセンテンス生成開始...");

    const genAI = initializeGeminiAPI();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = generateSentenceRefinementPrompt(
      originalText,
      textRankResults,
      config
    );

    const generatePromise = model.generateContent(prompt);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("AI API タイムアウト")),
        config.timeoutMs
      )
    );

    const result = (await Promise.race([
      generatePromise,
      timeoutPromise,
    ])) as any;
    const responseText = result.response.text();

    console.log("📝 Gemini API レスポンス受信");

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSON形式のレスポンスが見つかりません");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    let keySentences: EnhancedKeySentence[] = parsed.key_sentences
      .map((item: any, index: number) => {
        const sentence = item.sentence;
        const sentenceType = item.type as
          | "summary"
          | "technical"
          | "contextual"
          | "actionable";
        const baseScore = item.score || 0.5;
        const typeWeight = config.sentenceTypeWeights[sentenceType] || 1.0;
        const weightedScore = baseScore * typeWeight;

        return {
          sentence,
          score: baseScore,
          confidence: Math.max(0.1, Math.min(1.0, baseScore)),
          aiEnhanced: true,
          originalSentences: item.original_sentences || [],
          sentenceType,
          weightedScore,
          wordCount: sentence.length,
        };
      })
      .filter((item: EnhancedKeySentence) => {
        const length = item.sentence.length;
        return (
          length >= config.minSentenceLength &&
          length <= config.maxSentenceLength
        );
      });

    keySentences = removeDuplicateSentences(keySentences, config);

    keySentences.sort(
      (a, b) => (b.weightedScore || 0) - (a.weightedScore || 0)
    );

    console.log(
      `✅ AIキーセンテンス生成完了: ${keySentences.length}個のセンテンス`
    );
    console.log("🔍 生成結果:");
    keySentences.forEach((s) => {
      console.log(
        `  📋 [${s.sentenceType?.toUpperCase()}] "${s.sentence.substring(
          0,
          40
        )}..." (score: ${s.score.toFixed(3)}, weighted: ${(
          s.weightedScore || 0
        ).toFixed(3)})`
      );
    });

    return keySentences.slice(0, config.maxSentences);
  } catch (error) {
    console.error("❌ Gemini API エラー:", error);
    throw error;
  }
};

const applyAISentenceGeneration = async (
  originalText: string,
  textRankResults: string[],
  config: AISentenceConfig
): Promise<EnhancedKeySentence[]> => {
  let retryCount = 0;

  while (retryCount < config.maxRetries) {
    try {
      let keySentences = await generateKeySentencesWithGemini(
        originalText,
        textRankResults,
        config
      );

      keySentences = filterNoiseSentences(keySentences, config);

      return keySentences;
    } catch (error) {
      retryCount++;
      console.warn(
        `⚠️ AIキーセンテンス生成失敗 (${retryCount}/${config.maxRetries}):`,
        error
      );

      if (retryCount >= config.maxRetries) {
        console.log("🔄 AI生成失敗、TextRank結果にフォールバック");

        let fallbackSentences: EnhancedKeySentence[] = textRankResults
          .map((sentence, index) => {
            const sentenceType = detectSentenceType(sentence);
            const baseScore = Math.max(0.1, 1.0 - index * 0.15);
            const typeWeight = config.sentenceTypeWeights[sentenceType] || 1.0;
            const weightedScore = baseScore * typeWeight;

            return {
              sentence,
              score: baseScore,
              confidence: 0.6,
              aiEnhanced: false,
              sentenceType,
              weightedScore,
              wordCount: sentence.length,
            };
          })
          .filter((item) => {
            const length = item.sentence.length;
            return (
              length >= config.minSentenceLength &&
              length <= config.maxSentenceLength
            );
          });

        fallbackSentences = removeDuplicateSentences(fallbackSentences, config);
        fallbackSentences = filterNoiseSentences(fallbackSentences, config);

        fallbackSentences.sort(
          (a, b) => (b.weightedScore || 0) - (a.weightedScore || 0)
        );

        return fallbackSentences;
      } else {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retryCount) * 1000)
        );
      }
    }
  }

  let finalFallbackSentences: EnhancedKeySentence[] = textRankResults
    .map((sentence, index) => {
      const sentenceType = detectSentenceType(sentence);
      const baseScore = Math.max(0.1, 1.0 - index * 0.15);
      const typeWeight = config.sentenceTypeWeights[sentenceType] || 1.0;
      const weightedScore = baseScore * typeWeight;

      return {
        sentence,
        score: baseScore,
        confidence: 0.6,
        aiEnhanced: false,
        sentenceType,
        weightedScore,
        wordCount: sentence.length,
      };
    })
    .filter((item) => {
      const length = item.sentence.length;
      return (
        length >= config.minSentenceLength && length <= config.maxSentenceLength
      );
    });

  finalFallbackSentences = removeDuplicateSentences(
    finalFallbackSentences,
    config
  );
  finalFallbackSentences = filterNoiseSentences(finalFallbackSentences, config);
  finalFallbackSentences.sort(
    (a, b) => (b.weightedScore || 0) - (a.weightedScore || 0)
  );

  return finalFallbackSentences;
};

export const textrankKeySentenceExtractor = async (
  text: string,
  aiConfig: Partial<AISentenceConfig> = {}
): Promise<string[]> => {
  const startTime = Date.now();

  try {
    console.log("\n🎯 TextRank + AI キーセンテンス抽出開始");

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.log("⚠️ 入力テキストが無効です。");
      return [];
    }

    const finalAIConfig: AISentenceConfig = {
      ...DEFAULT_AI_SENTENCE_CONFIG,
      ...aiConfig,
    };

    const rawSentences = splitIntoSentences(text);

    if (rawSentences.length < 2) {
      console.log("⚠️ 分析に十分な文がありません。");
      return rawSentences.slice(0, finalAIConfig.maxSentences);
    }

    console.log(`📊 ${rawSentences.length}文を分析します...`);

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
      return sentences.map((s) => s.text).slice(0, finalAIConfig.maxSentences);
    }

    const similarityMatrix = buildSimilarityMatrix(sentences);

    const scores = runPageRank(similarityMatrix, DEFAULT_CONFIG);

    sentences.forEach((sentence, index) => {
      sentence.score = scores[index] || 0;
    });

    const rankedSentences = sentences
      .sort((a, b) => b.score - a.score)
      .slice(
        0,
        Math.min(DEFAULT_CONFIG.maxSentences, Math.ceil(sentences.length * 0.5))
      );

    const textRankResults = rankedSentences
      .sort((a, b) => a.originalPosition - b.originalPosition)
      .map((s) => s.text);

    console.log(`🏆 TextRank抽出完了: ${textRankResults.length}文を抽出`);
    console.log("📋 TextRank結果（トップ3）:");
    textRankResults.slice(0, 3).forEach((sentence, index) => {
      console.log(`  ${index + 1}. ${sentence.substring(0, 60)}...`);
    });

    if (!finalAIConfig.enableAI) {
      console.log("🔄 AI生成無効化：TextRank結果のみ返却");
      return textRankResults;
    }

    try {
      const enhancedResults = await applyAISentenceGeneration(
        text,
        textRankResults,
        finalAIConfig
      );

      const finalResults = enhancedResults.map((result) => result.sentence);

      const processingTime = Date.now() - startTime;
      console.log(
        `✅ TextRank + AI キーセンテンス生成完了 (${processingTime}ms): ${finalResults.length}個のセンテンス`
      );
      console.log("🎯 最終結果（タイプ別分析）:");

      const typeCounts = {
        summary: 0,
        technical: 0,
        contextual: 0,
        actionable: 0,
      };
      enhancedResults.forEach((result) => {
        const type = result.sentenceType || "contextual";
        typeCounts[type]++;
        console.log(
          `  🏷️ [${type.toUpperCase()}] "${result.sentence.substring(
            0,
            50
          )}..." (重み付きスコア: ${(result.weightedScore || 0).toFixed(3)})`
        );
      });

      console.log("📊 タイプ分布:", typeCounts);
      console.log("🎯 生成されたキーセンテンス:");
      finalResults.forEach((sentence, index) => {
        console.log(`  ${index + 1}. ${sentence}`);
      });

      return finalResults;
    } catch (aiError) {
      console.error("❌ AIキーセンテンス生成処理エラー:", aiError);
      console.log("🔄 AI生成失敗：TextRank結果のみ返却");
      return textRankResults;
    }
  } catch (error) {
    console.error("❌ キーセンテンス抽出処理で予期せぬエラー:", error);

    try {
      console.log("🔄 フォールバック処理を実行中...");
      const fallbackSentences = splitIntoSentences(text).slice(0, 5);
      return fallbackSentences;
    } catch (fallbackError) {
      console.error("❌ フォールバック処理もエラー:", fallbackError);
      return [];
    }
  }
};

export type { EnhancedKeySentence, AISentenceConfig, TextRankConfig };
