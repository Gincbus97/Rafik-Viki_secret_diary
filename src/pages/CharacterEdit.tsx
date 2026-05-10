import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  CLANS, SECTS, PREDATOR_TYPES, DEFAULT_DISCIPLINES, CREATURE_KINDS,
  CLAN_BANES, CLAN_COMPULSIONS,
  type Character, type Discipline, type LocationItem, type CreatureKind,
} from '@/lib/types';
import Slider from '@/components/Slider';

const EMPTY: Partial<Character> = {
  name: '', is_pc: false, kind: 'kindred', portrait_url: '', clan: '', sect: 'Unknown',
  generation: null, sire_id: null, embrace_age: '', status_in_sect: '',
  location_id: null, short_desc: '', biography: '',
  disciplines: [], humanity: 7, hunger: 1, reputation: 0,
  bane: '', compulsion: '', predator_type: '', notes: '',
};

interface Props { mode: 'new' | 'edit'; }

export default function CharacterEdit({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [form, setForm] = useState<Partial<Character>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['character', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('characters').select('*').eq('id', id!).single();
      if (error) throw error;
      return data as unknown as Character;
    },
    enabled: mode === 'edit' && !!id,
  });

  const characters = useQuery({
    queryKey: ['characters-mini'],
    queryFn: async () => {
      const { data, error } = await supabase.from('characters').select('id,name').order('name');
      if (error) throw error;
      return data as unknown as Pick<Character,'id'|'name'>[];
    },
  });

  const locations = useQuery({
    queryKey: ['locations-mini'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('id,name').order('name');
      if (error) throw error;
      return data as unknown as Pick<LocationItem,'id'|'name'>[];
    },
  });

  useEffect(() => {
    if (mode === 'edit' && existing.data) setForm(existing.data);
  }, [mode, existing.data]);

  function set<K extends keyof Character>(k: K, v: Character[K] | null | undefined) {
    setForm(s => ({ ...s, [k]: v as Character[K] }));
  }

  function setDiscipline(idx: number, patch: Partial<Discipline>) {
    const next = [...(form.disciplines ?? [])];
    next[idx] = { ...next[idx], ...patch };
    set('disciplines', next as Discipline[]);
  }
  function addDiscipline() {
    set('disciplines', [...(form.disciplines ?? []), { name: '', level: 1 }] as Discipline[]);
  }
  function removeDiscipline(idx: number) {
    const next = [...(form.disciplines ?? [])];
    next.splice(idx, 1);
    set('disciplines', next as Discipline[]);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...form,
        created_by: user?.id ?? null,
      };
      // нормализация пустых строк
      ['portrait_url','clan','embrace_age','status_in_sect','short_desc','biography',
       'bane','compulsion','predator_type','notes']
        .forEach(k => { if (payload[k] === '') payload[k] = null; });
      if ((payload.generation as unknown) === '') payload.generation = null;

      if (mode === 'new') {
        const { data, error } = await supabase.from('characters').insert(payload).select('id').single();
        if (error) throw error;
        return data.id as string;
      } else {
        const { error } = await supabase.from('characters').update(payload).eq('id', id!);
        if (error) throw error;
        return id as string;
      }
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ['characters'] });
      qc.invalidateQueries({ queryKey: ['character', newId] });
      qc.invalidateQueries({ queryKey: ['dash-chars'] });
      nav(`/characters/${newId}`);
    },
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try { await save.mutateAsync(); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось сохранить'); }
    finally { setSaving(false); }
  }

  if (mode === 'edit' && existing.isLoading) {
    return <p className="subtle">Открываем досье...</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-3xl mx-auto">
      <h1 className="heading">{mode === 'new' ? '🦇 Новый персонаж' : `✒️ ${form.name || 'Редактирование'}`}</h1>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.is_pc}
              onChange={e => set('is_pc', e.target.checked)}
              className="w-4 h-4 accent-blood"
            />
            <span className="text-bone">Игровой персонаж (PC)</span>
          </label>
          <div className="flex gap-1 bg-velvet/40 p-1 rounded-lg">
            {CREATURE_KINDS.map(k => (
              <button
                key={k.value}
                type="button"
                onClick={() => set('kind', k.value as CreatureKind)}
                className={`px-3 py-1 text-sm rounded transition ${
                  form.kind === k.value ? 'bg-blood text-bone' : 'text-ash hover:text-bone'
                }`}
              >
                {k.emoji} {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Имя *</label>
            <input className="input" required value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="label">URL портрета</label>
            <input
              className="input"
              type="url"
              placeholder="https://..."
              value={form.portrait_url ?? ''}
              onChange={e => set('portrait_url', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Клан</label>
            <select
              className="input"
              value={form.clan ?? ''}
              onChange={e => {
                const newClan = e.target.value;
                setForm(s => {
                  const next: Partial<Character> = { ...s, clan: newClan || null };
                  // Автоподстановка bane/compulsion если поля пустые и в нашем словаре
                  if (newClan && (!s.bane || s.bane.trim() === '') && CLAN_BANES[newClan]) {
                    next.bane = CLAN_BANES[newClan];
                  }
                  if (newClan && (!s.compulsion || s.compulsion.trim() === '') && CLAN_COMPULSIONS[newClan]) {
                    next.compulsion = CLAN_COMPULSIONS[newClan];
                  }
                  return next;
                });
              }}
            >
              <option value="">— не выбран —</option>
              {CLANS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Секта</label>
            <select
              className="input"
              value={SECTS.includes(form.sect as any) ? (form.sect ?? 'Unknown') : '__custom__'}
              onChange={e => {
                if (e.target.value === '__custom__') {
                  // оставить текущее значение, активировать поле ввода ниже
                  if (SECTS.includes(form.sect as any)) set('sect', '');
                } else {
                  set('sect', e.target.value);
                }
              }}
            >
              {SECTS.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="__custom__">Другое (вписать)…</option>
            </select>
            {!SECTS.includes(form.sect as any) && (
              <input
                className="input mt-2"
                placeholder="Например: Black Hand, Inconnu..."
                value={form.sect ?? ''}
                onChange={e => set('sect', e.target.value)}
              />
            )}
          </div>
          <div>
            <label className="label">Поколение</label>
            <input
              className="input"
              type="number"
              min={4}
              max={16}
              value={form.generation ?? ''}
              onChange={e => set('generation', e.target.value === '' ? null : parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Sire (родитель в крови)</label>
            <select
              className="input"
              value={form.sire_id ?? ''}
              onChange={e => set('sire_id', e.target.value || null)}
            >
              <option value="">— нет —</option>
              {(characters.data ?? []).filter(c => c.id !== id).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Возраст embrace</label>
            <input className="input" placeholder="напр. 1923 / 102 года назад" value={form.embrace_age ?? ''} onChange={e => set('embrace_age', e.target.value)} />
          </div>
          <div>
            <label className="label">Статус в секте</label>
            <input className="input" value={form.status_in_sect ?? ''} onChange={e => set('status_in_sect', e.target.value)} />
          </div>
          <div>
            <label className="label">Локация</label>
            <select
              className="input"
              value={form.location_id ?? ''}
              onChange={e => set('location_id', e.target.value || null)}
            >
              <option value="">— не выбрана —</option>
              {(locations.data ?? []).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Predator Type</label>
            <select className="input" value={form.predator_type ?? ''} onChange={e => set('predator_type', e.target.value)}>
              <option value="">—</option>
              {PREDATOR_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Краткое описание</label>
          <textarea className="input min-h-[64px]" value={form.short_desc ?? ''} onChange={e => set('short_desc', e.target.value)} />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl">Шкалы</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Slider label="Humanity" min={0} max={10} value={form.humanity ?? 7} onChange={v => set('humanity', v)} />
          <Slider label="Hunger"   min={0} max={5}  value={form.hunger   ?? 1} onChange={v => set('hunger', v)} />
          <Slider label="Известность / статус" min={0} max={10} value={form.reputation ?? 0} onChange={v => set('reputation', v)} />
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl">Disciplines</h2>
          <button type="button" onClick={addDiscipline} className="btn-ghost text-sm">+ добавить</button>
        </div>
        {(form.disciplines ?? []).length === 0 && <p className="subtle">Никаких сил пока нет.</p>}
        <div className="space-y-2">
          {(form.disciplines ?? []).map((d, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                list="disc-list"
                className="input flex-1"
                placeholder="Auspex / Dominate ..."
                value={d.name}
                onChange={e => setDiscipline(i, { name: e.target.value })}
              />
              <select
                className="input w-24"
                value={d.level}
                onChange={e => setDiscipline(i, { level: parseInt(e.target.value) })}
              >
                {[1,2,3,4,5].map(n => <option key={n} value={n}>•{'•'.repeat(n-1)} {n}</option>)}
              </select>
              <button type="button" onClick={() => removeDiscipline(i)} className="btn-danger text-sm">×</button>
            </div>
          ))}
          <datalist id="disc-list">
            {DEFAULT_DISCIPLINES.map(d => <option key={d} value={d} />)}
          </datalist>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-xl">Глубже</h2>
        <div>
          <label className="label">Биография</label>
          <textarea className="input min-h-[140px]" value={form.biography ?? ''} onChange={e => set('biography', e.target.value)} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Bane</label>
              {form.clan && CLAN_BANES[form.clan] && (
                <button
                  type="button"
                  className="text-xs text-rose hover:text-bloodlight underline-offset-2 hover:underline"
                  onClick={() => set('bane', CLAN_BANES[form.clan!])}
                >
                  ↳ из правил {form.clan}
                </button>
              )}
            </div>
            <textarea
              className="input min-h-[100px]"
              placeholder={form.clan && CLAN_BANES[form.clan] ? CLAN_BANES[form.clan] : 'Опиши бан клана или личный...'}
              value={form.bane ?? ''}
              onChange={e => set('bane', e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Compulsion</label>
              {form.clan && CLAN_COMPULSIONS[form.clan] && (
                <button
                  type="button"
                  className="text-xs text-rose hover:text-bloodlight underline-offset-2 hover:underline"
                  onClick={() => set('compulsion', CLAN_COMPULSIONS[form.clan!])}
                >
                  ↳ из правил {form.clan}
                </button>
              )}
            </div>
            <textarea
              className="input min-h-[100px]"
              placeholder={form.clan && CLAN_COMPULSIONS[form.clan] ? CLAN_COMPULSIONS[form.clan] : 'Compulsion клана или одноразовая...'}
              value={form.compulsion ?? ''}
              onChange={e => set('compulsion', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Заметки рассказчика</label>
          <textarea className="input min-h-[80px]" value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
        </div>
      </section>

      {err && <p className="text-rose">{err}</p>}

      <div className="flex gap-2">
        <button className="btn-primary" disabled={saving}>
          {saving ? 'Сохраняем...' : (mode === 'new' ? 'Создать' : 'Сохранить')}
        </button>
        <button type="button" className="btn-ghost" onClick={() => nav(-1)}>Отмена</button>
      </div>
    </form>
  );
}
