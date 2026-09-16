import { DesignSystemProvider } from "@/components/design-system/appearance";

export default function FlujosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      {children}
    </DesignSystemProvider>
  );
}
