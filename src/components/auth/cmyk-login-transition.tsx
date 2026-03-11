"use client";

type CmykLoginTransitionProps = {
  active: boolean;
};

export function CmykLoginTransition({ active }: CmykLoginTransitionProps) {
  if (!active) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
    >
      <div className="absolute inset-0 bg-[rgba(4,8,20,0.34)] backdrop-blur-[2px]" />

      <div className="cmyk-sweep cmyk-sweep-cyan" />
      <div className="cmyk-sweep cmyk-sweep-magenta" />
      <div className="cmyk-sweep cmyk-sweep-yellow" />
      <div className="cmyk-sweep cmyk-sweep-black" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_26%)]" />

      <div className="cmyk-register-mark">
        <div className="cmyk-register-ring cmyk-register-ring-lg" />
        <div className="cmyk-register-ring cmyk-register-ring-sm" />
        <div className="cmyk-register-cross cmyk-register-cross-h" />
        <div className="cmyk-register-cross cmyk-register-cross-v" />
      </div>
    </div>
  );
}
