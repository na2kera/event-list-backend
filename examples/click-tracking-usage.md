# クリックログAPI使用例

## API エンドポイント概要

### 1. クリックログの作成
```bash
POST /api/click-logs
Content-Type: application/json

{
  "userId": "user123",
  "sessionId": "session456",
  "elementType": "button",
  "elementId": "submit-btn",
  "elementClass": "btn btn-primary",
  "elementText": "送信",
  "pageUrl": "https://example.com/events",
  "pagePath": "/events",
  "coordinateX": 150,
  "coordinateY": 200,
  "eventId": "event123",
  "metadata": {
    "section": "header",
    "action": "submit"
  }
}
```

### 2. クリックログの取得
```bash
GET /api/click-logs?userId=user123&limit=10&offset=0

# フィルター例
GET /api/click-logs?pageUrl=events&elementType=button&startDate=2024-01-01

# レスポンス
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "limit": 10,
    "offset": 0,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 3. クリック統計の取得
```bash
GET /api/click-logs/stats?startDate=2024-01-01&endDate=2024-01-31

# レスポンス
{
  "success": true,
  "data": {
    "totalClicks": 1500,
    "uniqueUsers": 250,
    "uniqueSessions": 380,
    "topPages": [
      { "pageUrl": "https://example.com/events", "count": 500 },
      { "pageUrl": "https://example.com/", "count": 300 }
    ],
    "topElements": [
      { "elementType": "button", "elementText": "送信", "count": 200 },
      { "elementType": "a", "elementText": "詳細を見る", "count": 150 }
    ]
  }
}
```

## フロントエンド実装例

### React での使用例
```typescript
import React, { useEffect } from 'react';
import { initializeAutoClickTracking, generateSessionId } from '../utils/clickTracker';

const App: React.FC = () => {
  useEffect(() => {
    // セッションIDを生成
    const sessionId = generateSessionId();
    
    // 自動クリック追跡を初期化
    const tracker = initializeAutoClickTracking({
      apiEndpoint: `${process.env.REACT_APP_API_URL}/api/click-logs`,
      userId: getCurrentUserId(), // ユーザーIDを取得する関数
      sessionId,
      enableConsoleLog: process.env.NODE_ENV === 'development',
      batchSize: 5,
      flushInterval: 3000,
    });

    // クリーンアップ
    return () => {
      tracker.destroy();
    };
  }, []);

  const handleSpecialClick = (event: React.MouseEvent) => {
    // 特別なクリックイベントの追跡
    tracker.trackClick(event.nativeEvent, {
      eventId: 'special-event-123',
      metadata: {
        component: 'SpecialButton',
        category: 'interaction'
      }
    });
  };

  return (
    <div>
      <h1>イベント一覧</h1>
      <button onClick={handleSpecialClick}>
        特別なボタン
      </button>
      {/* その他のコンテンツ */}
    </div>
  );
};
```

### Vue.js での使用例
```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import { initializeAutoClickTracking, generateSessionId } from '../utils/clickTracker';

export default {
  setup() {
    let tracker: any = null;

    onMounted(() => {
      const sessionId = generateSessionId();
      
      tracker = initializeAutoClickTracking({
        apiEndpoint: `${process.env.VUE_APP_API_URL}/api/click-logs`,
        userId: getCurrentUserId(),
        sessionId,
        enableConsoleLog: process.env.NODE_ENV === 'development',
      });
    });

    onUnmounted(() => {
      if (tracker) {
        tracker.destroy();
      }
    });

    const trackSpecialClick = (event: MouseEvent) => {
      if (tracker) {
        tracker.trackClick(event, {
          eventId: 'vue-special-event',
          metadata: { framework: 'vue' }
        });
      }
    };

    return {
      trackSpecialClick
    };
  }
};
```

## 環境変数の設定

```env
# .env.local (開発環境)
REACT_APP_API_URL=http://localhost:3001
VUE_APP_API_URL=http://localhost:3001

# .env (本番環境)
REACT_APP_API_URL=https://your-api-domain.com
VUE_APP_API_URL=https://your-api-domain.com
```

## データ分析例

### SQLクエリ例
```sql
-- 最もクリックされた要素
SELECT element_type, element_text, COUNT(*) as click_count
FROM "ClickLog"
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY element_type, element_text
ORDER BY click_count DESC
LIMIT 10;

-- ページ別クリック数
SELECT page_url, COUNT(*) as clicks, COUNT(DISTINCT user_id) as unique_users
FROM "ClickLog"
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY page_url
ORDER BY clicks DESC;

-- 時間帯別クリック分析
SELECT EXTRACT(hour FROM timestamp) as hour, COUNT(*) as clicks
FROM "ClickLog"
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour;
```

## セキュリティ考慮事項

1. **IPアドレスの匿名化**: 本番環境ではIPアドレスの末尾を匿名化することを推奨
2. **データ保持期間**: 定期的に古いデータを削除（デフォルト30日）
3. **レート制限**: 過度なAPIリクエストを防ぐためのレート制限の実装
4. **認証**: 管理者向けエンドポイントへの適切な認証の実装