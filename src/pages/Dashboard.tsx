import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Character, Quest, QuestObjective, SessionRow } from '@/lib/types';
import { BatSticker, RoseSticker, MoonSticker } from '@/components/Stickers';
import Avatar from '@/components/Avatar';

async function fetchPCs() {
  const { data, error } = await supabase
    .from('characters')
    .select('id,name,is_pc,kind,clan,sect,portrait_url,short_desc,life_status,status_in_sect')
    .eq('is_pc', true)
    .order('name');
  if (error) throw error;
  return data as unknown as Character[];
}

async function fetchActiveQuestsWithObjectives() {
  const { data: quests, error } = await supabase
    .from('quests')
    .select('id,title,status,description,giver_id')
    .eq('status', 'Active')
    .order('updated_at', { ascending: false });
  if (error) throw error;

  const list = (quests ?? []) as unknown as Pick<Quest,'id'|'title'|'status'|'description'|'giver_id'>[];
  if (list.length === 0) return [] as (Pick<Quest,'id'|'title'|'status'|'description'|'giver_id'> & { objectives: QuestObjective[] })[];

  const ids = list.map(q => q.id);
  const { data: objs } = await supabase
    .from('quest_objectives')
    .select('*')
    .in('quest_id', ids)
    .order('position');

  const objectives = (objs ?? []) as unknown as QuestObjective[];
  return list.map(q => ({
    ...q,
    objectives: objectives.filter(o => o.quest_id === q.id),
  }));
}

async function fetchRecentSessions() {
  const { data, error } = await supabase
    .from('sessions')
    .select('id,number,date,title,summary')
    .order('date', { ascending: false, nullsFirst: false })
    .limit(3);
  if (error) throw error;
  return data as unknown as Pick<SessionRow,'id'|'number'|'date'|'title'|'summary'>[];
}

export default function Dashboard() {
  const pcs       = useQuery({ queryKey: ['dash-pcs'],      queryFn: fetchPCs });
  const quests    = useQuery({ queryKey: ['dash-quests-with-obj'], queryFn: fetchActiveQuestsWithObjectives });
  const sessions  = useQuery({ queryKey: ['dash-sessions'], queryFn: fetchRecentSessions });

  return (
    <div className="space-y-8">
      <section className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="heading flex items-center gap-2">
            Хроника <RoseSticker />
          </h1>
          <p className="subtle">Что было, что есть, и кого нужно избегать в Элизиуме.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/characters/new" className="btn-primary">+ Персонаж</Link>
          <Link to="/quests" className="btn-ghost">📜 Квесты</Link>
        </div>
      </section>

      {/* ============== Игровые персонажи ============== */}
      <section>
        <h2 className="text-2xl text-bone mb-3 flex items-center gap-2">
          <BatSticker /> Наши персонажи
        </h2>
        {pcs.isLoading ? <p className="subtle">Поднимаем гробы...</p> :
         pcs.data && pcs.data.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pcs.data.map(c => (
              <Link
                key={c.id}
                to={`/characters/${c.id}`}
                className="card card-hover border-bone/40 ring-1 ring-bone/10 flex gap-3"
              >
                <Avatar url={c.portrait_url} name={c.name} size={72} />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-xl truncate">{c.name}</p>
                  <p className="subtle text-xs">
                    {c.clan ?? '—'}{c.sect && c.sect !== 'Unknown' ? ` · ${c.sect}` : ''}
                  </p>
                  {c.life_status !== 'active' && (
                    <span className="chip mt-1 text-xs text-rose">⚠ {c.life_status}</span>
                  )}
                  {c.short_desc && (
                    <p className="text-sm text-bone/80 line-clamp-2 mt-1">{c.short_desc}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card text-ash text-center py-6">
            Игровых персонажей ещё нет. <Link to="/characters/new" className="link">Создай первого</Link>.
          </div>
        )}
      </section>

      {/* ============== Активные квесты с целями ============== */}
      <section>
        <h2 className="text-2xl text-bone mb-3 flex items-center gap-2">
          📜 Активные квесты
        </h2>
        {quests.isLoading ? <p className="subtle">Шёпоты Принца...</p> :
         quests.data && quests.data.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-3">
            {quests.data.map(q => {
              const done = q.objectives.filter(o => o.done).length;
              const total = q.objectives.length;
              return (
                <Link key={q.id} to={`/quests/${q.id}`} className="card card-hover">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-display text-lg flex-1 min-w-0 truncate">{q.title}</p>
                    {total > 0 && (
                      <span className="text-xs text-ash whitespace-nowrap">{done}/{total} ✓</span>
                    )}
                  </div>
                  {q.description && <p className="subtle text-sm line-clamp-2 mt-1">{q.description}</p>}
                  {q.objectives.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {q.objectives.slice(0, 4).map(o => (
                        <li key={o.id} className={`text-sm flex items-start gap-2 ${o.done ? 'line-through text-ash' : 'text-bone/90'}`}>
                          <span className="text-rose mt-0.5">{o.done ? '☑' : '☐'}</span>
                          <span className="flex-1">{o.text}</span>
                        </li>
                      ))}
                      {q.objectives.length > 4 && (
                        <li className="text-xs text-ash italic">…и ещё {q.objectives.length - 4}</li>
                      )}
                    </ul>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card text-ash text-center py-6">Активных квестов нет.</div>
        )}
      </section>

      {/* ============== Последние сессии ============== */}
      <section>
        <h2 className="text-2xl text-bone mb-3 flex items-center gap-2">
          <MoonSticker /> Последние сессии
        </h2>
        {sessions.isLoading ? <p className="subtle">Открываем дневник...</p> :
         sessions.data && sessions.data.length > 0 ? (
          <div className="space-y-2">
            {sessions.data.map(s => (
              <div key={s.id} className="card">
                <p className="font-display text-lg">
                  Сессия {s.number ?? '?'}{s.title ? ` · ${s.title}` : ''}
                  <span className="ml-3 subtle">{s.date ?? ''}</span>
                </p>
                <p className="subtle line-clamp-2">{s.summary ?? '—'}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-ash text-center py-6">Сессии ещё не записаны.</div>
        )}
      </section>
    </div>
  );
}
