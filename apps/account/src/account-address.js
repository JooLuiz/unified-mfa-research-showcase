import { createApp, h, reactive } from "vue";
import "./styles.css";

const AccountAddressComponent = {
  props: {
    address: {
      type: Object,
      default: () => null,
    },
    onSaveAddress: Function,
  },
  setup(props) {
    const formState = reactive({
      street: props.address?.street || "",
      city: props.address?.city || "",
      state: props.address?.state || "",
      postalCode: props.address?.postalCode || "",
      country: props.address?.country || "",
    });

    const handleSubmit = (submitEvent) => {
      submitEvent.preventDefault();
      if (typeof props.onSaveAddress === "function") {
        props.onSaveAddress({
          street: formState.street.trim(),
          city: formState.city.trim(),
          state: formState.state.trim(),
          postalCode: formState.postalCode.trim(),
          country: formState.country.trim(),
        });
      }
    };

    const buildField = (fieldId, fieldLabel, fieldKey) =>
      h("div", { class: "account-form-field" }, [
        h("label", { class: "account-form-label", for: fieldId }, fieldLabel),
        h("input", {
          id: fieldId,
          class: "account-form-input",
          type: "text",
          value: formState[fieldKey],
          onInput: (inputEvent) => {
            formState[fieldKey] = inputEvent.target.value;
          },
        }),
      ]);

    return () =>
      h("section", { class: "account-card" }, [
        h("header", { class: "account-card-header" }, [
          h("div", null, [h("h2", { class: "account-card-title" }, "Shipping Address")]),
        ]),
        h(
          "form",
          { class: "account-form account-form-grid", onSubmit: handleSubmit },
          [
            buildField("streetInput", "Street", "street"),
            buildField("cityInput", "City", "city"),
            buildField("stateInput", "State", "state"),
            buildField("postalCodeInput", "Postal code", "postalCode"),
            buildField("countryInput", "Country", "country"),
            h(
              "button",
              { class: "account-form-button", type: "submit" },
              "Save address",
            ),
          ],
        ),
      ]);
  },
};

export function mountAccountAddress(containerElement, props) {
  const accountAddressApp = createApp(AccountAddressComponent, {
    address: props.address,
    onSaveAddress: props.onSaveAddress,
  });
  accountAddressApp.mount(containerElement);

  return () => {
    accountAddressApp.unmount();
    containerElement.innerHTML = "";
  };
}
