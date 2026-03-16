import { cn } from "@/lib/utils";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackExt?: 'png' | 'jpg' | 'jpeg';
  className?: string;
  priority?: boolean;
}

export const OptimizedImage = ({ 
  src, 
  alt, 
  fallbackExt = 'png', 
  className, 
  priority = false,
  ...props 
}: OptimizedImageProps) => {
  // Only attempt WebP substitution for local images
  const isLocal = src.startsWith("/");
  const basePath = src.includes(".") ? src.split(".").slice(0, -1).join(".") : src;
  const webpPath = isLocal ? `${basePath}.webp` : src;

  return (
    <picture>
      {isLocal && <source srcSet={webpPath} type="image/webp" />}
      <source srcSet={src} type={src.endsWith(".jpg") || src.endsWith(".jpeg") ? "image/jpeg" : `image/png`} />
      <img 
        src={src} 
        alt={alt} 
        className={cn("w-full h-full object-cover", className)}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        {...props}
      />
    </picture>
  );
};
