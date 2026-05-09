import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Character, Relationship, RelationshipType } from '@/lib/types';

interface RelView extends Relationship {
  from?: Pick<Character,'id'|'name'|'is_pc'>;
  to?:   Pick<Character,'id'|'name'|'is_pc'>;
  type?: Pick<RelationshipType,'id'|'name'>;
}

interface Props {
  characterId: string;
  filter: 'all' | 'pc' | 'npc';
}

export default function RelationshipsBlock({ characterId, filter }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const rels = useQuery({
    queryKey: ['rels', characterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relationships')
        .select(`
          id, from_character_id, to_character_id, type_id,
          description, started_at_date, started_at_session, strength,
          created_by, created_at,
          from:characters!relationships_from_character_id_fkey(id,name,is_pc),
          to:characters!relationships_to_character_id_fkey(id,name,is_pc),
          type:relationship_types(id,name)
        `)
        .or(`from_character_id.eq.${characterId},to_character_id.eq.${characterId}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RelView[];
    },
  });

  const types = useQuery({
    queryKey: ['rel-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relationship_types').select('*').order('is_builtin', { ascending: false }).order('name');
      if (error) throw error;
      return data as RelationshipType[];
    },
  });

  const characters = useQuery({
    queryKey: ['characters-mini'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('characters').select('id,name,is_pc').order('name');
      if (error) throw error;
      return data as Pick<Character,'id'|'name'|'is_pc'>[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('relationships').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rels', characterId] });
    },
  });

  const filtered = (rels.data ?? []).filter(r => {
    if (filter === 'all') return true;
    const other = r.from?.id === characterId ? r.to : r.from;
    if (!other) return true;
    return filter === 'pc' ? other.is_pc : !other.is_pc;
  });

  return (
    <div className="space-y-3">
      <button onClick={() => setOpen(o => !o)} className="btn-ghost text-sm">
        {open ? '× Скрыть форму' : '+ Добавить связь'}
      </button>

      {open && (
        <NewRelationshipForm
          fromCharacterId={characterId}
          types={types.data ?? []}
          characters={(characters.data ?? []).filter(c => c.id !== characterId)}
          createdBy={user?.id ?? null}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['rels', characterId] });
            setOpen(false);
          }}
        />
      )}

      {rels.isLoading ? (
        <p className="subtle">Тянем нити...</p>
      ) : filtered.length === 0 ? (
        <p className="subtle">Связей нет. Этот kindred одинок в ночи.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-ash text-xs uppercase tracking-widest">
            <tr>
              <th className="text-left py-1">Направление</th>
              <th className="text-left py-1">Тип</th>
              <th className="text-left py-1">Описание</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const outgoing = r.from_character_id === characterId;
              const other = outgoing ? r.to : r.from;
              if (!other) return null;
              return (
                <tr key={r.id} className="border-t border-gold/10">
                  <td className="py-2 align-top">
                    <span className="text-ash">
                      {outgoing ? '→' : '←'}
                    </span>{' '}
                    <Link to={`/characters/${other.id}`} className="link">{other.name}</Link>{' '}
                    <span className={`chip ${other.is_pc ? 'chip-pc' : 'chip-npc'} ml-1`}>
                      {other.is_pc ? 'PC' : 'NPC'}
                    </span>
                  </td>
                  <td className="py-2 align-top">
                    <span className="chip">{r.type?.name}</span>
                  </td>
                  <td className="py-2 align-top">
                    <p className="text-bone/90 whitespace-pre-wrap">{r.description ?? '—'}</p>
                    {(r.started_at_date || r.started_at_session) && (
                      <p className="text-xs text-ash mt-1">
                        {r.started_at_date && <>📅 {r.started_at_date} </>}
                        {r.started_at_session && <>· сессия #{r.started_at_session}</>}
                      </p>
                    )}
                  </td>
                  <td className="py-2 align-top text-right">
                    <button
                      onClick={() => { if (confirm('Удалить связь?')) del.mutate(r.id); }}
                      className="text-rose hover:text-bloodlight text-xs"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function NewRelationshipForm({
  fromCharacterId, types, characters, createdBy, onCreated,
}: {
  fromCharacterId: string;
  types: RelationshipType[];
  characters: Pick<Character,'id'|'name'|'is_pc'>[];
  createdBy: string | null;
  onCreated: () => void;
}) {
  const [toId, setToId] = useState('');
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');
  const [session, setSession] = useState('');
  const [strength, setStrength] = useState(3);
  const [customType, setCustomType] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      let usedTypeId = typeId;
      if (customType.trim()) {
        const { data, error } = await supabase
          .from('relationship_types')
          .insert({ name: customType.trim(), is_builtin: false })
          .select('id')
          .single();
        if (error) throw error;
        usedTypeId = data.id;
      }
      const { error } = await supabase.from('relationships').insert({
        from_character_id: fromCharacterId,
        to_character_id: toId,
        type_id: usedTypeId,
        description: desc || null,
        started_at_date: date || null,
        started_at_session: session ? parseInt(session) : null,
        strength,
        created_by: createdBy,
      });
      if (error) throw error;
      onCreated();
    } catch (e: any) {
      setErr(e?.message ?? 'Не удалось добавить связь');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card bg-velvet/40 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="label">Кому (→)</label>
          <select className="input" required value={toId} onChange={e => setToId(e.target.value)}>
            <option value="">— выбери персонажа —</option>
            {characters.map(c => (
              <option key={c.id} value={c.id}>{c.name} {c.is_pc ? '(PC)' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Тип связи</label>
          <select className="input" value={typeId} onChange={e => setTypeId(e.target.value)} disabled={!!customType}>
            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input
            className="input mt-1"
            placeholder="...или впиши свой тип"
            value={customType}
            onChange={e => setCustomType(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label">Описание</label>
        <textarea className="input min-h-[60px]" value={desc} onChange={e => setDesc(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Дата</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Сессия №</label>
          <input type="number" className="input" value={session} onChange={e => setSession(e.target.value)} />
        </div>
        <div>
          <label className="label">Сила (1–5)</label>
          <input type="number" min={1} max={5} className="input" value={strength} onChange={e => setStrength(parseInt(e.target.value || '3'))} />
        </div>
      </div>
      {err && <p className="text-rose text-sm">{err}</p>}
      <button className="btn-primary text-sm" disabled={busy || !toId}>
        {busy ? 'Соединяем...' : 'Добавить связь'}
      </button>
    </form>
  );
}
