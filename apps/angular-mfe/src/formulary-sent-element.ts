import "@angular/compiler";
import { ApplicationRef, Component, Injector } from "@angular/core";
import { createCustomElement } from "@angular/elements";
import { createApplication } from "@angular/platform-browser";
import "./styles.css";

const customElementName = "angular-formulary-sent";

let formularyElementsApplicationPromise: Promise<ApplicationRef> | null = null;

const getFormularyElementsApplication = (): Promise<ApplicationRef> => {
  if (!formularyElementsApplicationPromise) {
    formularyElementsApplicationPromise = createApplication();
  }
  return formularyElementsApplicationPromise;
};

@Component({
  standalone: true,
  selector: customElementName,
  template: `
    <section class="formulary-sent-shell">
      <svg
        class="formulary-sent-icon"
        width="30"
        height="30"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.707 8.707-5 5a1 1 0 0 1-1.414 0l-2-2 1.414-1.414L11 13.586l4.293-4.293 1.414 1.414z"
        />
      </svg>
      <strong>form submitted successfully</strong>
    </section>
  `,
})
class FormularySentElementComponent {}

const ensureFormularyElementRegistered = (): void => {
  if (customElements.get(customElementName)) {
    return;
  }

  void getFormularyElementsApplication().then((applicationRef) => {
    if (customElements.get(customElementName)) {
      return;
    }

    const customElementConstructor = createCustomElement(FormularySentElementComponent, {
      injector: applicationRef.injector as Injector,
    });
    customElements.define(customElementName, customElementConstructor);
  });
};

export function registerFormularySentElement(): void {
  ensureFormularyElementRegistered();
}

export function mountFormularySent(containerElement: HTMLElement): () => void {
  ensureFormularyElementRegistered();
  const formularySentElement = document.createElement(customElementName);
  containerElement.appendChild(formularySentElement);

  return () => {
    containerElement.innerHTML = "";
  };
}
