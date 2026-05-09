import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { BatSticker, BloodDropSticker, MoonSticker, RoseSticker } from './Stickers';

const NAV = [
  { to: '/',            label: 'Дом',        emoji: '🏰' },
  { to: '/characters',  label: 'Персонажи',  emoji: '🦇' },
  { to: '/quests',      label: 'Квесты',     emoji: '📜' },
  { to: '/factions',    label: 'Фракции',    emoji: '🜲' },
  { to: '/locations',   label: 'Локации',    emoji: '🗝' },
  { to: '/sessions',    label: 'Сессии',     emoji: '🌙' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name ?? user.email ?? ''));
  }, [user]);

  return (
    <div className="relative min-h-screen">
      {/* Декоративные стикеры в углах */}
      <BatSticker className="hidden md:block fixed top-3 left-3 opacity-50" />
      <MoonSticker className="hidden md:block fixed top-3 right-3 opacity-50" />
      <RoseSticker className="hidden md:block fixed bottom-3 left-3 opacity-40" />
      <BloodDropSticker className="hidden md:block fixed bottom-3 right-3 opacity-40" />

      <header className="relative z-10 border-b border-gold/15 bg-ink/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl">🩸</span>
            <span className="font-display text-2xl text-bone tracking-wider group-hover:text-rose transition">
              Chronicle
            </span>
          </Link>
          <nav className="ml-4 hidden md:flex gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm transition border ${
                    isActive
                      ? 'bg-blood/20 border-blood/40 text-bone'
                      : 'border-transparent text-ash hover:text-bone hover:bg-velvet/40'
                  }`
                }
              >
                <span className="mr-1">{n.emoji}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => nav('/profile')}
              className="text-sm text-ash hover:text-bone hidden sm:inline"
              title="Профиль"
            >
              {displayName || user?.email}
            </button>
            <button onClick={async () => { await signOut(); nav('/login'); }} className="btn-ghost text-sm">
              Выйти
            </button>
          </div>
        </div>
        {/* Мобильная навигация */}
        <nav className="md:hidden flex gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm whitespace-nowrap border ${
                  isActive ? 'bg-blood/20 border-blood/40 text-bone' : 'border-transparent text-ash'
                }`
              }
            >
              {n.emoji} {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>

      <footer className="relative z-10 max-w-6xl mx-auto px-4 py-8 text-center text-ash/60 text-xs">
        Сделано в темноте · Vampire: The Masquerade 5e Chronicle
      </footer>
    </div>
  );
}
