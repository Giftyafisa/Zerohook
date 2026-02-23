import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser, selectIsAuthenticated } from '../../store/slices/authSlice';
import { API_BASE_URL } from '../../config/constants';
import { toast } from 'react-toastify';

// ─── Inline styles (no MUI dependency issues) ─────────────────────────────────
const S = {
  root: { minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: '"Outfit", sans-serif', padding: '24px 32px' },
  denied: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: 16 },
  h1: { fontSize: 32, fontWeight: 800, background: 'linear-gradient(90deg,#00f2ea,#ff0055)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 },
  h2: { fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 8px' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 },
  tab: (active) => ({ padding: '8px 20px', borderRadius: 8, border: active ? '1px solid #00f2ea' : '1px solid rgba(255,255,255,0.1)', background: active ? 'rgba(0,242,234,0.12)' : 'transparent', color: active ? '#00f2ea' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 600, fontSize: 14, transition: 'all .2s' }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16, marginBottom: 32 },
  statCard: (accent) => ({ background: 'rgba(255,255,255,0.04)', border: `1px solid ${accent || 'rgba(255,255,255,0.1)'}`, borderRadius: 12, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 6 }),
  statVal: (accent) => ({ fontSize: 28, fontWeight: 800, color: accent || '#00f2ea' }),
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '10px 14px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.07)' },
  td: { padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.85)', verticalAlign: 'middle' },
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, marginBottom: 20 },
  btn: (color) => ({ padding: '7px 16px', borderRadius: 7, border: 'none', background: color || '#00f2ea', color: color === '#ff0055' || color === '#e53935' ? '#fff' : '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'opacity .2s', marginRight: 6 }),
  badge: (color) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: `${color}22`, color: color, fontWeight: 600, fontSize: 12 }),
  section: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24, marginBottom: 24 },
  refresh: { padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(0,242,234,0.3)', background: 'transparent', color: '#00f2ea', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  spinner: { display: 'inline-block', width: 20, height: 20, border: '3px solid rgba(0,242,234,0.2)', borderTop: '3px solid #00f2ea', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
};

// ─── Check admin from multiple sources ────────────────────────────────────────
function checkIsAdmin(user) {
  if (!user) return false;
  return (
    user.is_admin === true ||
    user.role === 'admin' ||
    user.profile_data?.accountType === 'admin' ||
    user.accountType === 'admin'
  );
}

// ─── API helper ───────────────────────────────────────────────────────────────
async function adminFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE_URL}/admin/${path}`, {
    ...options,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ─── Format helpers ───────────────────────────────────────────────────────────
const fmt = (n) => n != null ? Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminPanel() {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();

  const isAdmin = checkIsAdmin(user);

  const [loading, setLoading] = useState(true);
  const [apiAdmin, setApiAdmin] = useState(null); // null=unknown, true=confirmed, false=denied
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [bannedUsers, setBannedUsers] = useState([]);
  const [unbanReqs, setUnbanReqs] = useState([]);
  const [actionLoading, setActionLoading] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const s = await adminFetch('stats');
      if (s.status === 403) { setApiAdmin(false); setLoading(false); return; }
      setApiAdmin(true);
      if (s.ok) setStats(s.data.stats);

      const [r, d, w, dep, b, u] = await Promise.allSettled([
        adminFetch('revenue'),
        adminFetch('disputes'),
        adminFetch('revenue'), // withdrawals inside revenue
        adminFetch('pending-deposits'),
        adminFetch('banned-users'),
        adminFetch('unban-requests'),
      ]);
      if (r.status === 'fulfilled' && r.value.ok) {
        setRevenue(r.value.data.revenue);
        setWithdrawals(r.value.data.revenue?.pendingWithdrawals?.items || []);
      }
      if (d.status === 'fulfilled' && d.value.ok) setDisputes(d.value.data.disputes || []);
      if (dep.status === 'fulfilled' && dep.value.ok) setDeposits(dep.value.data.deposits || []);
      if (b.status === 'fulfilled' && b.value.ok) setBannedUsers(b.value.data.users || []);
      if (u.status === 'fulfilled' && u.value.ok) setUnbanReqs(u.value.data.requests || []);
    } catch (e) {
      toast.error('Error loading admin data: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadAll();
    else setLoading(false);
  }, [isAuthenticated, loadAll]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const approveWithdrawal = async (id, txHash) => {
    setActionLoading(id);
    const r = await adminFetch(`withdrawals/${id}/approve`, { method: 'POST', body: JSON.stringify({ transactionHash: txHash }) });
    if (r.ok) { toast.success('Withdrawal approved'); loadAll(); }
    else toast.error(r.data.error || 'Failed');
    setActionLoading('');
  };

  const rejectWithdrawal = async (id) => {
    setActionLoading(id);
    const r = await adminFetch(`withdrawals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: 'Rejected by admin' }) });
    if (r.ok) { toast.success('Withdrawal rejected'); loadAll(); }
    else toast.error(r.data.error || 'Failed');
    setActionLoading('');
  };

  const resolveDispute = async (id, winner) => {
    setActionLoading(id);
    const r = await adminFetch(`disputes/${id}/resolve`, { method: 'POST', body: JSON.stringify({ winner, reasoning: 'Admin decision' }) });
    if (r.ok) { toast.success('Dispute resolved'); loadAll(); }
    else toast.error(r.data.error || 'Failed');
    setActionLoading('');
  };

  const unbanUser = async (userId) => {
    setActionLoading(userId);
    const r = await adminFetch(`unban/${userId}`, { method: 'POST', body: JSON.stringify({ reason: 'Admin unban' }) });
    if (r.ok) { toast.success('User unbanned'); loadAll(); }
    else toast.error(r.data.error || 'Failed');
    setActionLoading('');
  };

  const confirmDeposit = async (id, txHash) => {
    setActionLoading(id);
    const r = await adminFetch(`deposits/${id}/confirm`, { method: 'POST', body: JSON.stringify({ transactionHash: txHash, notes: 'Confirmed by admin' }) });
    if (r.ok) { toast.success('Deposit confirmed'); loadAll(); }
    else toast.error(r.data.error || 'Failed');
    setActionLoading('');
  };

  // ── Access checks ──────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div style={S.root}>
        <div style={S.denied}>
          <div style={{ fontSize: 64 }}>🔒</div>
          <h2 style={S.h2}>You must be logged in</h2>
          <button style={S.btn('#00f2ea')} onClick={() => navigate('/login')}>Go to Login</button>
        </div>
      </div>
    );
  }

  // Frontend check — if user is flagged admin in Redux, skip loading screen
  if (!isAdmin && apiAdmin === false) {
    return (
      <div style={S.root}>
        <div style={S.denied}>
          <div style={{ fontSize: 64 }}>🚫</div>
          <h2 style={S.h2}>Admin Access Required</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0 }}>Your account ({user?.email}) does not have admin privileges.</p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>Make sure your account has <code>profile_data.accountType = "admin"</code></p>
          <button style={S.btn()} onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={S.root}>
        <div style={S.denied}>
          <div style={S.spinner} />
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading admin panel…</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const TABS = ['overview', 'revenue', 'disputes', 'withdrawals', 'deposits', 'users'];

  return (
    <div style={S.root}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} body{background:#0a0a0f}`}</style>

      {/* Top bar */}
      <div style={S.topBar}>
        <div>
          <h1 style={S.h1}>⚡ Admin Panel</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', margin: '4px 0 0', fontSize: 13 }}>
            Logged in as <b style={{ color: '#00f2ea' }}>{user?.username}</b> &nbsp;·&nbsp; {user?.email}
          </p>
        </div>
        <button style={S.refresh} onClick={loadAll}>↻ Refresh All</button>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t} style={S.tab(activeTab === t)} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && stats && (
        <>
          <div style={S.grid}>
            <div style={S.statCard('#00f2ea33')}>
              <span style={S.statLabel}>Total Users</span>
              <span style={S.statVal('#00f2ea')}>{fmt(stats.users?.total)}</span>
            </div>
            <div style={S.statCard('#ff005533')}>
              <span style={S.statLabel}>Total Revenue (Fees)</span>
              <span style={S.statVal('#ff0055')}>₵{fmt(stats.revenue?.totalFees)}</span>
            </div>
            <div style={S.statCard('#ff980033')}>
              <span style={S.statLabel}>Pending Withdrawals</span>
              <span style={S.statVal('#ff9800')}>{fmt(stats.revenue?.pendingWithdrawals)}</span>
            </div>
            <div style={S.statCard('#9c27b033')}>
              <span style={S.statLabel}>Open Disputes</span>
              <span style={S.statVal('#9c27b0')}>{fmt(stats.disputes?.open)}</span>
            </div>
            <div style={S.statCard('#2196f333')}>
              <span style={S.statLabel}>Active Escrows</span>
              <span style={S.statVal('#2196f3')}>{fmt(stats.escrow?.active)}</span>
            </div>
            <div style={S.statCard('#4caf5033')}>
              <span style={S.statLabel}>Total Transactions</span>
              <span style={S.statVal('#4caf50')}>{fmt(stats.transactions?.total)}</span>
            </div>
            <div style={S.statCard()}>
              <span style={S.statLabel}>Subscribed Users</span>
              <span style={S.statVal()}>{fmt(stats.users?.subscribed)}</span>
            </div>
            <div style={S.statCard()}>
              <span style={S.statLabel}>Verified Users</span>
              <span style={S.statVal()}>{fmt(stats.users?.verified)}</span>
            </div>
          </div>
          <div style={S.section}>
            <h3 style={{ color: '#00f2ea', marginTop: 0 }}>Quick Summary</h3>
            <pre style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, overflow: 'auto', margin: 0 }}>{JSON.stringify(stats, null, 2)}</pre>
          </div>
        </>
      )}

      {/* ── REVENUE ── */}
      {activeTab === 'revenue' && (
        <div style={S.section}>
          <h2 style={S.h2}>Revenue & Fees</h2>
          {revenue ? (
            <div style={S.grid}>
              <div style={S.statCard('#00f2ea33')}>
                <span style={S.statLabel}>Total Fees Collected</span>
                <span style={S.statVal('#00f2ea')}>₵{fmt(revenue.totalFees)}</span>
              </div>
              <div style={S.statCard('#4caf5033')}>
                <span style={S.statLabel}>Available to Withdraw</span>
                <span style={S.statVal('#4caf50')}>₵{fmt(revenue.availableFees)}</span>
              </div>
              <div style={S.statCard('#ff980033')}>
                <span style={S.statLabel}>Pending Withdrawals #</span>
                <span style={S.statVal('#ff9800')}>{fmt(revenue.pendingWithdrawals?.count)}</span>
              </div>
              <div style={S.statCard('#ff005533')}>
                <span style={S.statLabel}>Pending Withdrawals ₵</span>
                <span style={S.statVal('#ff0055')}>₵{fmt(revenue.pendingWithdrawals?.totalAmount)}</span>
              </div>
            </div>
          ) : <p style={{ color: 'rgba(255,255,255,0.4)' }}>No revenue data.</p>}
        </div>
      )}

      {/* ── DISPUTES ── */}
      {activeTab === 'disputes' && (
        <div style={S.section}>
          <h2 style={S.h2}>Open Disputes ({disputes.length})</h2>
          {disputes.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>No open disputes 🎉</p>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  {['ID','Amount','Opened','Type','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {disputes.map(d => (
                  <tr key={d._id}>
                    <td style={S.td}><code style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{String(d._id).slice(-8)}</code></td>
                    <td style={S.td}>₵{fmt(d.amount)}</td>
                    <td style={S.td}>{fmtDate(d.created_at || d.createdAt)}</td>
                    <td style={S.td}><span style={S.badge('#ff9800')}>{d.type || 'general'}</span></td>
                    <td style={S.td}>
                      <button style={S.btn('#4caf50')} disabled={actionLoading === d._id} onClick={() => resolveDispute(d._id, 'provider')}>→ Provider</button>
                      <button style={S.btn('#2196f3')} disabled={actionLoading === d._id} onClick={() => resolveDispute(d._id, 'client')}>→ Client</button>
                      <button style={S.btn()} disabled={actionLoading === d._id} onClick={() => resolveDispute(d._id, 'split')}>Split</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── WITHDRAWALS ── */}
      {activeTab === 'withdrawals' && (
        <div style={S.section}>
          <h2 style={S.h2}>Pending Withdrawals ({withdrawals.length})</h2>
          {withdrawals.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>No pending withdrawals.</p>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  {['ID','User','Amount','Method','Requested','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {withdrawals.map(w => (
                  <tr key={w._id}>
                    <td style={S.td}><code style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{String(w._id).slice(-8)}</code></td>
                    <td style={S.td}>{w.username || w.userId?.slice(-6)}</td>
                    <td style={S.td}>₵{fmt(w.amount)}</td>
                    <td style={S.td}><span style={S.badge('#9c27b0')}>{w.method}</span></td>
                    <td style={S.td}>{fmtDate(w.created_at || w.createdAt)}</td>
                    <td style={S.td}>
                      <button style={S.btn('#4caf50')} disabled={actionLoading === String(w._id)} onClick={() => {
                        const tx = window.prompt('Enter transaction hash (optional):') || '';
                        approveWithdrawal(w._id, tx);
                      }}>✓ Approve</button>
                      <button style={S.btn('#e53935')} disabled={actionLoading === String(w._id)} onClick={() => rejectWithdrawal(w._id)}>✕ Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── DEPOSITS ── */}
      {activeTab === 'deposits' && (
        <div style={S.section}>
          <h2 style={S.h2}>Pending Deposits ({deposits.length})</h2>
          {deposits.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>No pending deposits.</p>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  {['ID','User','Amount','Method','Requested','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {deposits.map(dep => (
                  <tr key={dep._id}>
                    <td style={S.td}><code style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{String(dep._id).slice(-8)}</code></td>
                    <td style={S.td}>{dep.username || String(dep.userId).slice(-6)}</td>
                    <td style={S.td}>₵{fmt(dep.amount)}</td>
                    <td style={S.td}><span style={S.badge('#2196f3')}>{dep.method}</span></td>
                    <td style={S.td}>{fmtDate(dep.created_at || dep.createdAt)}</td>
                    <td style={S.td}>
                      <button style={S.btn('#4caf50')} disabled={actionLoading === String(dep._id)} onClick={() => {
                        const tx = window.prompt('Transaction hash (optional):') || '';
                        confirmDeposit(dep._id, tx);
                      }}>✓ Confirm</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── USERS ── */}
      {activeTab === 'users' && (
        <div style={S.section}>
          <h2 style={S.h2}>Banned Users ({bannedUsers.length})</h2>
          {bannedUsers.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>No banned users.</p>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  {['Username','Email','Banned At','Reason','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {bannedUsers.map(u => (
                  <tr key={u._id}>
                    <td style={S.td}>{u.username}</td>
                    <td style={S.td}>{u.email}</td>
                    <td style={S.td}>{fmtDate(u.ban_data?.bannedAt)}</td>
                    <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.ban_data?.reason || '—'}</td>
                    <td style={S.td}>
                      <button style={S.btn('#4caf50')} disabled={actionLoading === String(u._id)} onClick={() => unbanUser(u._id)}>Unban</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {unbanReqs.length > 0 && (
            <>
              <h2 style={{ ...S.h2, marginTop: 32 }}>Unban Requests ({unbanReqs.length})</h2>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['User','Reason','Requested','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {unbanReqs.map(r => (
                    <tr key={r._id}>
                      <td style={S.td}>{r.username}</td>
                      <td style={S.td}>{r.reason || '—'}</td>
                      <td style={S.td}>{fmtDate(r.createdAt)}</td>
                      <td style={S.td}>
                        <button style={S.btn('#4caf50')} disabled={actionLoading === String(r.userId)} onClick={() => unbanUser(r.userId)}>✓ Grant</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
