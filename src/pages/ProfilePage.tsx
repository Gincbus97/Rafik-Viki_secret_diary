import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Profile, Character, PersonalNote } from '@/lib/types';

const HIDEABLE_FIELDS = [
  { key: 'humanity',     label: 'Humanity' },
  { key: 'hunger',       label: 'Hunger' },
  { key: 'reputation',   label: 'Известность' },
  { key: 'biography',    label: 'Биография' },
  { key: 'bane',         label: 'Bane' },
  { key: 'compulsion',   label: 'Compulsion' },
  { key: 'disciplines',  label: 'Disciplines' },
  { key: 'notes',        label: 'Заметки рассказчика' },
] as const;

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', user!.id).single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user,
  });

  const myNotes = useQuery({
    queryKey: ['my-notes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_notes')
        .select('id,character_id,body,updated_at, characters(id,name,is_pc)')
        .eq('author_id', user!.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as unknown as (PersonalNote & { characters: Pick<Character,'id'|'name'|'is_pc'> })[];
    },
    enabled: !!user,
  });

  const [name, setName] = useState('');
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.display_name ?? '');
      const h = (profile.data.settings as any)?.hideFields ?? [];
      setHidden(Array.isArray(h) ? h : []);
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: name || null,
          settings: { ...(profile.data?.settings ?? {}), hideFields: hidden },
        })
        .eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', user?.id] }),
  });

  function toggleHidden(key: string) {
    setHidden(h => h.includes(key) ? h.filter(x => x !== key) : [...h, key]);
  }

  if (profile.isLoading) return <p className="subtle">Открываем твой пергамент...</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="heading">📖 Профиль</h1>

      <section className="card space-y-3">
        <div>
          <label className="label">Email</label>
          <input className="input" value={user?.email ?? ''} disabled />
        </div>
        <div>
          <label className="label">Имя в чате</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Тореадор Виктория" />
        </div>

        <div>
          <label className="label">Скрывать поля у чужих персонажей в досье</label>
          <p className="text-xs text-ash mb-2">
            Эти поля не будут показываться, когда ты открываешь чужого персонажа.
            Поможет, если рассказчик хочет, чтобы ты не подсматривал.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {HIDEABLE_FIELDS.map(f => (
              <label key={f.key} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" className="w-4 h-4 accent-blood" checked={hidden.includes(f.key)} onChange={() => toggleHidden(f.key)} />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
          <button className="btn-ghost" onClick={() => signOut()}>Выйти</button>
        </div>
      </section>

      <section className="card">
        <h2 className="text-xl mb-2">📝 Мои личные заметки про персонажей</h2>
        {myNotes.isLoading ? <p className="subtle">...</p> :
         (myNotes.data ?? []).length === 0 ? (
          <p className="subtle">Пока ничего не записано. Заметки добавляются прямо в досье персонажа.</p>
         ) : (
          <ul className="space-y-2">
            {myNotes.data!.map(n => (
              <li key={n.id} className="bg-velvet/40 rounded-lg p-3">
                <p className="font-display">
                  <Link to={`/characters/${n.character_id}`} className="link">
                    {n.characters?.name ?? 'неизвестный'}
                  </Link>
                </p>
                <p className="text-bone/90 whitespace-pre-wrap font-hand text-base">{n.body}</p>
              </li>
            ))}
          </ul>
         )}
      </section>
    </div>
  );
}
