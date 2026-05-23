const FAQ_FORMULARY_HTML_PATH = "faq-formulary.html";
const FAQ_FRAME_ID = "faq-formulary";

function buildFaqFormularyUrl(props) {
  const baseUrl = new URL(FAQ_FORMULARY_HTML_PATH, __webpack_public_path__);
  const queryParameters = new URLSearchParams({ type: "faq" });

  if (props.userName) {
    queryParameters.set("name", props.userName);
  }
  if (props.userEmail) {
    queryParameters.set("email", props.userEmail);
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

  if (frameId !== FAQ_FRAME_ID || !Number.isFinite(rawHeight)) {
    return;
  }

  const frameElement = document.querySelector(
    `iframe[data-frame-id="${FAQ_FRAME_ID}"]`,
  );
  if (frameElement) {
    frameElement.style.height = `${Math.max(rawHeight, 80)}px`;
  }
}

export function mountFaqFormulary(containerElement, props = {}) {
  const iframeSource = buildFaqFormularyUrl(props);

  containerElement.innerHTML = `
    <section class="frame-container">
      <iframe
        data-frame-id="${FAQ_FRAME_ID}"
        title="FAQ Formulary"
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

    if (messageData.type === "faq:form-submitted" && props.onFormSubmitted) {
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
