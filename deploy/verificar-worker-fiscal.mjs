import { execFileSync } from "node:child_process";
import { validarWorkerFiscal } from "./facturacion-worker-config.mjs";

const [entorno, opcion] = process.argv.slice(2);
if (
  !["staging", "produccion"].includes(entorno) ||
  (opcion && opcion !== "--permitir-manual")
) {
  console.error(
    "Uso: node deploy/verificar-worker-fiscal.mjs staging|produccion [--permitir-manual]",
  );
  process.exit(1);
}
const slug = entorno === "produccion" ? "production" : "staging";
const fly = process.env.FLYCTL_BIN || "fly";
const js = `const {createHash}=require('node:crypto');const huella=k=>process.env[k]?.trim()?createHash('sha256').update(process.env[k].trim()).digest('hex'):null;console.log(JSON.stringify({ambiente:process.env.AFIPSDK_ENVIRONMENT,token:huella('AFIPSDK_ACCESS_TOKEN'),cifrado:huella('INTEGRACIONES_ENCRYPTION_KEY')}));`;
const comando = "node -e '" + js.replaceAll("'", "'\\''") + "'";
function leer(servicio) {
  let salida;
  try {
    salida = execFileSync(
      fly,
      ["ssh", "console", "-a", `grafoprint-${slug}-${servicio}`, "-C", comando],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 90_000 },
    );
    return JSON.parse(salida.split("\n").find((l) => l.startsWith("{")));
  } catch {
    throw new Error(`No se pudo verificar la configuración de ${servicio}.`);
  }
}
try {
  const resultado = validarWorkerFiscal(leer("api"), leer("worker"), {
    entorno,
    permitirManual: opcion === "--permitir-manual",
  });
  console.log(JSON.stringify({ entorno, ...resultado }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
