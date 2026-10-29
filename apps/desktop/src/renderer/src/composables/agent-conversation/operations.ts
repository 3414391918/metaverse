import type { PersistenceControllerOperations } from "./persistence-controller-operations";
import type { RunLifecycleOperations } from "./run-lifecycle-operations";
import type { ApprovalsOperations } from "./approvals-operations";
import type { SessionLifecycleOperations } from "./session-lifecycle-operations";
import type { RunSettingsOperations } from "./run-settings-operations";

export type AgentConversationOperations = PersistenceControllerOperations &
  RunLifecycleOperations &
  ApprovalsOperations &
  SessionLifecycleOperations &
  RunSettingsOperations;
