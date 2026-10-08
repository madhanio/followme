'use client';

import React, { useState } from 'react';
import {
  Settings,
  X,
  ShieldCheck,
  Cpu,
  Mail,
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

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 13,
  border: '1px solid var(--line)',
  borderRadius: 'var(--r)',
  background: 'var(--bg)',
  color: 'var(--ink)',
  outline: 'none',
  boxSizing: 'border-box',
};

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {children}
      {hint && (
        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 4 }}>
          {hint}
        </span>
      )}
    </div>
  );
}

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
  onClose,
  setTempSettings,
  onSaveSettings,
  onSendTestEmail,
  onGitHubOAuth,
}: SettingsModalProps) {
  const [tab, setTab] = useState<'general' | 'data'>('general');

  if (!isOpen) return null;

  const gradeThreshold = Number(tempSettings.gradeThreshold ?? 7);

  function handleExportCSV() {
    // TODO: wire to real repos array / server action in Part G
    alert('Export not yet wired');
  }

  function handleDeleteAll() {
    if (!confirm('Delete ALL profile data? This cannot be undone.')) return;
    // TODO: wire to real server action in Part G
    alert('Delete not yet wired');
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={() => {
        setTempSettings(savedSettings);
        onClose();
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          width: '100%',
          maxWidth: 580,
          borderRadius: 'var(--r)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          gap: 16,
          maxHeight: '85vh',
          overflowY: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--r)', background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
              <Settings style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Dashboard Settings</h3>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>System Preferences & Agent Tuning</span>
            </div>
          </div>
          <button
            onClick={() => {
              setTempSettings(savedSettings);
              onClose();
            }}
            aria-label="Close"
            style={{
              width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--line)',
              background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--muted)', cursor: 'pointer',
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Tab switcher: General vs Data */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 4 }}>
          {(['general', 'data'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 14px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--ink)' : 'var(--muted)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t === 'general' ? 'General' : 'Data'}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'general' ? (
            <>
              {/* Section: Worker & Automation */}
              <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Worker & Safety Limits
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <SettingRow label="Max Profiles / Run">
                    <input
                      type="number"
                      value={tempSettings.maxProfilesPerRun ?? 50}
                      onChange={(e) => setTempSettings({ ...tempSettings, maxProfilesPerRun: Number(e.target.value) })}
                      style={INPUT_STYLE}
                    />
                  </SettingRow>

                  <SettingRow label="Daily Follow Cap">
                    <input
                      type="number"
                      value={tempSettings.dailyFollowLimit ?? 30}
                      onChange={(e) => setTempSettings({ ...tempSettings, dailyFollowLimit: Number(e.target.value) })}
                      style={INPUT_STYLE}
                    />
                  </SettingRow>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <SettingRow label="Grade threshold" hint="Worker follows profiles scoring ≥ this value (default 7)">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={gradeThreshold}
                      onChange={(e) => setTempSettings({ ...tempSettings, gradeThreshold: Number(e.target.value) })}
                      style={INPUT_STYLE}
                    />
                  </SettingRow>

                  <SettingRow label="Grace Period (Days)" hint="Days before unfollowing non-mutuals">
                    <input
                      type="number"
                      value={tempSettings.unfollowGracePeriod ?? 7}
                      onChange={(e) => setTempSettings({ ...tempSettings, unfollowGracePeriod: Number(e.target.value) })}
                      style={INPUT_STYLE}
                    />
                  </SettingRow>
                </div>

                <SettingRow label="Active Operating Window">
                  <input
                    type="text"
                    value={tempSettings.activeWorkingHours ?? ''}
                    onChange={(e) => setTempSettings({ ...tempSettings, activeWorkingHours: e.target.value })}
                    style={INPUT_STYLE}
                    placeholder="e.g. 09:00 - 22:00"
                  />
                </SettingRow>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!tempSettings.autoUnfollowNonMutuals}
                      onChange={(e) => setTempSettings({ ...tempSettings, autoUnfollowNonMutuals: e.target.checked })}
                    />
                    <span>Auto-unfollow non-mutual profiles after grace period</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!tempSettings.excludeOrgAccounts}
                      onChange={(e) => setTempSettings({ ...tempSettings, excludeOrgAccounts: e.target.checked })}
                    />
                    <span>Exclude Organization & Company Accounts (Target individual devs only)</span>
                  </label>
                </div>
              </div>

              {/* Section: AI Evaluation */}
              <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  AI Evaluation
                </span>

                <SettingRow label="Custom System Prompt Overlay">
                  <textarea
                    rows={3}
                    value={tempSettings.systemPrompt ?? ''}
                    onChange={(e) => setTempSettings({ ...tempSettings, systemPrompt: e.target.value })}
                    style={{ ...INPUT_STYLE, resize: 'none', lineHeight: 1.5 }}
                  />
                </SettingRow>
              </div>

              {/* Section: Notifications */}
              <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Incident Alerts & Email
                </span>

                <SettingRow label="Recipient Email Address">
                  <input
                    type="email"
                    value={tempSettings.recipientEmail ?? ''}
                    onChange={(e) => setTempSettings({ ...tempSettings, recipientEmail: e.target.value })}
                    style={INPUT_STYLE}
                    placeholder="user@example.com"
                  />
                </SettingRow>

                <SettingRow label="Email Sender Display Name">
                  <input
                    type="text"
                    value={tempSettings.senderName ?? ''}
                    onChange={(e) => setTempSettings({ ...tempSettings, senderName: e.target.value })}
                    style={INPUT_STYLE}
                    placeholder="FollowMe System"
                  />
                </SettingRow>

                <SettingRow
                  label="Resend API Key"
                  hint="Used securely server-side for zero-spam incident reports"
                >
                  <input
                    type="password"
                    value={tempSettings._resendApiKeyDirty ? tempSettings.resendApiKey ?? '' : ''}
                    placeholder={tempSettings.has_resendApiKey ? '••••••••••••••••' : 're_...'}
                    onChange={(e) => setTempSettings((s: any) => ({ ...s, resendApiKey: e.target.value, _resendApiKeyDirty: true }))}
                    style={INPUT_STYLE}
                  />
                </SettingRow>

                <button
                  type="button"
                  onClick={onSendTestEmail}
                  disabled={isSendingTestEmail}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--r)',
                    border: '1px solid var(--line)',
                    background: 'var(--hover)',
                    color: 'var(--ink)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Mail style={{ width: 14, height: 14, color: 'var(--accent)' }} />
                  <span>{isSendingTestEmail ? 'Sending...' : 'Send Test Alert Email'}</span>
                </button>

                {testEmailStatus && (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 'var(--r)',
                      border: `1px solid ${testEmailStatus.success ? 'var(--accent)' : 'var(--warn)'}`,
                      background: testEmailStatus.success ? 'var(--accent-tint)' : 'var(--warn-tint)',
                      color: testEmailStatus.success ? 'var(--accent)' : 'var(--warn)',
                      fontSize: 11,
                    }}
                  >
                    {testEmailStatus.message}
                  </div>
                )}
              </div>

              {/* Section: GitHub Credentials */}
              <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  GitHub Account & Credentials
                </span>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {userProfile?.avatar_url ? (
                      <img src={userProfile.avatar_url} alt={userProfile.login || 'GitHub'} width={38} height={38} style={{ borderRadius: '50%', border: '1px solid var(--line)' }} />
                    ) : (
                      <div style={{ width: 38, height: 38, borderRadius: 'var(--r)', background: 'var(--hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <GithubIcon style={{ width: 20, height: 20 }} />
                      </div>
                    )}
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', display: 'block' }}>
                        {userProfile?.login ? `@${userProfile.login}` : 'Not Connected'}
                      </span>
                      <span style={{ fontSize: 11, color: healthState?.isGitHubValid ? 'var(--accent)' : 'var(--warn)' }}>
                        {healthState?.isGitHubValid ? 'Connected & Healthy' : 'Auth Expired / Invalid'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onGitHubOAuth}
                    disabled={isOAuthConnecting}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 'var(--r)',
                      border: '1px solid var(--line)',
                      background: 'var(--hover)',
                      color: 'var(--ink)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isOAuthConnecting ? 'Connecting...' : userProfile?.login ? 'Re-authorize OAuth' : 'Connect via GitHub'}
                  </button>
                </div>

                <SettingRow
                  label="Personal Access Token (PAT)"
                  hint="Required scopes: public_repo, user:follow, read:user"
                >
                  <input
                    type="password"
                    value={tempSettings._githubTokenDirty ? tempSettings.githubToken ?? '' : ''}
                    placeholder={tempSettings.has_githubToken ? '••••••••••••••••' : 'ghp_...'}
                    onChange={(e) => setTempSettings((s: any) => ({ ...s, githubToken: e.target.value, _githubTokenDirty: true }))}
                    style={INPUT_STYLE}
                  />
                </SettingRow>
              </div>
            </>
          ) : (
            /* TAB: DATA */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Export */}
              <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>
                  Export profiles
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
                  Downloads all followed profiles as a CSV file (login, grade, follow_back, reason).
                </p>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 'var(--r)',
                    border: '1px solid var(--line)',
                    background: 'var(--hover)',
                    color: 'var(--ink)',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Export CSV
                </button>
              </div>

              {/* Delete */}
              <div style={{ border: '1px solid var(--warn)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--warn)', marginBottom: 4 }}>
                  Delete all profile data
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
                  Permanently removes all rows from the repos table. This cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 'var(--r)',
                    border: '1px solid var(--warn)',
                    background: 'var(--warn-tint)',
                    color: 'var(--warn)',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Delete all data
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <button
            type="button"
            onClick={() => setTempSettings(defaultSettings)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--r)',
              border: '1px solid var(--line)',
              background: 'transparent',
              color: 'var(--muted)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Restore Defaults
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setTempSettings(savedSettings);
                onClose();
              }}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--r)',
                border: '1px solid var(--line)',
                background: 'var(--hover)',
                color: 'var(--ink)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveSettings}
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--r)',
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
