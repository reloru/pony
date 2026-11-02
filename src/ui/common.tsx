import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { ArrowLeft } from 'lucide-preact';
import { back, type Route } from '../app/router';

export function TopBar({ title, backTo, children }: { title: ComponentChildren; backTo?: Route; children?: ComponentChildren }) {
  return (
    <div class="topbar">
      {backTo && (
        <button class="btn icon" aria-label="Back" onClick={() => back(backTo)}>
          <ArrowLeft size={30} strokeWidth={2.6} />
        </button>
      )}
      {typeof title === 'string' ? <h1>{title}</h1> : title}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toasts: short messages at the top of the screen.

let showToast: (msg: string) => void = () => {};
export function toast(msg: string) {
  showToast(msg);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    showToast = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2200);
    };
    return () => clearTimeout(t);
  }, []);
  return msg ? (
    <div class="toast" role="status">
      {msg}
    </div>
  ) : null;
}

export function Sheet({ onClose, children, label }: { onClose: () => void; children: ComponentChildren; label: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function Confetti() {
  const colors = ['#ff4f9a', '#7c5cff', '#12b5a3', '#ffc93c', '#6fd3f5', '#8fe08a', '#ff8f3c'];
  const bits = Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    dur: 2 + Math.random() * 1.8,
    color: colors[i % colors.length],
    round: Math.random() < 0.5,
  }));
  return (
    <div class="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i
          key={i}
          style={{
            left: `${b.left}%`,
            background: b.color,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
            borderRadius: b.round ? '50%' : '6px',
          }}
        />
      ))}
    </div>
  );
}
