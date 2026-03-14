import { useState } from 'react';
import { Download, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExportButtonProps {
  onExport: () => Promise<void> | void;
  label?: string;
  className?: string;
}

export function ExportButton({ onExport, label = 'Export CSV', className }: ExportButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  const handleClick = async () => {
    if (state !== 'idle') return;
    setState('loading');
    try {
      await onExport();
      setState('done');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('idle');
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200",
        state === 'idle' && "bg-background text-foreground border-border hover:border-primary hover:text-primary",
        state === 'loading' && "bg-background text-muted-foreground border-border cursor-wait",
        state === 'done' && "bg-green-500/10 text-green-600 border-green-500/30",
        className
      )}
    >
      {state === 'idle' && <Download size={15} />}
      {state === 'loading' && <Loader2 size={15} className="animate-spin" />}
      {state === 'done' && <Check size={15} />}
      <span>
        {state === 'idle' && label}
        {state === 'loading' && 'Exporting...'}
        {state === 'done' && 'Downloaded!'}
      </span>
    </button>
  );
}
