import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeColor?: string;
}

export function Switch({ checked, onChange, activeColor = 'bg-indigo-600' }: Props) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-10 h-6 rounded-full shrink-0 transition-colors duration-200',
        checked ? activeColor : 'bg-slate-200 dark:bg-slate-700'
      )}
    >
      <motion.span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
        animate={{ x: checked ? 16 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
