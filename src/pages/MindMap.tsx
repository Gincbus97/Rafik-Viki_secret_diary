import { useEffect, useMemo, useState, useCallback, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type Connection,
  useNodesState, useEdgesState,
  ConnectionMode, MarkerType,
  Handle, Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  CLANS, RECIPROCAL,
  type Character, type Relationship, type RelationshipType, type Faction,
} from '@/lib/types';

interface RelEdge extends Relationship {
  type?: { id: string; name: string; category: 'mechanic' | 'personal' };
}

type CharMM = Pick<Character,
  'id'|'name'|'is_pc'|'kind'|'clan'|'sect'|'portrait_url'|'mindmap_x'|'mindmap_y'
>;

// ----- Кастомный узел персонажа -----
function CharacterNode({ data }: {
  data: {
    name: string; is_pc: boolean; kind: string | null;
    clan: string | null; portrait_url: string | null;
    selected?: boolean;
  };
}) {
  // Цветовая кодировка ободка:
  //  - PC          → чёрный (тёмная контрастная рамка с золотым подсветом)
  //  - Vampire     → красный
  //  - Ghoul       → красный (вампироподобные)
  //  - Human       → синий
  //  - Other       → бронзовый
  let borderClass = 'border-2 border-gold/40';
  if (data.is_pc) {
    borderClass = 'border-[3px] border-black ring-2 ring-bone/60';
  } else if (data.kind === 'human') {
    borderClass = 'border-2 border-sky-500/80';
  } else if (data.kind === 'kindred' || data.kind === 'ghoul') {
    borderClass = 'border-2 border-bloodlight';
  }

  const ring = data.selected ? 'outline outline-2 outline-rose outline-offset-2' : '';

  return (
    <div className={`bg-crypt rounded-xl shadow-crypt px-3 py-2 min-w-[150px] ${borderClass} ${ring}`}>
      {/* Хэндлы со всех 4 сторон, чтобы можно было соединять в любую сторону */}
      <Handle id="t" type="source" position={Position.Top}    style={handleStyle} />
      <Handle id="r" type="source" position={Position.Right}  style={handleStyle} />
      <Handle id="b" type="source" position={Position.Bottom} style={handleStyle} />
      <Handle id="l" type="source" position={Position.Left}   style={handleStyle} />
      <Handle id="t2" type="target" position={Position.Top}    style={{ ...handleStyle, opacity: 0 }} />
      <Handle id="r2" type="target" position={Position.Right}  style={{ ...handleStyle, opacity: 0 }} />
      <Handle id="b2" type="target" position={Position.Bottom} style={{ ...handleStyle, opacity: 0 }} />
      <Handle id="l2" type="target" position={Position.Left}   style={{ ...handleStyle, opacity: 0 }} />

      <div className="flex items-center gap-2">
        {data.portrait_url ? (
          <img src={data.portrait_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-velvet flex items-center justify-center text-bone text-sm">
            {data.name?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-display text-sm leading-tight truncate text-bone">{data.name}</div>
          <div className="text-[10px] text-ash leading-tight truncate">
            {data.is_pc ? 'PC' : 'NPC'}
            {data.kind && data.kind !== 'kindred' ? ` · ${data.kind}` : ''}
            {data.clan ? ` · ${data.clan}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
const handleStyle = { width: 8, height: 8, background: '#8a0e1a', border: '1px solid #c8a96a' } as const;

const nodeTypes = { character: CharacterNode };

type FilterFocus = 'all' | 'one';
type CategoryFilter = 'all' | 'mechanic' | 'personal';

export default function MindMap() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const characters = useQuery({
    queryKey: ['mm-characters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('characters')
        .select('id,name,is_pc,kind,clan,sect,portrait_url,mindmap_x,mindmap_y')
        .order('name');
      if (error) throw error;
      return data as unknown as CharMM[];
    },
  });

  const relationships = useQuery({
    queryKey: ['mm-relationships'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relationships')
        .select('id,from_character_id,to_character_id,type_id,description,strength, type:relationship_types(id,name,category)');
      if (error) throw error;
      return data as unknown as RelEdge[];
    },
  });

  const relTypes = useQuery({
    queryKey: ['mm-rel-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relationship_types').select('*').order('category').order('name');
      if (error) throw error;
      return data as unknown as RelationshipType[];
    },
  });

  const factions = useQuery({
    queryKey: ['mm-factions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('factions').select('id,name');
      if (error) throw error;
      return data as unknown as Pick<Faction,'id'|'name'>[];
    },
  });

  const factionMembers = useQuery({
    queryKey: ['mm-faction-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faction_members').select('faction_id,character_id');
      if (error) throw error;
      return data as unknown as { faction_id: string; character_id: string }[];
    },
  });

  // ------------------ Фильтры ------------------
  const [showPcOnly, setShowPcOnly] = useState(false);
  const [clanFilter, setClanFilter] = useState<string>('');
  const [factionFilter, setFactionFilter] = useState<string>('');
  const [minStrength, setMinStrength] = useState<number>(1);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [focusMode, setFocusMode] = useState<FilterFocus>('all');
  const [focusId, setFocusId] = useState<string>('');
  const [hops, setHops] = useState<number>(1);
  const [lockPositions, setLockPositions] = useState(true);

  // ------------------ Создание связи через drag ------------------
  const [pendingConnect, setPendingConnect] = useState<{ from: string; to: string } | null>(null);

  const charactersInFaction = useMemo(() => {
    if (!factionFilter || !factionMembers.data) return null;
    return new Set(factionMembers.data.filter(m => m.faction_id === factionFilter).map(m => m.character_id));
  }, [factionFilter, factionMembers.data]);

  // ====================================================================
  // Считаем видимые узлы и грани
  // ====================================================================
  const computed = useMemo(() => {
    if (!characters.data || !relationships.data) return { nodes: [] as Node[], edges: [] as Edge[] };

    const visibleChars = new Set<string>();
    for (const c of characters.data) {
      if (showPcOnly && !c.is_pc) continue;
      if (clanFilter && c.clan !== clanFilter) continue;
      if (charactersInFaction && !charactersInFaction.has(c.id)) continue;
      visibleChars.add(c.id);
    }

    if (focusMode === 'one' && focusId) {
      const adj = new Map<string, Set<string>>();
      for (const r of relationships.data) {
        if (!adj.has(r.from_character_id)) adj.set(r.from_character_id, new Set());
        if (!adj.has(r.to_character_id))   adj.set(r.to_character_id,   new Set());
        adj.get(r.from_character_id)!.add(r.to_character_id);
        adj.get(r.to_character_id)!.add(r.from_character_id);
      }
      const reachable = new Set<string>([focusId]);
      let frontier = new Set<string>([focusId]);
      for (let i = 0; i < hops; i++) {
        const next = new Set<string>();
        for (const id of frontier) {
          const ns = adj.get(id);
          if (!ns) continue;
          for (const n of ns) if (!reachable.has(n)) { reachable.add(n); next.add(n); }
        }
        frontier = next;
      }
      for (const id of [...visibleChars]) if (!reachable.has(id)) visibleChars.delete(id);
      reachable.forEach(id => visibleChars.add(id));
    }

    // Раскладка: PC в центре маленьким кругом, NPC — снаружи
    const ids = [...visibleChars];
    const charById = new Map(characters.data.map(c => [c.id, c]));
    const fallback = new Map<string, { x: number; y: number }>();

    if (focusMode === 'one' && focusId && visibleChars.has(focusId)) {
      fallback.set(focusId, { x: 0, y: 0 });
      const others = ids.filter(i => i !== focusId);
      others.forEach((id, idx) => {
        const a = (idx / Math.max(others.length, 1)) * Math.PI * 2;
        const r = 280;
        fallback.set(id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
      });
    } else {
      const pcIds  = ids.filter(i => charById.get(i)?.is_pc);
      const npcIds = ids.filter(i => !charById.get(i)?.is_pc);
      // PC во внутреннем круге
      pcIds.forEach((id, idx) => {
        const a = (idx / Math.max(pcIds.length, 1)) * Math.PI * 2 - Math.PI / 2;
        const r = pcIds.length <= 1 ? 0 : 110;
        fallback.set(id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
      });
      // NPC снаружи
      npcIds.forEach((id, idx) => {
        const a = (idx / Math.max(npcIds.length, 1)) * Math.PI * 2;
        const r = 280 + Math.min(280, npcIds.length * 8);
        fallback.set(id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
      });
    }

    const nodes: Node[] = ids.map(id => {
      const c = charById.get(id)!;
      const stored = (typeof c.mindmap_x === 'number' && typeof c.mindmap_y === 'number')
        ? { x: c.mindmap_x, y: c.mindmap_y }
        : fallback.get(id)!;
      return {
        id,
        position: stored,
        type: 'character',
        draggable: !lockPositions,
        data: {
          name: c.name, is_pc: c.is_pc, kind: c.kind, clan: c.clan,
          portrait_url: c.portrait_url, selected: focusId === id,
        },
      };
    });

    // ----------- Грани: фильтрация и слияние биграневых -----------
    const filteredRels = relationships.data
      .filter(r => visibleChars.has(r.from_character_id) && visibleChars.has(r.to_character_id))
      .filter(r => (r.strength ?? 3) >= minStrength)
      .filter(r => categoryFilter === 'all' ? true : (r.type?.category ?? 'personal') === categoryFilter);

    // Группируем пары (sorted ids) → массив связей между ними
    const pairKey = (a: string, b: string) => [a, b].sort().join('|');
    const groups = new Map<string, RelEdge[]>();
    for (const r of filteredRels) {
      const k = pairKey(r.from_character_id, r.to_character_id);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }

    const edges: Edge[] = [];
    for (const [, rels] of groups) {
      if (rels.length === 1) {
        edges.push(buildEdge(rels[0], false));
        continue;
      }
      // Несколько связей между той же парой:
      // 1) Если есть пара "Sire→A→B + Childe→B→A" или подобная reciprocal — сливаем в одну стрелку (без двух стрелок)
      const reciprocalPair = findReciprocalPair(rels);
      if (reciprocalPair) {
        const [r1, r2] = reciprocalPair;
        edges.push(buildEdge(r1, false, r2));
        const remaining = rels.filter(x => x !== r1 && x !== r2);
        // Остальные связи между этой парой — на разных смещениях
        remaining.forEach((r, idx) => {
          edges.push(buildEdge(r, true, undefined, idx));
        });
      } else {
        // Просто несколько связей — рисуем все, делим перпендикулярным смещением для читаемости
        rels.forEach((r, idx) => edges.push(buildEdge(r, true, undefined, idx)));
      }
    }

    return { nodes, edges };
  }, [characters.data, relationships.data, showPcOnly, clanFilter, charactersInFaction, focusMode, focusId, hops, minStrength, lockPositions, categoryFilter]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  // Синхронизация: пересчитываем только когда меняется набор/позиции/фильтры (а не на каждом drag)
  const sig = useMemo(() => {
    const ns = computed.nodes.map(n => `${n.id}:${Math.round(n.position.x)}:${Math.round(n.position.y)}:${(n.data as any)?.selected ? 1 : 0}:${n.draggable ? 1 : 0}`).join('|');
    const es = computed.edges.map(e => `${e.id}:${e.source}:${e.target}:${e.label ?? ''}:${e.style?.strokeDasharray ?? ''}`).join('~');
    return ns + '#' + es;
  }, [computed]);
  const lastSig = useRef('');
  useEffect(() => {
    if (sig !== lastSig.current) {
      setRfNodes(computed.nodes);
      setRfEdges(computed.edges);
      lastSig.current = sig;
    }
  }, [sig, computed, setRfNodes, setRfEdges]);

  // ----- Клик: фокус-режим перецентровка, иначе открыть досье -----
  const onNodeClick = useCallback((_: any, node: Node) => {
    if (focusMode === 'one') setFocusId(node.id);
    else nav(`/characters/${node.id}`);
  }, [focusMode, nav]);

  // ----- Drag end: сохранить позицию -----
  const onNodeDragStop = useCallback(async (_: any, node: Node) => {
    const { error } = await supabase
      .from('characters')
      .update({ mindmap_x: node.position.x, mindmap_y: node.position.y } as any)
      .eq('id', node.id);
    if (!error) {
      qc.setQueryData<CharMM[]>(['mm-characters'], (old) =>
        old?.map(c => c.id === node.id ? { ...c, mindmap_x: node.position.x, mindmap_y: node.position.y } : c) ?? old
      );
    }
  }, [qc]);

  // ----- Drag-to-create: показать форму создания связи -----
  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    setPendingConnect({ from: c.source, to: c.target });
  }, []);

  const resetPositions = useCallback(async () => {
    if (!confirm('Сбросить все сохранённые позиции узлов?')) return;
    const ids = (characters.data ?? []).map(c => c.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('characters')
      .update({ mindmap_x: null, mindmap_y: null } as any)
      .in('id', ids);
    if (!error) qc.invalidateQueries({ queryKey: ['mm-characters'] });
  }, [characters.data, qc]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="heading">🕸 Карта связей</h1>
        <Legend />
      </div>

      <div className="card flex flex-wrap gap-3 items-end">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" className="w-4 h-4 accent-blood" checked={showPcOnly} onChange={e => setShowPcOnly(e.target.checked)} />
          только PC
        </label>

        <div>
          <label className="label">Категория связей</label>
          <div className="flex gap-1 bg-velvet/40 p-1 rounded-lg">
            <button onClick={() => setCategoryFilter('all')}      className={`px-2 py-1 text-xs rounded ${categoryFilter === 'all' ? 'bg-blood text-bone' : 'text-ash'}`}>Все</button>
            <button onClick={() => setCategoryFilter('mechanic')} className={`px-2 py-1 text-xs rounded ${categoryFilter === 'mechanic' ? 'bg-blood text-bone' : 'text-ash'}`} title="Sire, Boon, Blood Bond, Coterie...">⚙ Механика</button>
            <button onClick={() => setCategoryFilter('personal')} className={`px-2 py-1 text-xs rounded ${categoryFilter === 'personal' ? 'bg-blood text-bone' : 'text-ash'}`} title="Любит, ненавидит, союзник...">❤ Личное</button>
          </div>
        </div>

        <div>
          <label className="label">Клан</label>
          <select className="input" value={clanFilter} onChange={e => setClanFilter(e.target.value)}>
            <option value="">— любой —</option>
            {CLANS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Фракция</label>
          <select className="input" value={factionFilter} onChange={e => setFactionFilter(e.target.value)}>
            <option value="">— любая —</option>
            {(factions.data ?? []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Скрыть слабые связи</label>
          <select className="input" value={minStrength} onChange={e => setMinStrength(parseInt(e.target.value))}>
            <option value={1}>≥ 1 (все)</option>
            <option value={2}>≥ 2</option>
            <option value={3}>≥ 3</option>
            <option value={4}>≥ 4 (только сильные)</option>
          </select>
        </div>

        <div>
          <label className="label">Режим</label>
          <div className="flex gap-1 bg-velvet/40 p-1 rounded-lg">
            <button className={`px-2 py-1 text-xs rounded ${focusMode === 'all' ? 'bg-blood text-bone' : 'text-ash'}`} onClick={() => setFocusMode('all')}>Все</button>
            <button className={`px-2 py-1 text-xs rounded ${focusMode === 'one' ? 'bg-blood text-bone' : 'text-ash'}`} onClick={() => setFocusMode('one')}>Фокус</button>
          </div>
        </div>

        {focusMode === 'one' && (
          <>
            <div>
              <label className="label">Фокус на</label>
              <select className="input" value={focusId} onChange={e => setFocusId(e.target.value)}>
                <option value="">— выбери —</option>
                {(characters.data ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Глубина</label>
              <select className="input" value={hops} onChange={e => setHops(parseInt(e.target.value))}>
                <option value={1}>1 шаг</option>
                <option value={2}>2 шага</option>
              </select>
            </div>
          </>
        )}

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setLockPositions(l => !l)}
            className={`btn-ghost text-sm ${lockPositions ? '' : 'border-blood/40 text-rose'}`}
            title={lockPositions ? 'Разблокировать перетаскивание' : 'Зафиксировать позиции'}
          >
            {lockPositions ? '🔒 Заблокировано' : '🔓 Можно тащить'}
          </button>
          <button type="button" onClick={resetPositions} className="btn-ghost text-sm" title="Сбросить позиции">
            ↻ Авто-раскладка
          </button>
        </div>
      </div>

      {!lockPositions && (
        <p className="text-xs text-ash">
          💡 Совет: чтобы создать связь, наведись на край узла (появятся кружки) и протяни линию к другому узлу.
        </p>
      )}

      <div className="card p-0 overflow-hidden" style={{ height: 'calc(100vh - 360px)', minHeight: 480 }}>
        {characters.isLoading || relationships.isLoading ? (
          <div className="flex items-center justify-center h-full text-ash">Тянем нити в темноте...</div>
        ) : (characters.data ?? []).length === 0 ? (
          <div className="flex items-center justify-center h-full text-ash">Сначала добавь персонажей.</div>
        ) : (
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            nodesDraggable={!lockPositions}
            nodesConnectable={!lockPositions}
            edgesUpdatable={false}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{ type: 'default' }}
            fitView
            attributionPosition="bottom-right"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#3a1a22" gap={24} />
            <MiniMap
              nodeColor={(n) => {
                const d = n.data as any;
                if (d?.is_pc) return '#000';
                if (d?.kind === 'human') return '#3b82f6';
                return '#c0233a';
              }}
              maskColor="rgba(12,6,8,0.85)"
              style={{ background: '#0c0608', border: '1px solid rgba(200,169,106,0.2)' }}
            />
            <Controls
              showInteractive={false}
              style={{ background: '#1d1014', border: '1px solid rgba(200,169,106,0.2)' }}
            />
          </ReactFlow>
        )}
      </div>

      {pendingConnect && (
        <CreateRelationshipModal
          fromId={pendingConnect.from}
          toId={pendingConnect.to}
          characters={characters.data ?? []}
          relTypes={relTypes.data ?? []}
          createdBy={user?.id ?? null}
          onClose={() => setPendingConnect(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['mm-relationships'] });
            qc.invalidateQueries({ queryKey: ['rels'] });
            setPendingConnect(null);
          }}
        />
      )}
    </div>
  );
}

// =============================== Edge builders ===============================

function buildEdge(
  r: RelEdge,
  offset: boolean,
  reciprocal?: RelEdge,
  parallelIdx: number = 0,
): Edge {
  const cat = r.type?.category ?? 'personal';
  const color = edgeColor(r.type?.name ?? '', cat);
  const dashed = cat === 'personal';
  const isBidirectional = !!reciprocal;

  // Если есть взаимная пара (Sire/Childe) — сливаем в одну линию с двумя метками
  let label = r.type?.name ?? '';
  if (reciprocal) {
    const a = r.type?.name ?? '';
    const b = reciprocal.type?.name ?? '';
    label = a === b ? a : `${a} ↔ ${b}`;
  }

  const baseStroke = 1 + ((r.strength ?? 3) - 1) * 0.5;
  return {
    id: r.id,
    source: r.from_character_id,
    target: r.to_character_id,
    label,
    type: 'default',
    labelStyle: { fill: '#e8e2d4', fontSize: 10, fontFamily: 'Inter, sans-serif' },
    labelBgStyle: { fill: '#1d1014', fillOpacity: 0.9 },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
    style: {
      stroke: color,
      strokeWidth: baseStroke,
      strokeDasharray: dashed ? '6 4' : undefined,
      // Сдвиг параллельных рёбер для читаемости (через offset path не поддерживается напрямую,
      // оставляем визуальное смещение через увеличение толщины и метку с индексом)
      opacity: offset ? 0.85 : 1,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color },
    markerStart: isBidirectional ? { type: MarkerType.ArrowClosed, color } : undefined,
    data: { parallelIdx },
  };
}

function findReciprocalPair(rels: RelEdge[]): [RelEdge, RelEdge] | null {
  for (let i = 0; i < rels.length; i++) {
    for (let j = i + 1; j < rels.length; j++) {
      const a = rels[i], b = rels[j];
      if (a.from_character_id === b.to_character_id && a.to_character_id === b.from_character_id) {
        const an = a.type?.name ?? '';
        const bn = b.type?.name ?? '';
        if (an && bn && (RECIPROCAL[an] === bn || RECIPROCAL[bn] === an || an === bn)) {
          return [a, b];
        }
      }
    }
  }
  return null;
}

function edgeColor(typeName: string, category: 'mechanic' | 'personal'): string {
  const t = typeName.toLowerCase();
  // Сначала специальные цвета по типу:
  if (t.startsWith('sire') || t === 'childe')        return '#c0233a';
  if (t.startsWith('blood bond'))                     return '#8a0e1a';
  if (t === 'ghoul')                                  return '#d8536e';
  if (t === 'lover')                                  return '#d8536e';
  if (t === 'enemy' || t === 'hates')                 return '#7a1a1a';
  if (t === 'rival')                                  return '#c8a96a';
  if (t === 'ally' || t === 'mentor' || t === 'trusts') return '#a89c9b';
  if (t === 'fears' || t === 'distrusts')             return '#5b4a6e';
  if (t === 'coterie member')                         return '#dcd0e3';
  if (t.startsWith('boon'))                           return '#c8a96a';
  // Дефолт по категории
  return category === 'mechanic' ? '#c8a96a' : '#a89c9b';
}

// ============================== Легенда ==============================
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="chip border-black/80 bg-black/40">⬛ PC</span>
      <span className="chip border-bloodlight bg-blood/15">🟥 Vampire/Ghoul</span>
      <span className="chip border-sky-500/80 bg-sky-500/10">🟦 Human</span>
      <span className="chip">— механика</span>
      <span className="chip" style={{ borderStyle: 'dashed' }}>--- личное</span>
    </div>
  );
}

// ============================== Модалка создания связи ==============================
function CreateRelationshipModal({
  fromId, toId, characters, relTypes, createdBy, onClose, onSaved,
}: {
  fromId: string;
  toId: string;
  characters: CharMM[];
  relTypes: RelationshipType[];
  createdBy: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fromChar = characters.find(c => c.id === fromId);
  const toChar   = characters.find(c => c.id === toId);
  const personalTypes  = relTypes.filter(t => t.category === 'personal');
  const mechanicTypes  = relTypes.filter(t => t.category === 'mechanic');

  const [typeId, setTypeId] = useState(relTypes[0]?.id ?? '');
  const [desc, setDesc] = useState('');
  const [strength, setStrength] = useState(3);
  const [createReverse, setCreateReverse] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Если выбран Sire — предложить создать обратную Childe
  const selectedTypeName = relTypes.find(t => t.id === typeId)?.name ?? '';
  const reciprocalName = RECIPROCAL[selectedTypeName];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.from('relationships').insert({
        from_character_id: fromId,
        to_character_id: toId,
        type_id: typeId,
        description: desc || null,
        strength,
        created_by: createdBy,
      });
      if (error) throw error;

      if (createReverse && reciprocalName && reciprocalName !== selectedTypeName) {
        const reciprocalType = relTypes.find(t => t.name === reciprocalName);
        if (reciprocalType) {
          await supabase.from('relationships').insert({
            from_character_id: toId,
            to_character_id: fromId,
            type_id: reciprocalType.id,
            description: desc || null,
            strength,
            created_by: createdBy,
          });
        }
      }
      onSaved();
    } catch (e: any) {
      setErr(e?.message ?? 'Не удалось создать связь');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="card max-w-lg w-full space-y-3">
        <h2 className="text-xl font-display">Новая связь</h2>
        <p className="subtle text-sm">
          <span className="text-bone">{fromChar?.name ?? '…'}</span>
          <span className="text-rose mx-2">→</span>
          <span className="text-bone">{toChar?.name ?? '…'}</span>
        </p>

        <div>
          <label className="label">Тип</label>
          <select className="input" value={typeId} onChange={e => setTypeId(e.target.value)}>
            <optgroup label="⚙ Механика игры">
              {mechanicTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
            <optgroup label="❤ Личное отношение">
              {personalTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          </select>
        </div>

        {reciprocalName && reciprocalName !== selectedTypeName && (
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-blood mt-0.5" checked={createReverse} onChange={e => setCreateReverse(e.target.checked)} />
            <span>Создать встречную связь <span className="text-rose">«{reciprocalName}»</span> от <span className="text-bone">{toChar?.name}</span> к <span className="text-bone">{fromChar?.name}</span></span>
          </label>
        )}

        <div>
          <label className="label">Описание</label>
          <textarea className="input min-h-[60px]" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>

        <div>
          <label className="label">Сила (1–5)</label>
          <input type="number" min={1} max={5} className="input w-24" value={strength} onChange={e => setStrength(parseInt(e.target.value || '3'))} />
        </div>

        {err && <p className="text-rose text-sm">{err}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-ghost">Отмена</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Связываем...' : 'Создать связь'}</button>
        </div>
      </form>
    </div>
  );
}
