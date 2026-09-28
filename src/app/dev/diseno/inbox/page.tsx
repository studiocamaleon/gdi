import { notFound } from "next/navigation";
import { InboxPreview } from "@/components/inbox/preview/inbox-preview";

/** Catálogo de diseño. Nunca se publica como inbox operativo. */
export default function InboxDesignPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <InboxPreview />;
}
