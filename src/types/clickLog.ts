export interface ClickLogData {
  userId?: string;
  sessionId?: string;
  elementType?: string;
  elementId?: string;
  elementClass?: string;
  elementText?: string;
  pageUrl: string;
  pagePath: string;
  coordinateX?: number;
  coordinateY?: number;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  eventId?: string;
  metadata?: Record<string, any>;
}

export interface ClickLogResponse {
  id: string;
  userId?: string;
  sessionId?: string;
  elementType?: string;
  elementId?: string;
  elementClass?: string;
  elementText?: string;
  pageUrl: string;
  pagePath: string;
  coordinateX?: number;
  coordinateY?: number;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  eventId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface ClickLogQueryParams {
  userId?: string;
  sessionId?: string;
  pageUrl?: string;
  pagePath?: string;
  elementType?: string;
  eventId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ClickLogStats {
  totalClicks: number;
  uniqueUsers: number;
  uniqueSessions: number;
  topPages: Array<{
    pageUrl: string;
    count: number;
  }>;
  topElements: Array<{
    elementType: string;
    elementText?: string;
    count: number;
  }>;
}