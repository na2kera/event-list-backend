import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../src/config/prisma";

// Gemini API初期化
const initializeGeminiAPI = (): GoogleGenerativeAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY環境変数が設定されていません");
  }
  return new GoogleGenerativeAI(apiKey);
};

// 場所情報抽出のプロンプト生成
const generateLocationExtractionPrompt = (
  title: string,
  description: string,
  venue: string,
  address?: string
): string => {
  return `
あなたは日本のIT・技術イベントの専門家です。以下のイベント情報から、具体的な場所・地域情報を抽出してください。

【イベント情報】
タイトル: ${title}
会場: ${venue}
住所: ${address || "不明"}
詳細: ${description?.substring(0, 1000) || "詳細なし"}

【抽出指示】
1. 都道府県名（例：東京都、大阪府、神奈川県）
2. 市区町村名（例：渋谷区、新宿区、大阪市）
3. 主要エリア名（例：渋谷、新宿、梅田、天神）
4. オンライン開催の場合は「オンライン」
5. 場所が不明確な場合は「不明」

【出力形式】（JSON形式で回答）
{
  "location": "抽出された場所情報",
  "prefecture": "都道府県名",
  "city": "市区町村名", 
  "area": "エリア名",
  "confidence": 0.8,
  "is_online": false,
  "reasoning": "抽出理由の説明"
}

【注意事項】
- 場所情報は簡潔に（20文字以内）
- オンライン開催かどうかを必ず判定
- 不明確な場合は正直に「不明」と回答
- 日本の地名に限定
`;
};

// Gemini APIで場所情報を抽出
const extractLocationWithGemini = async (
  title: string,
  description: string,
  venue: string,
  address?: string
): Promise<{
  location: string;
  prefecture?: string;
  city?: string;
  area?: string;
  confidence: number;
  is_online: boolean;
  reasoning: string;
} | null> => {
  try {
    console.log(`📍 場所抽出中: ${title.substring(0, 50)}...`);

    const genAI = initializeGeminiAPI();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = generateLocationExtractionPrompt(title, description, venue, address);

    // タイムアウト制御付きAPI呼び出し
    const enhancePromise = model.generateContent(prompt);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("API タイムアウト")), 8000)
    );

    const result = await Promise.race([enhancePromise, timeoutPromise]) as any;
    const responseText = result.response.text();

    // JSON解析
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("⚠️ JSON形式のレスポンスが見つかりません");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    console.log(`✅ 場所抽出成功: ${parsed.location} (信頼度: ${parsed.confidence})`);
    
    return {
      location: parsed.location || "不明",
      prefecture: parsed.prefecture,
      city: parsed.city,
      area: parsed.area,
      confidence: parsed.confidence || 0.5,
      is_online: parsed.is_online || false,
      reasoning: parsed.reasoning || ""
    };

  } catch (error) {
    console.error("❌ Gemini API エラー:", error);
    return null;
  }
};

// locationが空またはnullのイベントを取得
const getEventsWithoutLocation = async (limit: number = 50) => {
  return await prisma.event.findMany({
    where: {
      OR: [
        { location: null },
        { location: "" },
        { location: "今から" }, // ユーザーが言及した問題のあるデータ
      ]
    },
    select: {
      id: true,
      title: true,
      description: true,
      venue: true,
      address: true,
      location: true,
      eventDate: true,
    },
    orderBy: {
      eventDate: 'desc'
    },
    take: limit
  });
};

// イベントのlocationフィールドを更新
const updateEventLocation = async (
  eventId: string,
  locationData: {
    location: string;
    prefecture?: string;
    city?: string;
    area?: string;
    confidence: number;
    is_online: boolean;
    reasoning: string;
  }
) => {
  await prisma.event.update({
    where: { id: eventId },
    data: { location: locationData.location }
  });
  
  console.log(`💾 更新完了: ${eventId} -> ${locationData.location}`);
};

// メイン処理
const main = async () => {
  try {
    console.log("🚀 イベント場所情報更新スクリプト開始");
    
    // locationが空のイベントを取得
    const events = await getEventsWithoutLocation();
    console.log(`📊 更新対象イベント数: ${events.length}件`);
    
    if (events.length === 0) {
      console.log("✅ 更新対象のイベントはありません");
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    
    // 各イベントを順次処理（レート制限を考慮）
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      console.log(`\n[${i + 1}/${events.length}] 処理中: ${event.title}`);
      
      try {
        // Gemini APIで場所情報を抽出
        const locationData = await extractLocationWithGemini(
          event.title,
          event.description || "",
          event.venue,
          event.address || undefined
        );
        
        if (locationData && locationData.confidence > 0.3) {
          // 信頼度が十分高い場合のみ更新
          await updateEventLocation(event.id, locationData);
          successCount++;
        } else {
          console.log(`⚠️ スキップ: 信頼度が低いまたは抽出失敗`);
          errorCount++;
        }
        
        // レート制限対策で少し待機
        if (i < events.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ エラー: ${event.id}`, error);
        errorCount++;
      }
    }
    
    console.log("\n🏆 処理完了");
    console.log(`✅ 成功: ${successCount}件`);
    console.log(`❌ エラー: ${errorCount}件`);
    
  } catch (error) {
    console.error("❌ メイン処理エラー:", error);
  } finally {
    await prisma.$disconnect();
  }
};

// dry-run モード（実際には更新しない）
const dryRun = async () => {
  try {
    console.log("🔍 DRY RUN モード: 実際の更新は行いません");
    
    const events = await getEventsWithoutLocation(10); // 少数でテスト
    console.log(`📊 テスト対象イベント数: ${events.length}件`);
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      console.log(`\n[${i + 1}/${events.length}] テスト中: ${event.title}`);
      
      const locationData = await extractLocationWithGemini(
        event.title,
        event.description || "",
        event.venue,
        event.address || undefined
      );
      
      if (locationData) {
        console.log(`📍 抽出結果: ${locationData.location}`);
        console.log(`🎯 信頼度: ${locationData.confidence}`);
        console.log(`📝 理由: ${locationData.reasoning}`);
      } else {
        console.log(`❌ 抽出失敗`);
      }
      
      // レート制限対策
      if (i < events.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
  } catch (error) {
    console.error("❌ DRY RUN エラー:", error);
  } finally {
    await prisma.$disconnect();
  }
};

// コマンドライン引数で実行モードを制御
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

if (isDryRun) {
  dryRun();
} else {
  main();
}