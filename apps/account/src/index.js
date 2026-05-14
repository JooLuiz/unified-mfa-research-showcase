import { createApp, h } from "vue";
import "./styles.css";

const PreviewComponent = {
  setup() {
    return () =>
      h("main", { class: "vue-preview" }, [
        h("h1", "Account MFE"),
        h(
          "p",
          "This domain exposes the Vue Account Profile and Account Address components via Module Federation.",
        ),
      ]);
  },
};

const rootElement = document.getElementById("root");
if (rootElement) {
  createApp(PreviewComponent).mount(rootElement);
}
