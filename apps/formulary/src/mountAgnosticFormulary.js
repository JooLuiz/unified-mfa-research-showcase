/**
 * Mounts the agnostic FAQ and new-post formulary into the iframe document.
 * Role: Owns the form definitions, query-parameter reader, Vue form, and submit/resize bridge calls for the faq-formulary.html page.
 * Not in this file: The host-side iframe URL builder (src/faq-formulary.js, src/new-post-formulary.js).
 * Key dependencies: vue; @shared/server-events (createFrameMessageEvents); src/iframe-bridge-client.js.
 * See also: public/faq-formulary.html; src/iframe-bridge-client.js.
 */

import { createApp, reactive, h, onMounted, watch } from "vue";
import { createFrameMessageEvents } from "@shared/server-events";
import {
  publishIframeResize,
  publishFormularySubmitted,
} from "./iframe-bridge-client";

const formularyTransport = createFrameMessageEvents();

const FORMULARY_TYPE_FAQ = "faq";
const FORMULARY_TYPE_POST = "post";

const FORMULARY_DEFINITIONS = {
  [FORMULARY_TYPE_FAQ]: {
    title: "FAQ Formulary",
    submittedMessageType: "faq:form-submitted",
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        placeholder: "Type your name",
        autofillFromQueryParam: "name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        placeholder: "Type your email",
        autofillFromQueryParam: "email",
      },
      {
        name: "contactMethod",
        label: "How would you like to be contacted?",
        type: "select",
        options: [
          { value: "", label: "Choose one option" },
          { value: "email", label: "Email" },
          { value: "phone", label: "Phone" },
          { value: "whatsapp", label: "WhatsApp" },
        ],
      },
      {
        name: "question",
        label: "Your question",
        type: "text",
        placeholder: "Type your question",
      },
    ],
    frameId: "faq-formulary",
  },
  [FORMULARY_TYPE_POST]: {
    title: "Create a new post",
    submittedMessageType: "post:form-submitted",
    fields: [
      {
        name: "content",
        label: "What do you want to share?",
        type: "textarea",
        placeholder: "Write your post here",
        required: true,
      },
      {
        name: "imageUrl",
        label: "Image URL (optional)",
        type: "text",
        placeholder: "https://example.com/image.jpg",
        required: false,
      },
    ],
    frameId: "new-post-formulary",
  },
};

/**
 * Reads the iframe query string for the form type and autofill values.
 *
 * @returns {{ type: string, getValue: (parameterName: string) => string }} Form type and a query value reader.
 */
function readQueryParameters() {
  const queryParameters = new URLSearchParams(window.location.search);
  return {
    type: queryParameters.get("type") || FORMULARY_TYPE_FAQ,
    getValue: (parameterName) => queryParameters.get(parameterName) || "",
  };
}

const queryParameters = readQueryParameters();
const formularyDefinition =
  FORMULARY_DEFINITIONS[queryParameters.type] ||
  FORMULARY_DEFINITIONS[FORMULARY_TYPE_FAQ];

/**
 * Publishes the current document height for the active formulary frame.
 *
 * @returns {void}
 * @sideEffects Publishes an iframe resized message to the parent window.
 */
function notifyHostHeight() {
  publishIframeResize(formularyTransport, formularyDefinition.frameId);
}

const AgnosticFormularyComponent = {
  setup() {
    const initialValues = formularyDefinition.fields.reduce(
      (accumulator, fieldDefinition) => {
        const autofillKey = fieldDefinition.autofillFromQueryParam;
        const autofilledValue = autofillKey
          ? queryParameters.getValue(autofillKey)
          : "";
        accumulator[fieldDefinition.name] = autofilledValue || "";
        return accumulator;
      },
      {},
    );
    const formValues = reactive(initialValues);

    const isFormValid = () => {
      return formularyDefinition.fields.every((fieldDefinition) => {
        if (fieldDefinition.required === false) {
          return true;
        }
        const fieldValue = formValues[fieldDefinition.name];
        return typeof fieldValue === "string" && fieldValue.trim() !== "";
      });
    };

    const handleSubmit = () => {
      if (!isFormValid()) {
        return;
      }

      const trimmedPayload = formularyDefinition.fields.reduce(
        (accumulator, fieldDefinition) => {
          const rawValue = formValues[fieldDefinition.name];
          accumulator[fieldDefinition.name] =
            typeof rawValue === "string" ? rawValue.trim() : rawValue;
          return accumulator;
        },
        {},
      );

      publishFormularySubmitted(
        formularyTransport,
        formularyDefinition.submittedMessageType,
        trimmedPayload,
      );

      formularyDefinition.fields.forEach((fieldDefinition) => {
        formValues[fieldDefinition.name] = "";
      });
      notifyHostHeight();
    };

    const renderFieldInput = (fieldDefinition) => {
      const sharedAttributes = {
        id: `${fieldDefinition.name}Input`,
        value: formValues[fieldDefinition.name],
        onInput: (changeEvent) => {
          formValues[fieldDefinition.name] = changeEvent.target.value;
        },
      };

      if (fieldDefinition.type === "select") {
        return h(
          "select",
          {
            id: `${fieldDefinition.name}Input`,
            value: formValues[fieldDefinition.name],
            onChange: (changeEvent) => {
              formValues[fieldDefinition.name] = changeEvent.target.value;
            },
          },
          (fieldDefinition.options || []).map((optionDefinition) =>
            h(
              "option",
              { value: optionDefinition.value },
              optionDefinition.label,
            ),
          ),
        );
      }

      if (fieldDefinition.type === "textarea") {
        return h("textarea", {
          ...sharedAttributes,
          placeholder: fieldDefinition.placeholder || "",
        });
      }

      return h("input", {
        ...sharedAttributes,
        type: fieldDefinition.type || "text",
        placeholder: fieldDefinition.placeholder || "",
      });
    };

    onMounted(() => {
      requestAnimationFrame(notifyHostHeight);
    });

    watch(
      () =>
        formularyDefinition.fields
          .map((fieldDefinition) => formValues[fieldDefinition.name])
          .join("|"),
      () => {
        requestAnimationFrame(notifyHostHeight);
      },
    );

    return () =>
      h("section", { class: "formulary-shell" }, [
        h("h2", formularyDefinition.title),
        ...formularyDefinition.fields.flatMap((fieldDefinition) => [
          h(
            "label",
            { for: `${fieldDefinition.name}Input` },
            fieldDefinition.label,
          ),
          renderFieldInput(fieldDefinition),
        ]),
        h("div", null, [
          h(
            "button",
            { type: "button", onClick: handleSubmit },
            "Send",
          ),
        ]),
      ]);
  },
};

createApp(AgnosticFormularyComponent).mount("#formularyRoot");

window.addEventListener("load", notifyHostHeight);
window.addEventListener("resize", notifyHostHeight);
