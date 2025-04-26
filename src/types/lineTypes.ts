import { Event, Bookmark } from "@prisma/client";

// イベント情報とブックマーク有無を含む型
// 注意: Prismaの型を直接利用していますが、プロジェクトによっては
//       必要なプロパティのみを定義したインターフェースの方が望ましい場合もあります。
export type EventWithBookmark = Event & { Bookmark?: Bookmark[] };
export type EventWithBookmarkStatus = Omit<EventWithBookmark, "Bookmark"> & {
  isBookmarked: boolean;
};
// 他のLINE関連の共有型があればここに追加できます
