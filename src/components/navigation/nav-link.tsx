"use client";

import * as React from "react";
import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";

import { useNavigationFeedback } from "@/components/navigation/navigation-feedback";

type NavLinkProps = LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(
  function NavLink({ href, onClick, prefetch = true, ...props }, ref) {
    const pathname = usePathname();
    const { startNavigation } = useNavigationFeedback();

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);

        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }

        const target =
          typeof href === "string"
            ? href
            : typeof href.pathname === "string"
              ? href.pathname
              : null;

        if (!target || target === pathname) {
          return;
        }

        startNavigation(target);
      },
      [href, onClick, pathname, startNavigation],
    );

    return (
      <Link
        ref={ref}
        href={href}
        prefetch={prefetch}
        onClick={handleClick}
        {...props}
      />
    );
  },
);
