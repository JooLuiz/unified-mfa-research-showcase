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
  subscribeToIframeChannel(input: IframeChannelInput & {
    onMessage(message: IframeBridgeMessage): void;
  }): () => void;
}

export function createIframeChannel(): string;
export function createIframeBridge(input: {
  mesh: {
    publish(input: object): void;
    subscribe(
      topic: string,
      event: string,
      callback: (message: { payload: unknown }) => void,
    ): () => void;
  };
}): IframeBridge;
