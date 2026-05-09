import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Character, Quest, Faction, LocationItem } from '@/lib/types';
import Avatar from '@/components/Avatar';
import RelationshipsBlock from '@/components/RelationshipsBlock';
import PersonalNoteBlock from '@/components/PersonalNoteBlock';

type RelFilter = 'all' | 'pc' | 'npc';

export default function CharacterDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [relFilter, setRelFilter] = useState<RelFilter>('all');

  const character = useQuery({
    queryKey: ['character', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('characters').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Character;
    },
    enabled: !!id,
  });

  const sire = useQuery({
    queryKey: ['character-sire', character.data?.sire_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('characters').select('id,name')
        .eq('id', character.data!.sire_id!).maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string } | null;
    },
    enabled: !!character.data?.sire_id,
  });

  const location = useQuery({
    queryKey: ['character-loc', character.data?.location_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations').select('id,name').eq('id', character.data!.location_id!).maybeSingle();
      if (error) throw error;
      return data as Pick<LocationItem,'id'|'name'> | null;
    },
    enabled: !!character.data?.location_id,
  });

  const quests = useQuery({
    queryKey: ['char-quests', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quest_characters').select('quest_id, quests(id,title,status)').eq('character_id', id);
      if (error) throw error;
      return (data as any[]).map(r => r.quests) as Pick<Quest,'id'|'title'|'status'>[];
    },
    enabled: !!id,
  });

  const factions = useQuery({
    queryKey: ['char-factions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faction_members').select('faction_id, factions(id,name,kind)').eq('character_id', id);
      if (error) throw error;
      return (data as any[]).map(r => r.factions) as Pick<Faction,'id'|'name'|'kind'>[];
    },
    enabled: !!id,
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('characters').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['characters'] });
      nav('/characters');
    },
  });

  if (character.isLoading) return <p className="subtle">Раскапываем досье...</p>;
  if (character.isError || !character.data) return <p className="text-rose">Персонаж не найден.</p>;

  const c = character.data;

  return (
    <div className="space-y-6">
      <div className="card flex flex-col md:flex-row gap-6">
        <Avatar url={c.portrait_url} name={c.name} size={160} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="heading">{c.name}</h1>
            <span className={`chip ${c.is_pc ? 'chip-pc' : 'chip-npc'}`}>{c.is_pc ? 'PC' : 'NPC'}</span>
          </div>
          <div className="subtle text-sm mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {c.clan && <span>Клан: <span className="text-bone">{c.clan}</span></span>}
            {c.sect && c.sect !== 'Unknown' && <span>Секта: <span className="text-bone">{c.sect}</span></span>}
            {c.generation && <span>{c.generation} поколение</span>}
            {c.embrace_age && <span>Embrace: <span className="text-bone">{c.embrace_age}</span></span>}
            {c.status_in_sect && <span>Статус: <span className="text-bone">{c.status_in_sect}</span></span>}
            {c.predator_type && <span>Predator: <span className="text-bone">{c.predator_type}</span></span>}
            {sire.data && (
              <span>Sire: <Link className="link" to={`/characters/${sire.data.id}`}>{sire.data.name}</Link></span>
            )}
            {location.data && (
              <span>Локация: <span className="text-bone">{location.data.name}</span></span>
            )}
          </div>

          {c.short_desc && <p className="mt-3 text-bone/90">{c.short_desc}</p>}

          <div className="grid grid-cols-3 gap-3 mt-4">
            <Stat label="Humanity"  value={c.humanity}   max={10} />
            <Stat label="Hunger"    value={c.hunger}     max={5}  />
            <Stat label="Известность" value={c.reputation} max={10} />
          </div>

          <div className="flex gap-2 mt-4">
            <Link to={`/characters/${id}/edit`} className="btn-ghost">✒️ Редактировать</Link>
            <button
              className="btn-danger"
              onClick={() => {
                if (confirm(`Удалить «${c.name}» навсегда? Это уберёт и все его связи.`)) del.mutate();
              }}
            >
              Удалить
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <section className="card lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xl">🩸 Связи</h2>
            <div className="flex gap-1 bg-velvet/40 p-1 rounded-lg">
              {(['all','pc','npc'] as RelFilter[]).map(f => (
                <button
                  key={f}
                  className={`px-2.5 py-1 text-xs rounded ${relFilter === f ? 'bg-blood text-bone' : 'text-ash hover:text-bone'}`}
                  onClick={() => setRelFilter(f)}
                >
                  {f === 'all' ? 'Все' : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <RelationshipsBlock characterId={c.id} filter={relFilter} />
        </section>

        <section className="space-y-4">
          <div className="card space-y-2">
            <h2 className="text-xl">📜 Квесты</h2>
            {quests.isLoading ? <p className="subtle">...</p> :
             quests.data && quests.data.length > 0 ? (
              <ul className="space-y-1">
                {quests.data.filter(Boolean).map(q => (
                  <li key={q.id}>
                    <Link to={`/quests/${q.id}`} className="link">{q.title}</Link>
                    <span className="ml-2 chip">{q.status}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="subtle">Никаких квестов.</p>}
          </div>

          <div className="card space-y-2">
            <h2 className="text-xl">🜲 Фракции</h2>
            {factions.isLoading ? <p className="subtle">...</p> :
             factions.data && factions.data.length > 0 ? (
              <ul className="space-y-1">
                {factions.data.filter(Boolean).map(f => (
                  <li key={f.id}>
                    <span className="text-bone">{f.name}</span>
                    <span className="ml-2 chip">{f.kind}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="subtle">Без фракций.</p>}
          </div>

          {user && <PersonalNoteBlock characterId={c.id} />}
        </section>
      </div>

      {(c.bane || c.compulsion) && (
        <section className="card grid md:grid-cols-2 gap-4">
          {c.bane && (
            <div>
              <h3 className="text-lg">Bane</h3>
              <p className="text-bone/90 whitespace-pre-wrap">{c.bane}</p>
            </div>
          )}
          {c.compulsion && (
            <div>
              <h3 className="text-lg">Compulsion</h3>
              <p className="text-bone/90 whitespace-pre-wrap">{c.compulsion}</p>
            </div>
          )}
        </section>
      )}

      {c.disciplines && c.disciplines.length > 0 && (
        <section className="card">
          <h3 className="text-lg mb-2">Disciplines</h3>
          <div className="flex flex-wrap gap-2">
            {c.disciplines.map((d, i) => (
              <span key={i} className="chip text-sm">
                <span className="text-bone">{d.name}</span>
                <span className="text-rose ml-1">{'•'.repeat(d.level)}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {c.biography && (
        <section className="card">
          <h3 className="text-lg mb-2">Биография</h3>
          <p className="text-bone/90 whitespace-pre-wrap leading-relaxed">{c.biography}</p>
        </section>
      )}

      {c.notes && (
        <section className="card border-blood/30">
          <h3 className="text-lg mb-2">Заметки рассказчика</h3>
          <p className="text-bone/90 whitespace-pre-wrap leading-relaxed">{c.notes}</p>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className="bg-velvet/50 rounded-lg px-3 py-2 border border-gold/10">
      <div className="flex items-center justify-between text-xs">
        <span className="text-ash uppercase tracking-widest">{label}</span>
        <span className="text-bone font-display text-base">{value}/{max}</span>
      </div>
      <div className="mt-1 h-1.5 bg-ink rounded-full overflow-hidden">
        <div className="h-full bg-blood" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
