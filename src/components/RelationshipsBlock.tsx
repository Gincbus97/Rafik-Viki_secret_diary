import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { createRelWithReciprocal, updateRelWithReciprocal, deleteRelWithReciprocal } from '@/lib/relationships';
import type { Character, Relationship, RelationshipType } from '@/lib/types';

interface RelView extends Relationship {
  from?: Pick<Character,'id'|'name'|'is_pc'>;
  to?:   Pick<Character,'id'|'name'|'is_pc'>;
  type?: Pick<RelationshipType,'id'|'name'>;
}

interface Props {
  characterId: string;
  currentIsPc: boolean;
  filter: 'all' | 'pc' | 'npc';
}

export default function RelationshipsBlock({ characterId, currentIsPc, filter }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      return data as unknown as RelationshipType[];
    },
  });

  const characters = useQuery({
    queryKey: ['characters-mini'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('characters').select('id,name,is_pc').order('name');
      if (error) throw error;
      return data as unknown as Pick<Character,'id'|'name'|'is_pc'>[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await deleteRelWithReciprocal(id, types.data ?? []);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rels'] });
      qc.invalidateQueries({ queryKey: ['mm-relationships'] });
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
      <button onClick={() => { setOpen(o => !o); setEditingId(null); }} className="btn-ghost text-sm">
        {open ? '× Скрыть форму' : '+ Добавить связь'}
      </button>

      {open && (
        <RelationshipForm
          mode="new"
          fromCharacterId={characterId}
          fromIsPc={currentIsPc}
          types={(types.data ?? []).filter(t => !t.hidden_from_manual)}
          characters={(characters.data ?? []).filter(c => c.id !== characterId)}
          createdBy={user?.id ?? null}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['rels', characterId] });
            qc.invalidateQueries({ queryKey: ['mm-relationships'] });
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
              const isEditing = editingId === r.id;
              return (
                <tr key={r.id} className="border-t border-gold/10 align-top">
                  {isEditing ? (
                    <td colSpan={4} className="py-2">
                      <RelationshipForm
                        mode="edit"
                        existing={r}
                        fromCharacterId={r.from_character_id}
                        fromIsPc={r.from?.is_pc ?? false}
                        types={(types.data ?? []).filter(t => !t.hidden_from_manual || t.id === r.type_id)}
                        characters={(characters.data ?? []).filter(c => c.id !== r.from_character_id)}
                        createdBy={user?.id ?? null}
                        onDone={() => {
                          qc.invalidateQueries({ queryKey: ['rels', characterId] });
                          qc.invalidateQueries({ queryKey: ['mm-relationships'] });
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="py-2">
                        <span className="text-ash">{outgoing ? '→' : '←'}</span>{' '}
                        <Link to={`/characters/${other.id}`} className="link">{other.name}</Link>{' '}
                        <span className={`chip ${other.is_pc ? 'chip-pc' : 'chip-npc'} ml-1`}>
                          {other.is_pc ? 'PC' : 'NPC'}
                        </span>
                      </td>
                      <td className="py-2"><span className="chip">{r.type?.name}</span></td>
                      <td className="py-2">
                        <p className="text-bone/90 whitespace-pre-wrap">{r.description ?? '—'}</p>
                        {(r.started_at_date || r.started_at_session) && (
                          <p className="text-xs text-ash mt-1">
                            {r.started_at_date && <>📅 {r.started_at_date} </>}
                            {r.started_at_session && <>· сессия #{r.started_at_session}</>}
                          </p>
                        )}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => setEditingId(r.id)}
                          className="text-ash hover:text-bone text-sm mr-2"
                          title="Редактировать"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => { if (confirm('Удалить связь?')) del.mutate(r.id); }}
                          className="text-rose hover:text-bloodlight text-sm"
                          title="Удалить"
                        >
                          ×
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface FormProps {
  mode: 'new' | 'edit';
  existing?: RelView;
  fromCharacterId: string;
  fromIsPc: boolean;
  types: RelationshipType[];
  characters: Pick<Character,'id'|'name'|'is_pc'>[];
  createdBy: string | null;
  onDone: () => void;
  onCancel?: () => void;
}

function RelationshipForm({ mode, existing, fromCharacterId, fromIsPc, types, characters, createdBy, onDone, onCancel }: FormProps) {
  const [toId, setToId] = useState(existing?.to_character_id ?? '');
  const [typeId, setTypeId] = useState(existing?.type_id ?? types[0]?.id ?? '');
  const [desc, setDesc] = useState(existing?.description ?? '');
  const [date, setDate] = useState(existing?.started_at_date ?? '');
  const [session, setSession] = useState(existing?.started_at_session?.toString() ?? '');
  const [strength, setStrength] = useState(existing?.strength ?? 3);
  const [customType, setCustomType] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Описание обязательно если хотя бы одна сторона PC
  const toChar = characters.find(c => c.id === toId);
  const descRequired = fromIsPc || !!toChar?.is_pc;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      let usedTypeId = typeId;
      let typesList = types;
      if (customType.trim()) {
        const { data, error } = await supabase
          .from('relationship_types')
          .insert({ name: customType.trim(), is_builtin: false, category: 'personal' })
          .select('*')
          .single();
        if (error) throw error;
        usedTypeId = data.id;
        typesList = [...types, data as RelationshipType];
      }

      if (descRequired && !desc.trim()) {
        setErr('Связь касается игрока — обязательно опиши, что между ними происходит.');
        setBusy(false);
        return;
      }
      const payload = {
        from_character_id: fromCharacterId,
        to_character_id: toId,
        type_id: usedTypeId,
        description: desc.trim() || null,
        started_at_date: date || null,
        started_at_session: session ? parseInt(session) : null,
        strength,
      };

      if (mode === 'new') {
        await createRelWithReciprocal({ ...payload, created_by: createdBy }, typesList);
      } else {
        await updateRelWithReciprocal(existing!.id, payload, typesList);
      }
      onDone();
    } catch (e: any) {
      setErr(e?.message ?? 'Не удалось сохранить связь');
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
            <optgroup label="⚙ Механика">
              {types.filter(t => t.category === 'mechanic').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
            <optgroup label="❤ Личное">
              {types.filter(t => t.category === 'personal').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
            <optgroup label="Прочее">
              {types.filter(t => !t.category || (t.category !== 'mechanic' && t.category !== 'personal')).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
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
        <label className="label">
          Описание {descRequired && <span className="text-rose">*</span>}
          {!descRequired && <span className="text-ash text-xs ml-1">(не обязательно — связь NPC↔NPC)</span>}
        </label>
        <textarea
          className="input min-h-[60px]"
          required={descRequired}
          placeholder={descRequired
            ? 'Связь касается игрока — опиши историю в одно-два предложения.'
            : 'Можешь оставить пустым.'}
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Дата</label>
          <input type="date" className="input" value={date ?? ''} onChange={e => setDate(e.target.value)} />
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
      <div className="flex gap-2">
        <button className="btn-primary text-sm" disabled={busy || !toId || (descRequired && !desc.trim())}>
          {busy ? 'Сохраняем...' : (mode === 'new' ? 'Добавить связь' : 'Сохранить')}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost text-sm">Отмена</button>
        )}
      </div>
    </form>
  );
}
