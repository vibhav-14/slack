import { useEffect } from "react";

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Slack` : "Slack";
  }, [title]);
}
