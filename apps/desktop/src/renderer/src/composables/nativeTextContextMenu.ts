import type {
  TextContextMenuAction,
  TextContextMenuApi,
  TextContextMenuCommand,
  TextContextMenuEvent
} from "@deepwrite/contracts";
import { captureTextMenuTarget } from "./textContextMenuTarget";

export interface TextMenuHistory {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
}
export interface TextMenuExtension {
  valid(): boolean;
  insert?: () => void;
  history?: TextMenuHistory | undefined;
}
export interface TextMenuIllustration {
  valid(): boolean;
  add(): void;
}
interface IllustrationRegistration {
  extension: TextMenuIllustration | undefined;
}
const illustrations = new WeakMap<MouseEvent, IllustrationRegistration>();

interface TextMenuRegistration {
  extension: TextMenuExtension | undefined;
}
const extensions = new WeakMap<MouseEvent, TextMenuRegistration>();
let invalidateExtension:
  ((extension: TextMenuExtension | TextMenuIllustration) => void) | undefined;

export function registerTextMenuIllustration(
  event: MouseEvent,
  extension: TextMenuIllustration
): () => void {
  const registration = {
    extension: extension as TextMenuIllustration | undefined
  };
  illustrations.set(event, registration);
  return () => {
    illustrations.delete(event);
    const current = registration.extension;
    registration.extension = undefined;
    if (current) invalidateExtension?.(current);
  };
}

export function registerTextMenuExtension(
  event: MouseEvent,
  extension: TextMenuExtension
): () => void {
  const registration: TextMenuRegistration = { extension };
  extensions.set(event, registration);
  return () => {
    extensions.delete(event);
    const current = registration.extension;
    registration.extension = undefined;
    if (current) invalidateExtension?.(current);
  };
}

/** Captures DOM identity, while Electron owns the actual menu and editing commands. */
export function installNativeTextContextMenu(
  api: TextContextMenuApi
): () => void {
  let candidate:
    | { event: MouseEvent; snapshot: ReturnType<typeof captureTextMenuTarget> }
    | undefined;
  let active:
    | {
        request: TextContextMenuEvent;
        snapshot: NonNullable<ReturnType<typeof captureTextMenuTarget>>;
        extension: TextMenuExtension | undefined;
        registration: TextMenuRegistration | undefined;
        illustration: TextMenuIllustration | undefined;
        illustrationRegistration: IllustrationRegistration | undefined;
      }
    | undefined;

  function reply(
    request: TextContextMenuEvent,
    payload: TextContextMenuCommand["payload"]
  ): void {
    api.reply({
      protocolVersion: 1,
      id: `${request.id}_${payload.phase}`,
      type: "textContextMenu.reply",
      timestamp: new Date().toISOString(),
      context: { correlationId: request.id },
      payload
    });
  }

  function cancel(): void {
    const previous = active;
    active = undefined;
    if (previous?.registration) previous.registration.extension = undefined;
    if (previous?.illustrationRegistration)
      previous.illustrationRegistration.extension = undefined;
    if (previous) reply(previous.request, { phase: "cancel" });
  }

  function onContextMenu(event: MouseEvent): void {
    cancel();
    candidate = { event, snapshot: captureTextMenuTarget(event) };
  }

  function actionAllowed(action: TextContextMenuAction): boolean {
    const state = active;
    if (
      !state ||
      !state.snapshot.valid() ||
      (state.extension && !state.extension.valid())
    )
      return false;
    const context = state.snapshot.context;
    if (action === "addIllustration")
      return (
        context.kind === "editable" &&
        !context.password &&
        Boolean(state.illustration?.valid())
      );
    if (action === "insertReference") return Boolean(state.extension?.insert);
    if (action === "copy" || action === "selectAll") return true;
    return context.kind === "editable";
  }

  const unsubscribe = api.subscribe((request) => {
    if (request.payload.phase === "prepare") {
      cancel();
      const current = candidate;
      candidate = undefined;
      // Chromium can select a word after DOM contextmenu dispatch (macOS).
      // Capture that settled selection without accepting a changed document.
      const snapshot = current?.snapshot?.valid(false)
        ? captureTextMenuTarget(current.event)
        : undefined;
      const registration = current && extensions.get(current.event);
      const extension = registration?.extension;
      const illustrationRegistration =
        current && illustrations.get(current.event);
      const illustration = illustrationRegistration?.extension;
      if (current) extensions.delete(current.event);
      if (current) illustrations.delete(current.event);
      if (!snapshot || !snapshot.valid()) {
        if (registration) registration.extension = undefined;
        if (illustrationRegistration)
          illustrationRegistration.extension = undefined;
        reply(request, {
          phase: "prepared",
          context: {
            kind: "none",
            password: false,
            hasSelection: false,
            hasText: false,
            canInsertReference: false
          }
        });
        return;
      }
      active = {
        request,
        snapshot,
        extension: extension?.valid() ? extension : undefined,
        registration,
        illustration: illustration?.valid() ? illustration : undefined,
        illustrationRegistration
      };
      const history = active.extension?.history;
      reply(request, {
        phase: "prepared",
        context: {
          ...snapshot.context,
          canInsertReference: Boolean(active.extension?.insert),
          canAddIllustration: Boolean(active.illustration),
          ...(history
            ? {
                history: {
                  canUndo: history.canUndo(),
                  canRedo: history.canRedo()
                }
              }
            : {})
        }
      });
    } else if (request.id === active?.request.id) {
      if (request.payload.phase === "closed") {
        if (active.registration) active.registration.extension = undefined;
        if (active.illustrationRegistration)
          active.illustrationRegistration.extension = undefined;
        active = undefined;
        return;
      }
      const action = request.payload.action;
      const allowed = actionAllowed(action);
      const extension = active.extension;
      const illustration = active.illustration;
      if (active.registration) active.registration.extension = undefined;
      if (active.illustrationRegistration)
        active.illustrationRegistration.extension = undefined;
      // Release the request before callbacks update reactive state or focus.
      active = undefined;
      let handled = false;
      try {
        if (allowed && action === "addIllustration") {
          illustration?.add();
          handled = true;
        }
        if (allowed && action === "insertReference") {
          extension?.insert?.();
          handled = true;
        }
        if (
          allowed &&
          (action === "undo" || action === "redo") &&
          extension?.history
        ) {
          extension.history[action]();
          handled = true;
        }
        reply(request, { phase: "actionReady", action, allowed, handled });
      } catch {
        reply(request, {
          phase: "actionReady",
          action,
          allowed: false,
          handled: false
        });
      }
    }
  });

  function onFocus(event: FocusEvent): void {
    if (
      active &&
      event.target !== active.snapshot.target &&
      !active.snapshot.target.contains(event.target as Node)
    )
      cancel();
  }
  function onInput(): void {
    cancel();
    candidate = undefined;
  }
  invalidateExtension = (extension) => {
    if (active?.extension === extension || active?.illustration === extension)
      cancel();
  };
  document.addEventListener("contextmenu", onContextMenu, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("focusin", onFocus, true);
  globalThis.addEventListener("pagehide", cancel);
  return () => {
    cancel();
    unsubscribe();
    invalidateExtension = undefined;
    document.removeEventListener("contextmenu", onContextMenu, true);
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("focusin", onFocus, true);
    globalThis.removeEventListener("pagehide", cancel);
  };
}
