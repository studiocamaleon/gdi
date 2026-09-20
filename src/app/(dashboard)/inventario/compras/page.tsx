import { DesignSystemProvider } from "@/components/design-system/appearance";
import { ComprasPanel } from "@/components/compras/compras-panel";
export default function ComprasPage() {
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <ComprasPanel />
    </DesignSystemProvider>
  );
}
