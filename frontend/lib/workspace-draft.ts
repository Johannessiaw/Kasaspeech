export type WorkspaceTarget = "translation" | "assistant" | "tts";

const storageKey = "lingua-ai-workspace-draft";

type Draft = { target: WorkspaceTarget; text: string };

export function saveWorkspaceDraft(target: WorkspaceTarget, text: string) {
  if (typeof window === "undefined") {
    throw new Error("Workspace transfer is only available in a browser.");
  }
  const draft: Draft = { target, text };
  window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
}

export function takeWorkspaceDraft(target: WorkspaceTarget) {
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem(storageKey);
  if (!stored) return null;
  window.sessionStorage.removeItem(storageKey);
  const value: unknown = JSON.parse(stored);
  if (
    typeof value !== "object" ||
    value === null ||
    !("target" in value) ||
    value.target !== target ||
    !("text" in value) ||
    typeof value.text !== "string"
  ) {
    return null;
  }
  return value.text;
}
