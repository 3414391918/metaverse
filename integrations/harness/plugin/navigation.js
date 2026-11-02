/** Session restoration selects an internal panel; it must not navigate host settings. */
export function sessionPanelPatch(currentScreen, panelId) {
  const settings = ["models", "plugins", "presets"].includes(currentScreen);
  return {
    activePanelId: panelId,
    screen: settings
      ? currentScreen
      : panelId === "plugins"
        ? "plugins"
        : "assistant"
  };
}
