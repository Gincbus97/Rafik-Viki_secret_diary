import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link } from 'react-router-dom';
import type { Faction, FactionKind, Character } from '@/lib/types';

const KINDS: FactionKind[] = ['sect','coterie','cult','package','other'];

export default function FactionsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

  const factions = useQuery({
    queryKey: ['factions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('factions').select('*').order('name');
      if (error) throw error;
      return data as Faction[];
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
      const { data, error } = await supabase
        .from('factions').insert({ name: 'Безымянная коттери', kind: 'coterie', created_by: user?.id ?? null })
        .select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ['factions'] }); setSelected(id); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="heading">🜲 Фракции и Коттери</h1>
        <button className="btn-primary" onClick={() => create.mutate()}>+ Новая</button>
      </div>

      {factions.isLoading ? <p className="subtle">...</p> :
       (factions.data ?? []).length === 0 ? (
        <div className="card text-center text-ash">Создай первую фракцию.</div>
       ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {factions.data!.map(f => (
            <div key={f.id} className="card space-y-2">
              <FactionCard faction={f} characters={characters.data ?? []} expanded={selected === f.id} onToggle={() => setSelected(selected === f.id ? null : f.id)} />
            </div>
          ))}
        </div>
       )}
    </div>
  );
}

function FactionCard({
  faction, characters, expanded, onToggle,
}: {
  faction: Faction;
  characters: Pick<Character,'id'|'name'|'is_pc'>[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<Faction>>(faction);

  useEffect(() => setDraft(faction), [faction]);

  const members = useQuery({
    queryKey: ['faction-members', faction.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faction_members').select('character_id, characters(id,name,is_pc)').eq('faction_id', faction.id);
      if (error) throw error;
      return (data as any[]).map(r => r.characters) as Pick<Character,'id'|'name'|'is_pc'>[];
    },
    enabled: expanded,
  });

  const save = useMutation({
    mutationFn: async () => {
      const patch: any = { ...draft };
      delete patch.id;
      ['description','territory','goals','notes'].forEach(k => { if (patch[k] === '') patch[k] = null; });
      const { error } = await supabase.from('factions').update(patch).eq('id', faction.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['factions'] }),
  });

  const addMember = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await supabase.from('faction_members').insert({ faction_id: faction.id, character_id: cid });
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faction-members', faction.id] }),
  });

  const removeMember = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await supabase.from('faction_members').delete().eq('faction_id', faction.id).eq('character_id', cid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faction-members', faction.id] }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('factions').delete().eq('id', faction.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['factions'] }),
  });

  if (!expanded) {
    return (
      <button onClick={onToggle} className="text-left w-full">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg">{faction.name}</p>
          <span className="chip">{faction.kind}</span>
        </div>
        {faction.description && <p className="subtle line-clamp-2 mt-1">{faction.description}</p>}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-start gap-2">
        <input className="input text-lg font-display flex-1" value={draft.name ?? ''} onChange={e => setDraft(d => ({...d, name: e.target.value}))} onBlur={() => save.mutate()} />
        <button onClick={onToggle} className="btn-ghost text-sm">свернуть</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Тип</label>
          <select className="input" value={draft.kind ?? 'coterie'} onChange={e => { setDraft(d => ({...d, kind: e.target.value as FactionKind})); save.mutate(); }}>
            {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Лидер</label>
          <select className="input" value={draft.leader_id ?? ''} onChange={e => { setDraft(d => ({...d, leader_id: e.target.value || null})); save.mutate(); }}>
            <option value="">— нет —</option>
            {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Территория</label>
        <input className="input" value={draft.territory ?? ''} onChange={e => setDraft(d => ({...d, territory: e.target.value}))} onBlur={() => save.mutate()} />
      </div>
      <div>
        <label className="label">Цели</label>
        <textarea className="input" value={draft.goals ?? ''} onChange={e => setDraft(d => ({...d, goals: e.target.value}))} onBlur={() => save.mutate()} />
      </div>
      <div>
        <label className="label">Описание</label>
        <textarea className="input" value={draft.description ?? ''} onChange={e => setDraft(d => ({...d, description: e.target.value}))} onBlur={() => save.mutate()} />
      </div>
      <div>
        <label className="label">Заметки</label>
        <textarea className="input" value={draft.notes ?? ''} onChange={e => setDraft(d => ({...d, notes: e.target.value}))} onBlur={() => save.mutate()} />
      </div>

      <div>
        <label className="label">Участники</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {(members.data ?? []).filter(Boolean).map(c => (
            <span key={c.id} className="chip">
              <Link to={`/characters/${c.id}`} className="link">{c.name}</Link>
              <button onClick={() => removeMember.mutate(c.id)} className="ml-1 text-rose">×</button>
            </span>
          ))}
        </div>
        <select className="input" value="" onChange={e => { if (e.target.value) addMember.mutate(e.target.value); }}>
          <option value="">+ добавить участника...</option>
          {characters
            .filter(c => !(members.data ?? []).some(m => m?.id === c.id))
            .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <button className="btn-danger text-sm" onClick={() => { if (confirm('Удалить фракцию?')) remove.mutate(); }}>
        Удалить фракцию
      </button>
    </div>
  );
}
