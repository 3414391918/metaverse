/** Sharp stays external; stage its target-specific native runtime for the package. */
exports.beforeBuild = async function beforeBuild(context) {
  const { vendorSharpRuntime } = await import("./vendor-sharp-runtime.mjs");
  await vendorSharpRuntime(
    context.appDir,
    context.platform.nodeName,
    context.arch
  );
  // Other runtime dependencies are bundled; avoid copying the pnpm tree into ASAR.
  return false;
};
