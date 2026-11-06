"use client";

// In-page replacement for window.confirm(): `if (!(await confirmDialog("Delete?"))) return;`
// Rendered by <ConfirmHost /> in the admin layout.
export type ConfirmRequest = {
  message: string;
  title?: string;
  confirmLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
};

type Listener = (req: ConfirmRequest) => void;
let listener: Listener | null = null;

export function registerConfirmHost(fn: Listener | null) {
  listener = fn;
}

export function confirmDialog(
  message: string,
  options: { title?: string; confirmLabel?: string; destructive?: boolean } = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    // Fallback if the host isn't mounted (e.g. a page outside the admin layout)
    if (!listener) return resolve(window.confirm(message));
    const destructive = options.destructive ?? /\b(delete|remove|cancel|end|revoke|permanently)\b/i.test(message);
    listener({ message, resolve, destructive, ...options });
  });
}
