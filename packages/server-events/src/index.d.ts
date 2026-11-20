export type ServerEventMessage = {
  topic: string;
  event: string;
  payload?: object;
  scope?: string;
};

export type ServerEventTransport = {
  publish(message: ServerEventMessage): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload?: object }) => void,
  ): () => void;
  request(message: {
    topic: string;
    event: string;
    payload?: object;
  }): Promise<{ ok: boolean; code?: string; status?: number }>;
  whenConnected(): Promise<void>;
};

export declare function createServerEvents(input: {
  getApiBaseUrl: () => string;
  getAuthToken?: () => string;
  getStockSessionId?: () => string;
  endpoints?: {
    requests?: object;
    publishes?: object;
    connections?: object;
  };
}): ServerEventTransport;

export declare function composeShellTransport(input: {
  browserTransport: {
    publish(message: ServerEventMessage): void;
    subscribe(
      topic: string,
      event: string,
      callback: (message: { payload?: object }) => void,
    ): () => void;
  };
  serverEvents: ServerEventTransport;
  isWindowContract: (topic: string, event: string) => boolean;
}): ServerEventTransport;
