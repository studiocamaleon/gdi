import type { ReactNode } from 'react';
import { Layers } from 'lucide-react';
import s from './configuracion-grupo-cola.module.css';

/** El encabezado identifica el material; la configuración pertenece a cada fila. */
export function ConfiguracionGrupoCola({ materialNombre, children }: {
  materialNombre: string | null; children?: ReactNode;
}) {
  return <div className={s.heading}>
    <Layers aria-hidden="true" />
    <strong>{materialNombre ?? 'Material sin identificar'}</strong>
    {children}
  </div>;
}
