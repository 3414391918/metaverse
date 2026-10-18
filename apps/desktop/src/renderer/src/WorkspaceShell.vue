<script setup lang="ts">
import WorkspaceShellContent from "./components/WorkspaceShellContent.vue";
import { useWorkspaceShell } from "./composables/shell/useWorkspaceShell";
useWorkspaceShell();
</script>
<template><WorkspaceShellContent /></template>
