"use client";

import { Avatar } from "@heroui/react";
import { User } from "lucide-react";
import styles from "./identity-avatar.module.css";

/** A3: identidad compacta con el degradado de marca compartido. */
export function IdentityAvatar({
  name,
  initials = name.slice(0, 2).toUpperCase(),
}: {
  name: string;
  initials?: string;
}) {
  return (
    <Avatar size="sm" className={styles.avatar} role="img" aria-label={name}>
      <Avatar.Fallback className={styles.fallback}>
        {initials || <User size={15} aria-hidden />}
      </Avatar.Fallback>
    </Avatar>
  );
}
