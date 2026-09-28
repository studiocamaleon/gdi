import { notFound } from "next/navigation";
import { InboxLaunchPreview } from "@/components/inbox/preview/inbox-launch-preview";

export default function InboxLaunchDesignPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <InboxLaunchPreview href="/dev/diseno/inbox" />;
}
