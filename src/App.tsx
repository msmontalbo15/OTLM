import { useState, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";

const SUPABASE_URL  = "https://qsypjducygmabychfwnt.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzeXBqZHVjeWdtYWJ5Y2hmd250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTcwOTcsImV4cCI6MjA4Nzg3MzA5N30.jjHpFO-LkWYtc98to6MaYn1q8GTM6wb6WNp_cRK-jVE";
const OWNER_EMAIL   = "your@email.com";

// ── Types ──────────────────────────────────────────────────────────────────
interface Session {
  access_token: string;
  [key: string]: unknown;
}

interface License {
  id: string;
  license_key: string;
  label: string;
  domain: string | null;
  expires_at: string | null;
  notes: string | null;
  is_active: boolean;
  revoked_at: string | null;
  machine_id: string | null;
  machine_hash: string | null;
  created_at: string;
}

interface ConfirmState {
  msg: string;
  onYes: () => void;
}

interface ToastState {
  msg: string;
  type: "ok" | "err";
}

type PillColor = "green" | "red" | "blue" | "gold" | "muted" | "orange" | "purple";
type SendChannel = "email" | "sms";

// ── Responsive hook ────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function buildLicenseMessage(lic: License): string {
  const expiry = lic.expires_at
    ? new Date(lic.expires_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Never";
  return [
    `Your License Key`,
    ``,
    `Key:     ${lic.license_key}`,
    `Label:   ${lic.label}`,
    lic.domain ? `Domain:  ${lic.domain}` : null,
    `Expires: ${expiry}`,
    lic.notes  ? `Notes:   ${lic.notes}`  : null,
    ``,
    `Keep this key safe. Do not share it publicly.`,
  ].filter((l) => l !== null).join("\n");
}

// ── Supabase helpers ───────────────────────────────────────────────────────
const sb = {
  async signIn(email: string, password: string) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON },
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },
  async query(table: string, params: string = "", token: string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    });
    return r.json();
  },
  async insert(table: string, data: Record<string, unknown>, token: string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    return r.json();
  },
  async patch(table: string, id: string, data: Record<string, unknown>, token: string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    return r.json();
  },
  async delete(table: string, id: string, token: string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    return r.ok;
  },
};

function generateKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `MSM-${seg(4)}-${seg(4)}-${seg(4)}-${seg(4)}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────
const Pill = ({ children, color }: { children: React.ReactNode; color: PillColor }) => {
  const colors: Record<PillColor, CSSProperties> = {
    green:  { background: "rgba(34,197,94,.15)",  color: "#4ade80", border: "1px solid rgba(34,197,94,.3)" },
    red:    { background: "rgba(239,68,68,.15)",   color: "#f87171", border: "1px solid rgba(239,68,68,.3)" },
    blue:   { background: "rgba(14,165,233,.15)",  color: "#38bdf8", border: "1px solid rgba(14,165,233,.3)" },
    gold:   { background: "rgba(245,158,11,.15)",  color: "#fbbf24", border: "1px solid rgba(245,158,11,.3)" },
    orange: { background: "rgba(249,115,22,.15)",  color: "#fb923c", border: "1px solid rgba(249,115,22,.3)" },
    purple: { background: "rgba(168,85,247,.15)",  color: "#c084fc", border: "1px solid rgba(168,85,247,.3)" },
    muted:  { background: "rgba(255,255,255,.05)", color: "#64748b", border: "1px solid rgba(255,255,255,.08)" },
  };
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: "2px",
      fontFamily: "'DM Mono',monospace", fontSize: "10px", letterSpacing: "1px",
      textTransform: "uppercase", ...(colors[color] ?? colors.muted),
    }}>{children}</span>
  );
};

const Toast = ({ msg, type, onClose }: { msg: string; type: "ok" | "err"; onClose: () => void }) => (
  <div style={{
    position: "fixed", bottom: 24, right: 24, zIndex: 999,
    background: type === "ok" ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
    border: `1px solid ${type === "ok" ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}`,
    color: type === "ok" ? "#4ade80" : "#f87171",
    padding: "14px 20px", borderRadius: "3px", fontFamily: "'DM Mono',monospace", fontSize: "13px",
    display: "flex", alignItems: "center", gap: 12, boxShadow: "0 20px 40px rgba(0,0,0,.5)",
    animation: "toastIn .3s ease", maxWidth: "calc(100vw - 48px)",
  }}>
    {type === "ok" ? "✓" : "✗"} {msg}
    <button onClick={onClose} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", marginLeft: 8, fontSize: 16 }}>×</button>
  </div>
);

const Confirm = ({ msg, onYes, onNo }: { msg: string; onYes: () => void; onNo: () => void }) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16,
  }}>
    <div style={{
      background: "#0d1117", border: "1px solid rgba(255,255,255,.1)", borderRadius: 4,
      padding: "32px", maxWidth: 380, width: "100%", boxShadow: "0 40px 80px rgba(0,0,0,.8)",
    }}>
      <div style={{ fontSize: 14, color: "#e2e8f0", marginBottom: 24, lineHeight: 1.6, whiteSpace: "pre-line" }}>{msg}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onNo} style={{ flex: 1, padding: "10px", borderRadius: 3, border: "1px solid rgba(255,255,255,.1)", background: "none", color: "#64748b", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>Cancel</button>
        <button onClick={onYes} style={{ flex: 1, padding: "10px", borderRadius: 3, border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.15)", color: "#f87171", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>Confirm</button>
      </div>
    </div>
  </div>
);

// ── Send Modal ─────────────────────────────────────────────────────────────
const SendModal = ({
  lic, onClose, showToast,
}: {
  lic: License;
  onClose: () => void;
  showToast: (msg: string, type?: "ok" | "err") => void;
}) => {
  const [channel, setChannel]     = useState<SendChannel>("email");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject]     = useState(`Your License Key — ${lic.label}`);
  const [msgBody, setMsgBody]     = useState(() => buildLicenseMessage(lic));
  const [bodyCopied, setBodyCopied] = useState(false);

  const mono: CSSProperties = { fontFamily: "'DM Mono',monospace" };
  const inputStyle: CSSProperties = {
    width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
    borderRadius: "3px", padding: "11px 14px", color: "#e2e8f0", fontSize: "13px",
    fontFamily: "'DM Mono',monospace", outline: "none", marginBottom: "14px",
  };

  const handleSend = () => {
    if (!recipient.trim()) {
      showToast(channel === "email" ? "Email address is required" : "Phone number is required", "err");
      return;
    }
    if (channel === "email") {
      window.open(
        `mailto:${encodeURIComponent(recipient.trim())}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(msgBody)}`,
        "_self",
      );
      showToast("Opening email client…");
    } else {
      // Works on iOS (sms:number&body=) and Android (sms:number?body=)
      window.open(
        `sms:${encodeURIComponent(recipient.trim())}` +
        `?&body=${encodeURIComponent(msgBody)}`,
        "_self",
      );
      showToast("Opening SMS app…");
    }
    onClose();
  };

  const copyBody = () => {
    navigator.clipboard.writeText(msgBody);
    setBodyCopied(true);
    showToast("Message copied to clipboard");
    setTimeout(() => setBodyCopied(false), 2000);
  };

  const isEmail = channel === "email";
  const accentGrad = isEmail
    ? "linear-gradient(135deg,#a855f7,#6366f1)"
    : "linear-gradient(135deg,#0ea5e9,#06b6d4)";

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 110, padding: 16, overflowY: "auto",
      }}
    >
      <div style={{
        background: "#0d1117", border: "1px solid rgba(255,255,255,.08)", borderRadius: 4,
        width: "100%", maxWidth: 520, boxShadow: "0 40px 80px rgba(0,0,0,.8)", overflow: "hidden",
      }}>
        {/* Accent bar */}
        <div style={{ height: 3, background: accentGrad, transition: "background .3s" }} />

        <div style={{ padding: "28px 28px 26px" }}>

          {/* Title row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
                Send <span style={{ color: isEmail ? "#c084fc" : "#38bdf8", transition: "color .3s" }}>License Key</span>
              </div>
              <div style={{ fontSize: 11, color: "#475569", ...mono, marginTop: 3 }}>{lic.label}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 22, lineHeight: 1, paddingTop: 2 }}>×</button>
          </div>

          {/* Channel toggle */}
          <div style={{ display: "flex", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 4, padding: 4, marginBottom: 22, gap: 4 }}>
            {(["email", "sms"] as SendChannel[]).map(ch => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                style={{
                  flex: 1, padding: "10px 0", border: "none", borderRadius: 3, cursor: "pointer",
                  fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 1.5,
                  textTransform: "uppercase", transition: "all .2s",
                  background: channel === ch
                    ? (ch === "email" ? "linear-gradient(135deg,#a855f7,#6366f1)" : "linear-gradient(135deg,#0ea5e9,#06b6d4)")
                    : "none",
                  color: channel === ch ? "#fff" : "#475569",
                }}
              >
                {ch === "email" ? "📧  Email" : "💬  SMS / Text"}
              </button>
            ))}
          </div>

          {/* Recipient */}
          <div style={{ fontSize: 10, ...mono, letterSpacing: 2, textTransform: "uppercase", color: "#475569", marginBottom: 6 }}>
            {isEmail ? "Recipient Email *" : "Recipient Phone Number *"}
          </div>
          <input
            style={inputStyle}
            type={isEmail ? "email" : "tel"}
            placeholder={isEmail ? "client@example.com" : "+1 555 000 0000"}
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            autoFocus
          />

          {/* Subject — email only */}
          {isEmail && (
            <>
              <div style={{ fontSize: 10, ...mono, letterSpacing: 2, textTransform: "uppercase", color: "#475569", marginBottom: 6 }}>Subject</div>
              <input style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)} />
            </>
          )}

          {/* Message body */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: 10, ...mono, letterSpacing: 2, textTransform: "uppercase", color: "#475569" }}>Message</div>
            <button onClick={copyBody} style={{ background: "none", border: "none", cursor: "pointer", ...mono, fontSize: 11, color: bodyCopied ? "#4ade80" : "#475569", padding: 0, transition: "color .2s" }}>
              {bodyCopied ? "✓ Copied" : "⧉ Copy"}
            </button>
          </div>
          <textarea
            rows={isEmail ? 9 : 6}
            value={msgBody}
            onChange={e => setMsgBody(e.target.value)}
            style={{
              ...inputStyle, marginBottom: 18, resize: "vertical",
              lineHeight: 1.75, fontSize: "12px", color: "#94a3b8",
            }}
          />

          {/* Info note */}
          <div style={{
            background: isEmail ? "rgba(168,85,247,.08)" : "rgba(14,165,233,.08)",
            border: `1px solid ${isEmail ? "rgba(168,85,247,.2)" : "rgba(14,165,233,.2)"}`,
            borderRadius: 3, padding: "10px 14px", fontSize: 11,
            color: isEmail ? "#c084fc" : "#38bdf8",
            ...mono, lineHeight: 1.6, marginBottom: 20, transition: "all .3s",
          }}>
            {isEmail
              ? "ℹ Your default email client will open with this message pre-filled."
              : "ℹ Your default SMS app will open with this message pre-filled. Standard carrier rates may apply."}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={onClose} style={{
              flex: "0 0 auto", padding: "12px 20px", borderRadius: 3,
              border: "1px solid rgba(255,255,255,.08)", background: "none",
              color: "#64748b", cursor: "pointer", ...mono, fontSize: 11,
            }}>Cancel</button>
            <button onClick={handleSend} style={{
              flex: 1, padding: "13px", borderRadius: 3, border: "none", cursor: "pointer",
              fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13,
              letterSpacing: 1.5, textTransform: "uppercase",
              background: accentGrad, color: "#fff", transition: "opacity .2s",
            }}>
              {isEmail ? "📧  Open Email Client" : "💬  Open SMS App"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Mobile License Card ────────────────────────────────────────────────────
const LicenseCard = ({
  lic, copied, onCopy, onToggle, onDelete, onUnlock, onLock, onSend,
}: {
  lic: License;
  copied: string | null;
  onCopy:   (k: string) => void;
  onToggle: (l: License) => void;
  onDelete: (l: License) => void;
  onUnlock: (l: License) => void;
  onLock:   (l: License) => void;
  onSend:   (l: License) => void;
}) => {
  const isMachineLocked = !!(lic.machine_id || lic.machine_hash);
  const actionBtn = (label: string, bg: string, border: string, color: string, onClick: () => void) => (
    <button onClick={onClick} style={{ padding: "6px 11px", borderRadius: 3, cursor: "pointer", fontSize: "10px", fontFamily: "'DM Mono',monospace", letterSpacing: "1px", textTransform: "uppercase", background: bg, border, color }}>
      {label}
    </button>
  );

  return (
    <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,.07)", borderRadius: 4, padding: "16px", marginBottom: 10, opacity: lic.revoked_at ? 0.5 : 1 }}>
      {/* Key row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <code style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "#38bdf8", letterSpacing: "1px", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lic.license_key}
        </code>
        <button onClick={() => onCopy(lic.license_key)} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, color: copied === lic.license_key ? "#4ade80" : "#334155", fontSize: "14px", padding: "2px 4px" }}>
          {copied === lic.license_key ? "✓" : "⧉"}
        </button>
      </div>

      {/* Label + badges */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: "13px", color: "#e2e8f0", fontWeight: 600 }}>{lic.label}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
          {isMachineLocked && <Pill color="orange">🔒 Locked</Pill>}
          {lic.revoked_at ? <Pill color="red">Revoked</Pill> : lic.is_active ? <Pill color="green">Active</Pill> : <Pill color="muted">Inactive</Pill>}
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
        {lic.domain && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#475569" }}>🌐 {lic.domain}</span>}
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#475569" }}>
          {lic.expires_at ? (new Date(lic.expires_at) < new Date() ? "⚠ Expired" : `⏱ ${new Date(lic.expires_at).toLocaleDateString()}`) : "⏱ Never"}
        </span>
        {lic.machine_id && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#475569" }}>💻 {lic.machine_id.slice(0, 12)}…</span>}
      </div>
      {lic.notes && <div style={{ fontSize: "11px", color: "#334155", fontStyle: "italic", marginBottom: 10 }}>{lic.notes}</div>}

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {actionBtn("📨 Send",   "rgba(168,85,247,.1)", "1px solid rgba(168,85,247,.25)", "#c084fc", () => onSend(lic))}
        {isMachineLocked
          ? actionBtn("🔓 Unlock", "rgba(245,158,11,.1)", "1px solid rgba(245,158,11,.25)", "#fbbf24", () => onUnlock(lic))
          : actionBtn("🔒 Lock",   "rgba(14,165,233,.1)", "1px solid rgba(14,165,233,.25)", "#38bdf8", () => onLock(lic))}
        {actionBtn(
          lic.revoked_at ? "Restore" : "Revoke",
          lic.revoked_at ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)",
          lic.revoked_at ? "1px solid rgba(34,197,94,.25)" : "1px solid rgba(239,68,68,.25)",
          lic.revoked_at ? "#4ade80" : "#f87171",
          () => onToggle(lic),
        )}
        {actionBtn("🗑", "rgba(239,68,68,.08)", "1px solid rgba(239,68,68,.15)", "#7f1d1d", () => onDelete(lic))}
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
export default function LicenseManager() {
  const isMobile = useIsMobile();

  const [session, setSession]     = useState<Session | null>(null);
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [authErr, setAuthErr]     = useState("");
  const [loading, setLoading]     = useState(false);

  const [licenses, setLicenses]   = useState<License[]>([]);
  const [fetching, setFetching]   = useState(false);

  const [showNew, setShowNew]     = useState(false);
  const [newKey, setNewKey]       = useState(generateKey());
  const [newLabel, setNewLabel]   = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [newNotes, setNewNotes]   = useState("");
  const [creating, setCreating]   = useState(false);

  const [lockMachineId, setLockMachineId]     = useState("");
  const [lockMachineHash, setLockMachineHash] = useState("");
  const [showLockModal, setShowLockModal]     = useState(false);
  const [lockTarget, setLockTarget]           = useState<License | null>(null);
  const [locking, setLocking]                 = useState(false);

  const [sendTarget, setSendTarget] = useState<License | null>(null);

  const [toast, setToast]     = useState<ToastState | null>(null);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");
  const [copied, setCopied]   = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };
  const askConfirm = (msg: string, onYes: () => void) => setConfirm({ msg, onYes });

  const loadLicenses = useCallback(async (tok: string) => {
    setFetching(true);
    try {
      const data = await sb.query("licenses", "?select=*&order=created_at.desc", tok);
      setLicenses(Array.isArray(data) ? data : []);
    } catch {
      showToast("Failed to load licenses", "err");
    }
    setFetching(false);
  }, []);

  useEffect(() => { if (session) loadLicenses(session.access_token); }, [session, loadLicenses]);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = `
      @keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      * { box-sizing: border-box; }
      textarea { font-family: 'DM Mono', monospace !important; }
      input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
    `;
    document.head.appendChild(style);
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setAuthErr("");
    const res = await sb.signIn(email, password);
    if (res.access_token) setSession(res as Session);
    else setAuthErr(res.error_description || res.msg || "Login failed");
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newLabel.trim()) { showToast("Label is required", "err"); return; }
    if (!newDomain.trim()) { showToast("Domain is required", "err"); return; }
    if (!session) return;
    setCreating(true);
    const res = await sb.insert("licenses", {
      license_key: newKey,
      label:       newLabel.trim(),
      domain:      newDomain.trim().toLowerCase().replace(/^www\./, "").replace(/:\d+$/, ""),
      expires_at:  newExpiry || null,
      notes:       newNotes.trim() || null,
      is_active:   true,
    }, session.access_token);
    if (Array.isArray(res) && res[0]?.id) {
      showToast("License created successfully!");
      setNewKey(generateKey()); setNewLabel(""); setNewDomain(""); setNewExpiry(""); setNewNotes("");
      setShowNew(false);
      loadLicenses(session.access_token);
    } else {
      showToast(res?.message || res?.msg || "Failed to create license", "err");
    }
    setCreating(false);
  };

  const toggleActive = async (lic: License) => {
    const action = lic.revoked_at ? "restore" : "revoke";
    askConfirm(`${action.charAt(0).toUpperCase() + action.slice(1)} license "${lic.label}"?`, async () => {
      setConfirm(null);
      if (!session) return;
      const patch = lic.revoked_at
        ? { is_active: true,  revoked_at: null }
        : { is_active: false, revoked_at: new Date().toISOString() };
      const res = await sb.patch("licenses", lic.id, patch, session.access_token);
      if (Array.isArray(res)) { showToast(`License ${action}d.`); loadLicenses(session.access_token); }
      else showToast("Action failed", "err");
    });
  };

  const handleDelete = async (lic: License) => {
    askConfirm(`Permanently delete license "${lic.label}"?\n\nThis cannot be undone.`, async () => {
      setConfirm(null);
      if (!session) return;
      const ok = await sb.delete("licenses", lic.id, session.access_token);
      if (ok) { showToast("License deleted."); loadLicenses(session.access_token); }
      else showToast("Delete failed", "err");
    });
  };

  const handleUnlock = async (lic: License) => {
    askConfirm(`Remove machine lock from "${lic.label}"?\n\nNext activation will re-bind it.`, async () => {
      setConfirm(null);
      if (!session) return;
      const res = await sb.patch("licenses", lic.id, { machine_id: null, machine_hash: null }, session.access_token);
      if (Array.isArray(res)) { showToast("Machine lock removed."); loadLicenses(session.access_token); }
      else showToast("Failed to remove machine lock", "err");
    });
  };

  const openLockModal = (lic: License) => {
    setLockTarget(lic); setLockMachineId(""); setLockMachineHash(""); setShowLockModal(true);
  };

  const handleLock = async () => {
    if (!lockTarget || !session) return;
    if (!lockMachineId.trim() && !lockMachineHash.trim()) { showToast("Provide at least a Machine ID or Machine Hash", "err"); return; }
    setLocking(true);
    const res = await sb.patch("licenses", lockTarget.id, {
      machine_id:   lockMachineId.trim()   || null,
      machine_hash: lockMachineHash.trim() || null,
    }, session.access_token);
    if (Array.isArray(res)) {
      showToast("Machine lock applied."); setShowLockModal(false); loadLicenses(session.access_token);
    } else {
      showToast("Failed to apply machine lock", "err");
    }
    setLocking(false);
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = licenses.filter(l => {
    const matchSearch = !search ||
      l.license_key.toLowerCase().includes(search.toLowerCase()) ||
      l.label.toLowerCase().includes(search.toLowerCase()) ||
      (l.domain ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all"     ? true :
      filter === "active"  ? l.is_active && !l.revoked_at :
      filter === "revoked" ? !!l.revoked_at :
      filter === "locked"  ? !!(l.machine_id || l.machine_hash) : true;
    return matchSearch && matchFilter;
  });

  const S = {
    page:      { minHeight: "100vh", background: "#080c10", fontFamily: "'Syne',sans-serif", color: "#e2e8f0" } as CSSProperties,
    loginWrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#080c10 0%,#0d1117 100%)", padding: 16 } as CSSProperties,
    loginCard: { background: "#0d1117", border: "1px solid rgba(255,255,255,.07)", borderRadius: "3px", padding: isMobile ? "28px 20px" : "44px 40px", width: "100%", maxWidth: "400px", boxShadow: "0 40px 80px rgba(0,0,0,.7)" } as CSSProperties,
    label:     { display: "block", fontFamily: "'DM Mono',monospace", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase" as const, color: "#475569", marginBottom: "8px" } as CSSProperties,
    input:     { width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: "3px", padding: "12px 14px", color: "#fff", fontSize: "14px", fontFamily: "'DM Mono',monospace", outline: "none", marginBottom: "14px" } as CSSProperties,
    btn: (c = "blue"): CSSProperties => ({
      width: "100%", padding: "13px", borderRadius: "3px", cursor: "pointer",
      fontFamily: "'Syne',sans-serif", fontSize: "13px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase",
      background: c === "blue"  ? "linear-gradient(135deg,#0ea5e9,#6366f1)" :
                  c === "green" ? "linear-gradient(135deg,#22c55e,#10b981)" :
                  c === "red"   ? "rgba(239,68,68,.15)" : "rgba(255,255,255,.07)",
      color:  c==="red" ? "#f87171" : "#fff",
      border: c==="red" ? "1px solid rgba(239,68,68,.25)" : "none",
    }),
    header: { background: "rgba(13,17,23,.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,.06)", padding: isMobile ? "0 16px" : "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "60px", position: "sticky" as const, top: 0, zIndex: 10 } as CSSProperties,
    main:   { maxWidth: "1100px", margin: "0 auto", padding: isMobile ? "16px 12px" : "32px 24px" } as CSSProperties,
    card:   { background: "#0d1117", border: "1px solid rgba(255,255,255,.07)", borderRadius: "3px", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,.3)" } as CSSProperties,
    th:     { fontFamily: "'DM Mono',monospace", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase" as const, color: "#475569", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,.06)" } as CSSProperties,
    mono:   { fontFamily: "'DM Mono',monospace", fontSize: "12px", color: "#38bdf8", letterSpacing: "1px" } as CSSProperties,
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!session) return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        <div style={{ height: "3px", background: "linear-gradient(90deg,#0ea5e9,#6366f1)", marginBottom: "36px" }} />
        <div style={{ marginBottom: "28px" }}>
          <div style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: "800", color: "#fff", marginBottom: "6px" }}>
            License <span style={{ color: "#0ea5e9" }}>Manager</span>
          </div>
          <div style={{ fontSize: "12px", color: "#475569", fontFamily: "'DM Mono',monospace" }}>Mark Spencer Montalbo — Supabase Auth</div>
        </div>
        {authErr && (
          <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", borderRadius: "3px", padding: "10px 14px", fontSize: "12px", color: "#f87171", marginBottom: "16px" }}>⚠ {authErr}</div>
        )}
        <form onSubmit={handleSignIn}>
          <label style={S.label}>Email</label>
          <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={OWNER_EMAIL} required />
          <label style={S.label}>Password</label>
          <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          <button style={S.btn("blue")} type="submit" disabled={loading}>{loading ? "Authenticating..." : "🔐  Sign In"}</button>
        </form>
      </div>
    </div>
  );

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const stats = {
    total:   licenses.length,
    active:  licenses.filter(l => l.is_active && !l.revoked_at).length,
    revoked: licenses.filter(l => !!l.revoked_at).length,
    locked:  licenses.filter(l => !!(l.machine_id || l.machine_hash)).length,
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "18px" }}>🔐</span>
          {isMobile
            ? <div style={{ fontSize: "15px", fontWeight: "700", color: "#fff" }}>Licenses</div>
            : <div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#fff" }}>License Manager</div>
                <div style={{ fontSize: "10px", fontFamily: "'DM Mono',monospace", color: "#475569", letterSpacing: "1px" }}>MARK SPENCER MONTALBO</div>
              </div>
          }
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowNew(true)} style={{ ...S.btn("blue"), width: "auto", padding: isMobile ? "8px 12px" : "8px 18px", fontSize: "12px" }}>
            {isMobile ? "+" : "+ New Key"}
          </button>
          <button onClick={() => setSession(null)} style={{ background: "none", border: "1px solid rgba(255,255,255,.1)", borderRadius: "3px", color: "#64748b", padding: isMobile ? "8px 10px" : "8px 14px", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: "11px" }}>
            {isMobile ? "↩" : "Sign Out"}
          </button>
        </div>
      </div>

      <div style={S.main}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 8 : 16, marginBottom: isMobile ? 16 : 28 }}>
          {[
            { label: "Total",   value: stats.total,   color: "#38bdf8", filter: "all"     },
            { label: "Active",  value: stats.active,  color: "#4ade80", filter: "active"  },
            { label: "Revoked", value: stats.revoked, color: "#f87171", filter: "revoked" },
            { label: "Locked",  value: stats.locked,  color: "#fbbf24", filter: "locked"  },
          ].map(s => (
            <div key={s.label} onClick={() => setFilter(s.filter)} style={{ ...S.card, padding: isMobile ? "14px 16px" : "20px 24px", cursor: "pointer", border: filter === s.filter ? `1px solid ${s.color}44` : "1px solid rgba(255,255,255,.07)", transition: "border .2s" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", letterSpacing: "2px", textTransform: "uppercase", color: "#475569", marginBottom: "6px" }}>{s.label}</div>
              <div style={{ fontSize: isMobile ? "24px" : "32px", fontWeight: "800", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            style={{ ...S.input, flex: 1, minWidth: isMobile ? "100%" : "200px", marginBottom: 0, fontSize: "12px", padding: "10px 14px" }}
            placeholder={isMobile ? "Search…" : "Search by key, label or domain..."}
            value={search} onChange={e => setSearch(e.target.value)}
          />
          {!isMobile && (
            <div style={{ display: "flex", gap: 8 }}>
              {["all", "active", "revoked", "locked"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: "10px 14px", borderRadius: "3px", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", background: filter === f ? "rgba(14,165,233,.2)" : "rgba(255,255,255,.04)", border: filter === f ? "1px solid rgba(14,165,233,.4)" : "1px solid rgba(255,255,255,.08)", color: filter === f ? "#38bdf8" : "#475569" }}>{f}</button>
              ))}
            </div>
          )}
          <button onClick={() => loadLicenses(session.access_token)} style={{ padding: "10px 14px", borderRadius: "3px", cursor: "pointer", fontSize: "14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "#94a3b8" }}>↻</button>
        </div>

        {/* Mobile filter tabs */}
        {isMobile && (
          <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
            {["all", "active", "revoked", "locked"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 12px", borderRadius: "3px", cursor: "pointer", flexShrink: 0, fontFamily: "'DM Mono',monospace", fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase", background: filter === f ? "rgba(14,165,233,.2)" : "rgba(255,255,255,.04)", border: filter === f ? "1px solid rgba(14,165,233,.4)" : "1px solid rgba(255,255,255,.08)", color: filter === f ? "#38bdf8" : "#475569" }}>{f}</button>
            ))}
          </div>
        )}

        {/* Mobile cards */}
        {isMobile ? (
          <div>
            {fetching && <div style={{ padding: "32px", textAlign: "center", color: "#475569", fontFamily: "'DM Mono',monospace", fontSize: "12px" }}>Loading...</div>}
            {!fetching && filtered.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "#334155", fontFamily: "'DM Mono',monospace", fontSize: "13px" }}>{licenses.length === 0 ? "No licenses yet." : "No results match."}</div>}
            {!fetching && filtered.map(lic => (
              <LicenseCard key={lic.id} lic={lic} copied={copied}
                onCopy={copyKey} onToggle={toggleActive} onDelete={handleDelete}
                onUnlock={handleUnlock} onLock={openLockModal} onSend={setSendTarget}
              />
            ))}
          </div>
        ) : (
          // Desktop table
          <div style={S.card}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", ...S.th }}>
              <span>Key / Label</span><span>Domain</span><span>Expires</span><span>Machine</span><span>Status</span><span>Actions</span>
            </div>
            {fetching && <div style={{ padding: "32px", textAlign: "center", color: "#475569", fontFamily: "'DM Mono',monospace", fontSize: "12px" }}>Loading...</div>}
            {!fetching && filtered.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "#334155", fontFamily: "'DM Mono',monospace", fontSize: "13px" }}>{licenses.length === 0 ? "No licenses found. Create your first one." : "No results match your search."}</div>}
            {!fetching && filtered.map(lic => {
              const isMachineLocked = !!(lic.machine_id || lic.machine_hash);
              return (
                <div key={lic.id}
                  style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", display: "grid", alignItems: "center", opacity: lic.revoked_at ? 0.5 : 1, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.05)", transition: "background .15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,.02)"}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ""}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <code style={{ ...S.mono, fontSize: "13px" }}>{lic.license_key}</code>
                      <button onClick={() => copyKey(lic.license_key)} style={{ background: "none", border: "none", cursor: "pointer", color: copied === lic.license_key ? "#4ade80" : "#334155", fontSize: "12px", padding: "2px 4px", transition: "color .2s" }}>{copied === lic.license_key ? "✓" : "⧉"}</button>
                    </div>
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>{lic.label}</div>
                    {lic.notes && <div style={{ fontSize: "10px", color: "#334155", fontStyle: "italic", marginTop: 2 }}>{lic.notes}</div>}
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "#64748b" }}>{lic.domain ?? <span style={{ color: "#334155" }}>—</span>}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "#64748b" }}>
                    {lic.expires_at ? (new Date(lic.expires_at) < new Date() ? <span style={{ color: "#f87171" }}>Expired</span> : new Date(lic.expires_at).toLocaleDateString()) : <span style={{ color: "#334155" }}>Never</span>}
                  </div>
                  <div>
                    {isMachineLocked ? <Pill color="orange">🔒 Locked</Pill> : <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#334155" }}>—</span>}
                    {isMachineLocked && lic.machine_id && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "#334155", marginTop: 3 }}>{lic.machine_id.slice(0, 14)}…</div>}
                  </div>
                  <div>
                    {lic.revoked_at ? <Pill color="red">Revoked</Pill> : lic.is_active ? <Pill color="green">Active</Pill> : <Pill color="muted">Inactive</Pill>}
                  </div>
                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {/* Send */}
                    <button onClick={() => setSendTarget(lic)} title="Send via Email or SMS" style={{ padding: "5px 8px", borderRadius: "2px", cursor: "pointer", background: "rgba(168,85,247,.1)", border: "1px solid rgba(168,85,247,.25)", color: "#c084fc", fontSize: "13px", lineHeight: 1 }}>📨</button>
                    {/* Lock / Unlock */}
                    {isMachineLocked
                      ? <button onClick={() => handleUnlock(lic)} title="Remove machine lock" style={{ padding: "5px 9px", borderRadius: "2px", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase", background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.25)", color: "#fbbf24" }}>🔓</button>
                      : <button onClick={() => openLockModal(lic)} title="Apply machine lock" style={{ padding: "5px 9px", borderRadius: "2px", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase", background: "rgba(14,165,233,.1)", border: "1px solid rgba(14,165,233,.25)", color: "#38bdf8" }}>🔒</button>
                    }
                    {/* Revoke / Restore */}
                    <button onClick={() => toggleActive(lic)} title={lic.revoked_at ? "Restore" : "Revoke"} style={{ padding: "5px 10px", borderRadius: "2px", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase", background: lic.revoked_at ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", border: lic.revoked_at ? "1px solid rgba(34,197,94,.25)" : "1px solid rgba(239,68,68,.25)", color: lic.revoked_at ? "#4ade80" : "#f87171" }}>{lic.revoked_at ? "Restore" : "Revoke"}</button>
                    {/* Delete */}
                    <button onClick={() => handleDelete(lic)} title="Delete permanently"
                      style={{ padding: "5px 8px", borderRadius: "2px", cursor: "pointer", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.15)", color: "#7f1d1d", fontSize: "13px", lineHeight: 1, transition: "all .15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,.2)"; (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#7f1d1d"; }}
                    >🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New License Modal */}
        {showNew && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16, overflowY: "auto" }}
            onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}>
            <div style={{ ...S.card, width: "100%", maxWidth: "480px", padding: isMobile ? "24px 20px" : "36px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#fff", marginBottom: "4px" }}>Generate <span style={{ color: "#0ea5e9" }}>License Key</span></div>
              <div style={{ fontSize: "12px", color: "#475569", fontFamily: "'DM Mono',monospace", marginBottom: "28px" }}>New key for your application</div>
              <label style={S.label}>Generated Key</label>
              <div style={{ display: "flex", gap: 8, marginBottom: "20px" }}>
                <code style={{ flex: 1, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: "3px", padding: "12px 14px", fontFamily: "'DM Mono',monospace", fontSize: isMobile ? "10px" : "13px", color: "#38bdf8", letterSpacing: "1.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{newKey}</code>
                <button onClick={() => setNewKey(generateKey())} style={{ padding: "12px 14px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: "3px", color: "#94a3b8", cursor: "pointer", fontSize: "16px", flexShrink: 0 }}>↻</button>
                <button onClick={() => copyKey(newKey)} style={{ padding: "12px 14px", background: "rgba(14,165,233,.1)", border: "1px solid rgba(14,165,233,.25)", borderRadius: "3px", color: "#38bdf8", cursor: "pointer", fontSize: "14px", flexShrink: 0 }}>{copied === newKey ? "✓" : "⧉"}</button>
              </div>
              <label style={S.label}>Label *</label>
              <input style={S.input} value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Mark Local Desktop" />
              <label style={S.label}>Domain * <span style={{ color: "#334155", fontWeight: 400 }}>(bare domain, no https)</span></label>
              <input style={S.input} value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="e.g. localhost or example.com" />
              <label style={S.label}>Expiry Date (optional)</label>
              <input style={S.input} type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} />
              <label style={S.label}>Notes (optional)</label>
              <input style={S.input} value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Internal notes..." />
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <button onClick={() => setShowNew(false)} style={{ ...S.btn("muted"), flex: "0 0 auto", width: "auto", padding: "12px 20px" }}>Cancel</button>
                <button onClick={handleCreate} disabled={creating} style={{ ...S.btn("green"), flex: 1 }}>{creating ? "Creating..." : "✓  Create License"}</button>
              </div>
            </div>
          </div>
        )}

        {/* Machine Lock Modal */}
        {showLockModal && lockTarget && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
            onClick={e => { if (e.target === e.currentTarget) setShowLockModal(false); }}>
            <div style={{ ...S.card, width: "100%", maxWidth: "440px", padding: isMobile ? "24px 20px" : "32px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#fff", marginBottom: "4px" }}>🔒 Machine <span style={{ color: "#fbbf24" }}>Lock</span></div>
              <div style={{ fontSize: "12px", color: "#475569", fontFamily: "'DM Mono',monospace", marginBottom: "20px" }}>Binding: <span style={{ color: "#e2e8f0" }}>{lockTarget.label}</span></div>
              <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 3, padding: "10px 14px", fontSize: "11px", color: "#fbbf24", fontFamily: "'DM Mono',monospace", marginBottom: "20px", lineHeight: 1.6 }}>
                ⚠ Provide the Machine ID and/or Hash from the target machine. Once locked, the license will only activate on this machine.
              </div>
              <label style={S.label}>Machine ID</label>
              <input style={S.input} value={lockMachineId} onChange={e => setLockMachineId(e.target.value)} placeholder="e.g. WIN-ABCD1234 or hardware UUID" />
              <label style={S.label}>Machine Hash (optional)</label>
              <input style={S.input} value={lockMachineHash} onChange={e => setLockMachineHash(e.target.value)} placeholder="e.g. sha256 fingerprint" />
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <button onClick={() => setShowLockModal(false)} style={{ ...S.btn("muted"), flex: "0 0 auto", width: "auto", padding: "12px 20px" }}>Cancel</button>
                <button onClick={handleLock} disabled={locking} style={{ ...S.btn("blue"), flex: 1 }}>{locking ? "Locking..." : "🔒 Apply Lock"}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Send Modal */}
      {sendTarget && <SendModal lic={sendTarget} onClose={() => setSendTarget(null)} showToast={showToast} />}

      {confirm && <Confirm msg={confirm.msg} onYes={confirm.onYes} onNo={() => setConfirm(null)} />}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}