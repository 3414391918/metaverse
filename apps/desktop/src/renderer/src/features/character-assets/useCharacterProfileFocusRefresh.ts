import { onScopeDispose } from "vue";

/** External tools write existing profile/asset files; returning to the window only rereads. */
export function useCharacterProfileFocusRefresh(refresh: () => void) {
  const onVisible = () => {
    if (document.visibilityState === "visible") refresh();
  };
  window.addEventListener("focus", refresh);
  if (typeof document !== "undefined")
    document.addEventListener("visibilitychange", onVisible);
  onScopeDispose(() => {
    window.removeEventListener("focus", refresh);
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", onVisible);
  });
}
