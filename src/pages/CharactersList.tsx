import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CLANS, SECTS, CREATURE_KINDS, KIND_SHORT, LIFE_STATUSES, type Character, type CreatureKind, type LifeStatus } from '@/lib/types';
import Avatar from '@/components/Avatar';

type Filter = 'all' | 'pc' | 'npc';

async function fetchCharacters() {
  const { data, error } = await supabase
    .from('characters')
    .select('id,name,is_pc,kind,life_status,kind_data,clan,sect,portrait_url,short_desc,status_in_sect')
    .order('name');
  if (error) throw error;
  return data as unknown as Character[];
}

export default function CharactersList() {
  const [filter, setFilter] = useState<Filter>('all');
  const [kindFilter, setKindFilter] = useState<CreatureKind | ''>('');
  const [statusFilter, setStatusFilter] = useState<LifeStatus | ''>('');
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
      if (statusFilter && c.life_status !== statusFilter) return false;
      if (clan && c.clan !== clan) return false;
      if (sect && c.sect !== sect) return false;
      if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [data, filter, kindFilter, statusFilter, clan, sect, q]);

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
          <label className="label">Статус</label>
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as LifeStatus | '')}>
            <option value="">— любой —</option>
            {LIFE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
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
          {filtered.map(c => {
            const status = LIFE_STATUSES.find(s => s.value === c.life_status) ?? LIFE_STATUSES[0];
            const borderClass =
              c.is_pc ? 'border-bone/40 ring-1 ring-bone/10' :
              c.kind === 'human' ? 'border-sky-500/30' :
              'border-gold/15';
            return (
              <Link key={c.id} to={`/characters/${c.id}`} className={`card card-hover flex gap-3 ${borderClass}`}>
                <Avatar url={c.portrait_url} name={c.name} size={64} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-display text-xl truncate">{c.name}</p>
                    <span className={`chip ${c.is_pc ? 'chip-pc' : 'chip-npc'}`}>
                      {c.is_pc ? '🩸 PC' : 'NPC'}
                    </span>
                    {c.kind && c.kind !== 'kindred' && (
                      <span className="chip">{KIND_SHORT[c.kind]}</span>
                    )}
                    {c.life_status && c.life_status !== 'active' && (
                      <span className={`chip ${status.tone}`}>{status.emoji} {status.label}</span>
                    )}
                  </div>
                  <p className="subtle text-xs">
                    {c.kind === 'kindred'
                      ? `${c.clan ?? '—'}${c.sect && c.sect !== 'Unknown' ? ` · ${c.sect}` : ''}`
                      : c.kind === 'human'
                      ? (((c.kind_data ?? {}) as any).profession ?? 'смертный')
                      : c.kind === 'ghoul'
                      ? 'гуль'
                      : (((c.kind_data ?? {}) as any).type_label ?? '—')
                    }
                  </p>

                  {c.status_in_sect && (
                    <p className="text-xs text-ash mt-1">Роль: <span className="text-bone">{c.status_in_sect}</span></p>
                  )}
                  {c.short_desc && (
                    <p className="text-sm text-bone/80 line-clamp-2 mt-1">{c.short_desc}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
