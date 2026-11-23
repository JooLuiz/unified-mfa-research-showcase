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
  whenConnected(options?: { timeoutMs?: number }): Promise<void>;
};

export type ServerEventClient = {
  publish(message: ServerEventMessage): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload?: object }) => void,
  ): () => void;
  whenConnected(options?: { timeoutMs?: number }): Promise<void>;
};

export declare function createServerEvents(input: {
  client: ServerEventClient;
  getApiBaseUrl: () => string;
  getAuthToken?: () => string;
  endpoints?: {
    requests?: object;
    connections?: object;
  };
}): ServerEventTransport;

export declare function composeShellTransport(input: {
  serverEvents: ServerEventTransport;
}): ServerEventTransport;
