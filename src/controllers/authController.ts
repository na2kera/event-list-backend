import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

export const syncUser = async (req: Request, res: Response) => {
  try {
    const { user, account } = req.body;

    let dbUser = await prisma.user.findUnique({
      where: {
        email: user.email,
      },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          name: user.name,
          email: user.email,
          image: user.image,
        },
      });
    }

    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
      },
    });

    if (existingAccount) {
      await prisma.account.update({
        where: {
          id: existingAccount.id,
        },
        data: {
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
        },
      });
    } else {
      await prisma.account.create({
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
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error syncing user:", error);
    res.status(500).json({ error: "Failed to sync user" });
  }
};
