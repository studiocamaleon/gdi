import { expect, it } from "vitest";
import { configuracionPaddleWeb } from "./paddle-web";

it("selecciona el token público del entorno al ejecutar la misma imagen", () => {
  const prod = {
    GRAFO_DEPLOY_ENV: "production",
    PADDLE_CLIENT_TOKEN: "live_ficticio",
    NODE_ENV: "production",
  } as const;
  expect(configuracionPaddleWeb(prod)).toEqual({
    entorno: "production",
    token: "live_ficticio",
  });
  expect(configuracionPaddleWeb({ ...prod, GRAFO_DEPLOY_ENV: "staging",
    STAGING_PRIVATE: "true", PADDLE_ENV: "production" }).token).toBeNull();
  for (const token of ["test_ficticio", "pdl_live_apikey_ficticia", ""]) {
    expect(
      configuracionPaddleWeb({ ...prod, PADDLE_CLIENT_TOKEN: token }).token,
    ).toBeNull();
  }
  expect(
    configuracionPaddleWeb({
      NODE_ENV: "test",
      PADDLE_ENV: "sandbox",
      PADDLE_CLIENT_TOKEN: "test_ficticio",
    }),
  ).toEqual({ entorno: "sandbox", token: "test_ficticio" });
});
