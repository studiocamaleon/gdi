-- URL del perfil de Google del negocio (ficha de Maps / Google Business).
-- Es a dónde apunta "Ver mapa" en el seguimiento público; si queda null, el
-- front cae a buscar el domicilio en Google Maps como hasta ahora.
ALTER TABLE "DatosEmpresa" ADD COLUMN "urlPerfilGoogle" TEXT;
