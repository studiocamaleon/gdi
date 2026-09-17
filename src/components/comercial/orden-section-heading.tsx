import { ChartNoAxesCombined, CreditCard, Factory, Files, History, ReceiptText } from "lucide-react";
import s from "./orden-issued.module.css";

const sections = {
  produccion: { title: "Producción", description: "Avance de la orden, operaciones y recorrido por el taller.", icon: Factory },
  pagos: { title: "Cobros de la orden", description: "Saldo, acreditaciones y movimientos en un solo lugar.", icon: CreditCard },
  comprobantes: { title: "Comprobantes", description: "Facturas, notas de crédito y su relación con los cobros.", icon: ReceiptText },
  archivos: { title: "Archivos de trabajo", description: "Referencias de la orden y arte de producción de cada producto.", icon: Files },
  costos: { title: "Costos y rentabilidad", description: "Composición del precio y comparación con los costos reales.", icon: ChartNoAxesCombined },
  historial: { title: "Historial de la orden", description: "Cada cambio, con su fecha y la persona que lo realizó.", icon: History },
};

export function OrdenSectionHeading({ section }: { section: string }) {
  const item = sections[section as keyof typeof sections];
  if (!item) return null;
  const Icon = item.icon;
  return (
    <header className={s.sectionHeading}>
      <span className={s.sectionIcon} aria-hidden="true"><Icon /></span>
      <div><h2>{item.title}</h2><p>{item.description}</p></div>
    </header>
  );
}
