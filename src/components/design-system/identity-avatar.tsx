"use client";

import { Avatar } from "@heroui/react";
import { User } from "lucide-react";
import styles from "./identity-avatar.module.css";

/** A3: identidad compacta con el degradado de marca compartido. */
export function IdentityAvatar({
  name,
  initials = name
    .trim()
    .split(/\s+/)
    .filter((_, index, words) => index === 0 || index === words.length - 1)
    .map((word) => word[0])
    .join("")
    .toUpperCase(),
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
