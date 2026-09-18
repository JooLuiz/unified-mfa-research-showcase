/**
 * Account profile remote for profile-save intents.
 * Role: Renders the profile form and publishes account.profile-save-requested on the host mesh.
 * Not in this file: Mesh configuration or HTTP account persistence (shell owns those).
 * Key dependencies: event-mesh/mesh singleton; @shared/account-events.
 * See also: MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import { createApp, h, reactive } from "vue";
import mesh from "event-mesh/mesh";
import { createAccountEvents } from "@shared/account-events";
import "./styles.css";

const { publishProfileSaveRequested } = createAccountEvents({ mesh });

const AccountProfileComponent = {
  props: {
    user: {
      type: Object,
      default: () => null,
    },
  },
  setup(props) {
    const formState = reactive({
      fullName: props.user?.fullName || "",
      gender: props.user?.gender || "",
    });

    const handleSubmit = (submitEvent) => {
      submitEvent.preventDefault();
      publishProfileSaveRequested({
        fullName: formState.fullName.trim(),
        gender: formState.gender.trim(),
      });
    };

    return () => {
      const username = props.user?.username || "(unknown)";
      const email = props.user?.email || "(unknown)";
      const avatarUrl = props.user?.avatarUrl;

      return h("section", { class: "account-card" }, [
        h("header", { class: "account-card-header" }, [
          avatarUrl
            ? h("img", {
                class: "account-avatar",
                src: avatarUrl,
                alt: `${username} avatar`,
              })
            : null,
          h("div", null, [
            h("h2", { class: "account-card-title" }, "Profile"),
            h("p", { class: "account-card-subtitle" }, [
              h("strong", "Username: "),
              h("span", username),
            ]),
            h("p", { class: "account-card-subtitle" }, [
              h("strong", "Email: "),
              h("span", email),
            ]),
          ]),
        ]),
        h(
          "form",
          { class: "account-form", onSubmit: handleSubmit },
          [
            h("label", { class: "account-form-label", for: "fullNameInput" }, "Full name"),
            h("input", {
              id: "fullNameInput",
              class: "account-form-input",
              type: "text",
              value: formState.fullName,
              onInput: (inputEvent) => {
                formState.fullName = inputEvent.target.value;
              },
            }),
            h("label", { class: "account-form-label", for: "genderInput" }, "Gender"),
            h(
              "select",
              {
                id: "genderInput",
                class: "account-form-input",
                value: formState.gender,
                onChange: (changeEvent) => {
                  formState.gender = changeEvent.target.value;
                },
              },
              [
                h("option", { value: "" }, "Prefer not to say"),
                h("option", { value: "female" }, "Female"),
                h("option", { value: "male" }, "Male"),
                h("option", { value: "non-binary" }, "Non-binary"),
                h("option", { value: "other" }, "Other"),
              ],
            ),
            h(
              "button",
              { class: "account-form-button", type: "submit" },
              "Save profile",
            ),
          ],
        ),
      ]);
    };
  },
};

export function mountAccountProfile(containerElement, props) {
  const accountProfileApp = createApp(AccountProfileComponent, {
    user: props.user,
  });
  accountProfileApp.mount(containerElement);

  return () => {
    accountProfileApp.unmount();
    containerElement.innerHTML = "";
  };
}
