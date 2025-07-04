import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import crypto from "crypto";

const prisma = new PrismaClient();

export const syncUser = async (req: Request, res: Response) => {
  console.log("--- Starting user sync ---");
  console.log("Received user:", JSON.stringify(req.body.user, null, 2));
  console.log("Received account:", JSON.stringify(req.body.account, null, 2));

  try {
    const { user, account } = req.body;

    if (
      !user ||
      !user.email ||
      !account ||
      !account.provider ||
      !account.providerAccountId
    ) {
      console.error(
        "Sync failed: Missing required user or account data in request body."
      );
      return res
        .status(400)
        .json({ error: "Bad Request: Missing required user or account data." });
    }

    const lineId =
      account.provider === "line" ? account.providerAccountId : null;
    if (account.provider === "line" && !lineId) {
      console.error(
        "Sync failed: LINE provider specified but providerAccountId is missing."
      );
      return res.status(400).json({
        error: "Bad Request: Missing providerAccountId for LINE user.",
      });
    }

    console.log(`Finding user by email: ${user.email}`);
    let dbUser = await prisma.user.findUnique({
      where: {
        email: user.email,
      },
    });

    if (!dbUser) {
      console.log(`User not found. Creating new user for email: ${user.email}`);
      try {
        dbUser = await prisma.user.create({
          data: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            emailVerified: user.emailVerified
              ? new Date(user.emailVerified)
              : null,
            lineId: lineId,
            stack: [],
            tag: [],
            goal: [],
          },
        });
        console.log(
          `New user created with ID: ${dbUser.id} and LineID: ${lineId}`
        );
      } catch (createError) {
        console.error("Error creating user:", createError);
        return res.status(500).json({
          error: "Failed to create user during sync",
          details:
            createError instanceof Error
              ? createError.message
              : String(createError),
        });
      }
    } else {
      console.log(`Found existing user with ID: ${dbUser.id}`);
      const updateData: { image?: string; lineId?: string | null } = {};

      if (user.image && dbUser.image !== user.image) {
        console.log(`Updating user image for user ID: ${dbUser.id}`);
        updateData.image = user.image;
      }

      if (lineId && !dbUser.lineId) {
        console.log(`Updating missing lineId for user ID: ${dbUser.id}`);
        updateData.lineId = lineId;
      }

      if (Object.keys(updateData).length > 0) {
        console.log("Performing update with data:", updateData);
        await prisma.user.update({
          where: { id: dbUser.id },
          data: updateData,
        });
        console.log("User updated.");
      } else {
        console.log("No updates needed for existing user.");
      }
    }

    const accountIdentifier = {
      provider: account.provider,
      providerAccountId: account.providerAccountId,
    };
    console.log(
      `Finding account by provider/providerAccountId:`,
      accountIdentifier
    );
    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: accountIdentifier,
      },
    });

    if (existingAccount) {
      console.log(
        `Found existing account with ID: ${existingAccount.id}. Updating tokens.`
      );
      await prisma.account.update({
        where: {
          id: existingAccount.id,
        },
        data: {
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
          scope: account.scope,
          id_token: account.id_token,
          session_state: account.session_state,
          token_type: account.token_type,
        },
      });
      console.log(`Account updated for user ID: ${existingAccount.userId}`);
    } else {
      console.log(
        `Account not found. Creating new account for user ID: ${dbUser.id}`
      );
      try {
        const newAccount = await prisma.account.create({
          data: {
            id: crypto.randomUUID(),
            userId: dbUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state,
          },
        });
        console.log(`New account created with ID: ${newAccount.id}`);
      } catch (createError) {
        console.error("Error creating account:", createError);
        return res.status(500).json({
          error: "Failed to create account during sync",
          details:
            createError instanceof Error
              ? createError.message
              : String(createError),
        });
      }
    }

    console.log(
      `--- User sync completed successfully for user email: ${user.email} ---`
    );
    res.status(200).json({ success: true, userId: dbUser.id });
  } catch (error) {
    console.error("--- Error during user sync ---");
    console.error("Request body:", JSON.stringify(req.body, null, 2));
    console.error("Error syncing user:", error);
    res.status(500).json({
      error: "Failed to sync user",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// テストユーザー用の簡単なログイン機能
export const testLogin = async (req: Request, res: Response) => {
  console.log("--- Starting test user login ---");
  console.log("Received credentials:", { email: req.body.email });

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      console.error("Login failed: Missing email or password");
      return res
        .status(400)
        .json({ error: "Bad Request: Missing email or password" });
    }

    // テストユーザーのメールアドレスと固定パスワードをチェック
    const testUserEmails = [
      "test@example.com",
      "admin@example.com",
      "developer@example.com",
    ];

    const testPassword = "testpassword123"; // 固定のテストパスワード

    if (!testUserEmails.includes(email) || password !== testPassword) {
      console.error("Login failed: Invalid credentials");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // データベースからユーザーを取得
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        stack: true,
        level: true,
        place: true,
        tag: true,
        goal: true,
        affiliation: true,
      },
    });

    if (!user) {
      console.error("Login failed: User not found in database");
      return res.status(401).json({ error: "User not found" });
    }

    console.log(`--- Test user login successful for: ${user.email} ---`);
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    });
  } catch (error) {
    console.error("--- Error during test user login ---");
    console.error("Error:", error);
    res.status(500).json({
      error: "Failed to login test user",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
