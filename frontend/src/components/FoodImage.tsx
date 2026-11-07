"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";
import styles from "./food-image.module.css";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  src?: string | null;
  alt: string;
};

export default function FoodImage({ src, alt, className = "", style, loading = "lazy", width, height, onError, ...props }: Props) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = src?.trim() || "";
  if (!source || failedSource === source) {
    return <span role="img" aria-label={`Photo unavailable: ${alt}`} className={`${className} ${styles.fallback}`} style={{ width, height, ...style }}>
      <ImageOff size={24} aria-hidden="true" />
      <span>Photo unavailable</span>
    </span>;
  }
  // Native image errors also cover unavailable remote catalog URLs.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={source} alt={alt} width={width} height={height} loading={loading} className={`${className} ${styles.image}`} style={style} onError={event => { setFailedSource(source); onError?.(event); }} />;
}
