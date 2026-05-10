import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CLANS, SECTS, CREATURE_KINDS, KIND_SHORT, type Character, type CreatureKind } from '@/lib/types';
import Avatar from '@/components/Avatar';

type Filter = 'all' | 'pc' | 'npc';

async function fetchCharacters() {
  const { data, error } = await supabase
    .from('characters')
    .select('id,name,is_pc,kind,clan,sect,portrait_url,short_desc,humanity,hunger,reputation,status_in_sect,predator_type')
    .order('name');
  if (error) throw error;
  return data as unknown as Character[];
}

export default function CharactersList() {
  const [filter, setFilter] = useState<Filter>('all');
  const [kindFilter, setKindFilter] = useState<CreatureKind | ''>('');
  const [clan, setClan] = useState<string>('');
  const [sect, setSect] = useState<string>('');
  const [q, setQ]       = useState<string>('');

  const { data, isLoading } = useQuery({ queryKey: ['characters'], queryFn: fetchCharacters });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter(c => {
      if (filter === 'pc'  && !c.is_pc) return false;
      if (filter === 'npc' &&  c.is_pc) return false;
      if (kindFilter && c.kind !== kindFilter) return false;
      if (clan && c.clan !== clan) return false;
      if (sect && c.sect !== sect) return false;
      if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [data, filter, kindFilter, clan, sect, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="heading">🦇 Персонажи</h1>
        <Link to="/characters/new" className="btn-primary">+ Новый</Link>
      </div>

      <div className="card flex flex-wrap gap-3 items-end">
        <div className="flex gap-1 bg-velvet/40 p-1 rounded-lg">
          {(['all','pc','npc'] as Filter[]).map(f => (
            <button
              key={f}
              className={`px-3 py-1 rounded-md text-sm transition ${
                filter === f ? 'bg-blood text-bone' : 'text-ash hover:text-bone'
              }`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Все' : f.toUpperCase()}
            </button>
          ))}
        </div>

        <div>
          <label className="label">Тип</label>
          <select className="input" value={kindFilter} onChange={e => setKindFilter(e.target.value as CreatureKind | '')}>
            <option value="">— любой —</option>
            {CREATURE_KINDS.map(k => <option key={k.value} value={k.value}>{k.emoji} {k.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Клан</label>
          <select className="input" value={clan} onChange={e => setClan(e.target.value)}>
            <option value="">— любой —</option>
            {CLANS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Секта</label>
          <select className="input" value={sect} onChange={e => setSect(e.target.value)}>
            <option value="">— любая —</option>
            {SECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="label">Поиск</label>
          <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="имя..." />
        </div>
      </div>

      {isLoading ? (
        <p className="subtle">Будим вампиров...</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-ash py-10">
          Никого не нашли. <Link to="/characters/new" className="link">Создать персонажа</Link>?
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <Link
              key={c.id}
              to={`/characters/${c.id}`}
              className={`card card-hover flex gap-3 ${
                c.is_pc
                  ? 'border-bone/40 ring-1 ring-bone/10'
                  : 'border-gold/15'
              }`}
            >
              <Avatar url={c.portrait_url} name={c.name} size={64} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display text-xl truncate">{c.name}</p>
                  <span className={`chip ${c.is_pc ? 'chip-pc' : 'chip-npc'}`}>
                    {c.is_pc ? '🩸 PC' : 'NPC'}
                  </span>
                  {c.kind && c.kind !== 'kindred' && (
                    <span className="chip">{KIND_SHORT[c.kind]}</span>
                  )}
                </div>
                <p className="subtle text-xs">
                  {c.clan ?? '—'}{c.sect && c.sect !== 'Unknown' ? ` · ${c.sect}` : ''}
                </p>

                {c.is_pc ? (
                  // PC: больше механики
                  <>
                    {c.predator_type && (
                      <p className="text-xs text-ash mt-1">Predator: <span className="text-bone">{c.predator_type}</span></p>
                    )}
                    <div className="flex gap-2 mt-2 text-[11px]">
                      <MiniStat label="Hum" v={c.humanity} max={10} />
                      <MiniStat label="Hng" v={c.hunger}   max={5}  variant="hunger" />
                      <MiniStat label="Fame" v={c.reputation} max={10} variant="fame" />
                    </div>
                  </>
                ) : (
                  // NPC: меньше цифр, больше роли
                  <>
                    {c.status_in_sect && (
                      <p className="text-xs text-ash mt-1">Роль: <span className="text-bone">{c.status_in_sect}</span></p>
                    )}
                    {c.short_desc && (
                      <p className="text-sm text-bone/80 line-clamp-2 mt-1">{c.short_desc}</p>
                    )}
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, v, max, variant }: { label: string; v: number; max: number; variant?: 'hunger' | 'fame' }) {
  const color = variant === 'hunger' ? 'bg-rose/70' : variant === 'fame' ? 'bg-gold/70' : 'bg-blood/70';
  const pct = Math.max(0, Math.min(1, v / max)) * 100;
  return (
    <div className="flex-1 bg-velvet/40 rounded px-1.5 py-1 border border-gold/10">
      <div className="flex justify-between items-baseline">
        <span className="text-ash uppercase tracking-wider">{label}</span>
        <span className="text-bone font-display text-xs">{v}/{max}</span>
      </div>
      <div className="h-0.5 bg-ink rounded-full overflow-hidden mt-0.5">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
