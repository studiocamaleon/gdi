import { useEffect, useState } from "react";
import { artworkBlob } from "../core/artwork";

export function ArtworkPreview({
  source,
  alt,
}: {
  source: string;
  alt: string;
}) {
  const [preview, setPreview] = useState<{ source: string; url: string }>();
  useEffect(() => {
    let url: string;
    try {
      url = URL.createObjectURL(artworkBlob(source));
    } catch {
      setPreview(undefined);
      return;
    }
    setPreview({ source, url });
    return () => URL.revokeObjectURL(url);
  }, [source]);
  return preview?.source === source ? (
    <img
      src={preview.url}
      alt={alt}
      className="w-full max-h-32 object-contain"
    />
  ) : null;
}
