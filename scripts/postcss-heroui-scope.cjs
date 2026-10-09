/* eslint-disable @typescript-eslint/no-require-imports -- Plugin CommonJS cargado por PostCSS. */
const postcss = require("postcss");
const selectorParser = require("postcss-selector-parser");

/** En un portal, el primer componente puede ser la propia raíz de @scope.
 * Producción aplana el nesting: `.popover .lista` necesita
 * `:scope:is(.popover) .lista`, no `:scope:is(.popover .lista)`.
 * El parser conserva combinadores, atributos y comas dentro de :is/:has.
 */
function fromScopeRoot(selector) {
  const nodes = selectorParser().astSync(selector).first.nodes;
  const boundary = nodes.findIndex(
    (node) =>
      node.type === "combinator" ||
      (node.type === "pseudo" &&
        (node.value.startsWith("::") ||
          /^:(before|after|first-line|first-letter)$/.test(node.value))),
  );
  const end = boundary < 0 ? nodes.length : boundary;
  const root = nodes.slice(0, end).map(String).join("");
  const descendants = nodes.slice(end).map(String).join("");
  return `:scope${root ? `:is(${root})` : ""}${descendants}`;
}

/** Sólo el CSS importado en esta capa pertenece al piloto HeroUI.
 * Los estilos se mantienen en el paquete; no copiamos reglas del proveedor.
 * @scope evita que .button/.tabs afecten pantallas todavía sin migrar.
 */
module.exports = () => ({
  postcssPlugin: "gdi-heroui-scope",
  OnceExit(root) {
    root.walkAtRules("layer", (layer) => {
      if (layer.params !== "components.heroui") return;
      if (layer.nodes?.length === 1 && layer.first.name === "scope") return;
      // El límite también puede ser el propio overlay portaleado.
      layer.walkRules((rule) => {
        let parent = rule.parent;
        while (parent !== layer && parent.type !== "rule") {
          if (parent.type === "atrule" && /keyframes$/.test(parent.name))
            return;
          parent = parent.parent;
        }
        if (parent.type === "rule") return;
        rule.selectors = rule.selectors.flatMap((selector) => [
          selector,
          fromScopeRoot(selector),
        ]);
      });
      const scope = postcss.atRule({
        name: "scope",
        params: '([data-ui="heroui"])',
      });
      scope.append(layer.nodes);
      layer.append(scope);
    });
  },
});
module.exports.postcss = true;
