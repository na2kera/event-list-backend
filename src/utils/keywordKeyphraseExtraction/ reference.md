# TextRank アルゴリズム参考資料

## 概要

TextRank は、Google の**PageRank**アルゴリズムを自然言語処理に応用したグラフベースのキーワード・要約抽出手法です。2004 年に Rada Mihalcea と Paul Tarau により提案されました。

## 基本原理

### 1. グラフベースアプローチ

- 文書内の単語（またはフレーズ）をノード（頂点）として扱う
- 単語間の関係性をエッジ（辺）として表現
- PageRank と同様の反復計算により単語の重要度を算出

### 2. 共起関係の活用

- 指定されたウィンドウサイズ内で共起する単語間にエッジを張る
- 共起頻度に基づいてエッジの重みを設定（手法により異なる）
- 無向グラフを構築（単語の関連度には方向性がないため）

## アルゴリズムの詳細

### PageRank の計算式

```
S(vi) = (1-d) + d × Σ(vj∈Adj(vi)) (wji / Σ(vk∈Adj(vj)) wjk) × S(vj)
```

- S(vi): 単語 vi のスコア
- d: ダンピングファクタ（通常 0.85）
- Adj(vi): vi に隣接する単語集合
- wji: 単語 vj から vi へのエッジ重み

### 実装手順

1. **前処理**

   - トークン化
   - ストップワード除去
   - 品詞タグ付け（名詞・形容詞のみを対象とすることが多い）
   - 語幹化・見出し語化（Lemmatization）

2. **グラフ構築**

   - 候補単語をノードとして追加
   - ウィンドウサイズ内で共起する単語間にエッジを作成
   - エッジの重み付け（共起回数、距離など）

3. **スコア計算**

   - 各ノードのスコアを初期化（通常 1.0）
   - 収束するまで反復計算を実行
   - 閾値以下の変化量で収束判定

4. **キーフレーズ抽出**
   - 高スコアの単語を選択
   - 隣接する高スコア単語を結合してフレーズを形成

## パラメータ調整

### 重要なパラメータ

- **ウィンドウサイズ**: 2〜10（論文では 2 が標準、実装により 10 も使用）
- **ダンピングファクタ**: 0.85（PageRank と同じ）
- **最大反復回数**: 通常 30〜100 回
- **収束閾値**: 0.0001 程度

### 最適化のポイント

- 短文書：ウィンドウサイズ 2〜3
- 長文書：ウィンドウサイズ 5〜10
- 学術論文：位置情報を考慮（PositionRank）
- ニュース記事：エッジ重み付けの調整

## 発展形・派生手法

### SingleRank (2008)

- エッジに共起回数で重み付け
- フレーズスコアを構成単語のスコア合計で計算
- ウィンドウサイズ 10 を使用

### PositionRank (2017)

- 単語の文書内位置を考慮
- 文書前半の単語により高い重みを付与
- 学術論文に効果的

### TopicRank (2013)

- 単語ではなくトピック（クラスタ）をノードとする
- 意味的に重複するキーフレーズの回避
- HAC（階層的凝集クラスタリング）を使用

### MultipartiteRank (2018)

- TopicRank の改良版
- フレーズ候補レベルでの重要度評価
- 同一トピック内の接続を除去

## 実装における技術的考慮事項

### ライブラリ・技術スタック

```python
# 主要ライブラリ
import networkx as nx        # グラフ構築・PageRank計算
import nltk                  # 自然言語処理
import spacy                 # 高度な言語処理
from sklearn.feature_extraction.text import TfidfVectorizer  # TF-IDF
```

### パフォーマンス最適化

- 大規模文書での計算時間：O(V²) 〜 O(V³)
- メモリ使用量：隣接行列の最適化が重要
- 並列処理：グラフ構築とスコア計算の並列化

### TF-IDF との併用

```python
# ハイブリッドアプローチ
combined_score = (tfidf_score × 2.0) + (textrank_score × multiplier)
```

## 評価・性能比較

### 他手法との比較

- **TF-IDF**: 高速だが文脈を無視
- **YAKE**: 統計的特徴ベース、多言語対応
- **KeyBERT**: 深層学習ベース、高精度だが計算コスト大
- **TextRank**: バランスの取れた性能、説明可能性

### 評価指標

- Precision（適合率）
- Recall（再現率）
- F1-Score
- ROUGE（要約評価）

## 実装上の注意点

### データ前処理の重要性

1. 適切な品詞フィルタリング（名詞・形容詞中心）
2. ストップワード除去の徹底
3. 文書特性に応じた正規化

### 一般的な問題と対策

- **短文書での性能低下**: ウィンドウサイズの調整
- **固有名詞の処理**: 固有名詞認識（NER）の活用
- **多言語対応**: 言語固有の前処理の実装

## 具体的な応用例

### 情報検索

- 学術論文の核となる概念抽出
- 特許文書の技術用語識別

### 文書要約

- ニュース記事の自動要約
- 法的文書の要点抽出

### SEO・コンテンツ最適化

- Web ページのキーワード特定
- メタデータ生成の自動化

## 参考文献・実装例

### 原著論文

- Mihalcea, R., & Tarau, P. (2004). "TextRank: Bringing order into text." EMNLP.

### 実装リソース

- **PyTextRank**: spaCy との統合
- **NetworkX**: グラフアルゴリズムの実装
- **Summa**: TextRank の軽量実装

### オープンソース実装

- GitHub 上に多数の実装例が存在
- JupyterNotebook 形式のチュートリアルが豊富

---

最終更新: 2025 年 1 月
作成者: AI Assistant（web 検索に基づく調査）
