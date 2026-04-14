import { createApp, h } from "vue";
import "./styles.css";

const PreviewComponent = {
  setup() {
    return () =>
      h("main", { class: "vue-preview" }, [
        h("h1", "Vue MFE Remote"),
        h("p", "This app exposes Footer web component and Checkout Summary remote module."),
      ]);
  },
};

const rootElement = document.getElementById("root");
if (rootElement) {
  createApp(PreviewComponent).mount(rootElement);
}
