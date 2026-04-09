import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import apiClient from '../services/apiClient';
import { selectIsAuthenticated, selectUser } from '../store/slices/authSlice';

const styles = {
  root: {
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#fff',
    fontFamily: 'Outfit, sans-serif',
    padding: '24px 32px'
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
    flexWrap: 'wrap'
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    background: 'linear-gradient(90deg,#00f2ea,#ff0055)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  button: {
    border: '1px solid rgba(0,242,234,0.35)',
    background: 'rgba(0,242,234,0.12)',
    color: '#00f2ea',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer'
  },
  card: {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16
  },
  subtitle: {
    margin: '0 0 10px',
    fontSize: 16,
    fontWeight: 700,
    color: '#fff'
  },
  row: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 10
  },
  input: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: '8px 10px',
    color: '#fff',
    fontSize: 13,
    minWidth: 130
  },
  tableWrap: {
    width: '100%',
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13
  },
  th: {
    textAlign: 'left',
    color: 'rgba(255,255,255,0.5)',
    borderBottom: '1px solid rgba(255,255,255,0.12)',
    padding: '8px 10px'
  },
  td: {
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    padding: '9px 10px',
    color: 'rgba(255,255,255,0.9)',
    verticalAlign: 'top'
  },
  chip: {
    display: 'inline-block',
    marginRight: 6,
    marginBottom: 6,
    background: 'rgba(0,242,234,0.18)',
    border: '1px solid rgba(0,242,234,0.35)',
    color: '#00f2ea',
    borderRadius: 999,
    padding: '4px 9px',
    fontSize: 12,
    fontWeight: 600
  },
  chipButton: {
    display: 'inline-block',
    marginRight: 6,
    marginBottom: 6,
    background: 'rgba(0,242,234,0.18)',
    border: '1px solid rgba(0,242,234,0.35)',
    color: '#00f2ea',
    borderRadius: 999,
    padding: '4px 9px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer'
  },
  chipButtonActive: {
    background: 'rgba(255,0,85,0.2)',
    border: '1px solid rgba(255,0,85,0.45)',
    color: '#ff4b85'
  },
  muted: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12
  }
};

const isUserAdmin = (user) => {
  if (!user) return false;
  return (
    user.is_admin === true
    || user.role === 'admin'
    || user.profile_data?.accountType === 'admin'
    || user.accountType === 'admin'
    || user.isAdmin === true
  );
};

const fmtDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
};

const fmtNumber = (value) => Number(value || 0).toLocaleString();

const parseBoundedInt = (value, fallback, min, max) => {
  const parsed = parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
};

const readDashboardQuery = (search) => {
  const params = new URLSearchParams(search || '');
  const rawDay = String(params.get('day') || '').trim();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(rawDay) ? rawDay : '';

  return {
    user: String(params.get('user') || '').trim(),
    event: String(params.get('event') || '').trim().slice(0, 128),
    day,
    page: parseBoundedInt(params.get('page'), 1, 1, 10000),
    limit: parseBoundedInt(params.get('limit'), 25, 1, 200),
    aggDays: parseBoundedInt(params.get('aggDays'), 7, 1, 90),
    aggLimit: parseBoundedInt(params.get('aggLimit'), 10, 1, 50),
    aggMaxDocs: parseBoundedInt(params.get('aggMaxDocs'), 1000, 1, 5000)
  };
};

export default function AdminSocketTraceDashboard() {
  const navigate = useNavigate();
  const currentLocation = useLocation();
  const [, setSearchParams] = useSearchParams();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const initialQuery = readDashboardQuery(currentLocation.search);

  const [loading, setLoading] = useState(true);
  const [adminDenied, setAdminDenied] = useState(false);
  const [isServerAdmin, setIsServerAdmin] = useState(null);

  const [recent, setRecent] = useState([]);
  const [recentPage, setRecentPage] = useState(initialQuery.page);
  const [recentLimit, setRecentLimit] = useState(initialQuery.limit);
  const [recentUserFilter, setRecentUserFilter] = useState(initialQuery.user);
  const [recentEventFilter, setRecentEventFilter] = useState(initialQuery.event);
  const [recentDayFilter, setRecentDayFilter] = useState(initialQuery.day);
  const [recentPages, setRecentPages] = useState(1);

  const [aggregate, setAggregate] = useState({ overallTop: [], perDay: [], scanned: null });
  const [aggDays, setAggDays] = useState(initialQuery.aggDays);
  const [aggLimit, setAggLimit] = useState(initialQuery.aggLimit);
  const [aggMaxDocs, setAggMaxDocs] = useState(initialQuery.aggMaxDocs);

  const [replayPayload, setReplayPayload] = useState({ traceId: '', userId: '', maxLines: 50, dryRun: true, emitToUser: true });
  const [replayResult, setReplayResult] = useState(null);

  const [exportPayload, setExportPayload] = useState({ sinceMinutes: 60, limit: 100, userId: '' });
  const [exportResult, setExportResult] = useState(null);

  const [busy, setBusy] = useState('');

  const localAdminHint = useMemo(() => isAuthenticated && isUserAdmin(user), [isAuthenticated, user]);

  const ensureAdmin = useCallback(async () => {
    try {
      await apiClient.get('/admin/stats');
      setAdminDenied(false);
      setIsServerAdmin(true);
      return true;
    } catch (error) {
      if (error?.response?.status === 403 || error?.response?.status === 401) {
        setAdminDenied(true);
        setIsServerAdmin(false);
        return false;
      }

      // Network/transient errors should not permanently deny; keep current hint.
      setIsServerAdmin(localAdminHint ? true : null);
      return false;
    }
  }, [localAdminHint]);

  const loadRecent = useCallback(async (
    pageArg = recentPage,
    limitArg = recentLimit,
    userFilterArg = recentUserFilter,
    eventFilterArg = recentEventFilter,
    dayFilterArg = recentDayFilter
  ) => {
    const params = {
      page: pageArg,
      limit: limitArg
    };
    if (userFilterArg && userFilterArg.trim()) {
      params.user = userFilterArg.trim();
    }
    if (eventFilterArg && eventFilterArg.trim()) {
      params.event = eventFilterArg.trim();
    }
    if (dayFilterArg && dayFilterArg.trim()) {
      params.day = dayFilterArg.trim();
    }

    const response = await apiClient.get('/debug/socket-trace/recent', { params });
    const data = response?.data?.data || {};
    setRecent(data.traces || []);
    setRecentPages(data.pagination?.pages || 1);
    setRecentPage(data.pagination?.page || pageArg);
  }, [recentDayFilter, recentEventFilter, recentLimit, recentPage, recentUserFilter]);

  const loadAggregate = useCallback(async () => {
    const params = {
      days: aggDays,
      limit: aggLimit,
      maxDocs: aggMaxDocs
    };
    if (recentUserFilter && recentUserFilter.trim()) {
      params.user = recentUserFilter.trim();
    }

    const response = await apiClient.get('/debug/socket-trace/aggregate', { params });
    const data = response?.data?.data || {};
    setAggregate({
      overallTop: data.overallTop || [],
      perDay: data.perDay || [],
      scanned: data.scanned || null
    });
  }, [aggDays, aggLimit, aggMaxDocs, recentUserFilter]);

  const refreshAll = useCallback(async () => {
    setBusy('refresh');
    try {
      await Promise.all([
        loadRecent(recentPage, recentLimit, recentUserFilter, recentEventFilter, recentDayFilter),
        loadAggregate()
      ]);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load socket trace dashboard');
    } finally {
      setBusy('');
    }
  }, [loadAggregate, loadRecent, recentDayFilter, recentEventFilter, recentLimit, recentPage, recentUserFilter]);

  useEffect(() => {
    const params = new URLSearchParams();

    const userFilter = recentUserFilter.trim();
    const eventFilter = recentEventFilter.trim();
    const dayFilter = recentDayFilter.trim();

    if (userFilter) params.set('user', userFilter);
    if (eventFilter) params.set('event', eventFilter);
    if (dayFilter) params.set('day', dayFilter);
    if (recentPage > 1) params.set('page', String(recentPage));
    if (recentLimit !== 25) params.set('limit', String(recentLimit));
    if (aggDays !== 7) params.set('aggDays', String(aggDays));
    if (aggLimit !== 10) params.set('aggLimit', String(aggLimit));
    if (aggMaxDocs !== 1000) params.set('aggMaxDocs', String(aggMaxDocs));

    const next = params.toString();
    const current = currentLocation.search.replace(/^\?/, '');
    if (next !== current) {
      setSearchParams(params, { replace: true });
    }
  }, [
    aggDays,
    aggLimit,
    aggMaxDocs,
    currentLocation.search,
    recentDayFilter,
    recentEventFilter,
    recentLimit,
    recentPage,
    recentUserFilter,
    setSearchParams
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      try {
        const allowed = await ensureAdmin();
        if (!allowed) return;
        await refreshAll();
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [isAuthenticated, ensureAdmin, refreshAll]);

  const runReplay = async () => {
    setBusy('replay');
    setReplayResult(null);
    try {
      const payload = {
        maxLines: Number(replayPayload.maxLines) || 50,
        dryRun: Boolean(replayPayload.dryRun),
        emitToUser: Boolean(replayPayload.emitToUser)
      };

      if (replayPayload.traceId.trim()) payload.traceId = replayPayload.traceId.trim();
      if (replayPayload.userId.trim()) payload.userId = replayPayload.userId.trim();

      const response = await apiClient.post('/debug/socket-trace/replay', payload);
      const data = response?.data?.data || {};
      setReplayResult(data);
      toast.success(response?.data?.message || 'Replay request completed');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Replay request failed');
    } finally {
      setBusy('');
    }
  };

  const runExport = async () => {
    setBusy('export');
    setExportResult(null);
    try {
      const payload = {
        sinceMinutes: Number(exportPayload.sinceMinutes) || 60,
        limit: Number(exportPayload.limit) || 100
      };
      if (exportPayload.userId.trim()) payload.userId = exportPayload.userId.trim();

      const response = await apiClient.post('/debug/socket-trace/export', payload);
      setExportResult(response?.data?.data || null);
      toast.success(response?.data?.message || 'Export completed');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Export failed');
    } finally {
      setBusy('');
    }
  };

  const runAggregateDrilldown = useCallback(async (eventName, day = '') => {
    const normalizedEvent = String(eventName || '').trim();
    const normalizedDay = String(day || '').trim();
    if (!normalizedEvent) return;

    setRecentEventFilter(normalizedEvent);
    setRecentDayFilter(normalizedDay);
    setBusy('drilldown');

    try {
      await loadRecent(1, recentLimit, recentUserFilter, normalizedEvent, normalizedDay);

      if (typeof document !== 'undefined') {
        const section = document.getElementById('recent-traces-section');
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (error) {
      toast.error('Failed to open filtered recent traces');
    } finally {
      setBusy('');
    }
  }, [loadRecent, recentLimit, recentUserFilter]);

  const copyShareLink = useCallback(async () => {
    try {
      const url = typeof window !== 'undefined'
        ? window.location.href
        : `${currentLocation.pathname}${currentLocation.search}`;

      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }

      await navigator.clipboard.writeText(url);
      toast.success('Share link copied');
    } catch (error) {
      toast.error('Could not copy share link');
    }
  }, [currentLocation.pathname, currentLocation.search]);

  if (!isAuthenticated) {
    return (
      <div style={styles.root}>
        <p>Login required.</p>
        <button
          style={styles.button}
          onClick={() => navigate('/login', {
            state: {
              from: {
                pathname: currentLocation.pathname,
                search: currentLocation.search,
                hash: currentLocation.hash
              }
            }
          })}
        >
          Go to login
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.root}>
        <p>Loading socket trace dashboard...</p>
      </div>
    );
  }

  if (adminDenied || isServerAdmin === false) {
    return (
      <div style={styles.root}>
        <p>Admin access required.</p>
        <button style={styles.button} onClick={() => navigate('/dashboard')}>Back to dashboard</button>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.topBar}>
        <h1 style={styles.title}>Socket Trace Admin</h1>
        <div style={styles.row}>
          <button style={styles.button} onClick={() => navigate('/admin')}>Back to admin</button>
          <button style={styles.button} onClick={refreshAll} disabled={busy === 'refresh'}>
            {busy === 'refresh' ? 'Refreshing...' : 'Refresh'}
          </button>
          <button style={styles.button} onClick={copyShareLink}>Copy share link</button>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.subtitle}>Filters</h2>
        <div style={styles.row}>
          <input
            style={styles.input}
            value={recentUserFilter}
            onChange={(e) => setRecentUserFilter(e.target.value)}
            placeholder="Filter by user id"
          />
          <input
            style={styles.input}
            value={recentEventFilter}
            onChange={(e) => setRecentEventFilter(e.target.value)}
            placeholder="Filter by event"
          />
          <input
            style={styles.input}
            type="date"
            value={recentDayFilter}
            onChange={(e) => setRecentDayFilter(e.target.value)}
            placeholder="Filter day"
          />
          <input
            style={styles.input}
            type="number"
            min="1"
            max="200"
            value={recentLimit}
            onChange={(e) => setRecentLimit(Number(e.target.value || 25))}
            placeholder="Recent limit"
          />
          <button
            style={styles.button}
            onClick={async () => {
              setBusy('filter');
              try {
                await Promise.all([
                  loadRecent(1, recentLimit, recentUserFilter, recentEventFilter, recentDayFilter),
                  loadAggregate()
                ]);
              } catch (error) {
                toast.error('Failed to apply filter');
              } finally {
                setBusy('');
              }
            }}
            disabled={busy === 'filter'}
          >
            {busy === 'filter' ? 'Applying...' : 'Apply filter'}
          </button>
          <button
            style={styles.button}
            onClick={async () => {
              setBusy('clear-filter');
              setRecentEventFilter('');
              setRecentDayFilter('');
              try {
                await loadRecent(1, recentLimit, recentUserFilter, '', '');
              } catch (error) {
                toast.error('Failed to clear event/day filters');
              } finally {
                setBusy('');
              }
            }}
            disabled={busy === 'clear-filter'}
          >
            {busy === 'clear-filter' ? 'Clearing...' : 'Clear event/day'}
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.subtitle}>Failure Aggregation (Top Event Types Per Day)</h2>
        <div style={styles.row}>
          <input style={styles.input} type="number" min="1" max="90" value={aggDays} onChange={(e) => setAggDays(Number(e.target.value || 7))} placeholder="days" />
          <input style={styles.input} type="number" min="1" max="50" value={aggLimit} onChange={(e) => setAggLimit(Number(e.target.value || 10))} placeholder="top limit" />
          <input style={styles.input} type="number" min="1" max="5000" value={aggMaxDocs} onChange={(e) => setAggMaxDocs(Number(e.target.value || 1000))} placeholder="max docs" />
          <button
            style={styles.button}
            onClick={async () => {
              setBusy('aggregate');
              try {
                await loadAggregate();
              } catch (error) {
                toast.error('Aggregation refresh failed');
              } finally {
                setBusy('');
              }
            }}
            disabled={busy === 'aggregate'}
          >
            {busy === 'aggregate' ? 'Loading...' : 'Refresh aggregation'}
          </button>
        </div>

        <div style={styles.row}>
          {(aggregate.overallTop || []).map((item) => (
            <button
              key={`${item.event}-${item.count}`}
              style={{
                ...styles.chipButton,
                ...(recentEventFilter === item.event && !recentDayFilter ? styles.chipButtonActive : {})
              }}
              onClick={() => runAggregateDrilldown(item.event)}
              title="Jump to recent traces filtered by this event"
            >
              {item.event}: {fmtNumber(item.count)}
            </button>
          ))}
        </div>
        <p style={styles.muted}>Click an event chip to jump into pre-filtered Recent Traces.</p>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Day</th>
                <th style={styles.th}>Top failing events</th>
                <th style={styles.th}>Total failures</th>
              </tr>
            </thead>
            <tbody>
              {(aggregate.perDay || []).map((day) => (
                <tr key={day.day}>
                  <td style={styles.td}>{day.day}</td>
                  <td style={styles.td}>
                    {(day.topEvents || []).map((event) => (
                      <button
                        key={`${day.day}-${event.event}`}
                        style={{
                          ...styles.chipButton,
                          ...(recentEventFilter === event.event && recentDayFilter === day.day ? styles.chipButtonActive : {})
                        }}
                        onClick={() => runAggregateDrilldown(event.event, day.day)}
                        title={`Jump to recent traces for ${day.day}`}
                      >
                        {event.event}: {fmtNumber(event.count)}
                      </button>
                    ))}
                  </td>
                  <td style={styles.td}>{fmtNumber(day.totalFailures)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {aggregate.scanned ? (
          <p style={styles.muted}>
            Scanned docs: {fmtNumber(aggregate.scanned.documents)} | lines: {fmtNumber(aggregate.scanned.lines)} | failure lines: {fmtNumber(aggregate.scanned.failureLines)}
          </p>
        ) : null}
      </div>

      <div id="recent-traces-section" style={styles.card}>
        <h2 style={styles.subtitle}>Recent Traces</h2>
        {(recentEventFilter || recentDayFilter) ? (
          <div style={styles.row}>
            {recentEventFilter ? <span style={styles.chip}>event: {recentEventFilter}</span> : null}
            {recentDayFilter ? <span style={styles.chip}>day: {recentDayFilter}</span> : null}
          </div>
        ) : null}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Trace ID</th>
                <th style={styles.th}>User</th>
                <th style={styles.th}>Origin</th>
                <th style={styles.th}>Lines</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.id}>
                  <td style={styles.td}>{row.id}</td>
                  <td style={styles.td}>{row.userId}</td>
                  <td style={styles.td}>{row.origin}</td>
                  <td style={styles.td}>{fmtNumber(row.traceCount)}</td>
                  <td style={styles.td}>{fmtDate(row.createdAt)}</td>
                  <td style={styles.td}>
                    <button
                      style={styles.button}
                      onClick={() => setReplayPayload((prev) => ({ ...prev, traceId: row.id, userId: row.userId || prev.userId }))}
                    >
                      Use for replay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={styles.row}>
          <button
            style={styles.button}
            disabled={recentPage <= 1}
            onClick={() => loadRecent(Math.max(1, recentPage - 1), recentLimit, recentUserFilter, recentEventFilter, recentDayFilter)}
          >
            Prev
          </button>
          <span style={styles.muted}>Page {recentPage} / {recentPages}</span>
          <button
            style={styles.button}
            disabled={recentPage >= recentPages}
            onClick={() => loadRecent(Math.min(recentPages, recentPage + 1), recentLimit, recentUserFilter, recentEventFilter, recentDayFilter)}
          >
            Next
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.subtitle}>Replay Remediation</h2>
        <div style={styles.row}>
          <input style={styles.input} value={replayPayload.traceId} onChange={(e) => setReplayPayload((prev) => ({ ...prev, traceId: e.target.value }))} placeholder="traceId" />
          <input style={styles.input} value={replayPayload.userId} onChange={(e) => setReplayPayload((prev) => ({ ...prev, userId: e.target.value }))} placeholder="fallback userId" />
          <input style={styles.input} type="number" min="1" max="200" value={replayPayload.maxLines} onChange={(e) => setReplayPayload((prev) => ({ ...prev, maxLines: Number(e.target.value || 50) }))} placeholder="max lines" />
        </div>
        <div style={styles.row}>
          <label style={styles.muted}>
            <input type="checkbox" checked={replayPayload.dryRun} onChange={(e) => setReplayPayload((prev) => ({ ...prev, dryRun: e.target.checked }))} /> dryRun
          </label>
          <label style={styles.muted}>
            <input type="checkbox" checked={replayPayload.emitToUser} onChange={(e) => setReplayPayload((prev) => ({ ...prev, emitToUser: e.target.checked }))} /> emitToUser
          </label>
          <button style={styles.button} onClick={runReplay} disabled={busy === 'replay'}>
            {busy === 'replay' ? 'Running...' : 'Run replay'}
          </button>
        </div>
        {replayResult ? (
          <p style={styles.muted}>
            Replay result: traceId={replayResult.traceId || '-'}, lineCount={fmtNumber(replayResult.lineCount)}, emitted={String(replayResult.emitted)}
          </p>
        ) : null}
      </div>

      <div style={styles.card}>
        <h2 style={styles.subtitle}>Export Pipeline</h2>
        <div style={styles.row}>
          <input style={styles.input} type="number" min="1" max="10080" value={exportPayload.sinceMinutes} onChange={(e) => setExportPayload((prev) => ({ ...prev, sinceMinutes: Number(e.target.value || 60) }))} placeholder="sinceMinutes" />
          <input style={styles.input} type="number" min="1" max="500" value={exportPayload.limit} onChange={(e) => setExportPayload((prev) => ({ ...prev, limit: Number(e.target.value || 100) }))} placeholder="limit" />
          <input style={styles.input} value={exportPayload.userId} onChange={(e) => setExportPayload((prev) => ({ ...prev, userId: e.target.value }))} placeholder="optional userId" />
          <button style={styles.button} onClick={runExport} disabled={busy === 'export'}>
            {busy === 'export' ? 'Exporting...' : 'Export to sink'}
          </button>
        </div>
        {exportResult ? (
          <p style={styles.muted}>
            Export result: sink={exportResult.sink || '-'}, redaction={exportResult.redactionMode || '-'}, processed={fmtNumber(exportResult.processed)}, shipped={fmtNumber(exportResult.shipped)}, failed={fmtNumber(exportResult.failed)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
