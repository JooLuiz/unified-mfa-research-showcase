import React from "react";
import { createRoot } from "react-dom/client";
import { SinglePostView } from "./SinglePostView";
import "./styles.css";

/**
 * Mounts the single post view into a DOM container element.
 *
 * @param {HTMLElement} containerElement
 * @param {{
 *   postId: string,
 *   apiBaseUrl: string,
 *   authToken?: string,
 *   currentUserId?: string,
 *   navigate?: (path: string) => void,
 *   canLike?: boolean
 * }} props
 * @returns {() => void} Cleanup function
 */
export function mountSinglePost(containerElement, props) {
  const root = createRoot(containerElement);
  root.render(
    <SinglePostView
      postId={props?.postId}
      apiBaseUrl={props?.apiBaseUrl}
      authToken={props?.authToken}
      currentUserId={props?.currentUserId}
      canLike={props?.canLike}
    />,
  );

  return () => {
    root.unmount();
  };
}
