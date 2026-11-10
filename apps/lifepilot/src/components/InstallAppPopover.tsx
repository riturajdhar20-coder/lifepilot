import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@project/components/ui/button';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function useIsPwaMode() {
  const [isPwa, setIsPwa] = useState(false);
  useEffect(() => {
    const qs = [window.matchMedia('(display-mode: standalone)'), window.matchMedia('(display-mode: fullscreen)')];
    const update = () =>
      setIsPwa(qs.some((q) => q.matches) || (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    update();
    qs.forEach((q) => q.addEventListener('change', update));
    return () => qs.forEach((q) => q.removeEventListener('change', update));
  }, []);
  return isPwa;
}

const instructions = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'Tap Share, then “Add to Home Screen”.';
  if (/android/.test(ua)) return 'Use your browser menu and choose “Add to Home screen”.';
  return 'Use the install icon in your browser’s address bar.';
};

export default function InstallAppPopover() {
  const isPwa = useIsPwaMode();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('lp-install-dismissed') === '1');
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isPwa || dismissed) return null;
  const dismiss = () => { localStorage.setItem('lp-install-dismissed', '1'); setDismissed(true); };
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
    dismiss();
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 rounded-xl border border-border bg-card p-4 shadow-lg sm:left-auto sm:w-80">
      <button onClick={dismiss} aria-label="Dismiss" className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
        <X size={16} />
      </button>
      <div className="flex gap-3 pr-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Download size={16} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Install LifePilot</p>
          <p className="text-[13px] text-muted-foreground">{prompt ? 'Add it to your device for one-tap access.' : instructions()}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={dismiss}>Not now</Button>
        {prompt && <Button size="sm" onClick={() => void install()}>Install</Button>}
      </div>
    </div>
  );
}
