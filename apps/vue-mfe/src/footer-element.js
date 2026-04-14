import { defineCustomElement, h } from "vue";
import "./styles.css";

const FooterElementComponent = {
  props: {
    message: {
      type: String,
      default: "Copyright Message",
    },
  },
  setup(props) {
    return () =>
      h("footer", { class: "footer-shell" }, [h("span", props.message)]);
  },
};

export function registerFooterElement() {
  const customElementName = "vue-footer-mfe";
  if (!customElements.get(customElementName)) {
    const VueFooterElement = defineCustomElement(FooterElementComponent);
    customElements.define(customElementName, VueFooterElement);
  }
}
