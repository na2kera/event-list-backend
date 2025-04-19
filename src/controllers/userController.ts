import { Request, Response, NextFunction, RequestHandler } from "express";
import prisma from "../config/prisma";
import axios from "axios";
import crypto from "crypto";

/**
 * LINEログイン処理
 * LINEから取得したコードを使用してアクセストークンを取得し、ユーザー情報を取得してデータベースに保存する
 */
export const lineLogin: RequestHandler = async (req, res, next) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      res.status(400).json({
        success: false,
        message: "認証コードが見つかりません",
      });
      return;
    }

    // LINEのアクセストークンを取得
    const tokenResponse = await axios.post(
      "https://api.line.me/oauth2/v2.1/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri:
          process.env.LINE_REDIRECT_URI || "http://localhost:3000/line-connect",
        client_id: process.env.LINE_CLIENT_ID || "",
        client_secret: process.env.LINE_CLIENT_SECRET || "",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, id_token } = tokenResponse.data;

    // LINEのプロフィール情報を取得
    const profileResponse = await axios.get("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const { userId: lineId, displayName, pictureUrl } = profileResponse.data;

    // ユーザー情報をデータベースに保存または更新
    const user = await prisma.user.upsert({
      where: {
        lineId,
      },
      update: {
        name: displayName,
        image: pictureUrl,
      },
      create: {
        id: crypto.randomUUID(),
        name: displayName,
        lineId,
        image: pictureUrl,
        stack: [],
        tag: [],
        goal: [],
      },
    });

    // セッション情報を保存
    const session = await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日間有効
        sessionToken: crypto.randomUUID(),
      },
    });

    // アカウント情報を保存
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "line",
          providerAccountId: lineId,
        },
      },
      update: {
        access_token,
        id_token,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1時間
      },
      create: {
        id: crypto.randomUUID(),
        userId: user.id,
        type: "oauth",
        provider: "line",
        providerAccountId: lineId,
        access_token,
        id_token,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1時間
        token_type: "Bearer",
      },
    });

    // クライアントに必要な情報を返す
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        image: user.image,
        lineId: user.lineId,
        stack: user.stack,
        level: user.level,
        place: user.place,
        tag: user.tag,
        goal: user.goal,
      },
      sessionToken: session.sessionToken,
    });
  } catch (error) {
    console.error("LINEログインエラー:", error);
    res.status(500).json({
      success: false,
      message: "LINEログイン処理中にエラーが発生しました",
      error: error instanceof Error ? error.message : "不明なエラー",
    });
  }
};

/**
 * ユーザー情報を取得する
 */
export const getUserProfile: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        lineId: true,
        stack: true,
        level: true,
        place: true,
        tag: true,
        goal: true,
        affiliation: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "ユーザーが見つかりません",
      });
      return;
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("ユーザー情報取得エラー:", error);
    res.status(500).json({
      success: false,
      message: "ユーザー情報の取得中にエラーが発生しました",
    });
  }
};

/**
 * ユーザー情報を更新する
 */
export const updateUserProfile: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { name, email, stack, level, place, tag, goal, affiliation } =
      req.body;

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name,
        email,
        stack,
        level,
        place,
        tag,
        goal,
        affiliation,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        lineId: true,
        stack: true,
        level: true,
        place: true,
        tag: true,
        goal: true,
        affiliation: true,
      },
    });

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("ユーザー情報更新エラー:", error);
    res.status(500).json({
      success: false,
      message: "ユーザー情報の更新中にエラーが発生しました",
    });
  }
};
