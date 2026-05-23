const NEW_POST_FORMULARY_HTML_PATH = "faq-formulary.html";
const NEW_POST_FRAME_ID = "new-post-formulary";

function buildNewPostFormularyUrl(props) {
  const baseUrl = new URL(NEW_POST_FORMULARY_HTML_PATH, __webpack_public_path__);
  const queryParameters = new URLSearchParams({ type: "post" });

  if (props.userName) {
    queryParameters.set("name", props.userName);
  }
  if (props.userEmail) {
    queryParameters.set("email", props.userEmail);
  }
  if (props.authorId) {
    queryParameters.set("authorId", props.authorId);
  }

  baseUrl.search = queryParameters.toString();
  return baseUrl.toString();
}

function handleIframeResize(event) {
  const messageData = event.data;
  if (!messageData || typeof messageData !== "object") {
    return;
  }

  if (messageData.type !== "iframe:resize") {
    return;
  }

  const frameId = messageData.payload?.frameId;
  const rawHeight = Number(messageData.payload?.height);

  if (frameId !== NEW_POST_FRAME_ID || !Number.isFinite(rawHeight)) {
    return;
  }

  const frameElement = document.querySelector(
    `iframe[data-frame-id="${NEW_POST_FRAME_ID}"]`,
  );
  if (frameElement) {
    frameElement.style.height = `${Math.max(rawHeight, 80)}px`;
  }
}

export function mountNewPostFormulary(containerElement, props = {}) {
  const iframeSource = buildNewPostFormularyUrl(props);

  containerElement.innerHTML = `
    <section class="frame-container">
      <iframe
        data-frame-id="${NEW_POST_FRAME_ID}"
        title="Create new post"
        src="${iframeSource}"
        scrolling="no"
      ></iframe>
    </section>
  `;

  const iframeElement = containerElement.querySelector("iframe");
  if (iframeElement) {
    iframeElement.style.height = "0px";
  }

  function handlePostMessage(event) {
    const messageData = event.data;
    if (!messageData || typeof messageData !== "object") {
      return;
    }

    if (messageData.type === "post:form-submitted" && props.onFormSubmitted) {
      props.onFormSubmitted(messageData.payload);
    }
  }

  window.addEventListener("message", handleIframeResize);
  window.addEventListener("message", handlePostMessage);

  return () => {
    window.removeEventListener("message", handleIframeResize);
    window.removeEventListener("message", handlePostMessage);
    containerElement.innerHTML = "";
  };
}
