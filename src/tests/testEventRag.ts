import { hydeEventsForUser } from '../utils/eventRag';
import { fetchAndConvertConnpassEvents } from '../utils/connpassEventUtils';
import { getAllEvents } from '../utils/eventUtils';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

// テスト用のユーザープロファイル
const testUser = {
  place: '東京',
  stack: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
  tag: ['フロントエンド', 'バックエンド', 'AI', '機械学習'],
  level: '中級者',
  goal: ['スキルアップ', 'キャリアアップ', 'ネットワーキング']
};

// RAGシステムのテスト
async function testRagSystem() {
  console.log('===== RAGシステムのテスト開始 =====');
  
  try {
    // 1. DBからイベントを取得
    console.log('1. DBからイベントを取得中...');
    const dbEvents = await getAllEvents();
    console.log(`DBから${dbEvents.length}件のイベントを取得しました`);
    
    // 2. Connpass APIからイベントを取得
    console.log('2. Connpass APIからイベントを取得中...');
    const connpassEvents = await fetchAndConvertConnpassEvents({
      place: testUser.place
    }, 14);
    console.log(`Connpass APIから${connpassEvents.length}件のイベントを取得しました`);
    
    // 3. DBイベントのみでテスト
    console.log('\n3. DBイベントのみでテスト');
    const dbRecommendations = await hydeEventsForUser(testUser, dbEvents);
    console.log(`DBイベントからの推薦結果: ${dbRecommendations.length}件`);
    console.log('推薦イベントID:', dbRecommendations);
    
    // 4. Connpassイベントのみでテスト
    console.log('\n4. Connpassイベントのみでテスト');
    const connpassRecommendations = await hydeEventsForUser(testUser, connpassEvents);
    console.log(`Connpassイベントからの推薦結果: ${connpassRecommendations.length}件`);
    console.log('推薦イベントID:', connpassRecommendations);
    
    // 5. 両方のイベントを組み合わせてテスト
    console.log('\n5. DBイベントとConnpassイベントを組み合わせてテスト');
    const combinedEvents = [...dbEvents, ...connpassEvents];
    console.log(`合計${combinedEvents.length}件のイベントでテスト`);
    
    const combinedRecommendations = await hydeEventsForUser(testUser, combinedEvents);
    console.log(`組み合わせイベントからの推薦結果: ${combinedRecommendations.length}件`);
    console.log('推薦イベントID:', combinedRecommendations);
    
    // 6. 推薦されたイベントの詳細を表示
    console.log('\n6. 推薦されたイベントの詳細');
    const recommendedEvents = combinedEvents.filter(event => 
      combinedRecommendations.includes(event.id)
    );
    
    recommendedEvents.forEach((event, index) => {
      console.log(`\n推薦イベント ${index + 1}:`);
      console.log(`ID: ${event.id}`);
      console.log(`タイトル: ${event.title}`);
      console.log(`開催地: ${event.venue || ''} ${event.address ? `(${event.address})` : ''}`);
      console.log(`開催日: ${event.eventDate instanceof Date ? event.eventDate.toISOString().split('T')[0] : event.eventDate}`);
      console.log(`詳細URL: ${event.detailUrl || ''}`);
    });
    
    console.log('\n===== RAGシステムのテスト完了 =====');
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
  }
}

// テストの実行
testRagSystem();
