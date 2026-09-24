import { useEffect } from "react";

type ScrollLockSnapshot = {
  count: number;
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
};

let snapshot: ScrollLockSnapshot | null = null;

export function useTaskOverlayScrollLock(open: boolean) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;
    if (!snapshot) {
      snapshot = {
        count: 0,
        htmlOverflow: html.style.overflow,
        htmlOverscrollBehavior: html.style.overscrollBehavior,
        bodyOverflow: body.style.overflow,
        bodyOverscrollBehavior: body.style.overscrollBehavior,
      };
    }
    snapshot.count += 1;
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      if (!snapshot) return;
      snapshot.count -= 1;
      if (snapshot.count > 0) return;
      html.style.overflow = snapshot.htmlOverflow;
      html.style.overscrollBehavior = snapshot.htmlOverscrollBehavior;
      body.style.overflow = snapshot.bodyOverflow;
      body.style.overscrollBehavior = snapshot.bodyOverscrollBehavior;
      snapshot = null;
    };
  }, [open]);
}
