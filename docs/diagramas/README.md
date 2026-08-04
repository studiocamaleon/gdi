# Diagramas

Fuentes HTML de los diagramas del sistema. Se exportan a PDF con Chrome headless:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --no-pdf-header-footer --print-to-pdf=motor-universal-diagrama.pdf \
  "file://$PWD/docs/diagramas/motor-universal-diagrama.html"
```

Cada `.page` tiene `height:188mm` = el área imprimible de una A4 apaisada con los
márgenes del `@page`. Si al editar el contenido se pasa de esa altura, la página
desborda: medir con Chrome antes de exportar.

- `motor-universal-diagrama.html` — cómo cotiza el motor (3 páginas).
