import "./styles.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  rootElement.innerHTML = `
    <main class="angular-preview">
      <h1>Angular MFE Domain</h1>
      <p>
        This app exposes product components through Module Federation and provides
        an iframe page for Order Placed.
      </p>
    </main>
  `;
}
