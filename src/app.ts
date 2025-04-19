import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import speakerRoutes from "./routes/speakerRoutes";
import eventRoutes from "./routes/eventRoutes";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import lineRoutes from "./routes/lineRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import bookmarkRoutes from "./routes/bookmarkRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { PrismaClient } from "@prisma/client";

dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env" : ".env.local",
});

const app = express();
const port = process.env.PORT || 3001;
const prisma = new PrismaClient();

// CORS設定を強化
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://event-list-frontend.vercel.app", // 本番環境のフロントエンドURL
  process.env.FRONTEND_URL || "", // 環境変数からフロントエンドURLを取得
].filter(Boolean); // 空の値を除外

app.use(
  cors({
    origin: (origin, callback) => {
      // 開発環境では全てのオリジンを許可
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      // 本番環境では許可リストのみ許可
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Database health check endpoint
app.get("/health/db", async (req, res) => {
  try {
    // データベースに接続を試みる
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch (error: unknown) {
    console.error("Database connection error:", error);
    res.status(500).json({
      status: "error",
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/line", lineRoutes);
app.use("/api/speakers", speakerRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/users", userRoutes);

// Error handling
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
