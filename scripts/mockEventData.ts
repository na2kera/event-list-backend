import { EventWithDetails } from "../src/utils/similarityUtils";

// 実在しそうなテックイベント 50 件（概要は 1 文で要約調）
export const detailedEvents: EventWithDetails[] = [
  {
    id: "1",
    keySentences: [
      "Vue.js Nation 2025 では Composition API と最新ツールチェーンを用いて大規模 SPA を構築するための実践テクニックを 1 日で習得します。",
    ],
    keywords: ["Vue", "Vue.js", "Front-End"],
  },
  {
    id: "2",
    keySentences: [
      "Generative AI Summit Tokyo は GPT-4o を活用した業務自動化事例と LLM ファインチューニングのベストプラクティスを学ぶ集中講座です。",
    ],
    keywords: ["生成AI", "LLM", "ChatGPT"],
  },
  {
    id: "3",
    keySentences: [
      "React Summit 2025 では Next.js 14 の App Router と Server Components を使ったパフォーマンス最適化手法をハンズオン形式で体験します。",
    ],
    keywords: ["React", "Next.js", "Front-End"],
  },
  {
    id: "4",
    keySentences: [
      "Cloud Native Bootcamp では AWS、Docker、Kubernetes を組み合わせてマイクロサービスをゼロからデプロイする CI/CD パイプラインを構築します。",
    ],
    keywords: ["AWS", "Docker", "Kubernetes"],
  },
  {
    id: "5",
    keySentences: [
      "Mobile Dev Day では React Native と Expo OTA 更新を用いて iOS／Android 双方にリリース可能な本格アプリを 1 日で完成させます。",
    ],
    keywords: ["React Native", "Mobile", "Expo"],
  },
  {
    id: "6",
    keySentences: [
      "Rust & WebAssembly Workshop では Rust で書いたコードを WASM へコンパイルし、ブラウザ上でネイティブ級の高速処理を実現する方法を学びます。",
    ],
    keywords: ["Rust", "WebAssembly", "Performance"],
  },
  {
    id: "7",
    keySentences: [
      "GraphQL Conferencia は Apollo Server と Federation を使ったスキーマ統合戦略からキャッシュ最適化までを深堀りする実践セッションです。",
    ],
    keywords: ["GraphQL", "API", "Back-End"],
  },
  {
    id: "8",
    keySentences: [
      "Node.js Backend Lab では Express と Prisma を活用し、型安全な REST API を設計・実装・テスト・デプロイまで一気通貫で体験します。",
    ],
    keywords: ["Node.js", "Express", "Back-End"],
  },
  {
    id: "9",
    keySentences: [
      "SvelteKit & Vite Workshop では Vite プラグインによるビルド高速化と SvelteKit のロード機構を活用した CSR / SSR ハイブリッド構成を学びます。",
    ],
    keywords: ["Svelte", "Vite", "Front-End"],
  },
  {
    id: "10",
    keySentences: [
      "Go Backend Summit では Gin と Wire を用いた依存性注入パターンや、高負荷環境でのチューニング手法をライブコーディングで解説します。",
    ],
    keywords: ["Go", "Gin", "Back-End"],
  },
  {
    id: "11",
    keySentences: [
      "TensorFlow Hands-on では CNN と Transformer を題材に、モデル構築から TFX によるパイプライン運用までを一気通貫で習得します。",
    ],
    keywords: ["TensorFlow", "Machine Learning", "Python"],
  },
  {
    id: "12",
    keySentences: [
      "Unity GameDev Conference では URP と新 Input System を活用し、モバイル向け 3D アクションゲームをゼロからプロトタイプまで制作します。",
    ],
    keywords: ["Unity", "C#", "GameDev"],
  },
  {
    id: "13",
    keySentences: [
      "CSS Motion Masterclass では CSS @layer と Scroll-Driven Animations を用いてパフォーマンスを損なわないインタラクティブ UI を構築します。",
    ],
    keywords: ["CSS", "Animation", "WebDesign"],
  },
  {
    id: "14",
    keySentences: [
      "Django REST Framework Intensive では JWT 認証と OpenAPI ドキュメント生成を組み込み、セキュアなバックエンド API を構築します。",
    ],
    keywords: ["Django", "REST API", "Python"],
  },
  {
    id: "15",
    keySentences: [
      "Flutter Global Summit では Material 3 と新しい Impeller レンダラーを活用し、高 FPS のクロスプラットフォーム UI を実装します。",
    ],
    keywords: ["Flutter", "Dart", "Mobile"],
  },
  {
    id: "16",
    keySentences: [
      "SQL Performance Tuning Workshop では 実データを用いてインデックス設計・クエリプラン解析・パーティショニング最適化を徹底的に行います。",
    ],
    keywords: ["SQL", "Performance", "Database"],
  },
  {
    id: "17",
    keySentences: [
      "Cybersecurity Essentials では OWASP Top 10 を題材に脆弱性診断手順と DevSecOps での自動スキャン導入方法をハンズオンで学びます。",
    ],
    keywords: ["Security", "Cybersecurity", "Vulnerability"],
  },
  {
    id: "18",
    keySentences: [
      "Blockchain DevCon では Solidity と Hardhat によるテスト戦略や、スマートコントラクト監査の実務フローを実演します。",
    ],
    keywords: ["Blockchain", "Solidity", "SmartContract"],
  },
  {
    id: "19",
    keySentences: [
      "Elixir & Phoenix LiveView Workshop では リアルタイム双方向通信を活用した SaaS ダッシュボードを作りながら BEAM の並行モデルを体験します。",
    ],
    keywords: ["Elixir", "Phoenix", "RealTime"],
  },
  {
    id: "20",
    keySentences: [
      "C++ Optimizations Day では コンパイラ最適化フラグと PGO/LTO を駆使し、ゲームエンジンのレンダリングコードを高速化します。",
    ],
    keywords: ["C++", "Compiler", "Optimization"],
  },
  {
    id: "21",
    keySentences: [
      "KotlinConf では Jetpack Compose と KMM を利用し、Android と iOS 双方にネイティブ UI を共有する方法をライブデモで紹介します。",
    ],
    keywords: ["Kotlin", "Android", "Mobile"],
  },
  {
    id: "22",
    keySentences: [
      "Swift World では SwiftUI 3 の新 API と Swift Concurrency を組み合わせ、モダンな iOS アプリアーキテクチャを設計します。",
    ],
    keywords: ["Swift", "iOS", "Mobile"],
  },
  {
    id: "23",
    keySentences: [
      "AR/VR Expo では Unity XR Interaction Toolkit を用いて没入型トレーニングシミュレータを構築し、性能最適化を学びます。",
    ],
    keywords: ["AR", "VR", "Unity"],
  },
  {
    id: "24",
    keySentences: [
      "Data Analytics Day では BigQuery と Looker Studio を連携し、大規模データを可視化して意思決定に活かすダッシュボードを構築します。",
    ],
    keywords: ["BigQuery", "Looker", "Analytics"],
  },
  {
    id: "25",
    keySentences: [
      "Serverless Summit では AWS Lambda と EventBridge を組み合わせた疎結合アーキテクチャとコスト最適化戦略を徹底解説します。",
    ],
    keywords: ["AWS", "Lambda", "Serverless"],
  },
  {
    id: "26",
    keySentences: [
      "IaC Bootcamp では Terraform Cloud と Policy as Code を活用し、安全で再現性の高いマルチクラウド環境を構築します。",
    ],
    keywords: ["Terraform", "IaC", "Cloud"],
  },
  {
    id: "27",
    keySentences: [
      "Streaming Tech Day では Apache Kafka と ksqlDB を使ったストリーム処理パイプラインをリアルタイム分析用途に実装します。",
    ],
    keywords: ["Kafka", "Streaming", "DataPipeline"],
  },
  {
    id: "28",
    keySentences: [
      "PostgreSQL Deep Dive では 拡張機能・パーティショニング・レプリケーションを駆使し、TB 級データを扱う DB の運用ノウハウを共有します。",
    ],
    keywords: ["PostgreSQL", "Database", "Tuning"],
  },
  {
    id: "29",
    keySentences: [
      "UX/UI Design Lab では Figma と Design Token を用いてスケーラブルなデザインシステムを構築し、チームコラボレーションを促進します。",
    ],
    keywords: ["Figma", "UX", "UI"],
  },
  {
    id: "30",
    keySentences: [
      "BI Workshop では Microsoft Power BI で DAX 関数と Dataflow を駆使し、インタラクティブなビジネスダッシュボードを作成します。",
    ],
    keywords: ["PowerBI", "BI", "Dashboard"],
  },
  {
    id: "31",
    keySentences: [
      "Azure Cloud Day では Azure Functions と Logic Apps を組み合わせたサーバレスワークフローでエンタープライズ統合を実装します。",
    ],
    keywords: ["Azure", "Functions", "Serverless"],
  },
  {
    id: "32",
    keySentences: [
      "GCP Next Step では Cloud Run、Pub/Sub、Firestore を活用したイベント駆動マイクロサービスをデプロイします。",
    ],
    keywords: ["GCP", "CloudRun", "PubSub"],
  },
  {
    id: "33",
    keySentences: [
      "DevSecOps Summit では GitHub Advanced Security と OWASP ZAP を CI/CD に統合し、セキュアな供給チェーンを実現します。",
    ],
    keywords: ["DevSecOps", "CI/CD", "Security"],
  },
  {
    id: "34",
    keySentences: [
      "MLOps Pipeline Day では Kubeflow と MLflow を連携し、モデル学習・バージョニング・デプロイの自動化を実演します。",
    ],
    keywords: ["MLOps", "Kubeflow", "ML"],
  },
  {
    id: "35",
    keySentences: [
      "Kubernetes Operators Workshop では Operator SDK を使って CRD を実装し、アプリケーションのライフサイクルを自動管理します。",
    ],
    keywords: ["Kubernetes", "Operators", "CloudNative"],
  },
  {
    id: "36",
    keySentences: [
      "Edge Computing Summit では Cloudflare Workers と Durable Objects でグローバル低遅延アプリケーションを構築します。",
    ],
    keywords: ["Edge", "Cloudflare", "Workers"],
  },
  {
    id: "37",
    keySentences: [
      "Observability Day では Prometheus、Grafana、Loki を組み合わせた統合監視スタックを Kubernetes クラスタへ導入します。",
    ],
    keywords: ["Observability", "Grafana", "Prometheus"],
  },
  {
    id: "38",
    keySentences: [
      "Container Security Workshop では Falco と Trivy を活用し、シフトレフトな脅威検知とイメージスキャン自動化を実装します。",
    ],
    keywords: ["Security", "Falco", "Trivy"],
  },
  {
    id: "39",
    keySentences: [
      "Python Web Summit では FastAPI と Pydantic により型安全な Web API を構築し、AsyncIO で高スループットを実現します。",
    ],
    keywords: ["Python", "FastAPI", "Web"],
  },
  {
    id: "40",
    keySentences: [
      "Functional Programming Day では Haskell と Type-Driven Development を通じて安全性と再利用性の高いコードを書く方法を学びます。",
    ],
    keywords: ["Haskell", "Functional", "Programming"],
  },
  {
    id: "41",
    keySentences: [
      "Quantum Computing Basics では IBM Quantum Experience と Qiskit で量子回路を作成し、アルゴリズムの基礎を体験します。",
    ],
    keywords: ["Quantum", "Qiskit", "Computing"],
  },
  {
    id: "42",
    keySentences: [
      "Data Visualization Masterclass では D3.js v7 と Observable で動的データビジュアルをデザインします。",
    ],
    keywords: ["D3.js", "Visualization", "Front-End"],
  },
  {
    id: "43",
    keySentences: [
      "Laravel Conf JP では Laravel 11 の新アーキテクチャと TALL スタックによるモダン PHP 開発を深堀りします。",
    ],
    keywords: ["PHP", "Laravel", "API"],
  },
  {
    id: "44",
    keySentences: [
      "Ruby Kaigi では Rails 8 の Hotwire Turbo と新 ActiveRecord API を用いた高速開発を実演します。",
    ],
    keywords: ["Ruby", "Rails", "Web"],
  },
  {
    id: "45",
    keySentences: [
      "SAP Tech Day では ABAP Cloud と BTP を活用し、既存 ERP を拡張するローコードアプリを開発します。",
    ],
    keywords: ["SAP", "ABAP", "ERP"],
  },
  {
    id: "46",
    keySentences: [
      "Oracle APEX Workshop では ローコードでセキュアなビジネスアプリを迅速に構築し、REST Data Source 連携を学びます。",
    ],
    keywords: ["Oracle", "APEX", "LowCode"],
  },
  {
    id: "47",
    keySentences: [
      "Salesforce Dev Conference では Lightning Web Components と Apex を用いたカスタム CRM 機能開発を行います。",
    ],
    keywords: ["Salesforce", "LWC", "CRM"],
  },
  {
    id: "48",
    keySentences: [
      "Tableau Day では VizQL ベストプラクティスとストーリーテリング技法を用いて説得力のあるダッシュボードを作成します。",
    ],
    keywords: ["Tableau", "Visualization", "BI"],
  },
  {
    id: "49",
    keySentences: [
      "Headless CMS Meetup では Drupal と GraphCMS を比較し、Jamstack サイト向け API 設計パターンを紹介します。",
    ],
    keywords: ["Drupal", "Headless", "CMS"],
  },
  {
    id: "50",
    keySentences: [
      "WordPress Block Theme Workshop では Gutenberg と FSE を活用したモダンサイト構築とパフォーマンス最適化を実施します。",
    ],
    keywords: ["WordPress", "Gutenberg", "CMS"],
  },
];
