# クリックログ機能実装手順書

## 実装概要
ユーザーのクリック操作を記録するログ機能を実装します。

## 実装日時
2024年11月現在

## 技術スタック
- Backend: Express.js + TypeScript
- Database: Prisma ORM
- 既存のプロジェクト構造を活用

## 実装手順

### 1. データベーススキーマの作成
Prismaスキーマにクリックログ用のテーブルを追加

### 2. 型定義の作成
TypeScriptの型定義ファイルを作成

### 3. コントローラーの実装
クリックログを保存・取得するコントローラーを実装

### 4. ルートの設定
Express.jsのルートを追加

### 5. メインアプリへの統合
app.tsにルートを追加

### 6. フロントエンド用ユーティリティの作成
ClickTrackerクラスを作成してクリック追跡を簡単に実装できるようにする

### 7. データベースマイグレーション
Prismaスキーマの変更をデータベースに適用

## 実装状況
- [x] データベーススキーマの作成
- [x] 型定義の作成
- [x] コントローラーの実装
- [x] ルートの設定
- [x] メインアプリへの統合
- [x] フロントエンド用ユーティリティの作成
- [x] Prismaクライアント生成
- [x] 使用例ドキュメントの作成
- [ ] データベースマイグレーション（本番環境）
- [ ] テストの実装

## 機能仕様
- クリックイベントの記録（要素、座標、タイムスタンプ、ユーザーID等）
- クリックログの取得（フィルタリング、ソート機能）
- プライバシーを考慮したデータ保持期間の設定

## 実装詳細

### 作成したファイル
1. **prisma/schema.prisma** - ClickLogモデルを追加
2. **src/types/clickLog.ts** - TypeScript型定義
3. **src/controllers/clickLogController.ts** - APIコントローラー
4. **src/routes/clickLogRoutes.ts** - Express.jsルート
5. **src/utils/clickTracker.ts** - フロントエンド用ユーティリティ
6. **examples/click-tracking-usage.md** - API使用例とドキュメント

### API エンドポイント
- `POST /api/click-logs` - クリックログの作成
- `GET /api/click-logs` - クリックログの取得（フィルタリング可能）
- `GET /api/click-logs/stats` - クリック統計の取得
- `DELETE /api/click-logs/cleanup` - 古いログの削除

### フロントエンドでの使用例
```typescript
import { initializeAutoClickTracking } from './utils/clickTracker';

// 自動追跡の初期化
const tracker = initializeAutoClickTracking({
  apiEndpoint: 'http://localhost:3001/api/click-logs',
  userId: 'user123',
  sessionId: 'session456',
  enableConsoleLog: true,
});

// 手動追跡
document.addEventListener('click', (event) => {
  tracker.trackClick(event, {
    eventId: 'event123',
    metadata: { section: 'header' }
  });
});
```

### データベースマイグレーション
```bash
npx prisma db push
# または
npx prisma migrate dev --name add-click-log
```

## 次のステップ
1. **データベースマイグレーション**: 本番環境でのスキーマ適用
   ```bash
   npx prisma migrate deploy
   ```
2. **テストの実装**: ユニットテストとインテグレーションテストの追加
3. **認証・認可**: 管理者向けエンドポイントへのセキュリティ実装
4. **監視・アラート**: 異常なクリックパターンの検知

## 注意事項
- プライバシーポリシーの遵守
- パフォーマンスへの影響を最小限に抑制
- セキュリティ対策の実装
- IPアドレスの匿名化を検討
- データ保持期間の設定（デフォルト30日）
- GDPR等の法規制への対応

## 完了
✅ ユーザークリックログ機能の基本実装が完了しました！
📚 詳細な使用例は `examples/click-tracking-usage.md` を参照してください。