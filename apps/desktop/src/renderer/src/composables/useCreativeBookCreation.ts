import type { Ref } from "vue";
import type { CreateLongBookInput } from "@deepwrite/contracts";
import { uiMessage } from "../ui-feedback";

export interface CreativeBookCreationOptions {
  open: Ref<boolean>;
  pending(): boolean;
  createLong(input: CreateLongBookInput): Promise<void>;
}
export function useCreativeBookCreation(options: CreativeBookCreationOptions) {
  function closeCreateBookDialog() {
    if (!options.pending()) options.open.value = false;
  }
  function openCreateBookDialog() {
    if (!window.deepwrite) {
      uiMessage.warning("浏览器预览不能保存作品，请使用桌面客户端创建。");
      return;
    }
    options.open.value = true;
  }
  async function createCreativeBook(input: CreateLongBookInput) {
    // contextBridge cannot clone nested Vue proxies from the binding form.
    const snapshot = JSON.parse(JSON.stringify(input)) as CreateLongBookInput;
    await options.createLong(snapshot);
  }
  return { closeCreateBookDialog, openCreateBookDialog, createCreativeBook };
}
