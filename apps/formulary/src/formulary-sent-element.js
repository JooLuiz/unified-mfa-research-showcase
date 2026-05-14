import { defineCustomElement, h } from "vue";
import "./styles.css";

const customElementName = "vue-formulary-sent";

const FormularySentElementComponent = {
  setup() {
    return () =>
      h("section", { class: "formulary-sent-shell" }, [
        h(
          "svg",
          {
            class: "formulary-sent-icon",
            width: "30",
            height: "30",
            viewBox: "0 0 24 24",
            "aria-hidden": "true",
          },
          [
            h("path", {
              fill: "currentColor",
              d: "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.707 8.707-5 5a1 1 0 0 1-1.414 0l-2-2 1.414-1.414L11 13.586l4.293-4.293 1.414 1.414z",
            }),
          ],
        ),
        h("strong", "form submitted successfully"),
      ]);
  },
};

export function registerFormularySentElement() {
  if (!customElements.get(customElementName)) {
    const FormularySentElement = defineCustomElement(FormularySentElementComponent);
    customElements.define(customElementName, FormularySentElement);
  }
}

export function mountFormularySent(containerElement) {
  registerFormularySentElement();
  const formularySentElement = document.createElement(customElementName);
  containerElement.appendChild(formularySentElement);

  return () => {
    containerElement.innerHTML = "";
  };
}
