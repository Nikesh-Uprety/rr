import { StarsBackground } from "@/components/backgrounds/StarsBackground";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <StarsBackground />
      
      <div className="relative z-10 text-center space-y-6 px-4">
        <h1 className="text-6xl md:text-8xl font-black tracking-tight uppercase">
          404
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground font-light">
          Page not found
        </p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a 
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 transition-opacity"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
