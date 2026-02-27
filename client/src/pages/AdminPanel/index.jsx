import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser, selectIsAuthenticated } from '../../store/slices/authSlice';
import { API_BASE_URL } from '../../config/constants';
import apiClient from '../../services/apiClient';
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
  // User management styles
  input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  select: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', appearance: 'auto' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 },
  modal: { background: '#111118', border: '1px solid rgba(0,242,234,0.25)', borderRadius: 16, padding: 28, width: '95%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', position: 'relative' },
  modalClose: { position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', padding: 4 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
  formLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' },
  formField: { marginBottom: 2 },
  searchBar: { display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' },
  pagination: { display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  pageBtn: (active) => ({ padding: '6px 14px', borderRadius: 6, border: active ? '1px solid #00f2ea' : '1px solid rgba(255,255,255,0.1)', background: active ? 'rgba(0,242,234,0.15)' : 'transparent', color: active ? '#00f2ea' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }),
  dangerBtn: { padding: '7px 16px', borderRadius: 7, border: 'none', background: '#e53935', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'opacity .2s', marginRight: 6 },
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
  try {
    const method = (options.method || 'GET').toLowerCase();
    const body = options.body ? JSON.parse(options.body) : undefined;
    const res = await apiClient[method === 'delete' ? 'delete' : method](`/admin/${path}`, method === 'get' || method === 'delete' ? undefined : body);
    return { ok: true, status: res.status, data: res.data };
  } catch (error) {
    return { ok: false, status: error.response?.status || 500, data: error.response?.data || {} };
  }
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

  // ── User management state ─────────────────────────────────────────────────
  const [allUsers, setAllUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPages, setUsersPages] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersFilter, setUsersFilter] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [editUser, setEditUser] = useState(null); // user object being edited
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // userId to confirm delete
  const searchTimeout = useRef(null);

  // ── Notifications state ───────────────────────────────────────────────────
  const [notifySearch, setNotifySearch] = useState('');
  const [notifySearchResults, setNotifySearchResults] = useState([]);
  const [notifySearching, setNotifySearching] = useState(false);
  const [notifyRecipient, setNotifyRecipient] = useState(null); // { _id, username, email }
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyType, setNotifyType] = useState('admin_notice');
  const [notifySending, setNotifySending] = useState(false);
  const [notifyMode, setNotifyMode] = useState('single'); // 'single' | 'bulk'
  const [notifyBulkFilter, setNotifyBulkFilter] = useState('all');
  const [sentNotifications, setSentNotifications] = useState([]);
  const [sentLoading, setSentLoading] = useState(false);
  const [sentPage, setSentPage] = useState(1);
  const [sentPages, setSentPages] = useState(1);
  const notifySearchTimeout = useRef(null);

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

  // ── User management actions ────────────────────────────────────────────────
  const loadUsers = useCallback(async (page = 1, search = '', filter = '') => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (search) params.set('search', search);
      if (filter) params.set('accountType', filter);
      const r = await adminFetch(`users?${params.toString()}`);
      if (r.ok) {
        setAllUsers(r.data.users || []);
        setUsersTotal(r.data.total || 0);
        setUsersPage(r.data.page || 1);
        setUsersPages(r.data.pages || 1);
      } else {
        toast.error(r.data.error || 'Failed to load users');
      }
    } catch (e) {
      toast.error('Error loading users: ' + e.message);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const handleUserSearch = useCallback((val) => {
    setUsersSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      loadUsers(1, val, usersFilter);
    }, 400);
  }, [loadUsers, usersFilter]);

  const handleFilterChange = useCallback((val) => {
    setUsersFilter(val);
    loadUsers(1, usersSearch, val);
  }, [loadUsers, usersSearch]);

  const openEditModal = (u) => {
    setEditUser(u);
    setEditForm({
      username: u.username || '',
      email: u.email || '',
      phone: u.phone || '',
      status: u.status || 'active',
      is_subscribed: u.is_subscribed || false,
      subscription_tier: u.subscription_tier || 'free',
      verification_tier: u.verification_tier || 1,
      is_admin: u.is_admin || false,
      role: u.role || 'user',
      accountType: u.accountType || 'user',
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      age: u.age || '',
      country: u.country || '',
      city: u.city || '',
    });
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const r = await adminFetch(`users/${editUser._id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      if (r.ok) {
        toast.success('User updated successfully');
        setEditUser(null);
        loadUsers(usersPage, usersSearch, usersFilter);
      } else {
        toast.error(r.data.error || 'Failed to update user');
      }
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const deleteUser = async (userId) => {
    setActionLoading(userId);
    try {
      const r = await adminFetch(`users/${userId}`, { method: 'DELETE' });
      if (r.ok) {
        toast.success(r.data.message || 'User deleted');
        setDeleteConfirm(null);
        loadUsers(usersPage, usersSearch, usersFilter);
      } else {
        toast.error(r.data.error || 'Failed to delete user');
      }
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setActionLoading('');
    }
  };

  const banUser = async (userId, username) => {
    const reason = window.prompt(`Ban reason for ${username}:`);
    if (!reason) return;
    setActionLoading(userId);
    const r = await adminFetch(`manual-ban/${userId}`, { method: 'POST', body: JSON.stringify({ reason }) });
    if (r.ok) { toast.success('User banned'); loadUsers(usersPage, usersSearch, usersFilter); }
    else toast.error(r.data.error || 'Failed to ban');
    setActionLoading('');
  };

  // ── Notification functions ────────────────────────────────────────────────
  const searchUsersForNotify = (query) => {
    setNotifySearch(query);
    if (notifySearchTimeout.current) clearTimeout(notifySearchTimeout.current);
    if (!query || query.length < 2) { setNotifySearchResults([]); return; }
    notifySearchTimeout.current = setTimeout(async () => {
      setNotifySearching(true);
      try {
        const r = await adminFetch(`users?search=${encodeURIComponent(query)}&limit=8`);
        if (r.ok) setNotifySearchResults(r.data.users || []);
      } catch (_) { /* swallow */ }
      setNotifySearching(false);
    }, 300);
  };

  const sendNotification = async () => {
    if (notifyMode === 'single' && !notifyRecipient) { toast.error('Select a recipient'); return; }
    if (!notifyTitle.trim()) { toast.error('Title is required'); return; }
    if (!notifyMessage.trim()) { toast.error('Message is required'); return; }

    setNotifySending(true);
    try {
      let r;
      if (notifyMode === 'single') {
        r = await adminFetch('send-notification', {
          method: 'POST',
          body: JSON.stringify({
            userId: notifyRecipient._id,
            title: notifyTitle.trim(),
            message: notifyMessage.trim(),
            type: notifyType,
          }),
        });
      } else {
        r = await adminFetch('send-bulk-notification', {
          method: 'POST',
          body: JSON.stringify({
            filter: notifyBulkFilter,
            title: notifyTitle.trim(),
            message: notifyMessage.trim(),
            type: notifyType,
          }),
        });
      }

      if (r.ok) {
        const count = r.data.count || r.data.sentCount || 1;
        toast.success(`Notification sent to ${count} user${count > 1 ? 's' : ''}`);
        setNotifyTitle('');
        setNotifyMessage('');
        setNotifyRecipient(null);
        setNotifySearch('');
        setNotifySearchResults([]);
        loadSentNotifications(1);
      } else {
        toast.error(r.data.error || 'Failed to send notification');
      }
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setNotifySending(false);
    }
  };

  const loadSentNotifications = useCallback(async (page = 1) => {
    setSentLoading(true);
    try {
      const r = await adminFetch(`sent-notifications?page=${page}&limit=15`);
      if (r.ok) {
        setSentNotifications(r.data.notifications || []);
        setSentPages(r.data.totalPages || 1);
        setSentPage(r.data.page || 1);
      }
    } catch (_) { /* swallow */ }
    setSentLoading(false);
  }, []);

  // Load users when switching to users tab
  useEffect(() => {
    if (activeTab === 'users' && allUsers.length === 0 && apiAdmin === true) {
      loadUsers(1, '', '');
    }
  }, [activeTab, allUsers.length, apiAdmin, loadUsers]);

  // Load sent notifications when switching to notifications tab
  useEffect(() => {
    if (activeTab === 'notifications' && sentNotifications.length === 0 && apiAdmin === true) {
      loadSentNotifications(1);
    }
  }, [activeTab, apiAdmin, loadSentNotifications]);

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
  const TABS = ['overview', 'revenue', 'disputes', 'withdrawals', 'deposits', 'users', 'notifications'];

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

      {/* ── USERS (Full Management) ── */}
      {activeTab === 'users' && (
        <div style={S.section}>
          <h2 style={S.h2}>User Management ({usersTotal} total)</h2>

          {/* Search & Filter Bar */}
          <div style={S.searchBar}>
            <input
              type="text"
              placeholder="Search by username, email, name, phone…"
              value={usersSearch}
              onChange={(e) => handleUserSearch(e.target.value)}
              style={{ ...S.input, maxWidth: 360, flex: 1 }}
            />
            <select value={usersFilter} onChange={(e) => handleFilterChange(e.target.value)} style={{ ...S.select, maxWidth: 180 }}>
              <option value="">All Types</option>
              <option value="client">Client</option>
              <option value="provider">Provider</option>
              <option value="sugar_daddy">Sugar Daddy</option>
              <option value="sugar_mommy">Sugar Mommy</option>
              <option value="admin">Admin</option>
            </select>
            <button style={S.refresh} onClick={() => loadUsers(usersPage, usersSearch, usersFilter)}>↻ Refresh</button>
          </div>

          {/* Users Table */}
          {usersLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><div style={S.spinner} /></div>
          ) : allUsers.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>No users found.</p>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {['User', 'Email', 'Type', 'Status', 'Sub', 'Trust', 'Joined', 'Actions'].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map(u => (
                      <tr key={u._id} style={u.is_banned ? { background: 'rgba(229,57,53,0.08)' } : {}}>
                        <td style={S.td}>
                          <div>
                            <b style={{ color: u.is_admin ? '#ff0055' : '#fff' }}>{u.username}</b>
                            {u.is_admin && <span style={{ ...S.badge('#ff0055'), marginLeft: 6 }}>ADMIN</span>}
                          </div>
                          {(u.firstName || u.lastName) && (
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{u.firstName} {u.lastName}</div>
                          )}
                        </td>
                        <td style={{ ...S.td, fontSize: 13 }}>{u.email}</td>
                        <td style={S.td}><span style={S.badge('#9c27b0')}>{u.accountType}</span></td>
                        <td style={S.td}>
                          {u.is_banned
                            ? <span style={S.badge('#e53935')}>Banned</span>
                            : <span style={S.badge(u.status === 'active' ? '#4caf50' : '#ff9800')}>{u.status}</span>
                          }
                        </td>
                        <td style={S.td}>
                          {u.is_subscribed
                            ? <span style={S.badge('#00f2ea')}>{u.subscription_tier}</span>
                            : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>free</span>
                          }
                        </td>
                        <td style={S.td}>
                          <span style={{ color: u.trust_score >= 70 ? '#4caf50' : u.trust_score >= 40 ? '#ff9800' : '#e53935', fontWeight: 700 }}>
                            {Math.round(u.trust_score || 0)}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{fmtDate(u.created_at)}</td>
                        <td style={S.td}>
                          <button
                            style={S.btn('#2196f3')}
                            onClick={() => openEditModal(u)}
                            title="Edit user"
                          >✏️ Edit</button>
                          {!u.is_banned && !u.is_admin && (
                            <button
                              style={S.btn('#ff9800')}
                              disabled={actionLoading === u._id}
                              onClick={() => banUser(u._id, u.username)}
                              title="Ban user"
                            >🚫 Ban</button>
                          )}
                          {u.is_banned && (
                            <button
                              style={S.btn('#4caf50')}
                              disabled={actionLoading === u._id}
                              onClick={() => unbanUser(u._id)}
                              title="Unban user"
                            >✓ Unban</button>
                          )}
                          {!u.is_admin && (
                            deleteConfirm === u._id ? (
                              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                                <button style={S.dangerBtn} disabled={actionLoading === u._id} onClick={() => deleteUser(u._id)}>
                                  {actionLoading === u._id ? '…' : 'Confirm Delete'}
                                </button>
                                <button style={{ ...S.btn(), padding: '7px 10px' }} onClick={() => setDeleteConfirm(null)}>✕</button>
                              </span>
                            ) : (
                              <button
                                style={S.dangerBtn}
                                onClick={() => setDeleteConfirm(u._id)}
                                title="Delete user permanently"
                              >🗑️ Delete</button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {usersPages > 1 && (
                <div style={S.pagination}>
                  <button
                    style={S.pageBtn(false)}
                    disabled={usersPage <= 1}
                    onClick={() => { setUsersPage(p => p - 1); loadUsers(usersPage - 1, usersSearch, usersFilter); }}
                  >← Prev</button>
                  {Array.from({ length: Math.min(usersPages, 7) }, (_, i) => {
                    let p;
                    if (usersPages <= 7) p = i + 1;
                    else if (usersPage <= 4) p = i + 1;
                    else if (usersPage >= usersPages - 3) p = usersPages - 6 + i;
                    else p = usersPage - 3 + i;
                    return (
                      <button key={p} style={S.pageBtn(p === usersPage)} onClick={() => { setUsersPage(p); loadUsers(p, usersSearch, usersFilter); }}>
                        {p}
                      </button>
                    );
                  })}
                  <button
                    style={S.pageBtn(false)}
                    disabled={usersPage >= usersPages}
                    onClick={() => { setUsersPage(p => p + 1); loadUsers(usersPage + 1, usersSearch, usersFilter); }}
                  >Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── NOTIFICATIONS TAB ── */}
      {activeTab === 'notifications' && (
        <div>
          {/* ── Compose Section ── */}
          <div style={S.section}>
            <h2 style={S.h2}>📨 Send Notification</h2>

            {/* Mode toggle: Single / Bulk */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                style={S.tab(notifyMode === 'single')}
                onClick={() => setNotifyMode('single')}
              >👤 Single User</button>
              <button
                style={S.tab(notifyMode === 'bulk')}
                onClick={() => setNotifyMode('bulk')}
              >👥 Bulk Send</button>
            </div>

            {/* Recipient: Single user search */}
            {notifyMode === 'single' && (
              <div style={{ marginBottom: 16, position: 'relative' }}>
                <label style={S.formLabel}>Recipient</label>
                {notifyRecipient ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(0,242,234,0.08)', border: '1px solid rgba(0,242,234,0.25)',
                    borderRadius: 8, padding: '8px 14px',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#00f2ea' }}>
                      {notifyRecipient.username}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      {notifyRecipient.email}
                    </span>
                    <button
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16 }}
                      onClick={() => { setNotifyRecipient(null); setNotifySearch(''); }}
                    >✕</button>
                  </div>
                ) : (
                  <>
                    <input
                      style={S.input}
                      placeholder="Search by username or email…"
                      value={notifySearch}
                      onChange={e => searchUsersForNotify(e.target.value)}
                    />
                    {notifySearching && (
                      <span style={{ position: 'absolute', right: 12, top: 30, ...S.spinner ? {} : {} }}>
                        <span style={S.spinner} />
                      </span>
                    )}
                    {notifySearchResults.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                        background: '#16161e', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8, maxHeight: 240, overflowY: 'auto', marginTop: 4,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      }}>
                        {notifySearchResults.map(u => (
                          <div
                            key={u._id}
                            onClick={() => { setNotifyRecipient(u); setNotifySearch(''); setNotifySearchResults([]); }}
                            style={{
                              padding: '10px 14px', cursor: 'pointer',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,242,234,0.06)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>{u.username}</span>
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginLeft: 8 }}>{u.email}</span>
                            {u.accountType && (
                              <span style={{ ...S.badge('#00f2ea'), marginLeft: 8, fontSize: 10 }}>{u.accountType}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Recipient: Bulk filter */}
            {notifyMode === 'bulk' && (
              <div style={{ marginBottom: 16 }}>
                <label style={S.formLabel}>Send To</label>
                <select
                  style={{ ...S.select, maxWidth: 260 }}
                  value={notifyBulkFilter}
                  onChange={e => setNotifyBulkFilter(e.target.value)}
                >
                  <option value="all">All Users</option>
                  <option value="providers">All Providers</option>
                  <option value="clients">All Clients</option>
                </select>
              </div>
            )}

            {/* Type & Title row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={S.formLabel}>Type</label>
                <select
                  style={S.select}
                  value={notifyType}
                  onChange={e => setNotifyType(e.target.value)}
                >
                  <option value="admin_notice">📋 Admin Notice</option>
                  <option value="warning">⚠️ Warning</option>
                  <option value="policy_violation">🚨 Policy Violation</option>
                  <option value="account_alert">🔔 Account Alert</option>
                  <option value="info">ℹ️ Info</option>
                </select>
              </div>
              <div>
                <label style={S.formLabel}>Title</label>
                <input
                  style={S.input}
                  placeholder="Notification title…"
                  value={notifyTitle}
                  onChange={e => setNotifyTitle(e.target.value)}
                  maxLength={120}
                />
              </div>
            </div>

            {/* Message */}
            <div style={{ marginBottom: 18 }}>
              <label style={S.formLabel}>Message</label>
              <textarea
                style={{
                  ...S.input,
                  minHeight: 100, resize: 'vertical',
                  fontFamily: 'inherit', lineHeight: 1.5,
                }}
                placeholder="Write the notification message…"
                value={notifyMessage}
                onChange={e => setNotifyMessage(e.target.value)}
                maxLength={2000}
              />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', float: 'right', marginTop: 2 }}>
                {notifyMessage.length}/2000
              </span>
            </div>

            {/* Preview */}
            {(notifyTitle || notifyMessage) && (
              <div style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: 16, marginBottom: 18,
              }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Preview
                </span>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>
                    {notifyType === 'warning' ? '⚠️' : notifyType === 'policy_violation' ? '🚨' : notifyType === 'account_alert' ? '🔔' : notifyType === 'info' ? 'ℹ️' : '📋'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{notifyTitle || '(No title)'}</div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                      {notifyMessage || '(No message)'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Send button */}
            <button
              style={{
                ...S.btn(notifyType === 'warning' || notifyType === 'policy_violation' ? '#ff0055' : '#00f2ea'),
                padding: '10px 28px', fontSize: 14, opacity: notifySending ? 0.6 : 1,
              }}
              disabled={notifySending}
              onClick={sendNotification}
            >
              {notifySending ? '⏳ Sending…' : notifyMode === 'single' ? '📨 Send Notification' : `📨 Send to ${notifyBulkFilter === 'all' ? 'All Users' : notifyBulkFilter === 'providers' ? 'All Providers' : 'All Clients'}`}
            </button>
          </div>

          {/* ── Sent History Section ── */}
          <div style={S.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ ...S.h2, margin: 0 }}>📜 Sent History</h2>
              <button style={S.refresh} onClick={() => loadSentNotifications(sentPage)}>↻ Refresh</button>
            </div>

            {sentLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <span style={S.spinner} />
              </div>
            ) : sentNotifications.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 20 }}>
                No notifications sent yet.
              </p>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Type</th>
                        <th style={S.th}>Recipient</th>
                        <th style={S.th}>Title</th>
                        <th style={S.th}>Message</th>
                        <th style={S.th}>Read</th>
                        <th style={S.th}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentNotifications.map(n => (
                        <tr key={n._id}>
                          <td style={S.td}>
                            <span style={S.badge(
                              n.type === 'warning' ? '#ff9800'
                              : n.type === 'policy_violation' ? '#e53935'
                              : n.type === 'account_alert' ? '#2196f3'
                              : n.type === 'info' ? '#9c27b0'
                              : '#00f2ea'
                            )}>
                              {n.type?.replace(/_/g, ' ') || 'notice'}
                            </span>
                          </td>
                          <td style={S.td}>
                            <span style={{ fontWeight: 600, color: '#fff' }}>
                              {n.user_id?.username || n.user_id?.email || n.user_id || '—'}
                            </span>
                          </td>
                          <td style={S.td}>{n.title || '—'}</td>
                          <td style={{ ...S.td, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {n.message || '—'}
                          </td>
                          <td style={S.td}>
                            <span style={S.badge(n.read ? '#4caf50' : '#ff9800')}>
                              {n.read ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td style={S.td}>{fmtDate(n.created_at || n.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {sentPages > 1 && (
                  <div style={S.pagination}>
                    <button
                      style={S.pageBtn(false)}
                      disabled={sentPage <= 1}
                      onClick={() => loadSentNotifications(sentPage - 1)}
                    >← Prev</button>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                      Page {sentPage} of {sentPages}
                    </span>
                    <button
                      style={S.pageBtn(false)}
                      disabled={sentPage >= sentPages}
                      onClick={() => loadSentNotifications(sentPage + 1)}
                    >Next →</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── EDIT USER MODAL ── */}
      {editUser && (
        <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) setEditUser(null); }}>
          <div style={S.modal}>
            <button style={S.modalClose} onClick={() => setEditUser(null)}>✕</button>
            <h2 style={{ ...S.h2, marginBottom: 4 }}>Edit User</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
              ID: {editUser._id} &nbsp;·&nbsp; Joined: {fmtDate(editUser.created_at)}
            </p>

            <div style={S.formGrid}>
              <div style={S.formField}>
                <label style={S.formLabel}>Username</label>
                <input style={S.input} value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div style={S.formField}>
                <label style={S.formLabel}>Email</label>
                <input style={S.input} type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div style={S.formField}>
                <label style={S.formLabel}>First Name</label>
                <input style={S.input} value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div style={S.formField}>
                <label style={S.formLabel}>Last Name</label>
                <input style={S.input} value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
              <div style={S.formField}>
                <label style={S.formLabel}>Phone</label>
                <input style={S.input} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div style={S.formField}>
                <label style={S.formLabel}>Age</label>
                <input style={S.input} type="number" value={editForm.age} onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))} />
              </div>
              <div style={S.formField}>
                <label style={S.formLabel}>Country</label>
                <input style={S.input} value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))} />
              </div>
              <div style={S.formField}>
                <label style={S.formLabel}>City</label>
                <input style={S.input} value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div style={S.formField}>
                <label style={S.formLabel}>Account Type</label>
                <select style={S.select} value={editForm.accountType} onChange={e => setEditForm(f => ({ ...f, accountType: e.target.value }))}>
                  <option value="user">User</option>
                  <option value="client">Client</option>
                  <option value="provider">Provider</option>
                  <option value="sugar_daddy">Sugar Daddy</option>
                  <option value="sugar_mommy">Sugar Mommy</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={S.formField}>
                <label style={S.formLabel}>Status</label>
                <select style={S.select} value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="banned">Banned</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div style={S.formField}>
                <label style={S.formLabel}>Subscription Tier</label>
                <select style={S.select} value={editForm.subscription_tier} onChange={e => setEditForm(f => ({ ...f, subscription_tier: e.target.value }))}>
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                  <option value="vip">VIP</option>
                </select>
              </div>
              <div style={S.formField}>
                <label style={S.formLabel}>Verification Tier</label>
                <select style={S.select} value={editForm.verification_tier} onChange={e => setEditForm(f => ({ ...f, verification_tier: parseInt(e.target.value) }))}>
                  <option value={1}>Tier 1 (Basic)</option>
                  <option value={2}>Tier 2 (ID Verified)</option>
                  <option value={3}>Tier 3 (Full)</option>
                </select>
              </div>
              <div style={S.formField}>
                <label style={S.formLabel}>Role</label>
                <select style={S.select} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {/* Toggle switches */}
            <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                <input type="checkbox" checked={editForm.is_subscribed} onChange={e => setEditForm(f => ({ ...f, is_subscribed: e.target.checked }))} />
                Subscribed
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: editForm.is_admin ? '#ff0055' : 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                <input type="checkbox" checked={editForm.is_admin} onChange={e => setEditForm(f => ({ ...f, is_admin: e.target.checked }))} />
                Admin
              </label>
            </div>

            {/* Save / Cancel */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={{ ...S.btn(), background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.15)' }} onClick={() => setEditUser(null)}>
                Cancel
              </button>
              <button style={S.btn('#4caf50')} disabled={editSaving} onClick={saveEdit}>
                {editSaving ? 'Saving…' : '✓ Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteConfirm && !allUsers.find(u => u._id === deleteConfirm) && setDeleteConfirm(null)}
    </div>
  );
}
