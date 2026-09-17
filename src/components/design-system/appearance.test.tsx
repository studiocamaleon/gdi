import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DesignSystemProvider,
  useDesignScope,
  useDesignTheme,
  useLegacyDesignScope,
} from "./appearance";
import baseTheme from "./theme.module.css";
import brandTheme from "./brand-workspace-theme.module.css";

function ScopeProbe() {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const legacy = useLegacyDesignScope();
  return <div {...scope} data-theme={theme} data-legacy={legacy.className} />;
}

describe("alcance de apariencia en formularios y portales", () => {
  it("mantiene el tema anterior en componentes sin una marca explícita", () => {
    const html = renderToStaticMarkup(<ScopeProbe />);
    expect(html).toContain(`data-theme="${baseTheme.theme}"`);
    expect(html).not.toContain("data-appearance");
    expect(html).not.toContain("data-legacy");
  });

  it("conserva marca y apariencia clara a través de proveedores anidados", () => {
    const html = renderToStaticMarkup(
      <DesignSystemProvider theme="brand" appearance="light">
        <DesignSystemProvider><ScopeProbe /></DesignSystemProvider>
      </DesignSystemProvider>,
    );
    expect(html).toContain('data-appearance="light"');
    expect(html).toContain(`data-theme="${brandTheme.theme}"`);
    expect(html).toContain(`data-legacy="${brandTheme.theme} ${brandTheme.legacy}"`);
  });

  it("permite volver al tema base sin cambiar la apariencia heredada", () => {
    const html = renderToStaticMarkup(
      <DesignSystemProvider theme="brand" appearance="light">
        <DesignSystemProvider theme="default"><ScopeProbe /></DesignSystemProvider>
      </DesignSystemProvider>,
    );
    expect(html).toContain(`data-theme="${baseTheme.theme}"`);
    expect(html).toContain('data-appearance="light"');
    expect(html).not.toContain("data-legacy");
  });

  it("respeta una apariencia explícita del formulario hijo", () => {
    const html = renderToStaticMarkup(
      <DesignSystemProvider theme="brand" appearance="dark">
        <DesignSystemProvider appearance="light"><ScopeProbe /></DesignSystemProvider>
      </DesignSystemProvider>,
    );
    expect(html).toContain('data-appearance="light"');
    expect(html).toContain(`data-theme="${brandTheme.theme}"`);
  });
});
