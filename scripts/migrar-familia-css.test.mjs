import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const script = fileURLToPath(
  new URL("./migrar-familia-css.mjs", import.meta.url),
);
function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "familia-css-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, "src/app"), { recursive: true });
  const css = ".demo-card {\n  color: red;\n}\n.other-card { color: blue; }\n";
  const tsx =
    '<div className="demo-card other-card"/><div className={`demo-card extra`}/>';
  writeFileSync(join(cwd, "src/app/globals.css"), css);
  writeFileSync(join(cwd, "view.tsx"), tsx);
  const run = (prefix, ...args) =>
    spawnSync(
      process.execPath,
      [script, prefix, "1", "3", "demo.module.css", "view.tsx", ...args],
      { cwd, encoding: "utf8", timeout: 3000 },
    );
  return { cwd, css, tsx, run };
}
for (const prefix of [
  ".*",
  "demo|other",
  "(a+)+",
  "[",
  "demo$",
  "demo\\s",
  "",
]) {
  test(`rechaza el prefijo ${JSON.stringify(prefix)} antes de modificar archivos`, (t) => {
    const f = fixture(t),
      result = f.run(prefix);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /prefijo/i);
    assert.equal(
      readFileSync(join(f.cwd, "src/app/globals.css"), "utf8"),
      f.css,
    );
    assert.equal(readFileSync(join(f.cwd, "view.tsx"), "utf8"), f.tsx);
    assert.equal(existsSync(join(f.cwd, "demo.module.css")), false);
  });
}
test("migra sólo la familia indicada en CSS y ambas formas de className", (t) => {
  const f = fixture(t);
  assert.equal(f.run("demo").status, 0);
  assert.match(readFileSync(join(f.cwd, "demo.module.css"), "utf8"), /^\.card/);
  assert.match(
    readFileSync(join(f.cwd, "view.tsx"), "utf8"),
    /\$\{s.card\} other-card/,
  );
  assert.match(
    readFileSync(join(f.cwd, "view.tsx"), "utf8"),
    /\$\{s.card\} extra/,
  );
  assert.equal(
    readFileSync(join(f.cwd, "src/app/globals.css"), "utf8"),
    ".other-card { color: blue; }\n",
  );
});
test("--dry no cambia ningún archivo", (t) => {
  const f = fixture(t);
  assert.equal(f.run("demo", "--dry").status, 0);
  assert.equal(readFileSync(join(f.cwd, "src/app/globals.css"), "utf8"), f.css);
  assert.equal(readFileSync(join(f.cwd, "view.tsx"), "utf8"), f.tsx);
  assert.equal(existsSync(join(f.cwd, "demo.module.css")), false);
});
