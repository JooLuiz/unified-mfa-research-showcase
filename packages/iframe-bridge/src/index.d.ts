export interface IframeBridgeMessage {
  event: string;
  payload: Record<string, unknown>;
}

export interface IframeChannelInput {
  channelId: string;
  frameId: string;
}

export interface IframeBridge {
  registerIframeChannel(input: IframeChannelInput): void;
  unregisterIframeChannel(input: IframeChannelInput): void;
  publishIframeMessage(input: IframeChannelInput & IframeBridgeMessage): void;
  publishIframeMessage(eventName: string, payload?: object): void;
  subscribeToIframeChannel(input: IframeChannelInput & {
    onMessage(message: IframeBridgeMessage): void;
  }): () => void;
  subscribeToIframeEvent(
    eventName: string,
    listener: (payload: unknown) => void,
  ): () => void;
}

export function createIframeChannel(): string;

export type IframeTransport = {
  publish(message: object): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload?: unknown }) => void,
  ): () => void;
};

export function createIframeBridge(input: IframeTransport): IframeBridge;
