"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { registerConfirmHost, type ConfirmRequest } from "@/lib/confirmDialog";

// Shows the dialogs requested through confirmDialog()
export default function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    registerConfirmHost((req) => setRequest(req));
    return () => registerConfirmHost(null);
  }, []);

  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  return (
    <AlertDialog open={!!request} onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title || "Are you sure?"}</AlertDialogTitle>
          <AlertDialogDescription>{request?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Go back</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={request?.destructive ? "bg-red-600 hover:bg-red-700 text-white" : "bg-cyan-600 hover:bg-cyan-700 text-white"}
          >
            {request?.confirmLabel || (request?.destructive ? "Yes, continue" : "Confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
