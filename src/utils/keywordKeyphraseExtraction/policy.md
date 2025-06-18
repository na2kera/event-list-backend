# keywordKeyphraseExtraction フォルダ構成

keywordKeyphraseExtraction/
├── fetchFiveEventData.ts
├── keyphrase_method/
│ └── (空)
├── keyword-keyphrase-extractor.ts
├── keyword_method/
│ ├── keyword-extractor-library.ts
│ ├── textrank-library.ts
│ └── tf-idf-library.ts
├── policy.md
└── result/
├── keyword-extractor-library-result.md
├── textrank-library-result.md
└── tf-idf-library-result.md

## ファイルの説明

### keyword-keyphrase-extractor.ts

このファイルは、キーワードおよびキーフレーズ抽出処理全体のオーケストレーションを行うメインスクリプトです。主な機能は以下の通りです。

- **入力テキストの準備**: 抽出対象となるテキストデータ（イベントの説明文など）を準備します。現在はサンプルテキストが直接記述されていますが、将来的には `fetchFiveEventData.ts` などを通じて動的にデータを取得することを想定しているようです。
- **抽出アルゴリズムの呼び出し**: `keyword_method/` ディレクトリに配置された個別のキーワード抽出アルゴリズム（例: `tf-idf-library.ts`、`keyword-extractor-library.ts`）をインポートし、準備されたテキストデータに適用します。
- **結果の表示**: 抽出されたキーワードやキーフレーズをコンソールに出力します。
- **処理の実行とテスト**: スクリプトの末尾で定義されたメイン関数 `extractKeywordsAndKeyphrases` を実行し、一連の抽出処理を開始します。異なる抽出手法を試すためのテストベッドとしての役割も担っています。

### keyword_method/

このディレクトリには、具体的なキーワード抽出アルゴリズムを実装した TypeScript ファイルが格納されます。各ファイルは、特定の抽出手法（例: TF-IDF、TextRank、keyword-extractor ライブラリ利用など）に基づいたロジックを含みます。

ディレクトリ内の各ライブラリ (`.ts` ファイル) は、一般的に以下の共通インターフェースを持つ関数をエクスポートすることを想定しています。

- **入力**: 分析対象のテキスト（`string` 型）
- **出力**: 抽出されたキーワードの配列（`string[]` 型、または非同期処理の場合は `Promise<string[]>` 型）

これにより、`keyword-keyphrase-extractor.ts` から各手法を統一的に呼び出し、結果を比較検討することが容易になります。

現在含まれるファイルは以下の通りです。

- `keyword-extractor-library.ts`: `keyword-extractor` npm パッケージを利用したキーワード抽出処理。
- `textrank-library.ts`: (現在は空) TextRank アルゴリズムに基づくキーワード抽出処理を実装予定。
- `tf-idf-library.ts`: TF-IDF (Term Frequency-Inverse Document Frequency) に基づくキーワード抽出処理。日本語の形態素解析には `kuromoji.js` を使用。

### keyphrase_method/

このディレクトリには、具体的なキーセンテンス（キーフレーズ）抽出アルゴリズムを実装した TypeScript ファイルが格納されます。各ファイルは、特定の抽出手法に基づいたロジックを含みます。

ディレクトリ内の各ライブラリ (`.ts` ファイル) は、一般的に以下の共通インターフェースを持つ関数をエクスポートすることを想定しています。

- **入力**: 分析対象のテキスト（`string` 型）
- **出力**: 抽出されたキーセンテンスの配列（`string[]` 型、または非同期処理の場合は `Promise<string[]>` 型）

これにより、`keyword-keyphrase-extractor.ts` から各手法を統一的に呼び出し、結果を比較検討することが容易になります。

現在想定されるファイルは以下の通りです。

- `ts-textrank-keyphrase-library.ts`: (現在は空) `ts-textrank` ライブラリを利用したキーセンテンス抽出処理を実装予定。これは文単位の TextRank アルゴリズムを適用し、重要な文を抽出します。

## 手法評価結果と採用方針

### 評価結果 (2024 年実施)

複数のキーワード・キーフレーズ抽出手法を検証した結果、以下のような評価となりました：

**TextRank ライブラリ（キーフレーズ抽出）**

- ✅ **採用決定**: 講座の核心内容を適切に捉えている
- ✅ **内容の質**: ChatGPT 活用や実践的アプローチなど、重要な特徴を抽出
- ✅ **差別化**: 他講座との違いを明確に表現
- ⚠️ **改善点**: 文章の長さ調整、不完全文章の修正が必要

**他手法との比較**

- TF-IDF: 技術用語は抽出するが文脈が不足
- keyword-extractor: 単語レベルの抽出に留まる
- その他: TextRank が総合的に最も優秀

### 今後の開発方針

**ベース手法**: TextRank ライブラリによるキーフレーズ抽出を採用

**実装優先度**:

1. TextRank ライブラリの改良・最適化
2. キーフレーズの長さ制限機能追加
3. 他手法との組み合わせ検討（必要に応じて）

**品質向上計画**:

- 文章の短縮化処理の実装
- 技術キーワードの補完機能
- 不完全文章の検出・修正機能

## 実行コマンド

- やりたい手法をコメントアウト
- 次のコマンドを実行

```

```
