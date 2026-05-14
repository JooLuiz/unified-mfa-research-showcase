import { createApp, h } from "vue";
import "./styles.css";

const PreviewComponent = {
  setup() {
    return () =>
      h("main", { class: "vue-preview" }, [
        h("h1", "Product Card MFE"),
        h("p", "This domain exposes the Vue Product Card via Module Federation."),
      ]);
  },
};

const rootElement = document.getElementById("root");
if (rootElement) {
  createApp(PreviewComponent).mount(rootElement);
}
