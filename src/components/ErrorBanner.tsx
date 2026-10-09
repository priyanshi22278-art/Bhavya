import React from 'react';
import { AlertTriangle, X, ShieldAlert, Copy, Check, Globe, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ErrorBanner: React.FC = () => {
  const { currentError, clearError } = useAuth();
  const [copied, setCopied] = React.useState(false);

  if (!currentError) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const isDomainAuthError =
    currentError.code === 'GOOGLE_OAUTH_DOMAIN_UNAUTHORIZED' ||
    currentError.details?.includes('auth/unauthorized-domain') ||
    currentError.details?.includes('Authorized Domains');

  const copyDetails = (textToCopy?: string) => {
    navigator.clipboard.writeText(textToCopy || JSON.stringify(currentError, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isDomainAuthError) {
    return (
      <div className="fixed top-4 right-4 left-4 md:left-auto md:w-[520px] z-50 animate-in fade-in slide-in-from-top duration-300">
        <div className="bg-slate-900/95 backdrop-blur-md border border-amber-500/60 rounded-2xl p-4 shadow-2xl text-slate-100 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <Globe className="w-5 h-5 flex-shrink-0 text-amber-400" />
              <span>Firebase Domain Authorization Required</span>
            </div>
            <button
              onClick={clearError}
              className="text-slate-400 hover:text-white rounded-lg p-1 transition-colors"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Google Sign-In with Firebase requires your current hosting domain to be registered in your Firebase project&apos;s{' '}
            <strong className="text-white">Authorized Domains</strong> list.
          </p>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Your Current Domain:</span>
              <button
                type="button"
                onClick={() => copyDetails(currentHost)}
                className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Domain'}</span>
              </button>
            </div>
            <div className="font-mono text-xs text-amber-300 bg-amber-950/40 border border-amber-900/40 p-2 rounded-lg break-all select-all">
              {currentHost}
            </div>
          </div>

          <div className="text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-200">How to authorize:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-300">
              <li>Open Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</li>
              <li>Click &quot;Add domain&quot; and paste the domain above</li>
            </ol>
            <p className="pt-1 text-[11px] text-emerald-400 font-medium">
              💡 Tip: Direct Google Calendar sync links in your Digital Pass work immediately without authorizing this domain!
            </p>
          </div>

          <div className="flex justify-end items-center gap-2 pt-1 text-xs">
            <a
              href="https://console.firebase.google.com/project/teak-tea-vggh3/authentication/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Firebase Console Settings</span>
            </a>
            <button
              onClick={clearError}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 left-4 md:left-auto md:w-[500px] z-50 animate-in fade-in slide-in-from-top duration-300">
      <div className="bg-red-950/90 backdrop-blur-md border border-red-500/60 rounded-xl p-4 shadow-2xl text-red-100 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-red-400 font-semibold">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 animate-pulse text-red-400" />
            <span className="text-sm uppercase tracking-wider">System Exception Detected</span>
          </div>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-white rounded-lg p-1 transition-colors"
            title="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-red-900/40 rounded-lg p-3 border border-red-800/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono bg-red-950 px-2 py-0.5 rounded border border-red-700/50 text-red-300 font-bold">
              CODE: {currentError.code}
            </span>
            <span className="text-red-300/70 text-[11px]">{currentError.timestamp}</span>
          </div>

          <p className="text-sm font-medium text-red-100 leading-snug">
            {currentError.message}
          </p>

          {currentError.details && (
            <p className="text-xs font-mono text-red-300/80 bg-black/40 p-2 rounded overflow-x-auto whitespace-pre-wrap">
              {currentError.details}
            </p>
          )}
        </div>

        <div className="flex justify-end items-center gap-2 pt-1 text-xs">
          <button
            onClick={() => copyDetails()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-900/60 hover:bg-red-800/80 text-red-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Error Details'}</span>
          </button>
          <button
            onClick={clearError}
            className="px-2.5 py-1 rounded-md bg-red-700 hover:bg-red-600 text-white font-medium transition-colors"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};
