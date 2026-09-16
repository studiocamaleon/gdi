import type { ReactNode } from "react";
import { DesignSystemProvider } from "@/components/design-system/appearance";

export default function ComprobantesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      {children}
    </DesignSystemProvider>
  );
}
