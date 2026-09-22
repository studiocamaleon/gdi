/** Genera vistas locales. Sólo envía con --enviar --para=correo --lote=identificador.
 * No crea registros, tokens, usuarios ni suscripciones. */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CorreoTransaccionalService } from '../src/registro/correo-transaccional.service';
import {
  adjuntosMarcaCorreo,
  MARCA_CORREO_CID,
} from '../src/registro/plantillas/correo-base';
import { crearCorreoInvitacionEmpresa } from '../src/registro/plantillas/invitacion-empresa';
import { crearCorreoVerificacion } from '../src/registro/plantillas/verificacion';

async function main() {
  const args = process.argv.slice(2);
  const valor = (nombre: string) =>
    args.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3);
  const enviar = args.includes('--enviar');
  const invitacion = valor('tipo') === 'invitacion';
  const para = valor('para');
  const lote = valor('lote');
  if (enviar && (!para || !lote || !process.env.RESEND_API_KEY)) {
    throw new Error(
      'Para enviar se requieren --para, --lote y RESEND_API_KEY.',
    );
  }
  const destino = resolve(
    valor('salida') ??
      (invitacion ? '/tmp/grafo-invitaciones' : '/tmp/grafo-correos'),
  );
  await mkdir(destino, { recursive: true });
  const correo = new CorreoTransaccionalService();
  const muestras = invitacion
    ? [
        {
          clave: 'invitacion-cofounder-pro',
          plan: 'Co-founder Pro',
          trialDias: 30,
          mensual: 290,
        },
        {
          clave: 'invitacion-cofounder-avanzado',
          plan: 'Co-founder Avanzado',
          trialDias: 30,
          mensual: 690,
        },
      ]
    : [
        { clave: 'confirmacion-registro', plan: 'Grafo Pro', trialDias: 14 },
        {
          clave: 'confirmacion-plazo-30-dias',
          plan: 'Grafo Co-founder Pro',
          trialDias: 30,
        },
      ];
  const resultados: { clave: string; archivo: string; id?: string }[] = [];
  for (const muestra of muestras) {
    const datos = {
      nombre: 'Lucas',
      empresa: 'Gráfica de ejemplo',
      plan: muestra.plan,
      trialDias: muestra.trialDias,
      // Enlaces de muestra sin credenciales ni acciones de autenticación.
      url: 'https://grafoprint.com.ar/',
    };
    const datosInvitacion = {
      empresa: datos.empresa,
      plan: datos.plan,
      url: datos.url,
      venceEl: new Date('2026-09-29T18:00:00Z'),
      trialHasta: new Date('2026-10-22T18:00:00Z'),
      moneda: 'USD',
      mensual: 'mensual' in muestra ? muestra.mensual : null,
      implementacion: 0,
    };
    const contenido = invitacion
      ? crearCorreoInvitacionEmpresa(datosInvitacion, { prueba: true })
      : crearCorreoVerificacion(datos, { prueba: true });
    const imagen = adjuntosMarcaCorreo()[0].content.toString('base64');
    const archivo = resolve(destino, `${muestra.clave}.html`);
    await writeFile(
      archivo,
      contenido.html.replace(
        `cid:${MARCA_CORREO_CID}`,
        `data:image/png;base64,${imagen}`,
      ),
    );
    const resultado: (typeof resultados)[number] = {
      clave: muestra.clave,
      archivo,
    };
    if (enviar) {
      const opciones = {
        prueba: true,
        idempotencyKey: `grafo-correos/${lote}/${muestra.clave}`,
      };
      const enviado = invitacion
        ? await correo.enviarInvitacionEmpresa(
            { ...datosInvitacion, para: para! },
            opciones,
          )
        : await correo.enviarVerificacion({ ...datos, para: para! }, opciones);
      resultado.id = enviado.id;
    }
    resultados.push(resultado);
  }
  await writeFile(
    resolve(destino, 'resultado.json'),
    JSON.stringify(
      { enviado: enviar, para: enviar ? para : undefined, resultados },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ enviado: enviar, destino, resultados }, null, 2),
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'No se pudo completar la prueba.',
  );
  process.exitCode = 1;
});
