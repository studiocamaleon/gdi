"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./modo-ingreso-selector.module.css";

export type OpcionModoIngreso<T extends string = string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  options: Array<OpcionModoIngreso<T>>;
  onValueChange: (value: T) => void;
  ariaLabel?: string;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
};

/**
 * Única puerta visual para elegir cómo se describe un trabajo al cotizar.
 * Las capacidades cambian por producto; la posición, el título y la interacción
 * permanecen iguales en todo el sheet.
 */
export function ModoIngresoSelector<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel = "Modo de ingreso",
  title = "Modo de ingreso",
  description,
  icon: Icon,
  action,
}: Props<T>) {
  if (options.length < 2 && !action) return null;

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        {Icon ? (
          <span className={styles.icon} aria-hidden="true">
            <Icon />
          </span>
        ) : null}
        <div className={styles.copy}>
          <strong>{title}</strong>
          {description ? <span>{description}</span> : null}
        </div>
        {action ? <div className={styles.action}>{action}</div> : null}
      </header>
      {options.length > 1 ? (
        <div className={styles.body}>
          <div
            className={styles.choices}
            role="group"
            aria-label={ariaLabel}
            style={{
              gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={styles.choice}
                data-active={option.value === value}
                aria-pressed={option.value === value}
                onClick={() => onValueChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
