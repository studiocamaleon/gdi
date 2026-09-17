import {
  FileCode2Icon,
  ShapesIcon,
  RectangleHorizontalIcon,
} from "lucide-react";
import type {
  PiezaComponenteFabricado,
  PiezaVectorialComponente,
} from "@/lib/productos-servicios-api";
import styles from "./piezas-diseno.module.css";

type Fuente = PiezaVectorialComponente["fuente"];
const numero = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

export function MiniaturaPieza({
  fuente,
  nombre,
}: {
  fuente?: Fuente;
  nombre: string;
}) {
  return (
    <div className={styles.preview}>
      {fuente?.svg ? (
        // El SVG se presenta como imagen, sin insertar markup del archivo en el DOM.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(fuente.svg)}`}
          alt={`Contorno de ${nombre}`}
          loading="lazy"
        />
      ) : (
        <ShapesIcon aria-hidden="true" />
      )}
      <span>{fuente ? "CONTORNO" : "SIN ARCHIVO"}</span>
    </div>
  );
}

export function DatosArchivoPieza({ fuente }: { fuente: Fuente }) {
  return (
    <div className={styles.fileInfo}>
      <dl className={styles.specs}>
        <div>
          <dt>Medidas</dt>
          <dd>
            {numero(fuente.anchoFinalMm)} × {numero(fuente.altoFinalMm)}{" "}
            <small>mm</small>
          </dd>
        </div>
        <div>
          <dt>Capa para nesting</dt>
          <dd>{fuente.procedencia.capa || "Contorno SVG"}</dd>
        </div>
        <div>
          <dt>
            {fuente.fabricacion ? "Capas conservadas" : "Operaciones internas"}
          </dt>
          <dd>
            {fuente.fabricacion
              ? `${new Set(fuente.fabricacion.entidades.filter((e) => e.conservar).map((e) => e.capa)).size} capas · ${fuente.fabricacion.entidades.filter((e) => e.conservar).length} entidades`
              : fuente.operaciones.length
                ? `${fuente.operaciones.length} trazos`
                : "Sin operaciones"}
          </dd>
        </div>
      </dl>
      <p className={styles.fileName} title={fuente.nombreArchivo}>
        <FileCode2Icon aria-hidden="true" />
        <span>{fuente.nombreArchivo}</span>
      </p>
    </div>
  );
}

export function PiezasBom({ piezas }: { piezas: PiezaComponenteFabricado[] }) {
  return (
    <section className={styles.bomPieces} aria-label="Piezas del componente">
      <header className={styles.bomHeading}>
        <ShapesIcon aria-hidden="true" />
        <h5>Piezas de fabricación</h5>
        <span>
          {piezas.length} tipos de pieza ·{" "}
          {piezas.reduce((n, p) => n + p.cantidadPorUnidad, 0)} piezas por
          producto
        </span>
      </header>
      <ul className={styles.bomList}>
        {piezas.map((p) => (
          <li key={p.id} className={styles.bomPiece}>
            {p.tipo === "RECTANGULAR" ? (
              <div className={styles.preview}>
                <RectangleHorizontalIcon aria-hidden="true" />
                <span>RECTANGULAR</span>
              </div>
            ) : (
              <MiniaturaPieza fuente={p.fuente} nombre={p.nombre} />
            )}
            <div className={styles.bomPieceBody}>
              <div className={styles.bomPieceTitle}>
                <strong>{p.nombre}</strong>
                <span>
                  <b>×{p.cantidadPorUnidad}</b> por producto
                </span>
              </div>
              {p.tipo === "RECTANGULAR" ? (
                <p className={styles.fileName}>
                  {numero(p.medidas.anchoMm / 10)} ×{" "}
                  {numero(p.medidas.altoMm / 10)} cm
                </p>
              ) : (
                <DatosArchivoPieza fuente={p.fuente} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
