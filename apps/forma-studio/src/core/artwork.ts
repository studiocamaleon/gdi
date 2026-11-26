const MAX_BYTES = 2_000_000;
const invalid = () =>
  new Error(
    "La gráfica debe ser una imagen PNG, JPEG o WebP incorporada al proyecto, de hasta 2 MB.",
  );

/** Decodifica datos, comprueba la firma raster y fija el MIME sin aceptar URLs. */
export function artworkBlob(source: string): Blob {
  if (source.length > 2_800_000) throw invalid();
  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(source);
  if (!match) throw invalid();
  let binary: string;
  try {
    binary = atob(match[2]);
  } catch {
    throw invalid();
  }
  if (!binary.length || binary.length > MAX_BYTES) throw invalid();
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const starts = (signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  const type =
    match[1] === "png" && starts([137, 80, 78, 71, 13, 10, 26, 10])
      ? "image/png"
      : match[1] === "jpeg" && starts([255, 216, 255])
        ? "image/jpeg"
        : match[1] === "webp" &&
            binary.startsWith("RIFF") &&
            binary.slice(8, 12) === "WEBP"
          ? "image/webp"
          : null;
  if (!type) throw invalid();
  return new Blob([bytes], { type });
}

export async function readArtwork(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > MAX_BYTES
  )
    throw invalid();
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  artworkBlob(source);
  return source;
}
