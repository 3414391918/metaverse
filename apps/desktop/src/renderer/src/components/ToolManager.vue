<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useToolLibrary } from "../composables/useToolLibrary";
import { uiMessage } from "../ui-feedback";
import CharacterAssetDialog from "../features/character-assets/CharacterAssetDialog.vue";
const model = useToolLibrary(() => window.deepwrite?.toolLibrary);
const { snapshot, file, content, tool, busy, dirty } = model;
const query = ref("");
const newTool = ref(false),
  newFile = ref(false),
  deleteTool = ref(false),
  reloadFile = ref(false),
  relationsOpen = ref(false);
const name = ref(""),
  description = ref(""),
  path = ref("");
const listed = computed(
  () =>
    snapshot.value?.tools.filter((item) =>
      `${item.name} ${item.description}`
        .toLocaleLowerCase()
        .includes(query.value.toLocaleLowerCase())
    ) ?? []
);
const outgoing = computed(
  () =>
    tool.value?.relatedToolIds.map((id) => ({
      id,
      name:
        snapshot.value?.tools.find((item) => item.id === id)?.name ??
        `${id}（不存在）`
    })) ?? []
);
const incoming = computed(
  () =>
    snapshot.value?.tools.filter((item) =>
      item.relatedToolIds.includes(tool.value?.id ?? "")
    ) ?? []
);
const refresh = () => void model.refresh();
async function create() {
  if (!name.value.trim()) {
    uiMessage.warning("请输入工具名称。");
    return;
  }
  await model.create(name.value, description.value);
  newTool.value = false;
  name.value = "";
  description.value = "";
}
async function addFile() {
  if (await model.addFile(path.value)) {
    newFile.value = false;
    path.value = "";
  }
}
onMounted(() => {
  refresh();
  window.addEventListener("focus", refresh);
});
onBeforeUnmount(() => {
  window.removeEventListener("focus", refresh);
  model.dispose();
});
</script>

<template>
  <section class="tool-manager" aria-label="工具管理">
    <header class="tool-heading">
      <div>
        <h1>工具管理</h1>
        <p>编辑说明和代码，交给外部 Agent 使用。</p>
      </div>
      <div class="tool-actions">
        <button type="button" :disabled="busy" @click="refresh">重新读取</button
        ><button type="button" :disabled="busy" @click="newTool = true">
          ＋ 新增工具
        </button>
      </div>
    </header>
    <template v-if="!tool">
      <input
        v-model="query"
        type="search"
        aria-label="搜索工具"
        placeholder="搜索工具名称或说明"
        class="tool-search"
      />
      <p v-if="!snapshot" class="tool-empty">
        {{ busy ? "正在读取工具…" : "请重新读取工具目录。" }}
      </p>
      <div v-else class="tool-card-grid">
        <button
          v-for="item in listed"
          :key="item.id"
          class="tool-card"
          type="button"
          :disabled="busy"
          @click="model.open(item.id)"
        >
          <strong>{{ item.name }}</strong>
          <p>{{ item.description }}</p>
          <small>{{
            item.error ??
            `${item.files.length} 个文件 · ${item.relatedToolIds.length} 个关联工具`
          }}</small>
        </button>
        <p v-if="!listed.length" class="tool-empty">没有匹配的工具。</p>
      </div>
    </template>
    <template v-else>
      <div class="tool-detail-heading">
        <button type="button" :disabled="busy" @click="model.back">
          ← {{ model.history.value.length ? "返回上一工具" : "返回工具列表" }}
        </button>
        <div>
          <h2>{{ tool.name }}</h2>
          <p>{{ tool.description }}</p>
        </div>
        <button type="button" :disabled="busy" @click="model.copyPath(true)">
          复制入口路径
        </button>
        <button
          type="button"
          class="is-danger"
          :disabled="busy"
          @click="deleteTool = true"
        >
          删除工具
        </button>
      </div>
      <div class="tool-workbench">
        <aside class="tool-files" aria-label="工具文件">
          <div class="tool-panel-heading">
            <strong>文件</strong
            ><button type="button" :disabled="busy" @click="newFile = true">
              ＋
            </button>
          </div>
          <button
            v-for="entry in tool.files"
            :key="entry.path"
            type="button"
            :class="{ 'is-selected': file?.path === entry.path }"
            :disabled="busy"
            @click="model.open(tool.id, entry.path, false)"
          >
            {{ entry.path }}
          </button>
        </aside>
        <div class="tool-code-panel">
          <div class="tool-file-toolbar">
            <span
              >{{ file?.path }}
              <small>{{ dirty ? "未保存" : "已保存" }}</small></span
            >
            <div class="tool-actions">
              <button type="button" :disabled="busy" @click="model.copyPath()">
                复制绝对路径</button
              ><button
                type="button"
                :disabled="busy"
                @click="dirty ? (reloadFile = true) : model.reload()"
              >
                重新读取</button
              ><button
                type="button"
                class="dialog-primary-button"
                :disabled="busy || !dirty"
                @click="model.save"
              >
                保存
              </button>
            </div>
          </div>
          <textarea
            :value="content"
            :disabled="busy"
            aria-label="工具文件编辑器"
            spellcheck="false"
            @input="model.edit(($event.target as HTMLTextAreaElement).value)"
          />
        </div>
        <aside class="tool-relations" aria-label="关联工具">
          <div class="tool-panel-heading">
            <strong>关联工具</strong
            ><button
              type="button"
              :disabled="busy"
              @click="relationsOpen = true"
            >
              编辑
            </button>
          </div>
          <p class="tool-hint">当前工具使用</p>
          <button
            v-for="related in outgoing"
            :key="related.id"
            type="button"
            :disabled="busy"
            @click="model.open(related.id)"
          >
            {{ related.name }} →
          </button>
          <p v-if="!outgoing.length" class="tool-hint">暂无关联</p>
          <p class="tool-hint incoming-title">使用当前工具</p>
          <button
            v-for="related in incoming"
            :key="related.id"
            type="button"
            :disabled="busy"
            @click="model.open(related.id)"
          >
            {{ related.name }} →
          </button>
          <p v-if="!incoming.length" class="tool-hint">暂无引用</p>
        </aside>
      </div>
    </template>
    <CharacterAssetDialog
      v-if="newTool"
      title="新增工具"
      :busy="busy"
      @close="newTool = false"
    >
      <label class="tool-field"
        >工具名称<input v-model="name" maxlength="200" /></label
      ><label class="tool-field"
        >说明<textarea v-model="description" maxlength="4000" />
      </label>
      <template #actions
        ><button type="button" :disabled="busy" @click="newTool = false">
          取消</button
        ><button type="button" :disabled="busy" @click="create">
          创建工具
        </button></template
      >
    </CharacterAssetDialog>
    <CharacterAssetDialog
      v-if="newFile"
      title="新增工具文件"
      :busy="busy"
      @close="newFile = false"
    >
      <label class="tool-field"
        >文件路径<input v-model="path" placeholder="例如 scripts/check.mjs"
      /></label>
      <template #actions
        ><button type="button" :disabled="busy" @click="newFile = false">
          取消</button
        ><button type="button" :disabled="busy" @click="addFile">
          创建文件
        </button></template
      >
    </CharacterAssetDialog>
    <CharacterAssetDialog
      v-if="deleteTool"
      title="删除工具"
      :busy="busy"
      @close="deleteTool = false"
    >
      <p>
        确认删除“{{
          tool?.name
        }}”及其全部文件吗？此操作无法撤销。被其它工具引用时，需要先解除关联。
      </p>
      <template #actions
        ><button type="button" @click="deleteTool = false">取消</button
        ><button
          type="button"
          class="is-danger"
          :disabled="busy"
          @click="model.remove().then(() => (deleteTool = false))"
        >
          确认删除
        </button></template
      >
    </CharacterAssetDialog>
    <CharacterAssetDialog
      v-if="reloadFile"
      title="重新读取文件"
      @close="reloadFile = false"
      ><p>重新读取会丢弃当前未保存内容。</p>
      <template #actions
        ><button type="button" @click="reloadFile = false">取消</button
        ><button
          type="button"
          @click="model.reload().then(() => (reloadFile = false))"
        >
          重新读取
        </button></template
      ></CharacterAssetDialog
    >
    <CharacterAssetDialog
      v-if="relationsOpen"
      title="关联工具"
      :busy="busy"
      @close="relationsOpen = false"
    >
      <label
        v-for="item in snapshot?.tools.filter((item) => item.id !== tool?.id)"
        :key="item.id"
        class="tool-relation-choice"
        ><input
          type="checkbox"
          :checked="tool?.relatedToolIds.includes(item.id)"
          :disabled="busy"
          @change="
            model.relate(item.id, ($event.target as HTMLInputElement).checked)
          "
        />{{ item.name }}</label
      >
    </CharacterAssetDialog>
  </section>
</template>

<style scoped src="./tool-manager.css"></style>
