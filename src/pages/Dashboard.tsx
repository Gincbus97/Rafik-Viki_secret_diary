import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Character, Quest, SessionRow } from '@/lib/types';
import { BatSticker, RoseSticker, MoonSticker } from '@/components/Stickers';

async function fetchRecentCharacters() {
  const { data, error } = await supabase
    .from('characters')
    .select('id,name,is_pc,clan,sect,portrait_url,updated_at')
    .order('updated_at', { ascending: false })
    .limit(6);
  if (error) throw error;
  return data as Pick<Character,'id'|'name'|'is_pc'|'clan'|'sect'|'portrait_url'|'updated_at'>[];
}

async function fetchActiveQuests() {
  const { data, error } = await supabase
    .from('quests')
    .select('id,title,status,description')
    .eq('status', 'Active')
    .order('updated_at', { ascending: false })
    .limit(5);
  if (error) throw error;
  return data as Pick<Quest,'id'|'title'|'status'|'description'>[];
}

async function fetchRecentSessions() {
  const { data, error } = await supabase
    .from('sessions')
    .select('id,number,date,title,summary')
    .order('date', { ascending: false, nullsFirst: false })
    .limit(3);
  if (error) throw error;
  return data as Pick<SessionRow,'id'|'number'|'date'|'title'|'summary'>[];
}

export default function Dashboard() {
  const characters = useQuery({ queryKey: ['dash-chars'],    queryFn: fetchRecentCharacters });
  const quests     = useQuery({ queryKey: ['dash-quests'],   queryFn: fetchActiveQuests });
  const sessions   = useQuery({ queryKey: ['dash-sessions'], queryFn: fetchRecentSessions });

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

      <section>
        <h2 className="text-xl text-bone mb-3 flex items-center gap-2">
          <BatSticker /> Недавние персонажи
        </h2>
        {characters.isLoading ? <p className="subtle">Поднимаем гробы...</p> :
         characters.data && characters.data.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {characters.data.map((c) => (
              <Link key={c.id} to={`/characters/${c.id}`} className="card card-hover flex gap-3 items-center p-3">
                <Avatar url={c.portrait_url} name={c.name} />
                <div className="min-w-0">
                  <p className="font-display text-lg truncate">{c.name}</p>
                  <p className="subtle truncate">
                    <span className={`chip ${c.is_pc ? 'chip-pc' : 'chip-npc'} mr-1`}>
                      {c.is_pc ? 'PC' : 'NPC'}
                    </span>
                    {c.clan ?? '—'}{c.sect ? ` · ${c.sect}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : <Empty text="Никого пока. Создай первого персонажа." />}
      </section>

      <section>
        <h2 className="text-xl text-bone mb-3 flex items-center gap-2">
          📜 Активные квесты
        </h2>
        {quests.isLoading ? <p className="subtle">Шёпоты Принца...</p> :
         quests.data && quests.data.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-3">
            {quests.data.map(q => (
              <Link key={q.id} to={`/quests/${q.id}`} className="card card-hover">
                <p className="font-display text-lg">{q.title}</p>
                <p className="subtle line-clamp-2">{q.description ?? 'Без описания'}</p>
              </Link>
            ))}
          </div>
        ) : <Empty text="Активных квестов нет." />}
      </section>

      <section>
        <h2 className="text-xl text-bone mb-3 flex items-center gap-2">
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
        ) : <Empty text="Сессии ещё не записаны." />}
      </section>
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return <img src={url} alt={name} className="w-12 h-12 rounded-xl object-cover border border-gold/20" />;
  }
  const letter = name?.[0]?.toUpperCase() ?? '?';
  return (
    <div className="w-12 h-12 rounded-xl bg-velvet flex items-center justify-center text-bone font-display text-xl border border-gold/20">
      {letter}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="card text-ash text-center py-6">{text}</div>;
}
