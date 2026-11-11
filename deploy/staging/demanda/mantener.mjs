// Retención temporal para despliegues o pruebas sin navegador. Nunca admite otro app.
import { execFileSync } from 'node:child_process';
import { WEB } from './control.mjs';
const minutos = Number(process.argv[2] ?? 120);
if (!Number.isInteger(minutos) || minutos < 0 || minutos > 1440) throw new Error('Usar entre 0 y 1440 minutos; 0 libera la retención.');
const fly = process.env.FLYCTL_BIN || 'flyctl';
const ejecutar = (args) => execFileSync(fly, args, { encoding: 'utf8', timeout: 40000, stdio: ['ignore', 'pipe', 'pipe'] });
const maquinas = JSON.parse(ejecutar(['machine', 'list', '-a', WEB, '--json']));
if (maquinas.length !== 1 || !/^[a-f0-9]{14}$/.test(maquinas[0].id)) throw new Error('Inventario inesperado de staging.');
const id = maquinas[0].id;
if (maquinas[0].state !== 'started') throw new Error('Abrí staging y esperá que termine de arrancar antes de mantenerlo encendido.');
const codigo = `const fs=require('node:fs');if(process.env.FLY_APP_NAME!==${JSON.stringify(WEB)})process.exit(1);const fd=fs.openSync('/tmp/staging-demanda-mantener-hasta',fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_TRUNC|fs.constants.O_NOFOLLOW,0o644);fs.fchmodSync(fd,0o644);fs.writeFileSync(fd,String(Date.now()+${minutos}*60000));fs.closeSync(fd);console.log('ok');`;
const comando = 'node -e ' + "'" + codigo.replaceAll("'", "'\\''") + "'";
const r = JSON.parse(ejecutar(['machine', 'exec', '-a', WEB, id, comando, '--json']));
if (r.exit_code || r.exit_signal || r.stdout?.trim() !== 'ok') throw new Error('No se confirmó la retención.');
console.log(minutos ? `Staging se mantendrá encendido durante ${minutos} minutos, incluso sin navegador.` : 'Retención liberada; vuelve a regir el plazo de inactividad.');
