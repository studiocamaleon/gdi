"use client";
import { GlowingEffect } from "./ui/glowing-effect";
export function FeatureCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`feature-card ${className}`}>
      <GlowingEffect
        spread={28}
        proximity={48}
        inactiveZone={0.3}
        disabled={false}
        borderWidth={1}
        movementDuration={0.35}
      />
      {children}
    </article>
  );
}
