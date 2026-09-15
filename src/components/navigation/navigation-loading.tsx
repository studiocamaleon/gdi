import { GrafoprintLoadingIndicator } from "@/components/brand/grafoprint-loading";
import theme from "@/components/design-system/theme.module.css";
import styles from "./navigation-loading.module.css";

export function NavigationLoading() {
  return (
    <div
      data-ui="heroui"
      data-appearance="light"
      className={`${theme.theme} ${styles.overlay}`}
    >
      <GrafoprintLoadingIndicator />
    </div>
  );
}
