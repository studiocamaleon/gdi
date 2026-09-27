import { notFound } from "next/navigation";
import { InboxGeneralPreview } from "@/components/inbox/preview/inbox-general-preview";
export default function InboxPruebaDesignPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <InboxGeneralPreview canalPrueba />;
}
