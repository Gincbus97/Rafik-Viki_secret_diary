import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link } from 'react-router-dom';
import type { SessionRow, Character } from '@/lib/types';

export default function SessionsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);

  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions').select('*')
        .order('number', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as SessionRow[];
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
    mutationFn: async () => {
      const nextN = (sessions.data?.[0]?.number ?? 0) + 1;
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          number: nextN,
          date: new Date().toISOString().slice(0,10),
          title: '',
          summary: '',
          created_by: user?.id ?? null,
        })
        .select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ['sessions'] }); setOpenId(id as string); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="heading">🌙 Сессии</h1>
        <button className="btn-primary" onClick={() => create.mutate()}>+ Новая сессия</button>
      </div>

      {sessions.isLoading ? <p className="subtle">...</p> :
        (sessions.data ?? []).length === 0 ? (
          <div className="card text-center text-ash">Хроника ещё не началась.</div>
        ) : (
          <div className="space-y-2">
            {sessions.data!.map(s => (
              <SessionItem
                key={s.id}
                session={s}
                expanded={openId === s.id}
                onToggle={() => setOpenId(openId === s.id ? null : s.id)}
                characters={characters.data ?? []}
              />
            ))}
          </div>
        )}
    </div>
  );
}

function SessionItem({
  session, expanded, onToggle, characters,
}: {
  session: SessionRow;
  expanded: boolean;
  onToggle: () => void;
  characters: Pick<Character,'id'|'name'|'is_pc'>[];
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<SessionRow>>(session);
  useEffect(() => setDraft(session), [session]);

  const attendees = useQuery({
    queryKey: ['session-att', session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_attendees').select('character_id, characters(id,name,is_pc)').eq('session_id', session.id);
      if (error) throw error;
      return (data as any[]).map(r => r.characters) as Pick<Character,'id'|'name'|'is_pc'>[];
    },
    enabled: expanded,
  });

  const save = useMutation({
    mutationFn: async () => {
      const patch: any = { ...draft };
      delete patch.id;
      ['title','summary','events','new_npcs','rel_changes'].forEach(k => { if (patch[k] === '') patch[k] = null; });
      const { error } = await supabase.from('sessions').update(patch).eq('id', session.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const addAtt = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await supabase
        .from('session_attendees').insert({ session_id: session.id, character_id: cid });
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session-att', session.id] }),
  });

  const removeAtt = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await supabase
        .from('session_attendees').delete().eq('session_id', session.id).eq('character_id', cid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session-att', session.id] }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sessions').delete().eq('id', session.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });

  if (!expanded) {
    return (
      <button onClick={onToggle} className="card card-hover w-full text-left">
        <div className="flex items-center gap-3">
          <div className="text-3xl font-display text-rose w-12 shrink-0 text-center">
            #{session.number ?? '?'}
          </div>
          <div className="flex-1">
            <p className="font-display text-lg">
              {session.title || 'Без названия'}
              {session.date && <span className="ml-2 subtle text-sm">{session.date}</span>}
            </p>
            {session.summary && <p className="subtle line-clamp-2">{session.summary}</p>}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 items-end flex-1">
          <div>
            <label className="label">№</label>
            <input type="number" className="input w-20" value={draft.number ?? ''} onChange={e => setDraft(d => ({...d, number: e.target.value ? parseInt(e.target.value) : null}))} onBlur={() => save.mutate()} />
          </div>
          <div>
            <label className="label">Дата</label>
            <input type="date" className="input" value={draft.date ?? ''} onChange={e => { setDraft(d => ({...d, date: e.target.value || null})); save.mutate(); }} />
          </div>
          <div className="flex-1">
            <label className="label">Название</label>
            <input className="input" value={draft.title ?? ''} onChange={e => setDraft(d => ({...d, title: e.target.value}))} onBlur={() => save.mutate()} />
          </div>
        </div>
        <button onClick={onToggle} className="btn-ghost text-sm">свернуть</button>
      </div>
      <div>
        <label className="label">Краткое содержание</label>
        <textarea className="input min-h-[80px]" value={draft.summary ?? ''} onChange={e => setDraft(d => ({...d, summary: e.target.value}))} onBlur={() => save.mutate()} />
      </div>
      <div>
        <label className="label">События</label>
        <textarea className="input min-h-[80px]" value={draft.events ?? ''} onChange={e => setDraft(d => ({...d, events: e.target.value}))} onBlur={() => save.mutate()} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="label">Новые NPC</label>
          <textarea className="input" value={draft.new_npcs ?? ''} onChange={e => setDraft(d => ({...d, new_npcs: e.target.value}))} onBlur={() => save.mutate()} />
        </div>
        <div>
          <label className="label">Изменения в связях</label>
          <textarea className="input" value={draft.rel_changes ?? ''} onChange={e => setDraft(d => ({...d, rel_changes: e.target.value}))} onBlur={() => save.mutate()} />
        </div>
      </div>
      <div>
        <label className="label">Участники</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {(attendees.data ?? []).filter(Boolean).map(c => (
            <span key={c.id} className="chip">
              <Link to={`/characters/${c.id}`} className="link">{c.name}</Link>
              <button onClick={() => removeAtt.mutate(c.id)} className="ml-1 text-rose">×</button>
            </span>
          ))}
        </div>
        <select className="input" value="" onChange={e => { if (e.target.value) addAtt.mutate(e.target.value); }}>
          <option value="">+ добавить...</option>
          {characters
            .filter(c => !(attendees.data ?? []).some(a => a?.id === c.id))
            .map(c => <option key={c.id} value={c.id}>{c.name} {c.is_pc ? '(PC)' : ''}</option>)}
        </select>
      </div>
      <button className="btn-danger text-sm" onClick={() => { if (confirm('Удалить сессию?')) remove.mutate(); }}>
        Удалить сессию
      </button>
    </div>
  );
}
