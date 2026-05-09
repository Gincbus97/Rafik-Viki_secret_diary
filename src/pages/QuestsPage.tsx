import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Quest, QuestStatus, Character } from '@/lib/types';

const STATUSES: QuestStatus[] = ['Active','OnHold','Completed','Failed'];

const STATUS_LABEL: Record<QuestStatus, string> = {
  Active:    'Активные',
  OnHold:    'На паузе',
  Completed: 'Завершённые',
  Failed:    'Провалены',
};

const STATUS_COLOR: Record<QuestStatus, string> = {
  Active:    'border-blood/40 bg-blood/10',
  OnHold:    'border-gold/30  bg-gold/10',
  Completed: 'border-emerald-700/40 bg-emerald-900/20',
  Failed:    'border-rose/40 bg-rose/10',
};

export default function QuestsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [statusFilter, setStatusFilter] = useState<QuestStatus | 'all'>('all');
  const [giverFilter, setGiverFilter] = useState<string>('');
  const [q, setQ] = useState('');

  const quests = useQuery({
    queryKey: ['quests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quests')
        .select('id,title,status,description,reward,giver_id,received_at,finished_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Quest[];
    },
  });

  const characters = useQuery({
    queryKey: ['characters-mini'],
    queryFn: async () => {
      const { data, error } = await supabase.from('characters').select('id,name,is_pc').order('name');
      if (error) throw error;
      return data as Pick<Character,'id'|'name'|'is_pc'>[];
    },
  });

  const create = useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await supabase
        .from('quests')
        .insert({ title, status: 'Active', created_by: user?.id ?? null })
        .select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: QuestStatus }) => {
      const patch: Partial<Quest> = { status };
      if (status === 'Completed' || status === 'Failed') patch.finished_at = new Date().toISOString().slice(0,10);
      const { error } = await supabase.from('quests').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }),
  });

  const giverName = (id: string | null) =>
    characters.data?.find(c => c.id === id)?.name ?? null;

  const filtered = useMemo(() => {
    if (!quests.data) return [];
    return quests.data.filter(qu => {
      if (statusFilter !== 'all' && qu.status !== statusFilter) return false;
      if (giverFilter && qu.giver_id !== giverFilter) return false;
      if (q && !qu.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [quests.data, statusFilter, giverFilter, q]);

  const [newTitle, setNewTitle] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="heading">📜 Квесты</h1>
        <div className="flex gap-1 bg-velvet/40 p-1 rounded-lg">
          <button className={`px-3 py-1 rounded text-sm ${view==='list'?'bg-blood text-bone':'text-ash'}`} onClick={() => setView('list')}>Список</button>
          <button className={`px-3 py-1 rounded text-sm ${view==='kanban'?'bg-blood text-bone':'text-ash'}`} onClick={() => setView('kanban')}>Канбан</button>
        </div>
      </div>

      <form
        className="card flex gap-2 items-end"
        onSubmit={async e => {
          e.preventDefault();
          if (!newTitle.trim()) return;
          const id = await create.mutateAsync(newTitle.trim());
          setNewTitle('');
          window.location.assign(`/quests/${id}`);
        }}
      >
        <div className="flex-1">
          <label className="label">Быстро добавить квест</label>
          <input className="input" placeholder="Найти исчезнувшего гуля Принца..." value={newTitle} onChange={e => setNewTitle(e.target.value)} />
        </div>
        <button className="btn-primary">+ Создать</button>
      </form>

      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Статус</label>
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="all">— любой —</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Заказчик</label>
          <select className="input" value={giverFilter} onChange={e => setGiverFilter(e.target.value)}>
            <option value="">— любой —</option>
            {(characters.data ?? []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="label">Поиск</label>
          <input className="input" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {quests.isLoading ? (
        <p className="subtle">Принц шепчет...</p>
      ) : view === 'list' ? (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="card text-center text-ash">Ничего не найдено.</div>
          ) : (
            filtered.map(qu => (
              <div key={qu.id}
                className={`card card-hover flex justify-between gap-3 items-center border ${STATUS_COLOR[qu.status]}`}>
                <Link to={`/quests/${qu.id}`} className="min-w-0 flex-1 -m-5 p-5">
                  <p className="font-display text-lg truncate">{qu.title}</p>
                  {qu.description && <p className="subtle line-clamp-1">{qu.description}</p>}
                  <div className="text-xs text-ash mt-1 flex flex-wrap gap-x-3">
                    {giverName(qu.giver_id) && <span>заказчик: <span className="text-bone">{giverName(qu.giver_id)}</span></span>}
                    {qu.received_at && <span>получен: {qu.received_at}</span>}
                    {qu.finished_at && <span>завершён: {qu.finished_at}</span>}
                  </div>
                </Link>
                <select
                  className="input w-36 shrink-0"
                  value={qu.status}
                  onChange={(e) => updateStatus.mutate({ id: qu.id, status: e.target.value as QuestStatus })}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['Active','Completed','Failed'] as QuestStatus[]).map(s => (
            <div key={s} className={`card border ${STATUS_COLOR[s]}`}>
              <h3 className="text-lg mb-2">{STATUS_LABEL[s]}</h3>
              <div className="space-y-2">
                {filtered.filter(qu => qu.status === s).map(qu => (
                  <Link key={qu.id} to={`/quests/${qu.id}`} className="block bg-velvet/40 rounded-lg p-2 hover:bg-velvet/60">
                    <p className="text-bone">{qu.title}</p>
                    {qu.description && <p className="subtle text-xs line-clamp-2">{qu.description}</p>}
                  </Link>
                ))}
                {filtered.filter(qu => qu.status === s).length === 0 && (
                  <p className="text-ash text-xs">пусто</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
