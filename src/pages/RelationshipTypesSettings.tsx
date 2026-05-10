import { useEffect, useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RelationshipType, RelationshipCategory } from '@/lib/types';

export default function RelationshipTypesSettings() {
  const qc = useQueryClient();

  const types = useQuery({
    queryKey: ['rel-types-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relationship_types').select('*').order('category').order('name');
      if (error) throw error;
      return data as unknown as RelationshipType[];
    },
  });

  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState<RelationshipCategory>('personal');
  const [newColor, setNewColor] = useState('#a89c9b');
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) return;
      const { error } = await supabase.from('relationship_types').insert({
        name: newName.trim(),
        category: newCat,
        color: newColor,
        dashed: newCat === 'personal',
        thickness: 1.0,
        is_builtin: false,
        hidden_from_manual: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rel-types-all'] });
      qc.invalidateQueries({ queryKey: ['rel-types'] });
      qc.invalidateQueries({ queryKey: ['mm-rel-types'] });
      setNewName('');
    },
  });

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setCreating(true);
    try { await create.mutateAsync(); }
    catch (e: any) { setErr(e?.message ?? 'Не удалось создать тип'); }
    finally { setCreating(false); }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="heading">⚙ Типы связей</h1>
        <p className="subtle">
          Управляй встроенными и кастомными типами. Цвет, пунктир и толщина применяются на карте автоматически.
          Тип со включённым «🚫 manual» не появится в выпадающем списке при ручном добавлении связи —
          такие нужны для механики, которая выводится из полей персонажа (Sire, Touchstone, Blood Bond, Ghoul).
        </p>
      </div>

      {/* ---- Создание нового типа ---- */}
      <form onSubmit={onCreate} className="card flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="label">Новый тип</label>
          <input
            className="input"
            placeholder="напр. Confidant"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Категория</label>
          <select className="input" value={newCat} onChange={e => setNewCat(e.target.value as RelationshipCategory)}>
            <option value="personal">❤ Личное</option>
            <option value="mechanic">⚙ Механика</option>
          </select>
        </div>
        <div>
          <label className="label">Цвет</label>
          <input type="color" className="h-10 w-14 rounded-lg bg-velvet/40 border border-gold/15 p-1 cursor-pointer" value={newColor} onChange={e => setNewColor(e.target.value)} />
        </div>
        <button className="btn-primary" disabled={creating || !newName.trim()}>+ Добавить</button>
        {err && <p className="text-rose text-sm w-full">{err}</p>}
      </form>

      {/* ---- Таблица типов ---- */}
      {types.isLoading ? (
        <p className="subtle">Грузим...</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-ash text-xs uppercase tracking-widest border-b border-gold/15">
              <tr>
                <th className="text-left p-3">Имя</th>
                <th className="text-left p-3">Категория</th>
                <th className="text-left p-3">Цвет</th>
                <th className="text-left p-3">Пунктир</th>
                <th className="text-left p-3">Толщина</th>
                <th className="text-left p-3">Скрыт из manual</th>
                <th className="text-left p-3">Превью</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {(types.data ?? []).map(t => (
                <TypeRow key={t.id} type={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TypeRow({ type }: { type: RelationshipType }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(type);

  useEffect(() => setDraft(type), [type]);

  const save = useMutation({
    mutationFn: async (patch: Partial<RelationshipType>) => {
      const { error } = await supabase
        .from('relationship_types')
        .update(patch as any)
        .eq('id', type.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rel-types-all'] });
      qc.invalidateQueries({ queryKey: ['rel-types'] });
      qc.invalidateQueries({ queryKey: ['mm-rel-types'] });
      qc.invalidateQueries({ queryKey: ['mm-relationships'] });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('relationship_types').delete().eq('id', type.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rel-types-all'] });
      qc.invalidateQueries({ queryKey: ['rel-types'] });
      qc.invalidateQueries({ queryKey: ['mm-rel-types'] });
    },
  });

  function patch<K extends keyof RelationshipType>(k: K, v: RelationshipType[K]) {
    setDraft(s => ({ ...s, [k]: v }));
    save.mutate({ [k]: v });
  }

  return (
    <tr className="border-b border-gold/5 hover:bg-velvet/20">
      <td className="p-3 align-middle">
        <input
          className="input"
          value={draft.name}
          onChange={e => setDraft(s => ({ ...s, name: e.target.value }))}
          onBlur={() => { if (draft.name !== type.name) save.mutate({ name: draft.name }); }}
        />
      </td>
      <td className="p-3 align-middle">
        <select
          className="input"
          value={draft.category}
          onChange={e => patch('category', e.target.value as RelationshipCategory)}
        >
          <option value="personal">❤ Личное</option>
          <option value="mechanic">⚙ Механика</option>
        </select>
      </td>
      <td className="p-3 align-middle">
        <input
          type="color"
          className="h-9 w-12 rounded-lg bg-velvet/40 border border-gold/15 p-1 cursor-pointer"
          value={draft.color}
          onChange={e => patch('color', e.target.value)}
        />
      </td>
      <td className="p-3 align-middle">
        <input
          type="checkbox"
          className="w-4 h-4 accent-blood"
          checked={!!draft.dashed}
          onChange={e => patch('dashed', e.target.checked)}
        />
      </td>
      <td className="p-3 align-middle">
        <input
          type="number"
          step={0.1}
          min={0.5}
          max={5}
          className="input w-20"
          value={draft.thickness}
          onChange={e => setDraft(s => ({ ...s, thickness: parseFloat(e.target.value) }))}
          onBlur={() => { if (draft.thickness !== type.thickness) save.mutate({ thickness: draft.thickness }); }}
        />
      </td>
      <td className="p-3 align-middle">
        <input
          type="checkbox"
          className="w-4 h-4 accent-blood"
          checked={!!draft.hidden_from_manual}
          onChange={e => patch('hidden_from_manual', e.target.checked)}
          title="Если включить — этот тип нельзя будет выбрать в форме связи. Используется для связей-механик, которые подтягиваются из полей персонажа."
        />
      </td>
      <td className="p-3 align-middle">
        {/* Превью линии */}
        <svg width="80" height="20" viewBox="0 0 80 20">
          <line
            x1={2} y1={10} x2={78} y2={10}
            stroke={draft.color}
            strokeWidth={Math.max(1, draft.thickness * 2)}
            strokeDasharray={draft.dashed ? '6 4' : undefined}
          />
        </svg>
      </td>
      <td className="p-3 align-middle text-right whitespace-nowrap">
        {type.is_builtin ? (
          <span className="chip text-xs">встроенный</span>
        ) : (
          <button
            onClick={() => { if (confirm(`Удалить тип «${type.name}»? Все связи этого типа сломаются.`)) remove.mutate(); }}
            className="text-rose hover:text-bloodlight text-sm"
            title="Удалить"
          >
            ×
          </button>
        )}
      </td>
    </tr>
  );
}
