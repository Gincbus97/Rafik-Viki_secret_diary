import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  CLANS, SECTS, DEFAULT_DISCIPLINES, CREATURE_KINDS, LIFE_STATUSES,
  CLAN_BANES, CLAN_COMPULSIONS, GROUP_SIZES, GROUP_DISPOSITIONS,
  type Character, type Discipline, type LocationItem, type CreatureKind, type LifeStatus,
  type KindredData, type GhoulData, type HumanData, type OtherData, type GroupData,
} from '@/lib/types';

const EMPTY: Partial<Character> = {
  name: '', is_pc: false, kind: 'kindred', life_status: 'active', kind_data: {},
  enemies: [],
  portrait_url: '', clan: '', sect: 'Unknown',
  generation: null, sire_id: null, embrace_age: '', status_in_sect: '',
  location_id: null, short_desc: '', biography: '',
  disciplines: [],
  bane: '', compulsion: '', notes: '',
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
    if (mode === 'edit' && existing.data) {
      setForm({
        ...existing.data,
        kind_data: existing.data.kind_data ?? {},
      });
    }
  }, [mode, existing.data]);

  function set<K extends keyof Character>(k: K, v: Character[K] | null | undefined) {
    setForm(s => ({ ...s, [k]: v as Character[K] }));
  }

  function setKindData(patch: Record<string, unknown>) {
    setForm(s => ({ ...s, kind_data: { ...(s.kind_data ?? {}), ...patch } }));
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
      // нормализация
      ['portrait_url','clan','embrace_age','status_in_sect','short_desc','biography','bane','compulsion','notes']
        .forEach(k => { if (payload[k] === '') payload[k] = null; });
      if ((payload.generation as unknown) === '') payload.generation = null;
      // Predator Type больше не редактируется в UI, но колонку оставили — чистим если она была пуста
      if (payload.predator_type === '') payload.predator_type = null;

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
      qc.invalidateQueries({ queryKey: ['dash-pcs'] });
      qc.invalidateQueries({ queryKey: ['mm-characters'] });
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

  const kind = (form.kind ?? 'kindred') as CreatureKind;
  const kindData = (form.kind_data ?? {}) as GhoulData & HumanData & OtherData;

  return (
    <form onSubmit={submit} className="space-y-4 max-w-3xl mx-auto">
      <h1 className="heading">{mode === 'new' ? '🦇 Новый персонаж' : `✒️ ${form.name || 'Редактирование'}`}</h1>

      {/* ---------- Базовая шапка: общая для всех kinds ---------- */}
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
          <div className="flex flex-wrap gap-1 bg-velvet/40 p-1 rounded-lg">
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
            <label className="label">Статус</label>
            <select className="input" value={form.life_status ?? 'active'} onChange={e => set('life_status', e.target.value as LifeStatus)}>
              {LIFE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
            </select>
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
        </div>

        <div>
          <label className="label">Краткое описание</label>
          <textarea className="input min-h-[64px]" value={form.short_desc ?? ''} onChange={e => set('short_desc', e.target.value)} />
        </div>
      </section>

      {/* ---------- Раздел под конкретный kind ---------- */}
      {kind === 'kindred' && (
        <KindredSection
          form={form}
          set={set}
          setKindData={setKindData}
          kindData={(form.kind_data ?? {}) as KindredData}
          characters={(characters.data ?? []).filter(c => c.id !== id)}
        />
      )}

      {kind === 'ghoul' && (
        <GhoulSection
          kindData={kindData}
          setKindData={setKindData}
          characters={(characters.data ?? []).filter(c => c.id !== id)}
        />
      )}

      {kind === 'human' && (
        <HumanSection kindData={kindData} setKindData={setKindData} />
      )}

      {kind === 'other' && (
        <OtherSection kindData={kindData} setKindData={setKindData} />
      )}

      {kind === 'group' && (
        <GroupSection
          kindData={kindData as GroupData}
          setKindData={setKindData}
          characters={(characters.data ?? []).filter(c => c.id !== id)}
        />
      )}

      {/* Враги — общее поле для всех типов */}
      <EnemiesSection
        enemies={form.enemies ?? []}
        setEnemies={(next) => set('enemies', next as Character['enemies'])}
        characters={(characters.data ?? []).filter(c => c.id !== id)}
      />

      {/* ---------- Disciplines (видимы у Kindred и Ghoul) ---------- */}
      {(kind === 'kindred' || kind === 'ghoul') && (
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Disciplines {kind === 'ghoul' && <span className="subtle text-sm">(полученные через витае)</span>}</h2>
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
      )}

      {/* ---------- Bane и Compulsion (только Kindred с автоподстановкой по клану) ---------- */}
      {kind === 'kindred' && (
        <section className="card space-y-3">
          <h2 className="text-xl">Bane и Compulsion</h2>
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
                placeholder={form.clan && CLAN_BANES[form.clan] ? CLAN_BANES[form.clan] : 'Опиши бан...'}
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
        </section>
      )}

      {/* ---------- Биография и заметки рассказчика — общее ---------- */}
      <section className="card space-y-3">
        <div>
          <label className="label">Биография</label>
          <textarea className="input min-h-[140px]" value={form.biography ?? ''} onChange={e => set('biography', e.target.value)} />
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

// =============================== Kindred ===============================
function KindredSection({
  form, set, kindData, setKindData, characters,
}: {
  form: Partial<Character>;
  set: <K extends keyof Character>(k: K, v: Character[K] | null | undefined) => void;
  kindData: KindredData;
  setKindData: (p: Record<string, unknown>) => void;
  characters: Pick<Character,'id'|'name'>[];
}) {
  const isCustomSect = !SECTS.includes(form.sect as any);
  const touchstones = kindData.touchstones ?? [];
  const bloodBonds = kindData.blood_bonded_to ?? [];
  const herd = kindData.herd ?? [];
  const allies = kindData.mortal_allies ?? [];
  const charsById = new Map(characters.map(c => [c.id, c]));

  function addTouchstone(cid: string) {
    if (!cid || touchstones.includes(cid)) return;
    setKindData({ touchstones: [...touchstones, cid] });
  }
  function removeTouchstone(cid: string) {
    setKindData({ touchstones: touchstones.filter(t => t !== cid) });
  }
  function addHerd(cid: string) {
    if (!cid || herd.includes(cid)) return;
    setKindData({ herd: [...herd, cid] });
  }
  function removeHerd(cid: string) {
    setKindData({ herd: herd.filter(t => t !== cid) });
  }
  function addAlly(cid: string) {
    if (!cid || allies.includes(cid)) return;
    setKindData({ mortal_allies: [...allies, cid] });
  }
  function removeAlly(cid: string) {
    setKindData({ mortal_allies: allies.filter(t => t !== cid) });
  }
  function addBond() {
    setKindData({ blood_bonded_to: [...bloodBonds, { character_id: '', level: 1 }] });
  }
  function patchBond(idx: number, patch: Partial<{ character_id: string; level: 1 | 2 | 3 }>) {
    const next = [...bloodBonds];
    next[idx] = { ...next[idx], ...patch };
    setKindData({ blood_bonded_to: next });
  }
  function removeBond(idx: number) {
    const next = [...bloodBonds];
    next.splice(idx, 1);
    setKindData({ blood_bonded_to: next });
  }

  return (
    <section className="card space-y-4">
      <h2 className="text-xl">🧛 Kindred</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label">Клан</label>
          <select
            className="input"
            value={form.clan ?? ''}
            onChange={e => {
              const newClan = e.target.value;
              set('clan', newClan || null);
              if (newClan && (!form.bane || form.bane.trim() === '') && CLAN_BANES[newClan]) set('bane', CLAN_BANES[newClan]);
              if (newClan && (!form.compulsion || form.compulsion.trim() === '') && CLAN_COMPULSIONS[newClan]) set('compulsion', CLAN_COMPULSIONS[newClan]);
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
            value={isCustomSect ? '__custom__' : (form.sect ?? 'Unknown')}
            onChange={e => {
              if (e.target.value === '__custom__') {
                if (!isCustomSect) set('sect', '');
              } else {
                set('sect', e.target.value);
              }
            }}
          >
            {SECTS.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="__custom__">Другое (вписать)…</option>
          </select>
          {isCustomSect && (
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
            {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Возраст embrace</label>
          <input className="input" placeholder="напр. 1923 / 102 года назад" value={form.embrace_age ?? ''} onChange={e => set('embrace_age', e.target.value)} />
        </div>
        <div>
          <label className="label">Статус в секте</label>
          <input className="input" placeholder="Ancilla, Harpy, Sheriff..." value={form.status_in_sect ?? ''} onChange={e => set('status_in_sect', e.target.value)} />
        </div>
      </div>

      {/* Touchstones */}
      <div className="border-t border-gold/10 pt-4">
        <label className="label">Touchstones — смертные якоря Humanity</label>
        <p className="text-xs text-ash mb-2">
          Появятся на карте автоматически как сплошная линия от тебя к якорю.
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {touchstones.length === 0 && <p className="subtle text-sm">Якорей пока нет.</p>}
          {touchstones.map(tid => (
            <span key={tid} className="chip">
              {charsById.get(tid)?.name ?? '...'}
              <button type="button" onClick={() => removeTouchstone(tid)} className="ml-1 text-rose">×</button>
            </span>
          ))}
        </div>
        <select className="input" value="" onChange={e => addTouchstone(e.target.value)}>
          <option value="">+ добавить touchstone…</option>
          {characters.filter(c => !touchstones.includes(c.id)).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Herd */}
      <div className="border-t border-gold/10 pt-4">
        <label className="label">Стадо — источники крови</label>
        <p className="text-xs text-ash mb-2">
          Смертные, на которых ты регулярно охотишься. Появятся на карте автоматически.
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {herd.length === 0 && <p className="subtle text-sm">Пусто.</p>}
          {herd.map(cid => (
            <span key={cid} className="chip">
              {charsById.get(cid)?.name ?? '...'}
              <button type="button" onClick={() => removeHerd(cid)} className="ml-1 text-rose">×</button>
            </span>
          ))}
        </div>
        <select className="input" value="" onChange={e => addHerd(e.target.value)}>
          <option value="">+ добавить в стадо…</option>
          {characters.filter(c => !herd.includes(c.id)).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Mortal Allies */}
      <div className="border-t border-gold/10 pt-4">
        <label className="label">Союзники-смертные</label>
        <p className="text-xs text-ash mb-2">
          V5 Allies — смертные, которые тебе помогают (журналисты, копы, врачи, охотники-конкуренты).
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {allies.length === 0 && <p className="subtle text-sm">Пусто.</p>}
          {allies.map(cid => (
            <span key={cid} className="chip">
              {charsById.get(cid)?.name ?? '...'}
              <button type="button" onClick={() => removeAlly(cid)} className="ml-1 text-rose">×</button>
            </span>
          ))}
        </div>
        <select className="input" value="" onChange={e => addAlly(e.target.value)}>
          <option value="">+ добавить союзника…</option>
          {characters.filter(c => !allies.includes(c.id)).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Blood Bonds */}
      <div className="border-t border-gold/10 pt-4">
        <label className="label">Blood Bonds — кровные узы (кому ты подчинён и на каком уровне)</label>
        <p className="text-xs text-ash mb-2">
          Уровень 1–3. Появятся на карте отдельной линией. На уровне 3 — полный bond.
        </p>
        <div className="space-y-2">
          {bloodBonds.length === 0 && <p className="subtle text-sm">Bond'ов нет.</p>}
          {bloodBonds.map((b, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                className="input flex-1"
                value={b.character_id}
                onChange={e => patchBond(i, { character_id: e.target.value })}
              >
                <option value="">— выбери —</option>
                {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                className="input w-32"
                value={b.level}
                onChange={e => patchBond(i, { level: parseInt(e.target.value) as 1 | 2 | 3 })}
              >
                <option value={1}>уровень 1</option>
                <option value={2}>уровень 2</option>
                <option value={3}>уровень 3 (полный)</option>
              </select>
              <button type="button" onClick={() => removeBond(i)} className="btn-danger text-sm">×</button>
            </div>
          ))}
          <button type="button" onClick={addBond} className="btn-ghost text-sm">+ добавить bond</button>
        </div>
      </div>
    </section>
  );
}

// =============================== Ghoul ===============================
function GhoulSection({
  kindData, setKindData, characters,
}: {
  kindData: GhoulData;
  setKindData: (p: Record<string, unknown>) => void;
  characters: Pick<Character,'id'|'name'>[];
}) {
  return (
    <section className="card space-y-4">
      <h2 className="text-xl">🩸 Ghoul</h2>
      <p className="subtle text-sm">Смертный, прикормленный витае Kindred. Тут — про связь с домитором и зависимость.</p>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label">Домитор (хозяин)</label>
          <select
            className="input"
            value={kindData.domitor_id ?? ''}
            onChange={e => setKindData({ domitor_id: e.target.value || null })}
          >
            <option value="">— не выбран —</option>
            {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Лет служения</label>
          <input
            type="number"
            className="input"
            value={kindData.years_served ?? ''}
            onChange={e => setKindData({ years_served: e.target.value === '' ? undefined : parseInt(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Уровень зависимости (0–5)</label>
          <input
            type="number"
            min={0}
            max={5}
            className="input"
            value={kindData.addiction_level ?? 0}
            onChange={e => setKindData({ addiction_level: parseInt(e.target.value || '0') })}
          />
        </div>
        <div>
          <label className="label">Blood Bond уровень (0–3)</label>
          <input
            type="number"
            min={0}
            max={3}
            className="input"
            value={kindData.bond_level ?? 0}
            onChange={e => setKindData({ bond_level: parseInt(e.target.value || '0') })}
          />
        </div>
      </div>
    </section>
  );
}

// =============================== Human ===============================
function HumanSection({
  kindData, setKindData,
}: {
  kindData: HumanData;
  setKindData: (p: Record<string, unknown>) => void;
}) {
  return (
    <section className="card space-y-4">
      <h2 className="text-xl">👤 Human (смертный)</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label">Профессия / род занятий</label>
          <input
            className="input"
            placeholder="Журналист, охотник, политик..."
            value={kindData.profession ?? ''}
            onChange={e => setKindData({ profession: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Возраст</label>
          <input
            type="number"
            className="input"
            value={kindData.age ?? ''}
            onChange={e => setKindData({ age: e.target.value === '' ? undefined : parseInt(e.target.value) })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Принадлежность / на чьей стороне</label>
          <input
            className="input"
            placeholder="Society of Leopold, Second Inquisition, Touchstone of {имя PC}..."
            value={kindData.allegiance ?? ''}
            onChange={e => setKindData({ allegiance: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-blood"
              checked={!!kindData.masquerade_aware}
              onChange={e => setKindData({ masquerade_aware: e.target.checked })}
            />
            <span className="text-bone">Знает о существовании Kindred (Masquerade aware)</span>
          </label>
        </div>
      </div>
    </section>
  );
}

// =============================== Group / Mob ===============================
function GroupSection({
  kindData, setKindData, characters,
}: {
  kindData: GroupData;
  setKindData: (p: Record<string, unknown>) => void;
  characters: Pick<Character,'id'|'name'>[];
}) {
  return (
    <section className="card space-y-4 border-gold/30 border-double border-[3px]">
      <h2 className="text-xl">👥 Group / Mob</h2>
      <p className="subtle text-sm">
        Безликая толпа смертных как единая сущность — банда, отряд полиции,
        охотничий ковен, толпа протестующих, оперативная группа. Появится на карте
        как один узел с двойной рамкой.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label">Размер</label>
          <select
            className="input"
            value={kindData.size_estimate ?? 'small'}
            onChange={e => setKindData({ size_estimate: e.target.value })}
          >
            {GROUP_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Отношение к PC</label>
          <select
            className="input"
            value={kindData.disposition ?? 'neutral'}
            onChange={e => setKindData({ disposition: e.target.value })}
          >
            {GROUP_DISPOSITIONS.map(d => (
              <option key={d.value} value={d.value}>{d.emoji} {d.label}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Состав</label>
          <textarea
            className="input min-h-[60px]"
            placeholder="напр. 12 фанатиков с факелами, 3 стрелка, 1 вожак на пикапе"
            value={kindData.composition ?? ''}
            onChange={e => setKindData({ composition: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Лидер (если есть)</label>
          <select
            className="input"
            value={kindData.leader_id ?? ''}
            onChange={e => setKindData({ leader_id: e.target.value || null })}
          >
            <option value="">— нет / коллективный —</option>
            {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
    </section>
  );
}

// =============================== Враги (общий для всех kind) ===============================
function EnemiesSection({
  enemies, setEnemies, characters,
}: {
  enemies: string[];
  setEnemies: (next: string[]) => void;
  characters: Pick<Character,'id'|'name'>[];
}) {
  const charsById = new Map(characters.map(c => [c.id, c]));
  function add(cid: string) {
    if (!cid || enemies.includes(cid)) return;
    setEnemies([...enemies, cid]);
  }
  function remove(cid: string) {
    setEnemies(enemies.filter(e => e !== cid));
  }
  return (
    <section className="card border-rose/30 space-y-2">
      <h2 className="text-xl">⚔️ Враги</h2>
      <p className="subtle text-sm">
        Кого этот персонаж считает врагом. Появятся на карте красной враждебной стрелкой.
        Это <b>одностороннее</b> чувство — если враждуют обоюдно, пропиши с обеих сторон.
      </p>
      <div className="flex flex-wrap gap-2 mb-2">
        {enemies.length === 0 && <p className="subtle text-sm">Никаких врагов. Пока что.</p>}
        {enemies.map(eid => (
          <span key={eid} className="chip border-rose/40 bg-rose/10 text-rose">
            {charsById.get(eid)?.name ?? '...'}
            <button type="button" onClick={() => remove(eid)} className="ml-1">×</button>
          </span>
        ))}
      </div>
      <select className="input" value="" onChange={e => add(e.target.value)}>
        <option value="">+ добавить врага…</option>
        {characters.filter(c => !enemies.includes(c.id)).map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </section>
  );
}

// =============================== Other ===============================
function OtherSection({
  kindData, setKindData,
}: {
  kindData: OtherData;
  setKindData: (p: Record<string, unknown>) => void;
}) {
  return (
    <section className="card space-y-4">
      <h2 className="text-xl">✨ Other</h2>
      <p className="subtle text-sm">Не вампир, не гуль, не обычный человек. Werewolf, Mage, дух, призрак, что угодно.</p>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label">Тип существа</label>
          <input
            className="input"
            placeholder="Werewolf, Mage, Wraith, Demon..."
            value={kindData.type_label ?? ''}
            onChange={e => setKindData({ type_label: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="label">Особенности</label>
        <textarea
          className="input min-h-[80px]"
          placeholder="Способности, слабости, отношения с миром Kindred..."
          value={kindData.notes ?? ''}
          onChange={e => setKindData({ notes: e.target.value })}
        />
      </div>
    </section>
  );
}
