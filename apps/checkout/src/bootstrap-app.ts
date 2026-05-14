import { Component } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import "./styles.css";

@Component({
  standalone: true,
  selector: "angular-preview-root",
  template: `
    <main class="angular-preview">
      <h1>Checkout MFE</h1>
      <p>
        This domain exposes the Angular Checkout Items, Checkout Summary, and Apply
        Coupon components via Module Federation, plus serves the Empty Checkout
        iframe page.
      </p>
    </main>
  `,
})
class AngularPreviewComponent {}

if (document.getElementById("root")) {
  bootstrapApplication(AngularPreviewComponent);
}
