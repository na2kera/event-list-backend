import { Event } from "@prisma/client";

/**
 * イベントカルーセルメッセージを生成する
 * @param events イベント配列
 * @param userId ユーザーID
 * @returns カルーセルメッセージオブジェクト
 */
export const createEventRecommendlMessage = (
  events: Event[],
  userId: string
) => {
  // イベントごとにバブルを作成
  const bubbles = events.map((event) => {
    return {
      type: "bubble",
      hero: {
        type: "image",
        url:
          event.image ||
          "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png",
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: event.title,
            weight: "bold",
            size: "xl",
            wrap: true,
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "日時",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 1,
                  },
                  {
                    type: "text",
                    text: `${event.eventDate.toISOString().split("T")[0]} ${
                      event.startTime
                    }〜${event.endTime || "終了時間未定"}`,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5,
                  },
                ],
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "場所",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 1,
                  },
                  {
                    type: "text",
                    text: event.venue,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5,
                  },
                ],
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "形式",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 1,
                  },
                  {
                    type: "text",
                    text: event.format,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5,
                  },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#4169E1", // ロイヤルブルー
            height: "sm",
            action: {
              type: "uri",
              label: "詳細を見る",
              uri: event.detailUrl || `https://example.com/events/${event.id}`,
            },
          },
          {
            type: "button",
            style: "secondary",
            color: "#FF6B6E", // ピンク系
            height: "sm",
            action: {
              type: "postback",
              label: "ブックマークに追加",
              data: `action=bookmark&eventId=${event.id}&userId=${userId}`,
            },
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "text",
                    text: event.format === "ONLINE" ? "オンライン" : event.format === "HYBRID" ? "ハイブリッド" : "オフライン",
                    size: "xs",
                    color: event.format === "ONLINE" ? "#1DB446" : event.format === "HYBRID" ? "#9932CC" : "#FF8C00",
                    align: "center",
                    weight: "bold"
                  }
                ],
                width: "60%",
                backgroundColor: event.format === "ONLINE" ? "#E8F9E9" : event.format === "HYBRID" ? "#F1E8F9" : "#F9F1E8",
                cornerRadius: "4px",
                paddingAll: "2px"
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "text",
                    text: event.eventType || "イベント",
                    size: "xs",
                    color: "#666666",
                    align: "center",
                    weight: "bold"
                  }
                ],
                width: "40%",
                backgroundColor: "#F5F5F5",
                cornerRadius: "4px",
                paddingAll: "2px"
              }
            ],
            spacing: "xs",
            margin: "md"
          }
        ],
        flex: 0,
      },
    };
  });

  // カルーセルテンプレートを作成
  const carouselMessage = {
    type: "flex",
    altText: "おすすめイベント情報",
    contents: {
      type: "carousel",
      contents: bubbles,
    },
  };

  return carouselMessage;
};

/**
 * イベントリマインドメッセージを生成する
 * @param event イベント
 * @param eventDate イベント日付（表示用）
 * @returns リマインドメッセージオブジェクト
 */
export const createEventReminderMessage = (event: Event, eventDate: Date) => {
  const reminderMessage = {
    type: "flex",
    altText: `【イベントリマインド】「${event.title}」が1週間後に開催されます`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "イベントリマインド",
            weight: "bold",
            color: "#FFFFFF",
            size: "md",
          },
        ],
        backgroundColor: "#FF5551",
        paddingTop: "12px",
        paddingBottom: "12px",
        paddingStart: "16px",
        paddingEnd: "16px",
      },
      hero: {
        type: "image",
        url:
          event.image ||
          "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png",
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: event.title,
            weight: "bold",
            size: "xl",
            wrap: true,
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "日時",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 1,
                  },
                  {
                    type: "text",
                    text: `${eventDate.toISOString().split("T")[0]} ${
                      event.startTime
                    }〜${event.endTime || "終了時間未定"}`,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5,
                  },
                ],
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "場所",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 1,
                  },
                  {
                    type: "text",
                    text: event.venue,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5,
                  },
                ],
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "形式",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 1,
                  },
                  {
                    type: "text",
                    text: event.format,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5,
                  },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "link",
            height: "sm",
            action: {
              type: "uri",
              label: "詳細を見る",
              uri: event.detailUrl || `https://example.com/events/${event.id}`,
            },
          },
        ],
        flex: 0,
      },
    },
  };

  return reminderMessage;
};
