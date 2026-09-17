import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { InspeccionVector } from './interpretar-vector';

export function ejecutarDxfNativo<T>(entrada: object): Promise<T> {
  const candidatos = [
    resolve('.venv-opennest/bin/python'),
    resolve('apps/api/.venv-opennest/bin/python'),
  ];
  const python =
    process.env.DXF_PYTHON?.trim() ||
    process.env.OPENNEST_PYTHON?.trim() ||
    candidatos.find((p) => existsSync(p)) ||
    'python3';
  return new Promise((resolve, reject) => {
    const child = execFile(
      python,
      [join(__dirname, 'python/dxf_fabricacion.py')],
      {
        timeout: 30_000,
        maxBuffer: 32 * 1024 * 1024,
      },
      (error, stdout) => {
        try {
          const resultado = JSON.parse(stdout) as T & { error?: string };
          if (error || resultado.error)
            reject(
              new Error(
                resultado.error || 'No se pudo completar la conversión DXF.',
              ),
            );
          else resolve(resultado);
        } catch {
          reject(
            new Error(
              'No se pudo ejecutar el lector CAD. Verificá la instalación de ezdxf y DXF_PYTHON.',
            ),
          );
        }
      },
    );
    child.stdin?.on('error', () => {
      /* El callback del proceso informa el fallo. */
    });
    child.stdin?.end(JSON.stringify(entrada));
  });
}

export function inspeccionarDxfNativo(
  contenido: string,
): Promise<InspeccionVector> {
  return ejecutarDxfNativo({ accion: 'inspeccionar', contenido });
}
