/**
 * Click Tracker Utility for Frontend
 * このファイルは参考実装です。実際のフロントエンドで使用する際は、
 * フロントエンドプロジェクトにコピーして使用してください。
 */

export interface ClickTrackingConfig {
  apiEndpoint: string;
  userId?: string;
  sessionId?: string;
  enableConsoleLog?: boolean;
  batchSize?: number;
  flushInterval?: number;
}

export interface ClickEvent {
  elementType?: string;
  elementId?: string;
  elementClass?: string;
  elementText?: string;
  pageUrl: string;
  pagePath: string;
  coordinateX?: number;
  coordinateY?: number;
  eventId?: string;
  metadata?: Record<string, any>;
}

export class ClickTracker {
  private config: ClickTrackingConfig;
  private eventQueue: ClickEvent[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(config: ClickTrackingConfig) {
    this.config = {
      batchSize: 10,
      flushInterval: 5000, // 5 seconds
      enableConsoleLog: false,
      ...config,
    };

    // Auto-flush timer
    if (this.config.flushInterval) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }

    // Flush on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.flush();
      });
    }
  }

  /**
   * Track a click event
   */
  public trackClick(event: MouseEvent, additionalData?: Partial<ClickEvent>): void {
    try {
      const target = event.target as HTMLElement;
      
      const clickEvent: ClickEvent = {
        elementType: target.tagName?.toLowerCase(),
        elementId: target.id || undefined,
        elementClass: target.className || undefined,
        elementText: this.getElementText(target),
        pageUrl: window.location.href,
        pagePath: window.location.pathname,
        coordinateX: event.clientX,
        coordinateY: event.clientY,
        ...additionalData,
      };

      this.addToQueue(clickEvent);

      if (this.config.enableConsoleLog) {
        console.log("Click tracked:", clickEvent);
      }
    } catch (error) {
      console.error("Error tracking click:", error);
    }
  }

  /**
   * Get meaningful text from an element
   */
  private getElementText(element: HTMLElement): string | undefined {
    // For buttons, get the text content
    if (element.tagName === "BUTTON") {
      return element.textContent?.trim() || undefined;
    }

    // For links, get the text content
    if (element.tagName === "A") {
      return element.textContent?.trim() || undefined;
    }

    // For inputs, get the value or placeholder
    if (element.tagName === "INPUT") {
      const input = element as HTMLInputElement;
      return input.value || input.placeholder || undefined;
    }

    // For images, get the alt text
    if (element.tagName === "IMG") {
      const img = element as HTMLImageElement;
      return img.alt || img.title || undefined;
    }

    // For other elements, get text content but limit length
    const text = element.textContent?.trim();
    if (text && text.length > 0) {
      return text.length > 100 ? text.substring(0, 100) + "..." : text;
    }

    return undefined;
  }

  /**
   * Add event to queue and flush if needed
   */
  private addToQueue(clickEvent: ClickEvent): void {
    this.eventQueue.push(clickEvent);

    if (this.eventQueue.length >= (this.config.batchSize || 10)) {
      this.flush();
    }
  }

  /**
   * Send queued events to the server
   */
  public async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Send events individually for now (could be optimized to batch)
      for (const event of eventsToSend) {
        await this.sendEvent(event);
      }
    } catch (error) {
      console.error("Error flushing click events:", error);
      // Re-add events to queue if sending failed
      this.eventQueue.unshift(...eventsToSend);
    }
  }

  /**
   * Send a single event to the server
   */
  private async sendEvent(clickEvent: ClickEvent): Promise<void> {
    const eventData = {
      ...clickEvent,
      userId: this.config.userId,
      sessionId: this.config.sessionId,
    };

    const response = await fetch(this.config.apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ClickTrackingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

/**
 * Auto-track all clicks on the page
 */
export function initializeAutoClickTracking(config: ClickTrackingConfig): ClickTracker {
  const tracker = new ClickTracker(config);

  if (typeof document !== "undefined") {
    document.addEventListener("click", (event) => {
      tracker.trackClick(event);
    });
  }

  return tracker;
}

/**
 * Generate a session ID for tracking
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}