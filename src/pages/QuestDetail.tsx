import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Quest, QuestObjective, QuestStatus, Character, LocationItem } from '@/lib/types';

const STATUSES: QuestStatus[] = ['Active','OnHold','Completed','Failed'];
const STATUS_LABEL: Record<QuestStatus, string> = {
  Active: 'Активный', OnHold: 'На паузе', Completed: 'Завершён', Failed: 'Провален',
};

export default function QuestDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [draft, setDraft] = useState<Partial<Quest>>({});
  const [newObj, setNewObj] = useState('');

  const quest = useQuery({
    queryKey: ['quest', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('quests').select('*').eq('id', id!).single();
      if (error) throw error;
      return data as unknown as Quest;
    },
    enabled: !!id,
  });

  const objectives = useQuery({
    queryKey: ['quest-obj', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quest_objectives').select('*').eq('quest_id', id!).order('position');
      if (error) throw error;
      return data as unknown as QuestObjective[];
    },
    enabled: !!id,
  });

  const characters = useQuery({
    queryKey: ['characters-mini'],
    queryFn: async () => {
      const { data, error } = await supabase.from('characters').select('id,name,is_pc').order('name');
      if (error) throw error;
      return data as unknown as Pick<Character,'id'|'name'|'is_pc'>[];
    },
  });

  const locations = useQuery({
    queryKey: ['locations-mini'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('id,name').order('name');
      if (error) throw error;
      return data as unknown as Pick<LocationItem,'id'|'name'>[];
    },
  });

  const questChars = useQuery({
    queryKey: ['quest-chars', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quest_characters')
        .select('character_id, characters(id,name,is_pc)')
        .eq('quest_id', id!);
      if (error) throw error;
      return (data as unknown as any[]).map(r => r.characters) as unknown as Pick<Character,'id'|'name'|'is_pc'>[];
    },
    enabled: !!id,
  });

  const questLocs = useQuery({
    queryKey: ['quest-locs', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quest_locations').select('location_id, locations(id,name)').eq('quest_id', id!);
      if (error) throw error;
      return (data as unknown as any[]).map(r => r.locations) as unknown as Pick<LocationItem,'id'|'name'>[];
    },
    enabled: !!id,
  });

  useEffect(() => { if (quest.data) setDraft(quest.data); }, [quest.data]);

  const save = useMutation({
    mutationFn: async () => {
      const patch: any = { ...draft };
      delete patch.id;
      ['description','reward','notes'].forEach(k => { if (patch[k] === '') patch[k] = null; });
      if (patch.status === 'Completed' || patch.status === 'Failed') {
        if (!patch.finished_at) patch.finished_at = new Date().toISOString().slice(0,10);
      }
      const { error } = await supabase.from('quests').update(patch).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quest', id] });
      qc.invalidateQueries({ queryKey: ['quests'] });
    },
  });

  const addObj = useMutation({
    mutationFn: async () => {
      if (!newObj.trim()) return;
      const pos = (objectives.data?.length ?? 0);
      const { error } = await supabase
        .from('quest_objectives')
        .insert({ quest_id: id, text: newObj.trim(), position: pos });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewObj('');
      qc.invalidateQueries({ queryKey: ['quest-obj', id] });
    },
  });

  const toggleObj = useMutation({
    mutationFn: async (o: QuestObjective) => {
      const { error } = await supabase
        .from('quest_objectives').update({ done: !o.done }).eq('id', o.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quest-obj', id] }),
  });

  const deleteObj = useMutation({
    mutationFn: async (oid: string) => {
      const { error } = await supabase.from('quest_objectives').delete().eq('id', oid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quest-obj', id] }),
  });

  const addCharLink = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await supabase
        .from('quest_characters')
        .insert({ quest_id: id, character_id: cid });
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quest-chars', id] }),
  });

  const removeCharLink = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await supabase
        .from('quest_characters').delete().eq('quest_id', id).eq('character_id', cid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quest-chars', id] }),
  });

  const addLocLink = useMutation({
    mutationFn: async (lid: string) => {
      const { error } = await supabase
        .from('quest_locations').insert({ quest_id: id, location_id: lid });
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quest-locs', id] }),
  });

  const removeLocLink = useMutation({
    mutationFn: async (lid: string) => {
      const { error } = await supabase
        .from('quest_locations').delete().eq('quest_id', id).eq('location_id', lid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quest-locs', id] }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('quests').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quests'] });
      nav('/quests');
    },
  });

  if (quest.isLoading) return <p className="subtle">...</p>;
  if (!quest.data) return <p className="text-rose">Квест не найден.</p>;

  function set<K extends keyof Quest>(k: K, v: Quest[K]) {
    setDraft(d => ({ ...d, [k]: v }));
  }

  const completed = (objectives.data ?? []).filter(o => o.done).length;
  const total     = (objectives.data ?? []).length;

  return (
    <div className="space-y-4">
      <Link to="/quests" className="link text-sm">← к списку квестов</Link>

      <div className="card space-y-3">
        <input
          className="input text-2xl font-display"
          value={draft.title ?? ''}
          onChange={e => set('title', e.target.value)}
          onBlur={() => save.mutate()}
        />
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="label">Статус</label>
            <select className="input" value={draft.status ?? 'Active'} onChange={e => { set('status', e.target.value as QuestStatus); save.mutate(); }}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Заказчик</label>
            <select className="input" value={draft.giver_id ?? ''} onChange={e => { set('giver_id', e.target.value || null); save.mutate(); }}>
              <option value="">— нет —</option>
              {(characters.data ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Награда</label>
            <input className="input" value={draft.reward ?? ''} onChange={e => set('reward', e.target.value)} onBlur={() => save.mutate()} />
          </div>
          <div>
            <label className="label">Дата получения</label>
            <input type="date" className="input" value={draft.received_at ?? ''} onChange={e => { set('received_at', e.target.value || null); save.mutate(); }} />
          </div>
          <div>
            <label className="label">Дата завершения</label>
            <input type="date" className="input" value={draft.finished_at ?? ''} onChange={e => { set('finished_at', e.target.value || null); save.mutate(); }} />
          </div>
        </div>
        <div>
          <label className="label">Описание</label>
          <textarea className="input min-h-[100px]" value={draft.description ?? ''} onChange={e => set('description', e.target.value)} onBlur={() => save.mutate()} />
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl">✅ Цели</h2>
          <span className="subtle text-sm">{completed} / {total}</span>
        </div>
        <ul className="space-y-1.5">
          {(objectives.data ?? []).map(o => (
            <li key={o.id} className="flex items-start gap-2 group">
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 accent-blood"
                checked={o.done}
                onChange={() => toggleObj.mutate(o)}
              />
              <span className={`flex-1 ${o.done ? 'line-through text-ash' : 'text-bone'}`}>{o.text}</span>
              <button className="opacity-0 group-hover:opacity-100 text-rose text-sm" onClick={() => deleteObj.mutate(o.id)}>×</button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); addObj.mutate(); }}
        >
          <input className="input flex-1" placeholder="новая цель..." value={newObj} onChange={e => setNewObj(e.target.value)} />
          <button className="btn-ghost text-sm">+</button>
        </form>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card space-y-2">
          <h2 className="text-xl">👤 Персонажи в квесте</h2>
          <div className="flex flex-wrap gap-2">
            {(questChars.data ?? []).filter(Boolean).map(c => (
              <span key={c.id} className="chip">
                <Link className="link" to={`/characters/${c.id}`}>{c.name}</Link>
                <button className="ml-1 text-rose" onClick={() => removeCharLink.mutate(c.id)}>×</button>
              </span>
            ))}
          </div>
          <select
            className="input"
            value=""
            onChange={(e) => { if (e.target.value) addCharLink.mutate(e.target.value); }}
          >
            <option value="">+ добавить персонажа...</option>
            {(characters.data ?? [])
              .filter(c => !(questChars.data ?? []).some(qc => qc?.id === c.id))
              .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="card space-y-2">
          <h2 className="text-xl">🗝 Локации</h2>
          <div className="flex flex-wrap gap-2">
            {(questLocs.data ?? []).filter(Boolean).map(l => (
              <span key={l.id} className="chip">
                {l.name}
                <button className="ml-1 text-rose" onClick={() => removeLocLink.mutate(l.id)}>×</button>
              </span>
            ))}
          </div>
          <select
            className="input"
            value=""
            onChange={(e) => { if (e.target.value) addLocLink.mutate(e.target.value); }}
          >
            <option value="">+ добавить локацию...</option>
            {(locations.data ?? [])
              .filter(l => !(questLocs.data ?? []).some(ql => ql?.id === l.id))
              .map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <label className="label">Заметки</label>
        <textarea className="input min-h-[80px]" value={draft.notes ?? ''} onChange={e => set('notes', e.target.value)} onBlur={() => save.mutate()} />
      </div>

      <div className="flex gap-2">
        <button className="btn-danger" onClick={() => { if (confirm('Удалить квест?')) remove.mutate(); }}>
          Удалить квест
        </button>
      </div>
    </div>
  );
}
