import prisma from '../config/prisma';
import { User, Account } from '@prisma/client';
import fs from 'fs';
import path from 'path';

/**
 * ユーザーIDに基づいてユーザー情報をデータベースから取得する
 * @param userId ユーザーのID
 * @returns ユーザー情報、見つからない場合はnull
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    // Prismaを使用してユーザーをIDで検索
    const user = await prisma.user.findUnique({
      where: {
        id: userId
      },
      // 関連するアカウント情報も取得する場合は以下のようにincludeを使用
      include: {
        accounts: true
      }
    });
    
    return user;
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    throw error;
  }
};

/**
 * ユーザーIDに基づいてユーザー情報とその関連データを取得する
 * @param userId ユーザーのID
 * @returns ユーザー情報と関連データ、見つからない場合はnull
 */
export const getUserWithDetailsById = async (userId: string) => {
  try {
    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: {
        id: userId
      },
      include: {
        accounts: true,
        sessions: true
      }
    });
    
    if (!user) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('ユーザー詳細情報取得エラー:', error);
    throw error;
  }
};

// モックユーザーデータの型定義
type MockUser = {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  // 学生エンジニア向けアプリ用の追加情報
  techStack: string[];       // 技術スタック
  skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'; // 技術レベル
  location: string;         // 居住地
  interests: string[];      // 興味タグ
  goals: string[];          // 目標
  accounts: {
    id: string;
    userId: string;
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token: string | null;
    access_token: string | null;
    expires_at: number | null;
    token_type: string | null;
    scope: string | null;
    id_token: string | null;
    session_state: string | null;
  }[];
};

// モックユーザーデータ
const mockUsers: MockUser[] = [
  {
    id: 'user-1',
    name: '山田太郎',
    email: 'taro@example.com',
    emailVerified: new Date(),
    image: 'https://example.com/avatar1.jpg',
    // 学生エンジニア向けアプリ用の追加情報
    techStack: ['JavaScript', 'React', 'Next.js', 'Node.js'],
    skillLevel: 'INTERMEDIATE',
    location: '東京',
    interests: ['Webフロントエンド', 'UI/UX', 'ハッカソン'],
    goals: ['IMPROVE_SKILLS', 'CREATE_PORTFOLIO'],
    accounts: [
      {
        id: 'account-1',
        userId: 'user-1',
        type: 'oauth',
        provider: 'github',
        providerAccountId: '12345',
        refresh_token: null,
        access_token: 'mock-access-token-1',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        scope: 'read:user',
        id_token: null,
        session_state: null
      }
    ]
  },
  {
    id: 'user-2',
    name: '鈴木花子',
    email: 'hanako@example.com',
    emailVerified: new Date(),
    image: 'https://example.com/avatar2.jpg',
    // 学生エンジニア向けアプリ用の追加情報
    techStack: ['Python', 'TensorFlow', 'PyTorch', 'scikit-learn'],
    skillLevel: 'ADVANCED',
    location: '大阪',
    interests: ['機械学習', '生成AI', 'データ分析'],
    goals: ['IMPROVE_SKILLS', 'EXPERIENCE_TEAM_DEV'],
    accounts: [
      {
        id: 'account-2',
        userId: 'user-2',
        type: 'oauth',
        provider: 'google',
        providerAccountId: '67890',
        refresh_token: 'mock-refresh-token-2',
        access_token: 'mock-access-token-2',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        scope: 'email profile',
        id_token: 'mock-id-token-2',
        session_state: null
      }
    ]
  },
  {
    id: 'user-3',
    name: '佐藤次郎',
    email: 'jiro@example.com',
    emailVerified: new Date(),
    image: 'https://example.com/avatar3.jpg',
    // 学生エンジニア向けアプリ用の追加情報
    techStack: ['Java', 'Spring Boot', 'MySQL', 'Docker'],
    skillLevel: 'BEGINNER',
    location: '福岡',
    interests: ['バックエンド', 'クラウド', 'サーバーレス'],
    goals: ['IMPROVE_SKILLS', 'CREATE_PORTFOLIO'],
    accounts: [
      {
        id: 'account-3',
        userId: 'user-3',
        type: 'oauth',
        provider: 'twitter',
        providerAccountId: '24680',
        refresh_token: null,
        access_token: 'mock-access-token-3',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        scope: 'read',
        id_token: null,
        session_state: null
      }
    ]
  }
];

/**
 * テスト用：モックユーザーデータからユーザー情報を取得する
 * @param userId ユーザーのID
 * @returns ユーザー情報、見つからない場合はnull
 */
export const getMockUserById = (userId: string): MockUser | null => {
  try {
    // モックデータからユーザーを検索
    const user = mockUsers.find(user => user.id === userId);
    
    if (!user) {
      console.log(`モックユーザーID ${userId} が見つかりません`);
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('モックユーザー情報取得エラー:', error);
    throw error;
  }
};

/**
 * テスト用：すべてのモックユーザーを取得する
 * @returns すべてのモックユーザー情報
 */
export const getAllMockUsers = (): MockUser[] => {
  return mockUsers;
};
