import { Progress } from "@/components/ui/progress";
import theme from "@/components/design-system/brand-theme.module.css";
import styles from "./navigation-loading.module.css";

export function NavigationLoading() {
  return (
    <div
      data-ui="heroui"
      className={`${theme.theme} ${styles.overlay}`}
    >
      <Progress
        value={null}
        aria-label="Cargando vista"
        className={styles.progress}
      />
    </div>
  );
}
