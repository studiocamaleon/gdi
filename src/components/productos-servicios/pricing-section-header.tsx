import type * as React from "react";

import {
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import styles from "./pricing-visual.module.css";

export function PricingSectionHeader({
  step,
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
}: {
  step: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <CardHeader className={styles.sectionHeader}>
      <div className={styles.sectionLead}>
        <span className={styles.sectionMark} aria-hidden="true">
          <Icon />
        </span>
        <div className={styles.sectionCopy}>
          <span className={styles.eyebrow}>
            {step} · {eyebrow}
          </span>
          <CardTitle className={styles.sectionTitle}>{title}</CardTitle>
          <CardDescription className={styles.sectionDescription}>
            {description}
          </CardDescription>
        </div>
      </div>
      {action ? (
        <CardAction className={styles.sectionAction}>{action}</CardAction>
      ) : null}
    </CardHeader>
  );
}
