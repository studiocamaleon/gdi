/** Piloto interno: credenciales del servidor, nunca del formulario/browser. */
export function configuracionMetaPiloto() {
  const env = process.env;
  const tenantId = env.META_PILOT_TENANT_ID ?? '';
  if (
    env.META_WHATSAPP_PILOT_ENABLED !== 'true' ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(tenantId)
  )
    return null;
  const phoneNumberId = env.META_PILOT_PHONE_NUMBER_ID ?? '';
  const wabaId = env.META_PILOT_WABA_ID ?? '';
  const destinatario = env.META_PILOT_RECIPIENT ?? '';
  const accessToken = env.META_PILOT_ACCESS_TOKEN ?? '';
  return {
    tenantId,
    phoneNumberId,
    wabaId,
    destinatario,
    accessToken,
    listo:
      /^v\d+\.0$/.test(env.META_GRAPH_API_VERSION ?? 'v26.0') &&
      /^\d+$/.test(phoneNumberId) &&
      /^\d+$/.test(wabaId) &&
      /^\+[1-9]\d{7,14}$/.test(destinatario) &&
      accessToken.length > 20 &&
      Boolean(env.META_APP_SECRET) &&
      Boolean(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
  };
}
