import type { Topic, TopicStatus } from "../api/types";
import { useSetTopicStatus } from "../api/hooks";
import { topicStatusLabel } from "./ui";
import { useToast } from "./Toast";

export function TopicStatusSelect({ topic, size }: { topic: Topic; size?: "sm" }) {
  const setStatus = useSetTopicStatus();
  const toast = useToast();
  const pending = setStatus.isPending ? setStatus.variables?.status : undefined;

  return (
    <select
      className={`select${size === "sm" ? " select-sm" : ""}`}
      value={pending ?? topic.status}
      aria-label={`Status of ${topic.title}`}
      disabled={setStatus.isPending}
      onChange={(e) =>
        setStatus.mutate(
          { id: topic.id, status: e.target.value as TopicStatus },
          { onError: () => toast("Couldn't save the status. Try again.", { error: true }) },
        )
      }
    >
      {(Object.keys(topicStatusLabel) as TopicStatus[]).map((s) => (
        <option key={s} value={s}>
          {topicStatusLabel[s]}
        </option>
      ))}
    </select>
  );
}
