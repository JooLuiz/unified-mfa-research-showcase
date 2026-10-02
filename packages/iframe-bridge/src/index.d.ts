export const IFRAME_BRIDGE_TOPIC: string;
export const IFRAME_BRIDGE_MESSAGE_EVENT: string;
export const RESIZED_EVENT: string;
export const FAQ_SUBMITTED_EVENT: string;
export const POST_SUBMITTED_EVENT: string;
export const GO_SHOPPING_EVENT: string;

export interface IframeTransportMessage {
  topic: string;
  event: string;
  payload?: object;
  scope?: string;
}

export interface IframeTransport {
  publish(message: IframeTransportMessage): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload?: unknown }) => void,
  ): () => void;
}

export interface IframeBridge {
  publishIframeMessage(eventName: string, payload?: object): void;
  subscribeToIframeEvent(eventName: string, listener: (payload: unknown) => void): () => void;
}

export function createPostMessageTransport(): IframeTransport;
export function createIframeBridge(transport: IframeTransport): IframeBridge;
