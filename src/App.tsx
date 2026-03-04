import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL  = "https://qsypjducygmabychfwnt.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzeXBqZHVjeWdtYWJ5Y2hmd250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTcwOTcsImV4cCI6MjA4Nzg3MzA5N30.jjHpFO-LkWYtc98to6MaYn1q8GTM6wb6WNp_cRK-jVE";
const OWNER_EMAIL   = "your@email.com";

const sb = {
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON },
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },
  async query(table, params = "", token) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    });
    return r.json();
  },
  async insert(table, data, token) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    return r.json();
  },
  async patch(table, id, data, token) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    return r.json();
  },
  async delete(table, id, token) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    return r.ok;
  },
};

function generateKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `MSM-${seg(4)}-${seg(4)}-${seg(4)}-${seg(4)}`;
}

const Pill = ({ children, color }) => {
  const colors = {
    green: { background:"rgba(34,197,94,.15)",  color:"#4ade80", border:"1px solid rgba(34,197,94,.3)" },
    red:   { background:"rgba(239,68,68,.15)",   color:"#f87171", border:"1px solid rgba(239,68,68,.3)" },
    blue:  { background:"rgba(14,165,233,.15)",  color:"#38bdf8", border:"1px solid rgba(14,165,233,.3)" },
    gold:  { background:"rgba(245,158,11,.15)",  color:"#fbbf24", border:"1px solid rgba(245,158,11,.3)" },
    muted: { background:"rgba(255,255,255,.05)", color:"#64748b", border:"1px solid rgba(255,255,255,.08)" },
  };
  return (
    <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:"2px",
      fontFamily:"'DM Mono',monospace", fontSize:"10px", letterSpacing:"1px",
      textTransform:"uppercase", ...(colors[color]||colors.muted) }}>{children}</span>
  );
};

const Toast = ({ msg, type, onClose }) => (
  <div style={{ position:"fixed", bottom:24, right:24, zIndex:999,
    background: type==="ok" ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
    border:`1px solid ${type==="ok" ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}`,
    color: type==="ok" ? "#4ade80" : "#f87171",
    padding:"14px 20px", borderRadius:"3px", fontFamily:"'DM Mono',monospace", fontSize:"13px",
    display:"flex", alignItems:"center", gap:12, boxShadow:"0 20px 40px rgba(0,0,0,.5)",
    animation:"toastIn .3s ease" }}>
    {type==="ok" ? "✓" : "✗"} {msg}
    <button onClick={onClose} style={{background:"none",border:"none",color:"inherit",cursor:"pointer",marginLeft:8,fontSize:16}}>×</button>
  </div>
);

// Confirm dialog
const Confirm = ({ msg, onYes, onNo }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", backdropFilter:"blur(4px)",
    display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
    <div style={{ background:"#0d1117", border:"1px solid rgba(255,255,255,.1)", borderRadius:4,
      padding:"32px", maxWidth:380, width:"100%", boxShadow:"0 40px 80px rgba(0,0,0,.8)" }}>
      <div style={{ fontSize:14, color:"#e2e8f0", marginBottom:24, lineHeight:1.6 }}>{msg}</div>
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={onNo} style={{ flex:1, padding:"10px", borderRadius:3, border:"1px solid rgba(255,255,255,.1)",
          background:"none", color:"#64748b", cursor:"pointer", fontFamily:"'DM Mono',monospace", fontSize:11 }}>
          Cancel
        </button>
        <button onClick={onYes} style={{ flex:1, padding:"10px", borderRadius:3, border:"1px solid rgba(239,68,68,.3)",
          background:"rgba(239,68,68,.15)", color:"#f87171", cursor:"pointer", fontFamily:"'DM Mono',monospace", fontSize:11 }}>
          Confirm
        </button>
      </div>
    </div>
  </div>
);

export default function LicenseManager() {
  const [session, setSession]     = useState(null);
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [authErr, setAuthErr]     = useState("");
  const [loading, setLoading]     = useState(false);

  const [licenses, setLicenses]   = useState([]);
  const [fetching, setFetching]   = useState(false);

  const [showNew, setShowNew]     = useState(false);
  const [newKey, setNewKey]       = useState(generateKey());
  const [newLabel, setNewLabel]   = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [newNotes, setNewNotes]   = useState("");
  const [creating, setCreating]   = useState(false);

  const [toast, setToast]         = useState(null);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState("all");
  const [copied, setCopied]       = useState(null);
  const [confirm, setConfirm]     = useState(null); // { msg, onYes }

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };
  const askConfirm = (msg, onYes) => setConfirm({ msg, onYes });

  const loadLicenses = useCallback(async (tok) => {
    setFetching(true);
    try {
      const data = await sb.query("licenses", "?select=*&order=created_at.desc", tok || session?.access_token);
      setLicenses(Array.isArray(data) ? data : []);
    } catch(e) { showToast("Failed to load licenses", "err"); }
    setFetching(false);
  }, [session]);

  useEffect(() => { if (session) loadLicenses(session.access_token); }, [session, loadLicenses]);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = `@keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(style);
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault(); setLoading(true); setAuthErr("");
    const res = await sb.signIn(email, password);
    if (res.access_token) setSession(res);
    else setAuthErr(res.error_description || res.msg || "Login failed");
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newLabel.trim()) { showToast("Label is required", "err"); return; }
    if (!newDomain.trim()) { showToast("Domain is required", "err"); return; }
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

  const toggleActive = async (lic) => {
    const action = lic.revoked_at ? "restore" : "revoke";
    askConfirm(
      `${action.charAt(0).toUpperCase()+action.slice(1)} license "${lic.label}"?`,
      async () => {
        setConfirm(null);
        const patch = lic.revoked_at
          ? { is_active: true,  revoked_at: null }
          : { is_active: false, revoked_at: new Date().toISOString() };
        const res = await sb.patch("licenses", lic.id, patch, session.access_token);
        if (Array.isArray(res)) { showToast(`License ${action}d.`); loadLicenses(session.access_token); }
        else showToast("Action failed", "err");
      }
    );
  };

  const handleDelete = async (lic) => {
    askConfirm(
      `Permanently delete license "${lic.label}"?\n\nThis cannot be undone. The key will stop working immediately.`,
      async () => {
        setConfirm(null);
        const ok = await sb.delete("licenses", lic.id, session.access_token);
        if (ok) { showToast("License deleted."); loadLicenses(session.access_token); }
        else showToast("Delete failed", "err");
      }
    );
  };

  const handleUnlockMachine = async (lic) => {
    askConfirm(
      `Remove machine lock from "${lic.label}"?\n\nThe next activation on any machine will re-bind it.`,
      async () => {
        setConfirm(null);
        const res = await sb.patch("licenses", lic.id, { machine_id: null, machine_hash: null }, session.access_token);
        if (Array.isArray(res)) { showToast("Machine lock removed."); loadLicenses(session.access_token); }
        else showToast("Failed to remove machine lock", "err");
      }
    );
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = licenses.filter(l => {
    const matchSearch = !search ||
      l.license_key.toLowerCase().includes(search.toLowerCase()) ||
      l.label.toLowerCase().includes(search.toLowerCase()) ||
      (l.domain||"").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all"     ? true :
      filter === "active"  ? l.is_active && !l.revoked_at :
      filter === "revoked" ? !!l.revoked_at : true;
    return matchSearch && matchFilter;
  });

  const S = {
    page:      { minHeight:"100vh", background:"#080c10", fontFamily:"'Syne',sans-serif", color:"#e2e8f0" },
    loginWrap: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
                 background:"linear-gradient(135deg,#080c10 0%,#0d1117 100%)" },
    loginCard: { background:"#0d1117", border:"1px solid rgba(255,255,255,.07)", borderRadius:"3px",
                 padding:"44px 40px", width:"100%", maxWidth:"400px", boxShadow:"0 40px 80px rgba(0,0,0,.7)" },
    label:     { display:"block", fontFamily:"'DM Mono',monospace", fontSize:"10px", letterSpacing:"2px",
                 textTransform:"uppercase", color:"#475569", marginBottom:"8px" },
    input:     { width:"100%", background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.1)",
                 borderRadius:"3px", padding:"12px 14px", color:"#fff", fontSize:"14px",
                 fontFamily:"'DM Mono',monospace", outline:"none", marginBottom:"14px" },
    btn: (c="blue") => ({
      width:"100%", padding:"13px", borderRadius:"3px", border:"none", cursor:"pointer",
      fontFamily:"'Syne',sans-serif", fontSize:"13px", fontWeight:"700", letterSpacing:"1.5px", textTransform:"uppercase",
      background: c==="blue"  ? "linear-gradient(135deg,#0ea5e9,#6366f1)" :
                  c==="green" ? "linear-gradient(135deg,#22c55e,#10b981)" :
                  c==="red"   ? "rgba(239,68,68,.15)" : "rgba(255,255,255,.07)",
      color:  c==="red" ? "#f87171" : "#fff",
      border: c==="red" ? "1px solid rgba(239,68,68,.25)" : "none",
    }),
    header: { background:"rgba(13,17,23,.9)", backdropFilter:"blur(12px)",
              borderBottom:"1px solid rgba(255,255,255,.06)", padding:"0 32px",
              display:"flex", alignItems:"center", justifyContent:"space-between",
              height:"60px", position:"sticky", top:0, zIndex:10 },
    main: { maxWidth:"1100px", margin:"0 auto", padding:"32px 24px" },
    card: { background:"#0d1117", border:"1px solid rgba(255,255,255,.07)",
            borderRadius:"3px", overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,.3)" },
    th:   { fontFamily:"'DM Mono',monospace", fontSize:"10px", letterSpacing:"2px",
            textTransform:"uppercase", color:"#475569", padding:"12px 20px",
            borderBottom:"1px solid rgba(255,255,255,.06)" },
    mono: { fontFamily:"'DM Mono',monospace", fontSize:"12px", color:"#38bdf8", letterSpacing:"1px" },
    iconBtn: (c="muted") => ({
      padding:"5px 9px", borderRadius:"2px", cursor:"pointer", border:"none", background:"none",
      fontFamily:"'DM Mono',monospace", fontSize:"11px", transition:"all .15s",
      color: c==="red" ? "#f87171" : c==="green" ? "#4ade80" : c==="gold" ? "#fbbf24" : "#475569",
    }),
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!session) return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        <div style={{ height:"3px", background:"linear-gradient(90deg,#0ea5e9,#6366f1)", marginBottom:"36px" }} />
        <div style={{ marginBottom:"28px" }}>
          <div style={{ fontSize:"24px", fontWeight:"800", color:"#fff", marginBottom:"6px" }}>
            License <span style={{ color:"#0ea5e9" }}>Manager</span>
          </div>
          <div style={{ fontSize:"12px", color:"#475569", fontFamily:"'DM Mono',monospace" }}>
            Mark Spencer Montalbo — Supabase Auth
          </div>
        </div>
        {authErr && (
          <div style={{ background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)",
            borderRadius:"3px", padding:"10px 14px", fontSize:"12px", color:"#f87171", marginBottom:"16px" }}>
            ⚠ {authErr}
          </div>
        )}
        <form onSubmit={handleSignIn}>
          <label style={S.label}>Email</label>
          <input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={OWNER_EMAIL} required />
          <label style={S.label}>Password</label>
          <input style={S.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />
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
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:"18px" }}>🔐</span>
          <div>
            <div style={{ fontSize:"15px", fontWeight:"700", color:"#fff" }}>License Manager</div>
            <div style={{ fontSize:"10px", fontFamily:"'DM Mono',monospace", color:"#475569", letterSpacing:"1px" }}>MARK SPENCER MONTALBO</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => setShowNew(true)} style={{ ...S.btn("blue"), width:"auto", padding:"8px 18px", fontSize:"12px" }}>+ New Key</button>
          <button onClick={() => setSession(null)} style={{ background:"none", border:"1px solid rgba(255,255,255,.1)", borderRadius:"3px", color:"#64748b", padding:"8px 14px", cursor:"pointer", fontFamily:"'DM Mono',monospace", fontSize:"11px" }}>Sign Out</button>
        </div>
      </div>

      <div style={S.main}>
        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:28 }}>
          {[
            { label:"Total Keys", value:stats.total,   color:"#38bdf8" },
            { label:"Active",     value:stats.active,  color:"#4ade80" },
            { label:"Revoked",    value:stats.revoked, color:"#f87171" },
          ].map(s => (
            <div key={s.label} style={{ ...S.card, padding:"20px 24px" }}>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"10px", letterSpacing:"2px", textTransform:"uppercase", color:"#475569", marginBottom:"8px" }}>{s.label}</div>
              <div style={{ fontSize:"32px", fontWeight:"800", color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
          <input
            style={{ ...S.input, flex:1, minWidth:"200px", marginBottom:0, fontSize:"12px", padding:"10px 14px" }}
            placeholder="Search by key, label or domain..."
            value={search} onChange={e=>setSearch(e.target.value)}
          />
          {["all","active","revoked"].map(f => (
            <button key={f} onClick={()=>setFilter(f)} style={{
              padding:"10px 16px", borderRadius:"3px", cursor:"pointer",
              fontFamily:"'DM Mono',monospace", fontSize:"11px", letterSpacing:"1px", textTransform:"uppercase",
              background: filter===f ? "rgba(14,165,233,.2)" : "rgba(255,255,255,.04)",
              border:     filter===f ? "1px solid rgba(14,165,233,.4)" : "1px solid rgba(255,255,255,.08)",
              color:      filter===f ? "#38bdf8" : "#475569",
            }}>{f}</button>
          ))}
          <button onClick={()=>loadLicenses(session.access_token)} style={{ padding:"10px 14px", borderRadius:"3px", cursor:"pointer", fontSize:"14px", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", color:"#94a3b8" }}>↻</button>
        </div>

        {/* Table */}
        <div style={S.card}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr auto", ...S.th }}>
            <span>Key / Label</span><span>Domain</span><span>Expires</span><span>Status</span><span>Actions</span>
          </div>

          {fetching && (
            <div style={{ padding:"32px", textAlign:"center", color:"#475569", fontFamily:"'DM Mono',monospace", fontSize:"12px" }}>Loading...</div>
          )}
          {!fetching && filtered.length === 0 && (
            <div style={{ padding:"40px", textAlign:"center", color:"#334155", fontFamily:"'DM Mono',monospace", fontSize:"13px" }}>
              {licenses.length === 0 ? "No licenses found. Create your first one." : "No results match your search."}
            </div>
          )}

          {!fetching && filtered.map(lic => {
            const isMachineLocked = !!(lic.machine_id || lic.machine_hash);
            const isLocalhost     = lic.domain === "localhost";
            return (
              <div key={lic.id} style={{
                gridTemplateColumns:"2fr 1fr 1fr 1fr auto", display:"grid",
                alignItems:"center", opacity: lic.revoked_at ? .5 : 1,
                padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,.05)",
                transition:"background .15s",
              }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.02)"}
              onMouseLeave={e=>e.currentTarget.style.background=""}
              >
                {/* Key + Label */}
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <code style={{ ...S.mono, fontSize:"13px" }}>{lic.license_key}</code>
                    <button onClick={()=>copyKey(lic.license_key)} style={{
                      background:"none", border:"none", cursor:"pointer",
                      color: copied===lic.license_key ? "#4ade80" : "#334155",
                      fontSize:"12px", padding:"2px 4px", transition:"color .2s",
                    }}>{copied===lic.license_key ? "✓" : "⧉"}</button>
                  </div>
                  <div style={{ fontSize:"12px", color:"#94a3b8" }}>{lic.label}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:3, flexWrap:"wrap" }}>
                    {isMachineLocked && (
                      <span style={{ display:"inline-flex", alignItems:"center", gap:4,
                        fontFamily:"'DM Mono',monospace", fontSize:"9px", color:"#475569", letterSpacing:.5 }}>
                        🔒 machine-locked
                        {isLocalhost && (
                          <button
                            onClick={() => handleUnlockMachine(lic)}
                            title="Remove machine lock"
                            style={{ background:"none", border:"1px solid rgba(245,158,11,.3)", borderRadius:2,
                              color:"#fbbf24", cursor:"pointer", fontSize:"8px", padding:"1px 5px",
                              fontFamily:"'DM Mono',monospace", letterSpacing:.5, lineHeight:1.6 }}>
                            unlock
                          </button>
                        )}
                      </span>
                    )}
                    {lic.notes && <span style={{ fontSize:"10px", color:"#334155", fontStyle:"italic" }}>{lic.notes}</span>}
                  </div>
                </div>

                {/* Domain */}
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"11px", color:"#64748b" }}>
                  {lic.domain || <span style={{color:"#334155"}}>—</span>}
                </div>

                {/* Expires */}
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:"11px", color:"#64748b" }}>
                  {lic.expires_at
                    ? new Date(lic.expires_at) < new Date()
                      ? <span style={{color:"#f87171"}}>Expired</span>
                      : new Date(lic.expires_at).toLocaleDateString()
                    : <span style={{color:"#334155"}}>Never</span>
                  }
                </div>

                {/* Status */}
                <div>
                  {lic.revoked_at
                    ? <Pill color="red">Revoked</Pill>
                    : lic.is_active
                      ? <Pill color="green">Active</Pill>
                      : <Pill color="muted">Inactive</Pill>
                  }
                </div>

                {/* Actions */}
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  {/* Revoke / Restore */}
                  <button onClick={()=>toggleActive(lic)} title={lic.revoked_at ? "Restore" : "Revoke"} style={{
                    padding:"5px 10px", borderRadius:"2px", cursor:"pointer",
                    fontFamily:"'DM Mono',monospace", fontSize:"10px", letterSpacing:"1px", textTransform:"uppercase",
                    background: lic.revoked_at ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)",
                    border:     lic.revoked_at ? "1px solid rgba(34,197,94,.25)" : "1px solid rgba(239,68,68,.25)",
                    color:      lic.revoked_at ? "#4ade80" : "#f87171",
                  }}>
                    {lic.revoked_at ? "Restore" : "Revoke"}
                  </button>

                  {/* Delete */}
                  <button onClick={()=>handleDelete(lic)} title="Delete permanently" style={{
                    padding:"5px 8px", borderRadius:"2px", cursor:"pointer",
                    background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.15)",
                    color:"#7f1d1d", fontSize:"13px", lineHeight:1, transition:"all .15s",
                  }}
                  onMouseEnter={e=>{ e.target.style.background="rgba(239,68,68,.2)"; e.target.style.color="#f87171"; }}
                  onMouseLeave={e=>{ e.target.style.background="rgba(239,68,68,.08)"; e.target.style.color="#7f1d1d"; }}
                  >🗑</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* New License Modal */}
        {showNew && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", backdropFilter:"blur(4px)",
            display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20 }}
            onClick={e=>{ if(e.target===e.currentTarget) setShowNew(false); }}>
            <div style={{ ...S.card, width:"100%", maxWidth:"480px", padding:"36px" }}>
              <div style={{ fontSize:"18px", fontWeight:"800", color:"#fff", marginBottom:"4px" }}>
                Generate <span style={{color:"#0ea5e9"}}>License Key</span>
              </div>
              <div style={{ fontSize:"12px", color:"#475569", fontFamily:"'DM Mono',monospace", marginBottom:"28px" }}>New key for your application</div>

              <label style={S.label}>Generated Key</label>
              <div style={{ display:"flex", gap:8, marginBottom:"20px" }}>
                <code style={{ flex:1, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.1)",
                  borderRadius:"3px", padding:"12px 14px", fontFamily:"'DM Mono',monospace",
                  fontSize:"13px", color:"#38bdf8", letterSpacing:"1.5px" }}>{newKey}</code>
                <button onClick={()=>setNewKey(generateKey())} style={{ padding:"12px 14px", background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.1)", borderRadius:"3px", color:"#94a3b8", cursor:"pointer", fontSize:"16px" }}>↻</button>
                <button onClick={()=>copyKey(newKey)} style={{ padding:"12px 14px", background:"rgba(14,165,233,.1)", border:"1px solid rgba(14,165,233,.25)", borderRadius:"3px", color:"#38bdf8", cursor:"pointer", fontSize:"14px" }}>{copied===newKey ? "✓" : "⧉"}</button>
              </div>

              <label style={S.label}>Label *</label>
              <input style={S.input} value={newLabel} onChange={e=>setNewLabel(e.target.value)} placeholder="e.g. Mark Local Desktop" />

              <label style={S.label}>Domain * <span style={{color:"#334155",fontWeight:400}}>(bare domain, no https)</span></label>
              <input style={S.input} value={newDomain} onChange={e=>setNewDomain(e.target.value)} placeholder="e.g. localhost or overtime.valenzuela.gov.ph" />

              <label style={S.label}>Expiry Date (optional)</label>
              <input style={S.input} type="date" value={newExpiry} onChange={e=>setNewExpiry(e.target.value)} />

              <label style={S.label}>Notes (optional)</label>
              <input style={S.input} value={newNotes} onChange={e=>setNewNotes(e.target.value)} placeholder="Internal notes..." />

              <div style={{ display:"flex", gap:12, marginTop:4 }}>
                <button onClick={()=>setShowNew(false)} style={{ ...S.btn("muted"), flex:"0 0 auto", width:"auto", padding:"12px 20px" }}>Cancel</button>
                <button onClick={handleCreate} disabled={creating} style={{ ...S.btn("green"), flex:1 }}>{creating ? "Creating..." : "✓  Create License"}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {confirm && <Confirm msg={confirm.msg} onYes={confirm.onYes} onNo={()=>setConfirm(null)} />}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
    </div>
  );
}