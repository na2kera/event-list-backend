import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

async function seedTestUsers() {
  console.log("Starting test user seeding...");

  const testUsers = [
    {
      id: crypto.randomUUID(),
      email: "test@example.com",
      name: "Test User",
      image: null,
      emailVerified: new Date(),
      lineId: null, // LINE認証なしのテストユーザー
      stack: ["JavaScript", "TypeScript", "React"],
      level: "INTERMEDIATE",
      place: "Tokyo",
      tag: ["Frontend", "Backend", "Web Development"],
      goal: ["スキルアップ", "ネットワーキング"],
      affiliation: "Test Company",
    },
    {
      id: crypto.randomUUID(),
      email: "admin@example.com",
      name: "Admin User",
      image: null,
      emailVerified: new Date(),
      lineId: null,
      stack: ["Node.js", "TypeScript", "PostgreSQL", "Prisma"],
      level: "ADVANCED",
      place: "Osaka",
      tag: ["DevOps", "Backend", "Database"],
      goal: ["チーム開発経験", "技術発信"],
      affiliation: "Admin Company",
    },
    {
      id: crypto.randomUUID(),
      email: "developer@example.com",
      name: "Developer User",
      image: null,
      emailVerified: new Date(),
      lineId: "test_line_id_001", // LINE認証ありのテストユーザー
      stack: ["Python", "Django", "AWS"],
      level: "BEGINNER",
      place: "Remote",
      tag: ["AI/ML", "Cloud", "Python"],
      goal: ["ポートフォリオ作成", "コミュニティ参加"],
      affiliation: "Freelancer",
    },
  ];

  for (const userData of testUsers) {
    try {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {
          // 既存ユーザーがある場合は基本情報のみ更新
          name: userData.name,
          stack: userData.stack,
          level: userData.level,
          place: userData.place,
          tag: userData.tag,
          goal: userData.goal,
          affiliation: userData.affiliation,
        },
        create: userData,
      });

      console.log(
        `✅ Test user created/updated: ${user.email} (ID: ${user.id})`
      );

      // LINE IDが設定されている場合は、対応するAccountレコードも作成
      if (userData.lineId) {
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: "line",
              providerAccountId: userData.lineId,
            },
          },
          update: {
            // 既存のAccountがある場合は何もしない
          },
          create: {
            id: crypto.randomUUID(),
            userId: user.id,
            type: "oauth",
            provider: "line",
            providerAccountId: userData.lineId,
            refresh_token: null,
            access_token: "test_access_token",
            expires_at: Math.floor(Date.now() / 1000) + 3600, // 1時間後
            token_type: "Bearer",
            scope: "profile openid email",
            id_token: null,
            session_state: null,
          },
        });
        console.log(`✅ LINE account created for: ${user.email}`);
      }
    } catch (error) {
      console.error(`❌ Error creating test user ${userData.email}:`, error);
    }
  }

  console.log("Test user seeding completed!");
}

async function main() {
  try {
    await seedTestUsers();
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
