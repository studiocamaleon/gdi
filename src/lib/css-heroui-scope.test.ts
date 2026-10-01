import { createRequire } from "node:module";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const scope = require("../../scripts/postcss-heroui-scope.cjs");

describe("aislamiento de HeroUI durante la migración", () => {
  it("conserva el scroll de los descendientes cuando producción aplana el CSS del portal", async () => {
    const css = `@layer components.heroui {
      .autocomplete__popover [data-slot="list-box"] {max-height:320px; min-height:0; overflow-y:auto}
      .autocomplete__popover[data-placement="top"] > [data-slot="search-field"] {flex-shrink:0}
      .select__popover:is(.compact, .large) [role="option"] {padding:8px}
      .list-box-item::before {content:""}
    }`;
    const result = await postcss([scope()]).process(css, { from: undefined });
    expect(result.css).toContain(':scope:is(.autocomplete__popover) [data-slot="list-box"]');
    expect(result.css).toContain(':scope:is(.autocomplete__popover[data-placement="top"]) > [data-slot="search-field"]');
    expect(result.css).toContain(':scope:is(.select__popover:is(.compact, .large)) [role="option"]');
    expect(result.css).toContain(':scope:is(.list-box-item)::before');
    expect(result.css).not.toContain(':scope:is(.autocomplete__popover [data-slot="list-box"])');
    expect(result.css).toContain('overflow-y:auto');
  });

  it("acota sólo la capa del proveedor, incluye raíces portaleadas y conserva nesting y animaciones", async () => {
    const css = `.button {color:red} @layer components.heroui {
      .button { color:blue; &:hover {color:green} }
      @media (min-width:600px) { .modal__backdrop {position:fixed} }
      @keyframes enter {from {opacity:0} to {opacity:1}}
    } @layer utilities {.flex {display:flex}}`;
    const result = await postcss([scope()]).process(css, { from: undefined });
    expect(result.root.first?.toString()).toBe(".button {color:red}");
    let scoped = 0;
    result.root.walkAtRules("scope", (node) => {
      scoped++;
      expect(node.params).toBe('([data-ui="heroui"])');
      expect(node.toString()).toContain(":scope:is(.modal__backdrop)");
      expect(node.toString()).toContain("&:hover {color:green}");
      expect(node.toString()).toContain("from {opacity:0} to {opacity:1}");
    });
    expect(scoped).toBe(1);
    expect(result.root.last?.toString()).toBe(
      "@layer utilities {.flex {display:flex}}",
    );
    const secondPass = await postcss([scope()]).process(result.css, {
      from: undefined,
    });
    expect(secondPass.css).toBe(result.css);
  });
});
