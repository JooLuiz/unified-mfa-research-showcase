async function bootstrapAngularPreview(): Promise<void> {
  await import("./polyfills");
  await import("./bootstrap-app");
}

bootstrapAngularPreview().catch((error: unknown) => {
  console.error("bootstrapAngularPreview - error");
  console.error(error);
});
