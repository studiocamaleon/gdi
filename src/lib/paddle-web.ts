/** Sólo el token público de Paddle.js puede pasar del servidor al navegador. */
export function configuracionPaddleWeb(env: NodeJS.ProcessEnv) {
  const entorno =
    env.GRAFO_DEPLOY_ENV === "production" ||
    (env.STAGING_PRIVATE !== "true" && (env.PADDLE_ENV ?? env.NEXT_PUBLIC_PADDLE_ENV) === "production")
      ? "production"
      : "sandbox";
  const token = (
    env.PADDLE_CLIENT_TOKEN ?? env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
  )?.trim();
  const prefijo = entorno === "production" ? "live_" : "test_";
  return { entorno, token: token?.startsWith(prefijo) ? token : null } as const;
}
