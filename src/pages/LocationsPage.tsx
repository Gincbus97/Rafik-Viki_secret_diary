import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { LocationItem, LocationKind, Character, Faction } from '@/lib/types';

const KINDS: LocationKind[] = ['haven','elysium','hunting_ground','business','other'];
const KIND_LABEL: Record<LocationKind, string> = {
  haven:           '🏚 Haven',
  elysium:         '🕯 Elysium',
  hunting_ground:  '🩸 Hunting ground',
  business:        '🏢 Business',
  other:           '· Other',
};

export default function LocationsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const locations = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('*').order('name');
      if (error) throw error;
      return data as LocationItem[];
    },
  });

  const characters = useQuery({
    queryKey: ['characters-mini'],
    queryFn: async () => {
      const { data, error } = await supabase.from('characters').select('id,name').order('name');
      if (error) throw error;
      return data as Pick<Character,'id'|'name'>[];
    },
  });

  const factions = useQuery({
    queryKey: ['factions-mini'],
    queryFn: async () => {
      const { data, error } = await supabase.from('factions').select('id,name').order('name');
      if (error) throw error;
      return data as Pick<Faction,'id'|'name'>[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .insert({ name: 'Новое место', kind: 'other', created_by: user?.id ?? null })
        .select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="heading">🗝 Локации</h1>
        <button className="btn-primary" onClick={() => create.mutate()}>+ Новая</button>
      </div>

      {locations.isLoading ? <p className="subtle">...</p> :
       (locations.data ?? []).length === 0 ? (
        <div className="card text-center text-ash">Места ещё не отмечены на карте.</div>
       ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {locations.data!.map(l => (
            <LocationCard key={l.id} loc={l} characters={characters.data ?? []} factions={factions.data ?? []} />
          ))}
        </div>
       )}
    </div>
  );
}

function LocationCard({
  loc, characters, factions,
}: {
  loc: LocationItem;
  characters: Pick<Character,'id'|'name'>[];
  factions:   Pick<Faction,'id'|'name'>[];
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<LocationItem>>(loc);
  useEffect(() => setDraft(loc), [loc]);

  const save = useMutation({
    mutationFn: async () => {
      const patch: any = { ...draft };
      delete patch.id;
      ['description','notes'].forEach(k => { if (patch[k] === '') patch[k] = null; });
      const { error } = await supabase.from('locations').update(patch).eq('id', loc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('locations').delete().eq('id', loc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });

  return (
    <div className="card space-y-2">
      <input className="input text-lg font-display" value={draft.name ?? ''} onChange={e => setDraft(d => ({...d, name: e.target.value}))} onBlur={() => save.mutate()} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Тип</label>
          <select className="input" value={draft.kind ?? 'other'} onChange={e => { setDraft(d => ({...d, kind: e.target.value as LocationKind})); save.mutate(); }}>
            {KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Владелец-персонаж</label>
          <select
            className="input"
            value={draft.owner_character_id ?? ''}
            onChange={e => { setDraft(d => ({...d, owner_character_id: e.target.value || null, owner_faction_id: e.target.value ? null : d.owner_faction_id ?? null })); save.mutate(); }}
          >
            <option value="">— нет —</option>
            {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">...или владелец-фракция</label>
          <select
            className="input"
            value={draft.owner_faction_id ?? ''}
            onChange={e => { setDraft(d => ({...d, owner_faction_id: e.target.value || null, owner_character_id: e.target.value ? null : d.owner_character_id ?? null })); save.mutate(); }}
          >
            <option value="">— нет —</option>
            {factions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Описание</label>
        <textarea className="input" value={draft.description ?? ''} onChange={e => setDraft(d => ({...d, description: e.target.value}))} onBlur={() => save.mutate()} />
      </div>
      <div>
        <label className="label">Заметки</label>
        <textarea className="input" value={draft.notes ?? ''} onChange={e => setDraft(d => ({...d, notes: e.target.value}))} onBlur={() => save.mutate()} />
      </div>
      <button className="btn-danger text-sm" onClick={() => { if (confirm('Удалить локацию?')) remove.mutate(); }}>
        Удалить
      </button>
    </div>
  );
}
