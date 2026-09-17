const postcss = require("postcss");

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
          `:scope:is(${selector})`,
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
