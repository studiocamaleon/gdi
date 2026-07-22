import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { IntegracionesService } from './src/integraciones/integraciones.service';
import { PrismaService } from './src/prisma/prisma.service';
import { runWithTenant } from './src/common/tenant-context';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const svc = app.get(IntegracionesService);
  const t: any[] = await prisma.$queryRawUnsafe(`select id from "Tenant" limit 1`);
  await runWithTenant(t[0].id, async () => {
    const c = (await svc.credencialesWati())!;
    const base = `${c.endpoint.replace(/\/+$/, '')}/${c.tenantId}`;
    const h = { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' };
    const lista: any = await (await fetch(`${base}/api/v1/getMessageTemplates`, { headers: h })).json();
    const x = (lista.messageTemplates ?? []).find((y: any) => y.elementName === 'grafo_orden_en_produccion_v1');

    // Mismo shape que manda el dashboard al guardar y enviar.
    const payload = {
      id: x.id, wabaId: x.wabaId, elementName: x.elementName,
      category: x.category, subCategory: '', hsm: x.hsm, hsmOriginal: null,
      customParams: x.customParams, status: 'DRAFT', language: x.language?.value ?? 'es_AR',
      type: 'hsm', header: null, body: x.body, bodyOriginal: '', footer: x.footer,
      buttons: [], buttonsType: 'none', isUrlBtnClickTrackingEnabled: false,
      quality: 0, creationMethod: 0, trackingUrlVersion: 1,
    };
    const r = await fetch(`${base}/api/v1/templates/update`, { method: 'POST', headers: h, body: JSON.stringify(payload) });
    const j: any = await r.json();
    console.log('update →', r.status, 'ok=', j.ok, '| status=', JSON.stringify(j.result?.status));

    const l2: any = await (await fetch(`${base}/api/v1/getMessageTemplates`, { headers: h })).json();
    const y = (l2.messageTemplates ?? []).find((z: any) => z.elementName === 'grafo_orden_en_produccion_v1');
    console.log('estado ahora →', y?.status, '| bodyOriginal=', y?.bodyOriginal ? 'sí' : 'NO');
  });
  await app.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
