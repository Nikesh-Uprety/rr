import { motion } from "framer-motion";
import { Sparkles, Diamond, Star, Gem } from "lucide-react";
import { Link } from "wouter";

export default function LegalPlaceholder() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center relative overflow-hidden bg-background px-6">
      
      {/* Decorative gradient background elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
      
      {/* Floating Animated Icons */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden text-muted-foreground/20">
        <Sparkles className="absolute top-[20%] left-[15%] w-6 h-6 animate-float" />
        <Star className="absolute top-[15%] right-[20%] w-5 h-5 animate-float-delayed" />
        <Gem className="absolute bottom-[25%] left-[25%] w-4 h-4 animate-float" style={{ animationDelay: '1s' }} />
        <Diamond className="absolute bottom-[30%] right-[15%] w-6 h-6 animate-float-delayed" style={{ animationDelay: '2s' }} />
        <Sparkles className="absolute top-[50%] right-[30%] w-3 h-3 animate-pulse" style={{ animationDelay: '0.5s' }} />
        <Star className="absolute top-[60%] left-[10%] w-3 h-3 animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative max-w-2xl w-full text-center z-10">
        {/* Subtle top decoration */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="flex justify-center mb-6"
        >
          <div className="w-12 h-12 rounded-full border border-primary/20 flex items-center justify-center bg-background/50 backdrop-blur-sm shadow-inner overflow-hidden relative">
             <Diamond className="w-5 h-5 text-primary/60 animate-pulse" />
             <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/5 to-transparent" />
          </div>
        </motion.div>

        {/* Main Heading Text */}
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl md:text-5xl lg:text-7xl font-serif font-black tracking-tighter mb-6 leading-tight uppercase relative inline-block text-foreground"
        >
          Under
          <br className="md:hidden" />
          <span className="italic font-light ml-2">Development</span>
        </motion.h1>

        {/* Separator line */}
        <motion.div 
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          className="h-px w-24 bg-gradient-to-r from-transparent via-primary/40 to-transparent mx-auto mb-8"
        />

        {/* Body Text */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
          className="text-muted-foreground text-sm md:text-base font-medium max-w-lg mx-auto leading-relaxed"
        >
          We are currently crafting the specific details for this section to ensure the highest standard of transparency.
          <br />
          <br />
          <span className="text-foreground font-semibold">It will be updated very soon. Thank you for your patience.</span>
        </motion.p>

        {/* Back Context Actions */}
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ duration: 1, delay: 1 }}
           className="mt-12"
        >
          <Link
            href="/"
            className="inline-flex items-center justify-center text-xs font-bold uppercase tracking-[0.2em] border-b border-foreground/30 pb-1 hover:border-foreground transition-colors duration-300 group"
          >
            Return Home
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
