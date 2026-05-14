import { Component } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import "./polyfills";
import "./styles.css";

@Component({
  standalone: true,
  selector: "angular-preview-root",
  template: `
    <main class="angular-preview">
      <h1>Product Showcase MFE</h1>
      <p>This domain exposes the Angular Product Showcase via Module Federation.</p>
    </main>
  `,
})
class AngularPreviewComponent {}

if (document.getElementById("root")) {
  bootstrapApplication(AngularPreviewComponent);
}
