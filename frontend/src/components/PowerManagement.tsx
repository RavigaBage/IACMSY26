import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

type Device = { _id: string; deviceName: string };
type Schedule = {
  _id: string; name: string; enabled: boolean; time: string; days: number[];
  timezone: string; targetType: 'all' | 'selected'; deviceIds: string[];
  graceSeconds: number; skipIfActiveSession: boolean; allowCancellation: boolean;
};
type ScheduleForm = Omit<Schedule, '_id' | 'enabled'>;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fresh = (deviceIds: string[]): ScheduleForm => ({ name: '', time: '18:00', days: [1, 2, 3, 4, 5], timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', targetType: 'selected', deviceIds, graceSeconds: 60, skipIfActiveSession: true, allowCancellation: true });

export function PowerManagement({ devices, selectedIds }: { devices: Device[]; selectedIds: string[] }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [form, setForm] = useState<ScheduleForm>(fresh(selectedIds));
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { success, error } = useToast();

  const load = useCallback(async () => {
    try { const data = await api.get('/api/iac/power/schedules'); setSchedules(Array.isArray(data) ? data : data?.data || []); }
    catch { error('Could not load power schedules.'); }
  }, [error]);
  useEffect(() => { void load(); }, [load]);
  const selectedKey = selectedIds.join(',');
  useEffect(() => {
    const selected = selectedKey ? selectedKey.split(',') : [];
    if (!editing && selected.length) setForm(current => current.deviceIds.length ? current : ({ ...current, deviceIds: selected }));
  }, [selectedKey, editing]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = form;
    if (payload.targetType === 'selected' && !payload.deviceIds.length) { error('Select at least one computer in the device list.'); return; }
    setBusy(true);
    try {
      if (editing) await api.patch(`/api/iac/power/schedules/${editing}`, payload);
      else await api.post('/api/iac/power/schedules', payload);
      success(editing ? 'Schedule updated.' : 'Schedule created.');
      setEditing(null); setForm(fresh(selectedIds)); await load();
    } catch (err: any) { error(err?.message || 'Could not save schedule.'); }
    finally { setBusy(false); }
  };

  const edit = (item: Schedule) => {
    setEditing(item._id);
    setForm({ name: item.name, time: item.time, days: item.days, timezone: item.timezone, targetType: item.targetType, deviceIds: item.deviceIds || [], graceSeconds: item.graceSeconds, skipIfActiveSession: item.skipIfActiveSession, allowCancellation: item.allowCancellation });
  };

  const toggleDay = (day: number) => setForm(current => ({ ...current, days: current.days.includes(day) ? current.days.filter(d => d !== day) : [...current.days, day].sort() }));
  const updateSchedule = async (item: Schedule, changes: Partial<Schedule>) => {
    try { await api.patch(`/api/iac/power/schedules/${item._id}`, changes); await load(); }
    catch (err: any) { error(err?.message || 'Could not update schedule.'); }
  };
  const remove = async (item: Schedule) => {
    if (!window.confirm(`Delete “${item.name}”?`)) return;
    try { await api.delete(`/api/iac/power/schedules/${item._id}`); await load(); success('Schedule deleted.'); }
    catch (err: any) { error(err?.message || 'Could not delete schedule.'); }
  };

  return <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-zinc-900">Laboratory power management</h2><p className="mt-1 text-xs text-zinc-500">Schedules use {form.timezone}; Wake-on-LAN needs a reachable device network.</p></div>
      <p className="text-xs text-zinc-500">Select a power command in Device commands. Schedules can be managed below.</p>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(260px,0.8fr)_1.2fr]">
      <form onSubmit={save} className="space-y-3 rounded-xl bg-zinc-50 p-4">
        <h3 className="text-sm font-semibold">{editing ? 'Edit sleep schedule' : 'Create sleep schedule'}</h3>
        <input className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Schedule name" required maxLength={80} />
        <div className="flex gap-2"><input aria-label="Sleep time" type="time" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /><input aria-label="Timezone" className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} /></div>
        <div className="flex flex-wrap gap-2">{DAY_NAMES.map((label, day) => <label key={label} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={form.days.includes(day)} onChange={() => toggleDay(day)} />{label}</label>)}</div>
        <select className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" value={form.targetType} onChange={e => setForm({ ...form, targetType: e.target.value as 'all' | 'selected', deviceIds: e.target.value === 'selected' ? selectedIds : [] })}><option value="selected">Selected computers ({selectedIds.length})</option><option value="all">All online, sleep-enabled computers</option></select>
        {form.targetType === 'selected' && <div className="max-h-28 space-y-1 overflow-auto rounded-lg border border-zinc-200 bg-white p-2">
          <p className="mb-1 text-xs text-zinc-500">Choose computers for this schedule</p>
          {devices.map(device => <label key={device._id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.deviceIds.includes(device._id)} onChange={e => setForm(current => ({ ...current, deviceIds: e.target.checked ? [...new Set([...current.deviceIds, device._id])] : current.deviceIds.filter(id => id !== device._id) }))} />{device.deviceName}</label>)}
        </div>}
        <label className="flex items-center gap-2 text-xs text-zinc-700">Grace period <input type="number" min="0" max="600" className="w-20 rounded border border-zinc-200 px-2 py-1" value={form.graceSeconds} onChange={e => setForm({ ...form, graceSeconds: Number(e.target.value) })} />seconds</label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.skipIfActiveSession} onChange={e => setForm({ ...form, skipIfActiveSession: e.target.checked })} />Skip if a user session is active</label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.allowCancellation} onChange={e => setForm({ ...form, allowCancellation: e.target.checked })} />Allow cancellation during grace period</label>
        <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50">{editing ? 'Save changes' : 'Create schedule'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(fresh(selectedIds)); }} className="rounded-lg border px-3 py-2 text-sm">Cancel edit</button>}</div>
      </form>
      <div className="space-y-2">
        {schedules.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-zinc-500">No sleep schedules yet.</p> : schedules.map(item => <article key={item._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3">
          <div><div className="font-medium text-sm">{item.name}</div><div className="text-xs text-zinc-500">{item.time} · {item.days.map(day => DAY_NAMES[day]).join(', ')} · {item.targetType === 'all' ? 'All online computers' : `${item.deviceIds.length} selected`}</div><div className="text-xs text-zinc-400">{item.timezone} · {item.graceSeconds}s grace</div></div>
          <div className="flex items-center gap-2"><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={item.enabled} onChange={e => void updateSchedule(item, { enabled: e.target.checked })} />Enabled</label><button onClick={() => edit(item)} className="rounded border px-2 py-1 text-xs">Edit</button><button onClick={() => void api.post(`/api/iac/power/schedules/${item._id}/cancel`, {}).then(() => success('Pending sleep cancellation sent.')).catch((err: any) => error(err.message || 'Could not cancel pending sleep.'))} disabled={!item.allowCancellation} className="rounded border px-2 py-1 text-xs disabled:opacity-40">Cancel pending</button><button onClick={() => void remove(item)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700">Delete</button></div>
        </article>)}
      </div>
    </div>
  </section>;
}
