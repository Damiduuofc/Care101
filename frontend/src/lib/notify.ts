"use client";

import { toast } from "@/hooks/use-toast";

// In-page replacement for window.alert(): a toast that doesn't block the page.
// Messages that read like a failure are shown in the error style.
const ERROR_WORDS = /\b(fail(ed|ure)?|error|invalid|could ?n[o']t|cannot|can't|unable|not (found|allowed|authori[sz]ed)|denied|missing|required|please (select|enter|fill|choose|upload)|must)\b/i;

export function notify(message: unknown, kind?: "success" | "error" | "info") {
  const text = typeof message === "string" ? message : String(message ?? "");
  const isError = kind ? kind === "error" : ERROR_WORDS.test(text);
  toast({
    title: isError ? "Something went wrong" : kind === "info" ? undefined : "Done",
    description: text,
    variant: isError ? "destructive" : "default",
    duration: isError ? 7000 : 4000,
  });
}
