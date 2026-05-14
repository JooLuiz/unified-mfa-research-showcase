import { createApp, h } from "vue";
import "./styles.css";

const PreviewComponent = {
  setup() {
    return () =>
      h("main", { class: "vue-preview" }, [
        h("h1", "Global Layout - Footer"),
        h("p", "This sub-project exposes the Vue Footer Web Component via Module Federation."),
      ]);
  },
};

const rootElement = document.getElementById("root");
if (rootElement) {
  createApp(PreviewComponent).mount(rootElement);
}
