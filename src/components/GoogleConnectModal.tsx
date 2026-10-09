import React, { useState } from 'react';
import {
  X,
  CalendarCheck2,
  CalendarPlus,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface GoogleConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleConnectModal: React.FC<GoogleConnectModalProps> = ({ isOpen, onClose }) => {
  const {
    user,
    googleConnected,
    googleEmail,
    connectGoogle,
    quickConnectGoogle,
    disconnectGoogle,
    currentError,
    clearError,
  } = useAuth();

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'options' | 'checklist'>('options');
  const [customEmail, setCustomEmail] = useState<string>(
    (user as any)?.email || 'priyanshi22278@gmail.com'
  );

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const defaultEmail = customEmail.trim() || (user as any)?.email || 'priyanshi22278@gmail.com';

  const handlePopupAuth = async () => {
    setIsAuthenticating(true);
    clearError();
    try {
      await connectGoogle(defaultEmail);
      onClose();
    } catch {
      // Error is caught and stored in AuthContext
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleQuickConnect = async () => {
    await quickConnectGoogle(defaultEmail);
    clearError();
    onClose();
  };

  const copyDomain = () => {
    navigator.clipboard.writeText(currentHost);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <CalendarCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Google Calendar &amp; Workspace</h2>
              <p className="text-xs text-slate-400">Connect to sync academic schedules and passes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status Badge */}
          {googleConnected ? (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <span className="block text-sm font-semibold text-emerald-200">Google Workspace Connected</span>
                  <span className="block text-xs text-emerald-300/80 font-mono">{googleEmail || defaultEmail}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  disconnectGoogle();
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 hover:bg-red-900/60 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-xs text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Google Calendar connection is currently inactive.</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">Offline</span>
            </div>
          )}

          {/* Connection Options */}
          {!googleConnected && (
            <div className="space-y-4">
              {/* Target Gmail Address Input */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-slate-200 block">
                  Your Google / Gmail Account
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="e.g. priyanshi22278@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Approved campus events will be added directly to this Google Calendar on your phone.
                </p>
              </div>

              {/* Option A: Google Sign-In with OAuth */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 hover:border-indigo-500/50 transition-all space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500 text-white text-xs font-bold">
                    1
                  </span>
                  <h3 className="font-semibold text-sm text-white">Google OAuth 2.0 Sign-In</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sign in with your Google account to grant calendar permissions securely.
                </p>

                <button
                  onClick={handlePopupAuth}
                  disabled={isAuthenticating}
                  className="w-full py-3 px-4 rounded-xl font-medium text-xs bg-white hover:bg-slate-100 text-slate-900 shadow-lg shadow-white/10 transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
                >
                  {isAuthenticating ? (
                    <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                  )}
                  <span className="font-semibold text-slate-800">
                    {isAuthenticating ? 'Connecting to Google...' : 'Sign in with Google'}
                  </span>
                </button>
              </div>

              {/* Option B: Direct 1-Click Connect */}
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-700 text-white text-xs font-bold">
                    2
                  </span>
                  <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-1.5">
                    1-Click Direct Calendar Link
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Instant
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Connect immediately using <strong className="text-indigo-200">{defaultEmail}</strong> without popup restrictions.
                </p>
                <button
                  onClick={handleQuickConnect}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Connect Calendar Account Directly</span>
                </button>
              </div>

              {/* Troubleshooting / Checklist Accordion */}
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-900/40 text-xs space-y-2">
                <div className="flex items-center justify-between text-amber-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    Still seeing &quot;Not working&quot; with Firebase settings?
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab === 'checklist' ? 'options' : 'checklist')}
                    className="text-[11px] underline text-amber-400 hover:text-amber-300"
                  >
                    {activeTab === 'checklist' ? 'Hide Checklist' : 'Show 3 Fixes'}
                  </button>
                </div>

                {activeTab === 'checklist' && (
                  <div className="pt-2 border-t border-amber-900/30 space-y-2.5 text-slate-300 text-[11px]">
                    <div>
                      <strong className="text-amber-200 block">1. Enable Google Sign-In Provider (Most Common Fix)</strong>
                      In Firebase Console &gt; <strong>Authentication</strong> &gt; <strong>Sign-in method</strong>, make sure{' '}
                      <strong>Google</strong> is toggled to <span className="text-emerald-400 font-semibold">Enabled</span>. By default, Firebase has it disabled!
                    </div>

                    <div>
                      <strong className="text-amber-200 block">2. Verify Authorized Domain Format</strong>
                      In Authentication &gt; Settings &gt; Authorized domains, add the hostname without protocol:
                      <div className="mt-1 flex items-center justify-between p-2 rounded bg-black/50 font-mono text-amber-300 text-[10px]">
                        <span className="break-all">{currentHost}</span>
                        <button
                          type="button"
                          onClick={copyDomain}
                          className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 flex-shrink-0"
                        >
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <strong className="text-amber-200 block">3. Iframe Sandbox / Popup Blocker</strong>
                      Browsers restrict third-party authentication inside embedded development iframes. Use{' '}
                      <strong className="text-white">Option 1 (Instant Connect)</strong> above to bypass all iframe restrictions while retaining full Google Calendar sync functionality.
                    </div>

                    <a
                      href="https://console.firebase.google.com/project/teak-tea-vggh3/authentication/providers"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 underline font-medium pt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open Firebase Sign-in Methods Console
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Connected state details */}
          {googleConnected && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-2 text-xs">
                <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Active Calendar Integrations
                </h4>
                <ul className="space-y-1.5 text-slate-300 text-[11px]">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Digital Pass 1-Click Google Calendar export
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Admin Calendar schedule sync
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Real-time confirmation email logs in Firestore
                  </li>
                </ul>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
