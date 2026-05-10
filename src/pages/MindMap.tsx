import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge,
  useNodesState, useEdgesState,
  ConnectionMode, MarkerType,
  Handle, Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { supabase } from '@/lib/supabase';
import { CLANS, type Character, type Relationship, type RelationshipType, type Faction } from '@/lib/types';

interface RelEdge extends Relationship {
  type?: { id: string; name: string };
}

// Кастомный узел персонажа (готическая карточка)
function CharacterNode({ data }: { data: { name: string; is_pc: boolean; clan: string | null; portrait_url: string | null; selected?: boolean } }) {
  const ring = data.selected ? 'ring-2 ring-rose ring-offset-2 ring-offset-ink' : '';
  return (
    <div className={`bg-crypt border ${data.is_pc ? 'border-blood/60' : 'border-gold/30'} rounded-xl shadow-crypt px-3 py-2 min-w-[140px] ${ring}`}>
      <Handle type="target" position={Position.Top}    style={{ background: '#8a0e1a' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#8a0e1a' }} />
      <div className="flex items-center gap-2">
        {data.portrait_url ? (
          <img src={data.portrait_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-velvet flex items-center justify-center text-bone text-sm">
            {data.name?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-display text-sm leading-tight truncate text-bone">{data.name}</div>
          <div className="text-[10px] text-ash leading-tight truncate">
            {data.is_pc ? 'PC' : 'NPC'}{data.clan ? ` · ${data.clan}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { character: CharacterNode };

type FilterFocus = 'all' | 'pc' | 'one';

export default function MindMap() {
  const nav = useNavigate();

  const characters = useQuery({
    queryKey: ['mm-characters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('characters').select('id,name,is_pc,clan,sect,portrait_url').order('name');
      if (error) throw error;
      return data as unknown as Pick<Character,'id'|'name'|'is_pc'|'clan'|'sect'|'portrait_url'>[];
    },
  });

  const relationships = useQuery({
    queryKey: ['mm-relationships'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relationships')
        .select('id,from_character_id,to_character_id,type_id,description,strength, type:relationship_types(id,name)');
      if (error) throw error;
      return data as unknown as RelEdge[];
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

  // ----- Фильтры -----
  const [showPcOnly, setShowPcOnly] = useState(false);
  const [clanFilter, setClanFilter] = useState<string>('');
  const [factionFilter, setFactionFilter] = useState<string>('');
  const [minStrength, setMinStrength] = useState<number>(1);
  const [focusMode, setFocusMode] = useState<FilterFocus>('all');
  const [focusId, setFocusId] = useState<string>('');
  const [hops, setHops] = useState<number>(1);

  // Сет id персонажей в выбранной фракции
  const charactersInFaction = useMemo(() => {
    if (!factionFilter || !factionMembers.data) return null;
    const set = new Set(
      factionMembers.data.filter(m => m.faction_id === factionFilter).map(m => m.character_id)
    );
    return set;
  }, [factionFilter, factionMembers.data]);

  // Граф: считаем какие узлы видны
  const { nodes, edges } = useMemo(() => {
    if (!characters.data || !relationships.data) return { nodes: [] as Node[], edges: [] as Edge[] };

    const visibleChars = new Set<string>();

    for (const c of characters.data) {
      if (showPcOnly && !c.is_pc) continue;
      if (clanFilter && c.clan !== clanFilter) continue;
      if (charactersInFaction && !charactersInFaction.has(c.id)) continue;
      visibleChars.add(c.id);
    }

    // Focus mode: оставляем только выбранного и его соседей в радиусе hops
    if (focusMode === 'one' && focusId) {
      const reachable = new Set<string>([focusId]);
      const adj = new Map<string, Set<string>>();
      for (const r of relationships.data) {
        if (!adj.has(r.from_character_id)) adj.set(r.from_character_id, new Set());
        if (!adj.has(r.to_character_id))   adj.set(r.to_character_id,   new Set());
        adj.get(r.from_character_id)!.add(r.to_character_id);
        adj.get(r.to_character_id)!.add(r.from_character_id);
      }
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
      // пересечение с visibleChars
      for (const id of [...visibleChars]) if (!reachable.has(id)) visibleChars.delete(id);
      reachable.forEach(id => visibleChars.add(id)); // и добавим тех, кого фильтры скрыли но они часть подграфа
    }

    // Расположим узлы по кругу + центр для focus
    const ids = [...visibleChars];
    const positions = new Map<string, { x: number; y: number }>();
    const N = ids.length;
    if (focusMode === 'one' && focusId && visibleChars.has(focusId)) {
      positions.set(focusId, { x: 0, y: 0 });
      const others = ids.filter(i => i !== focusId);
      others.forEach((id, idx) => {
        const a = (idx / Math.max(others.length, 1)) * Math.PI * 2;
        const r = 280;
        positions.set(id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
      });
    } else {
      ids.forEach((id, idx) => {
        const a = (idx / Math.max(N, 1)) * Math.PI * 2;
        const r = 60 + Math.min(420, N * 14);
        positions.set(id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
      });
    }

    const nodes: Node[] = ids.map(id => {
      const c = characters.data!.find(c => c.id === id)!;
      const pos = positions.get(id) ?? { x: 0, y: 0 };
      return {
        id,
        position: pos,
        type: 'character',
        data: { name: c.name, is_pc: c.is_pc, clan: c.clan, portrait_url: c.portrait_url, selected: focusId === id },
      };
    });

    const edges: Edge[] = relationships.data
      .filter(r => visibleChars.has(r.from_character_id) && visibleChars.has(r.to_character_id))
      .filter(r => (r.strength ?? 3) >= minStrength)
      .map(r => ({
        id: r.id,
        source: r.from_character_id,
        target: r.to_character_id,
        label: r.type?.name,
        labelStyle: { fill: '#e8e2d4', fontSize: 10, fontFamily: 'Inter, sans-serif' },
        labelBgStyle: { fill: '#1d1014', fillOpacity: 0.85 },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 4,
        style: {
          stroke: edgeColor(r.type?.name ?? ''),
          strokeWidth: 1 + ((r.strength ?? 3) - 1) * 0.5,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(r.type?.name ?? '') },
      }));

    return { nodes, edges };
  }, [characters.data, relationships.data, showPcOnly, clanFilter, charactersInFaction, focusMode, focusId, hops, minStrength]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);
  useEffect(() => { setRfNodes(nodes); }, [nodes, setRfNodes]);
  useEffect(() => { setRfEdges(edges); }, [edges, setRfEdges]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (focusMode === 'one') {
      setFocusId(node.id);
    } else {
      nav(`/characters/${node.id}`);
    }
  }, [focusMode, nav]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="heading">🕸 Карта связей</h1>
        <p className="subtle text-sm">
          Клик по узлу{focusMode === 'one' ? ' — фокус на персонаже' : ' — открыть досье'}
        </p>
      </div>

      <div className="card flex flex-wrap gap-3 items-end">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" className="w-4 h-4 accent-blood" checked={showPcOnly} onChange={e => setShowPcOnly(e.target.checked)} />
          только PC
        </label>

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
      </div>

      <div className="card p-0 overflow-hidden" style={{ height: 'calc(100vh - 320px)', minHeight: 480 }}>
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
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            attributionPosition="bottom-right"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#3a1a22" gap={24} />
            <MiniMap
              nodeColor={(n) => (n.data?.is_pc ? '#c0233a' : '#1d1014')}
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
    </div>
  );
}

function edgeColor(typeName: string): string {
  const t = typeName.toLowerCase();
  if (t.startsWith('sire') || t === 'childe')        return '#c0233a'; // кровные узы
  if (t.startsWith('blood bond'))                     return '#8a0e1a';
  if (t === 'ghoul')                                  return '#d8536e';
  if (t === 'lover')                                  return '#d8536e';
  if (t === 'enemy' || t === 'rival')                 return '#c8a96a';
  if (t === 'ally' || t === 'mentor')                 return '#a89c9b';
  if (t === 'coterie member')                         return '#dcd0e3';
  if (t.startsWith('boon'))                           return '#c8a96a';
  return '#a89c9b';
}
