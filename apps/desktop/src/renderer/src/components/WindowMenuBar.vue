<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, ref } from "vue";
import type { WindowFrameAction } from "@deepwrite/contracts";
import PopupSelect from "./PopupSelect.vue";
import { buildWindowFrameMenus } from "../composables/buildWindowFrameMenus";
import type {
  WorkspaceWindowActions,
  WindowFrameMenu
} from "../composables/windowFrameMenus";
import { uiMessage } from "../ui-feedback";
const WindowHelpDialog = defineAsyncComponent(
  () => import("./WindowHelpDialog.vue")
);
const props = defineProps<{
  actions: WorkspaceWindowActions;
  fullscreen: boolean;
  initialMenu: number;
  openInitially: boolean;
}>();
const emit = defineEmits<{ command: [action: WindowFrameAction] }>();
const selectors = ref<InstanceType<typeof PopupSelect>[]>([]);
const help = ref(false);
const menus = computed<WindowFrameMenu[]>(() =>
  buildWindowFrameMenus(props.actions).map((menu) => ({
    ...menu,
    options: [
      ...menu.options,
      ...(menu.label === "文件"
        ? [
            { value: "window:close", label: "关闭窗口", description: "Alt+F4" },
            { value: "window:quit", label: "退出 DeepWrite" }
          ]
        : []),
      ...(menu.label === "视图"
        ? [
            {
              value: "window:fullscreen",
              label: props.fullscreen ? "退出全屏" : "进入全屏",
              description: "F11"
            }
          ]
        : []),
      ...(menu.label === "帮助"
        ? [{ value: "window:help", label: "使用帮助与关于" }]
        : [])
    ]
  }))
);
async function run(menu: WindowFrameMenu, value: string | number) {
  try {
    if (value === "window:close") emit("command", "close");
    else if (value === "window:quit") emit("command", "quit");
    else if (value === "window:fullscreen") emit("command", "toggleFullscreen");
    else if (value === "window:help") {
      await nextTick();
      help.value = true;
    } else await menu.run(String(value));
  } catch {
    uiMessage.error("操作失败，请重试。");
  }
}
async function activate(index: number, open = true) {
  selectors.value.forEach((select) => select.closeMenu());
  selectors.value[index]?.trigger?.focus();
  if (open) await selectors.value[index]?.openMenu(true);
}
function navigate(index: number, direction: 1 | -1) {
  void activate(
    (index + direction + menus.value.length) % menus.value.length,
    selectors.value[index]?.open
  );
}
onMounted(() => {
  void activate(props.initialMenu, props.openInitially);
});
defineExpose({ activate });
</script>
<template>
  <nav role="menubar" aria-label="应用菜单" class="window-menus">
    <PopupSelect
      v-for="(menu, index) in menus"
      :key="menu.label"
      ref="selectors"
      variant="menu"
      size="small"
      model-value=""
      :placeholder="menu.label"
      :accessible-label="`${menu.label}菜单`"
      :options="menu.options"
      :menu-min-width="220"
      :menu-z-index="1100"
      @change="run(menu, $event)"
      @menu-navigate="navigate(index, $event)"
    />
  </nav>
  <WindowHelpDialog v-if="help" @close="help = false" />
</template>
