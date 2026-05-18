import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  KIND_SHORT, LIFE_STATUSES, GROUP_SIZES, GROUP_DISPOSITIONS,
  type Character, type Quest, type Faction, type LocationItem,
  type KindredData, type GhoulData, type HumanData, type OtherData, type GroupData,
} from '@/lib/types';
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
      const { data, error } = await supabase.from('characters').select('*').eq('id', id!).single();
      if (error) throw error;
      return data as unknown as Character;
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
      return data as unknown as { id: string; name: string } | null;
    },
    enabled: !!character.data?.sire_id,
  });

  // Для гулей — домитор лежит в kind_data.domitor_id
  const domitorId = (character.data?.kind_data as GhoulData | undefined)?.domitor_id ?? null;
  const domitor = useQuery({
    queryKey: ['character-domitor', domitorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('characters').select('id,name')
        .eq('id', domitorId!).maybeSingle();
      if (error) throw error;
      return data as unknown as { id: string; name: string } | null;
    },
    enabled: !!domitorId,
  });

  const location = useQuery({
    queryKey: ['character-loc', character.data?.location_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations').select('id,name').eq('id', character.data!.location_id!).maybeSingle();
      if (error) throw error;
      return data as unknown as Pick<LocationItem,'id'|'name'> | null;
    },
    enabled: !!character.data?.location_id,
  });

  const quests = useQuery({
    queryKey: ['char-quests', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quest_characters').select('quest_id, quests(id,title,status)').eq('character_id', id!);
      if (error) throw error;
      return (data as unknown as any[]).map(r => r.quests) as unknown as Pick<Quest,'id'|'title'|'status'>[];
    },
    enabled: !!id,
  });

  const factions = useQuery({
    queryKey: ['char-factions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faction_members').select('faction_id, factions(id,name,kind)').eq('character_id', id!);
      if (error) throw error;
      return (data as unknown as any[]).map(r => r.factions) as unknown as Pick<Faction,'id'|'name'|'kind'>[];
    },
    enabled: !!id,
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('characters').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['characters'] });
      qc.invalidateQueries({ queryKey: ['mm-characters'] });
      nav('/characters');
    },
  });

  if (character.isLoading) return <p className="subtle">Раскапываем досье...</p>;
  if (character.isError || !character.data) return <p className="text-rose">Персонаж не найден.</p>;

  const c = character.data;
  const status = LIFE_STATUSES.find(s => s.value === c.life_status) ?? LIFE_STATUSES[0];

  return (
    <div className="space-y-6">
      <div className={`card flex flex-col md:flex-row gap-6 ${
        c.is_pc ? 'border-bone/40 ring-1 ring-bone/10' :
        c.kind === 'human' ? 'border-sky-500/40' :
        'border-blood/30'
      }`}>
        <Avatar url={c.portrait_url} name={c.name} size={160} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="heading">{c.name}</h1>
            <span className={`chip ${c.is_pc ? 'chip-pc' : 'chip-npc'}`}>{c.is_pc ? 'PC' : 'NPC'}</span>
            {c.kind && c.kind !== 'kindred' && <span className="chip">{KIND_SHORT[c.kind]}</span>}
            {c.life_status !== 'active' && (
              <span className={`chip ${status.tone} border-current/40`}>
                {status.emoji} {status.label}
              </span>
            )}
          </div>

          <div className="subtle text-sm mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {c.kind === 'kindred' && c.clan && <span>Клан: <span className="text-bone">{c.clan}</span></span>}
            {c.kind === 'kindred' && c.sect && c.sect !== 'Unknown' && <span>Секта: <span className="text-bone">{c.sect}</span></span>}
            {c.kind === 'kindred' && c.generation && <span>{c.generation} поколение</span>}
            {c.kind === 'kindred' && c.embrace_age && <span>Embrace: <span className="text-bone">{c.embrace_age}</span></span>}
            {c.status_in_sect && <span>{c.is_pc ? 'Статус' : 'Роль'}: <span className="text-bone">{c.status_in_sect}</span></span>}
            {sire.data && (
              <span>Sire: <Link className="link" to={`/characters/${sire.data.id}`}>{sire.data.name}</Link></span>
            )}
            {domitor.data && (
              <span>Домитор: <Link className="link" to={`/characters/${domitor.data.id}`}>{domitor.data.name}</Link></span>
            )}
            {location.data && (
              <span>Локация: <span className="text-bone">{location.data.name}</span></span>
            )}
          </div>

          {c.short_desc && <p className="mt-3 text-bone/90">{c.short_desc}</p>}

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

      {/* Kind-specific блоки */}
      {c.kind === 'kindred' && <KindredInfo data={c.kind_data as KindredData} />}
      {c.kind === 'ghoul' && <GhoulInfo data={c.kind_data as GhoulData} />}
      {c.kind === 'human' && <HumanInfo data={c.kind_data as HumanData} />}
      {c.kind === 'group' && <GroupInfo data={c.kind_data as GroupData} />}
      {c.kind === 'other' && <OtherInfo data={c.kind_data as OtherData} />}

      {/* Враги — общая секция для всех типов */}
      {Array.isArray(c.enemies) && c.enemies.length > 0 && (
        <EnemiesInfo ids={c.enemies} />
      )}

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
          <RelationshipsBlock characterId={c.id} currentIsPc={c.is_pc} filter={relFilter} />
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

      {(c.bane || c.compulsion) && c.kind === 'kindred' && (
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

      {c.disciplines && c.disciplines.length > 0 && (c.kind === 'kindred' || c.kind === 'ghoul') && (
        <section className="card">
          <h3 className="text-lg mb-2">
            Disciplines {c.kind === 'ghoul' && <span className="subtle text-sm">(через витае)</span>}
          </h3>
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

function KindredInfo({ data }: { data: KindredData }) {
  const ts = data.touchstones ?? [];
  const bonds = data.blood_bonded_to ?? [];
  const herd = data.herd ?? [];
  const allies = data.mortal_allies ?? [];
  if (ts.length === 0 && bonds.length === 0 && herd.length === 0 && allies.length === 0) return null;
  return (
    <section className="card border-blood/20 space-y-3">
      <h2 className="text-xl">🧛 Узы Kindred</h2>
      {ts.length > 0 && <KindredLinks ids={ts} title="Touchstones" emoji="✨" />}
      {herd.length > 0 && <KindredLinks ids={herd} title="Стадо" emoji="🩸" />}
      {allies.length > 0 && <KindredLinks ids={allies} title="Союзники-смертные" emoji="🤝" />}
      {bonds.length > 0 && <BloodBondsList bonds={bonds} />}
    </section>
  );
}

function KindredLinks({ ids, title, emoji }: { ids: string[]; title: string; emoji: string }) {
  const list = useQuery({
    queryKey: ['ts-batch', ids.join(',')],
    queryFn: async () => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('characters').select('id,name,is_pc').in('id', ids);
      if (error) throw error;
      return data as unknown as { id: string; name: string; is_pc: boolean }[];
    },
    enabled: ids.length > 0,
  });
  return (
    <div>
      <p className="label">{emoji} {title}</p>
      <div className="flex flex-wrap gap-2">
        {(list.data ?? []).map(c => (
          <Link key={c.id} to={`/characters/${c.id}`} className="chip hover:border-bloodlight transition">
            {c.name} {c.is_pc && <span className="text-rose ml-1">PC</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

function BloodBondsList({ bonds }: { bonds: { character_id: string; level: 1 | 2 | 3 }[] }) {
  const ids = bonds.map(b => b.character_id).filter(Boolean);
  const list = useQuery({
    queryKey: ['bb-batch', ids.join(',')],
    queryFn: async () => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('characters').select('id,name').in('id', ids);
      if (error) throw error;
      return data as unknown as { id: string; name: string }[];
    },
    enabled: ids.length > 0,
  });
  const byId = new Map((list.data ?? []).map(c => [c.id, c.name]));
  return (
    <div>
      <p className="label">🩸 Blood Bonds</p>
      <div className="flex flex-wrap gap-2">
        {bonds.map((b, i) => {
          if (!b.character_id) return null;
          return (
            <Link key={i} to={`/characters/${b.character_id}`} className="chip hover:border-bloodlight transition">
              {byId.get(b.character_id) ?? '...'}
              <span className="text-rose ml-1">{'•'.repeat(b.level)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function GhoulInfo({ data }: { data: GhoulData }) {
  const has = data.years_served != null || data.addiction_level != null || data.bond_level != null;
  if (!has) return null;
  return (
    <section className="card border-rose/20">
      <h2 className="text-xl mb-2">🩸 Зависимость от витае</h2>
      <div className="grid grid-cols-3 gap-3">
        {data.years_served != null && (
          <div className="bg-velvet/40 rounded-lg px-3 py-2">
            <p className="label">Лет служения</p>
            <p className="text-bone font-display text-2xl">{data.years_served}</p>
          </div>
        )}
        {data.addiction_level != null && (
          <div className="bg-velvet/40 rounded-lg px-3 py-2">
            <p className="label">Зависимость</p>
            <p className="text-bone font-display text-2xl">{data.addiction_level} <span className="text-ash text-sm">/ 5</span></p>
          </div>
        )}
        {data.bond_level != null && (
          <div className="bg-velvet/40 rounded-lg px-3 py-2">
            <p className="label">Blood Bond</p>
            <p className="text-bone font-display text-2xl">{data.bond_level} <span className="text-ash text-sm">/ 3</span></p>
          </div>
        )}
      </div>
    </section>
  );
}

function HumanInfo({ data }: { data: HumanData }) {
  const has = data.profession || data.allegiance || data.age != null || data.masquerade_aware;
  if (!has) return null;
  return (
    <section className="card border-sky-500/20">
      <h2 className="text-xl mb-2">👤 Смертный</h2>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        {data.profession && <div><span className="label !inline">Профессия:</span> <span className="text-bone">{data.profession}</span></div>}
        {data.age != null && <div><span className="label !inline">Возраст:</span> <span className="text-bone">{data.age}</span></div>}
        {data.allegiance && <div className="sm:col-span-2"><span className="label !inline">Принадлежность:</span> <span className="text-bone">{data.allegiance}</span></div>}
        {data.masquerade_aware && (
          <div className="sm:col-span-2">
            <span className="chip border-blood/40 bg-blood/10 text-rose">⚠ Знает о Kindred (Masquerade aware)</span>
          </div>
        )}
      </div>
    </section>
  );
}

function GroupInfo({ data }: { data: GroupData }) {
  if (!data.size_estimate && !data.disposition && !data.composition && !data.leader_id) return null;
  const size = GROUP_SIZES.find(s => s.value === data.size_estimate);
  const disp = GROUP_DISPOSITIONS.find(d => d.value === data.disposition);
  return (
    <section className="card border-gold/30 border-double border-[3px]">
      <h2 className="text-xl mb-2">👥 Group / Mob</h2>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        {size && <div><span className="label !inline">Размер:</span> <span className="text-bone">{size.label}</span></div>}
        {disp && (
          <div>
            <span className="label !inline">Отношение к PC:</span>{' '}
            <span className={`chip ${disp.value === 'hostile' ? 'text-rose border-rose/40' : disp.value === 'friendly' ? 'text-bone border-emerald-700/40' : ''}`}>
              {disp.emoji} {disp.label}
            </span>
          </div>
        )}
        {data.composition && (
          <div className="sm:col-span-2">
            <span className="label !inline">Состав:</span>{' '}
            <span className="text-bone whitespace-pre-wrap">{data.composition}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function EnemiesInfo({ ids }: { ids: string[] }) {
  const list = useQuery({
    queryKey: ['enemies-batch', ids.join(',')],
    queryFn: async () => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('characters').select('id,name,is_pc').in('id', ids);
      if (error) throw error;
      return data as unknown as { id: string; name: string; is_pc: boolean }[];
    },
    enabled: ids.length > 0,
  });
  return (
    <section className="card border-rose/30">
      <h2 className="text-xl mb-2">⚔️ Враги</h2>
      <div className="flex flex-wrap gap-2">
        {(list.data ?? []).map(c => (
          <Link key={c.id} to={`/characters/${c.id}`} className="chip border-rose/40 bg-rose/10 text-rose hover:bg-rose/20 transition">
            {c.name}{c.is_pc && <span className="ml-1 text-bone">PC</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}

function OtherInfo({ data }: { data: OtherData }) {
  if (!data.type_label && !data.notes) return null;
  return (
    <section className="card">
      <h2 className="text-xl mb-2">✨ Не такое существо</h2>
      {data.type_label && <p><span className="label !inline">Тип:</span> <span className="text-bone">{data.type_label}</span></p>}
      {data.notes && <p className="text-bone/90 whitespace-pre-wrap mt-2">{data.notes}</p>}
    </section>
  );
}
