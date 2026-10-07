import React, { useState } from 'react';
import {
  Settings,
  X,
  Clock,
  ShieldCheck,
  Cpu,
  Mail,
  Play,
  Key,
  ExternalLink,
} from 'lucide-react';
import type { UserProfile, SystemHealthState } from '@/lib/types';

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export interface SettingsModalProps {
  isOpen: boolean;
  tempSettings: Record<string, any>;
  savedSettings: Record<string, any>;
  defaultSettings: Record<string, any>;
  userProfile: UserProfile | null;
  healthState: SystemHealthState | null;
  isOAuthConnecting: boolean;
  isSendingTestEmail: boolean;
  testEmailStatus: { success: boolean; message: string } | null;
  isTriggeringAgent: boolean;
  agentTriggerStatus: { success: boolean; message: string } | null;
  onClose: () => void;
  setTempSettings: (settings: any) => void;
  onSaveSettings: () => Promise<void>;
  onSendTestEmail: () => Promise<void>;
  onTestWebhook?: () => Promise<void>;
  isTestingWebhook?: boolean;
  webhookTestStatus?: { success: boolean; message: string } | null;
  onTriggerAgent: () => Promise<void>;
  onGitHubOAuth: (e?: React.MouseEvent) => void;
}

export function SettingsModal({
  isOpen,
  tempSettings,
  savedSettings,
  defaultSettings,
  userProfile,
  healthState,
  isOAuthConnecting,
  isSendingTestEmail,
  testEmailStatus,
  isTriggeringAgent,
  agentTriggerStatus,
  onClose,
  setTempSettings,
  onSaveSettings,
  onSendTestEmail,
  onTestWebhook,
  isTestingWebhook,
  webhookTestStatus,
  onTriggerAgent,
  onGitHubOAuth,
}: SettingsModalProps) {
  const [settingsTab, setSettingsTab] = useState<'automation' | 'safety' | 'ai' | 'notifications' | 'github'>('automation');

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={() => {
        setTempSettings(savedSettings);
        onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-[#121215] border border-[#dadada] dark:border-[#2a2a2a] w-full max-w-xl rounded-3xl p-6 flex flex-col shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#eeeeee] dark:border-[#2a2a2a] pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#e60023]/10 border border-[#e60023]/30 flex items-center justify-center text-[#e60023]">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-jakarta text-base font-bold text-[#1a1c1c] dark:text-[#f0f0f0]">Dashboard Settings</h3>
              <span className="text-[10px] font-mono text-zinc-400">System Preferences & Agent Tuning</span>
            </div>
          </div>
          <button
            onClick={() => {
              setTempSettings(savedSettings);
              onClose();
            }}
            className="h-8 w-8 rounded-full border border-[#dadada] dark:border-[#2a2a2a] hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 cursor-pointer transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category Navigation Pills */}
        <div className="flex bg-[#f3f3f3] dark:bg-[#1a1a1e] p-1 rounded-2xl text-xs font-bold font-geist overflow-x-auto gap-1">
          {[
            { id: 'automation', label: 'Automation', icon: Clock },
            { id: 'safety', label: 'Safety', icon: ShieldCheck },
            { id: 'ai', label: 'AI Settings', icon: Cpu },
            { id: 'notifications', label: 'Notifications', icon: Mail },
            { id: 'github', label: 'GitHub Account', icon: GithubIcon },
          ].map(cat => {
            const Icon = cat.icon;
            const isActive = settingsTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSettingsTab(cat.id as any)}
                className={`flex-1 min-w-[100px] flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-white dark:bg-[#2a2a30] text-[#e60023] font-bold shadow-xs' 
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Category Tab Content */}
        <div className="space-y-4 font-sans text-xs max-h-[55vh] overflow-y-auto pr-1">
          {/* TAB 1: AUTOMATION */}
          {settingsTab === 'automation' && (
            <div className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-[#18181c] border border-[#eeeeee] dark:border-[#2a2a2a] space-y-3 animate-in fade-in">
              <h4 className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta flex items-center gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5 text-[#e60023]" /> Automation & Schedule Controls
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Execution Frequency</label>
                    <select
                      value={tempSettings.cronFrequency}
                      onChange={(e) => setTempSettings({ ...tempSettings, cronFrequency: e.target.value })}
                      className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                    >
                      <option value="2">Every 2 Hours</option>
                      <option value="4">Every 4 Hours</option>
                      <option value="6">Every 6 Hours</option>
                      <option value="12">Every 12 Hours</option>
                      <option value="24">Every 24 Hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Max Profiles / Run</label>
                    <input
                      type="number"
                      value={tempSettings.maxProfilesPerRun}
                      onChange={(e) => setTempSettings({ ...tempSettings, maxProfilesPerRun: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Active Operating Window</label>
                  <input
                    type="text"
                    value={tempSettings.activeWorkingHours}
                    onChange={(e) => setTempSettings({ ...tempSettings, activeWorkingHours: e.target.value })}
                    className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                    placeholder="e.g. 09:00 - 22:00"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SAFETY */}
          {settingsTab === 'safety' && (
            <div className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-[#18181c] border border-[#eeeeee] dark:border-[#2a2a2a] space-y-3 animate-in fade-in">
              <h4 className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta flex items-center gap-1.5 text-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-[#e60023]" /> Safety & Filtering Limits
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Daily Follow Cap</label>
                    <input
                      type="number"
                      value={tempSettings.dailyFollowLimit}
                      onChange={(e) => setTempSettings({ ...tempSettings, dailyFollowLimit: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Grace Period (Days)</label>
                    <input
                      type="number"
                      value={tempSettings.unfollowGracePeriod}
                      onChange={(e) => setTempSettings({ ...tempSettings, unfollowGracePeriod: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                    />
                  </div>
                </div>
                
                <div className="space-y-2 pt-1 border-t border-[#eeeeee] dark:border-[#2a2a2a]">
                  <label className="flex items-center space-x-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={tempSettings.autoUnfollowNonMutuals}
                      onChange={(e) => setTempSettings({ ...tempSettings, autoUnfollowNonMutuals: e.target.checked })}
                      className="rounded border-[#dadada] dark:border-[#2a2a2a] text-[#e60023] focus:ring-[#e60023]"
                    />
                    <span className="text-xs font-medium text-[#1a1c1c] dark:text-[#f0f0f0]">
                      Auto-unfollow non-mutual profiles after grace period
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={tempSettings.excludeOrgAccounts}
                      onChange={(e) => setTempSettings({ ...tempSettings, excludeOrgAccounts: e.target.checked })}
                      className="rounded border-[#dadada] dark:border-[#2a2a2a] text-[#e60023] focus:ring-[#e60023]"
                    />
                    <span className="text-xs font-medium text-[#1a1c1c] dark:text-[#f0f0f0]">
                      Exclude Organization & Company Accounts (Target individual devs only)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI TUNING */}
          {settingsTab === 'ai' && (
            <div className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-[#18181c] border border-[#eeeeee] dark:border-[#2a2a2a] space-y-3 animate-in fade-in">
              <h4 className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta flex items-center gap-1.5 text-xs">
                <Cpu className="h-3.5 w-3.5 text-[#e60023]" /> AI Model & Evaluation Prompt
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">LLM Model Selector</label>
                  <select
                    value={tempSettings.llmModel}
                    onChange={(e) => setTempSettings({ ...tempSettings, llmModel: e.target.value })}
                    className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                  >
                    <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (Ultra Fast & Efficient)</option>
                    <option value="Gemini 1.5 Pro">Gemini 1.5 Pro (Deep Code Reasoning)</option>
                    <option value="GPT-4o">GPT-4o (High Context Precision)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Custom System Prompt Overlay</label>
                  <textarea
                    rows={3}
                    value={tempSettings.systemPrompt}
                    onChange={(e) => setTempSettings({ ...tempSettings, systemPrompt: e.target.value })}
                    className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-3 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023] leading-relaxed resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NOTIFICATIONS */}
          {settingsTab === 'notifications' && (
            <div className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-[#18181c] border border-[#eeeeee] dark:border-[#2a2a2a] space-y-3 animate-in fade-in">
              <h4 className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta flex items-center gap-1.5 text-xs">
                <Mail className="h-3.5 w-3.5 text-[#e60023]" /> Email Digest & Webhook Alerts
              </h4>
              
              <label className="flex items-center space-x-2 cursor-pointer pb-2 border-b border-[#eeeeee] dark:border-[#2a2a2a]">
                <input
                  type="checkbox"
                  checked={tempSettings.enableEmailDigest}
                  onChange={(e) => setTempSettings({ ...tempSettings, enableEmailDigest: e.target.checked })}
                  className="rounded border-[#dadada] dark:border-[#2a2a2a] text-[#e60023] focus:ring-[#e60023]"
                />
                <span className="text-xs font-bold text-[#1a1c1c] dark:text-[#f0f0f0]">
                  Enable Daily Automated Email Digest
                </span>
              </label>

              {tempSettings.enableEmailDigest && (
                <div className="space-y-3 pt-1 animate-in fade-in">
                  <div>
                    <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Recipient Email Address</label>
                    <input
                      type="email"
                      value={tempSettings.recipientEmail}
                      onChange={(e) => setTempSettings({ ...tempSettings, recipientEmail: e.target.value })}
                      className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                      placeholder="e.g. user@example.com"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1.5">Digest Content Specifications</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'runSummary', label: 'Run Summary' },
                        { id: 'followedProfiles', label: 'Followed Profiles' },
                        { id: 'unfollowedProfiles', label: 'Unfollowed Profiles' },
                        { id: 'mutualFollows', label: 'Mutual Follow-backs' },
                      ].map(opt => (
                        <label key={opt.id} className="flex items-center space-x-2 cursor-pointer bg-white dark:bg-[#111111] p-2 rounded-xl border border-[#dadada] dark:border-[#2a2a2a]">
                          <input
                            type="checkbox"
                            checked={(tempSettings.digestSummary as any)?.[opt.id]}
                            onChange={(e) => setTempSettings({
                              ...tempSettings,
                              digestSummary: { ...tempSettings.digestSummary, [opt.id]: e.target.checked },
                            })}
                            className="rounded text-[#e60023] focus:ring-[#e60023]"
                          />
                          <span className="text-[11px] font-mono">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">Delivery Time</label>
                    <input
                      type="text"
                      value={tempSettings.digestDeliveryTime}
                      onChange={(e) => setTempSettings({ ...tempSettings, digestDeliveryTime: e.target.value })}
                      className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                      placeholder="e.g. 09:00 AM"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">
                      Resend API Key (for Automated Incident & Health Reports)
                    </label>
                    <input
                      type="password"
                      value={tempSettings._resendApiKeyDirty ? tempSettings.resendApiKey ?? '' : ''}
                      placeholder={tempSettings.has_resendApiKey ? '••••••••••••••••' : 're_...'}
                      onChange={(e) => setTempSettings((s: any) => ({ ...s, resendApiKey: e.target.value, _resendApiKeyDirty: true }))}
                      className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                    />
                    <p className="text-[9px] text-zinc-500 mt-1 font-mono">
                      Stored securely server-side. Used to send zero-spam executive incident alerts directly to your inbox.
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono font-bold text-zinc-500 block mb-1">
                      Email Sender Display Name
                    </label>
                    <input
                      type="text"
                      value={tempSettings.senderName || ''}
                      onChange={(e) => setTempSettings({ ...tempSettings, senderName: e.target.value })}
                      className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                      placeholder="e.g. FollowMe Ops, My Custom Bot"
                    />
                    <p className="text-[9px] text-zinc-500 mt-1 font-mono">
                      The sender name displayed in your inbox (defaults to FollowMe System).
                    </p>
                  </div>

                  <div className="border-t border-[#eeeeee] dark:border-[#2a2a2a] pt-3 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-mono font-bold text-zinc-500">Webhook Endpoint URL (Optional)</label>
                        {onTestWebhook && (
                          <button
                            type="button"
                            onClick={onTestWebhook}
                            disabled={isTestingWebhook || !tempSettings.webhookUrl}
                            className="text-[10px] font-mono text-[#e60023] hover:underline disabled:opacity-40 cursor-pointer"
                          >
                            {isTestingWebhook ? 'Testing...' : 'Test Webhook'}
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={tempSettings.webhookUrl || ''}
                        onChange={(e) => setTempSettings({ ...tempSettings, webhookUrl: e.target.value })}
                        className="w-full bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                        placeholder="e.g. https://api.yoursite.com/webhook"
                      />
                      {webhookTestStatus && (
                        <div className={`mt-2 p-2 rounded-lg border text-[10px] font-mono ${
                          webhookTestStatus.success
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                        }`}>
                          {webhookTestStatus.message}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Setup Guide */}
                  <div className="p-3 bg-emerald-50 dark:bg-[#15231c] border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-1.5 text-[10px] font-sans">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 block flex items-center gap-1">
                      🛡️ Resend High-Priority Incident Pipeline
                    </span>
                    <p className="text-zinc-600 dark:text-zinc-400 leading-normal">
                      When your GitHub PAT expires, NVIDIA NIM credits deplete, or rate limits are reached, FollowMe sends a crisp executive report with direct resolution links.
                    </p>
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={onSendTestEmail}
                      disabled={isSendingTestEmail}
                      className="flex-1 py-2 bg-zinc-900 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-[10px] font-bold rounded-xl transition cursor-pointer font-geist flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                    >
                      {isSendingTestEmail ? (
                        <>
                          <span className="h-3 w-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          <span>Dispatching...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="h-3 w-3 text-emerald-400" />
                          <span>Send Test Alert Email</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={onTriggerAgent}
                      disabled={isTriggeringAgent || healthState?.isGitHubValid === false}
                      className="flex-1 py-2 bg-[#e60023] hover:bg-[#c0001b] disabled:opacity-50 text-white text-[10px] font-bold rounded-xl transition cursor-pointer font-geist flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      {isTriggeringAgent ? (
                        <>
                          <span className="h-3 w-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          <span>Triggering...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 text-white fill-current" />
                          <span>Run Agent Now</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Status banners */}
                  {testEmailStatus && (
                    <div className={`p-2.5 rounded-xl border text-[10px] font-mono font-medium animate-in slide-in-from-top-2 ${
                      testEmailStatus.success 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                    }`}>
                      {testEmailStatus.message}
                    </div>
                  )}

                  {agentTriggerStatus && (
                    <div className={`p-2.5 rounded-xl border text-[10px] font-mono font-medium animate-in slide-in-from-top-2 ${
                      agentTriggerStatus.success 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-455'
                    }`}>
                      {agentTriggerStatus.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: GITHUB ACCOUNT INTEGRATION */}
          {settingsTab === 'github' && (
            <div className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-[#18181c] border border-[#eeeeee] dark:border-[#2a2a2a] space-y-4 animate-in fade-in">
              <h4 className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta flex items-center gap-1.5 text-xs">
                <GithubIcon className="h-4 w-4 text-[#e60023]" /> GitHub Account & Credentials
              </h4>

              <div className="p-4 bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  {userProfile?.avatar_url ? (
                    <img 
                      src={userProfile.avatar_url} 
                      alt={userProfile.login || 'GitHub User'} 
                      className="h-11 w-11 rounded-full border border-zinc-200 dark:border-zinc-700 object-cover"
                    />
                  ) : (
                    <div className="h-11 w-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
                      <GithubIcon className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold font-jakarta text-xs text-[#1a1c1c] dark:text-[#f0f0f0]">
                        {userProfile?.login ? `@${userProfile.login}` : 'Not Connected'}
                      </span>
                      {healthState?.isGitHubValid ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          Connected & Healthy
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          Authentication Expired / Invalid
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {userProfile?.name ? `${userProfile.name} • ` : ''}Used for discovery, grading & follow automations
                    </p>
                  </div>
                </div>

                <button
                  onClick={onGitHubOAuth}
                  disabled={isOAuthConnecting}
                  className="px-4 py-2 bg-[#24292e] hover:bg-[#1b1f23] dark:bg-[#1f2328] dark:hover:bg-[#2d333b] disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center space-x-2 shrink-0 shadow-xs cursor-pointer"
                >
                  {isOAuthConnecting ? (
                    <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  ) : (
                    <GithubIcon className="h-3.5 w-3.5" />
                  )}
                  <span>{isOAuthConnecting ? 'Connecting...' : (userProfile?.login ? 'Re-authorize OAuth' : 'Connect via GitHub OAuth')}</span>
                </button>
              </div>

              {/* Manual PAT Configuration */}
              <div className="p-4 bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1a1c1c] dark:text-[#f0f0f0] flex items-center gap-1.5 font-jakarta">
                    <Key className="h-3.5 w-3.5 text-[#e60023]" /> Personal Access Token (PAT)
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-[#e60023] hover:underline font-mono flex items-center gap-1"
                  >
                    Generate on GitHub <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <input
                  type="password"
                  value={tempSettings._githubTokenDirty ? tempSettings.githubToken ?? '' : ''}
                  placeholder={tempSettings.has_githubToken ? '••••••••••••••••' : 'ghp_...'}
                  onChange={(e) => setTempSettings((s: any) => ({ ...s, githubToken: e.target.value, _githubTokenDirty: true }))}
                  className="w-full bg-zinc-50 dark:bg-[#151518] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl px-3 py-2 text-xs font-mono text-[#1a1c1c] dark:text-[#f0f0f0] focus:outline-none focus:border-[#e60023]"
                />
                <p className="text-[10px] text-zinc-500 font-mono">
                  Required scopes: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[9px]">public_repo</code>, <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[9px]">user:follow</code>, <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[9px]">read:user</code>.
                </p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800 rounded-xl text-[11px] font-sans text-zinc-600 dark:text-zinc-400 space-y-1">
                <p className="font-bold text-zinc-800 dark:text-zinc-200">ℹ️ Updating Your Token</p>
                <p className="leading-relaxed text-[10px]">
                  Pasting a new PAT here and clicking "Save Settings" immediately restores live connection, clears the offline snapshot banner, and re-enables all background tasks.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="pt-2 flex items-center justify-between border-t border-[#eeeeee] dark:border-[#2a2a2a]">
          <button
            type="button"
            onClick={() => setTempSettings(defaultSettings)}
            className="px-4 py-2 border border-[#dadada] dark:border-[#2a2a2a] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-full transition cursor-pointer font-geist"
          >
            Restore Defaults
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setTempSettings(savedSettings);
                onClose();
              }}
              className="px-4 py-2 border border-[#dadada] dark:border-[#2a2a2a] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold rounded-full transition cursor-pointer font-geist"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveSettings}
              className="px-5 py-2 bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full transition cursor-pointer font-geist shadow-sm"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
