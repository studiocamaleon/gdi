import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteConfig } from "./site-config";

afterEach(() => vi.unstubAllEnvs());

describe("Activación de la web comercial", () => {
  it.each([undefined, "", "prelaunch", "error", "LIVE"])(
    "mantiene cerrado el acceso salvo activación explícita: %s",
    (mode) => {
      vi.stubEnv("MARKETING_SITE_URL", "https://web.test");
      vi.stubEnv("MARKETING_LAUNCH_MODE", mode);
      vi.stubEnv("MARKETING_LOGIN_URL", "https://app.test/login");
      vi.stubEnv("MARKETING_SIGNUP_URL", "https://app.test/registro");
      vi.stubEnv("MARKETING_DEMO_URL", "https://app.test/demo");
      vi.stubEnv("MARKETING_CONTACT_URL", "mailto:equipo@web.test");
      const site = getSiteConfig();
      expect(site.isLive).toBe(false);
      expect(site.login).toBe("https://web.test/proximamente");
      expect(site.signup).toBe(site.login);
      expect(site.demo).toBe("mailto:equipo@web.test");
    },
  );

  it("restaura los destinos configurados cuando se habilita live", () => {
    vi.stubEnv("MARKETING_LAUNCH_MODE", "live");
    vi.stubEnv("MARKETING_APP_URL", "https://app.test");
    vi.stubEnv("MARKETING_LOGIN_URL", "");
    vi.stubEnv("MARKETING_SIGNUP_URL", "https://app.test/alta");
    vi.stubEnv("MARKETING_DEMO_URL", "https://demo.test/reservar");
    const site = getSiteConfig();
    expect(site.isLive).toBe(true);
    expect(site.login).toBe("https://app.test/login");
    expect(site.signup).toBe("https://app.test/alta");
    expect(site.demo).toBe("https://demo.test/reservar");
  });
});
