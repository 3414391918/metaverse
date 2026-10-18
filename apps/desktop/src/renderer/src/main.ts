import { installNativeTextContextMenu } from "./composables/nativeTextContextMenu";
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";

const platform = /Mac|Macintosh/.test(navigator.userAgent) ? "darwin" : "other";
document.documentElement.dataset.platform = platform;

if (window.deepwrite?.textContextMenu) {
  const dispose = installNativeTextContextMenu(
    window.deepwrite.textContextMenu
  );
  import.meta.hot?.dispose(dispose);
}

createApp(App).use(createPinia()).mount("#app");
