import { useEffect, useMemo, useState, useCallback, useRef, FormEvent, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type Connection, type EdgeProps,
  useNodesState, useEdgesState,
  ConnectionMode, MarkerType,
  Handle, Position,
  BaseEdge, EdgeLabelRenderer, useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { DEJAVU_SANS_BASE64 } from '@/lib/pdfFont';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { createRelWithReciprocal } from '@/lib/relationships';
import {
  CLANS, RECIPROCAL,
  type Character, type Relationship, type RelationshipType, type Faction,
  type KindredData, type GhoulData,
} from '@/lib/types';

interface RelEdge extends Relationship {
  type?: { id: string; name: string; category: 'mechanic' | 'personal'; color?: string; dashed?: boolean; thickness?: number; hidden_from_manual?: boolean };
}

type CharMM = Pick<Character,
  'id'|'name'|'is_pc'|'kind'|'clan'|'sect'|'portrait_url'|'mindmap_x'|'mindmap_y'|'sire_id'|'kind_data'|'life_status'|'enemies'
>;

// =============================== Локальные смещения рёбер (localStorage) ===============================
const EDGE_OFFSETS_KEY = 'chronicle-edge-offsets-v1';
type EdgeOffset = { dx: number; dy: number };
function loadEdgeOffsets(): Record<string, EdgeOffset> {
  try { return JSON.parse(localStorage.getItem(EDGE_OFFSETS_KEY) ?? '{}'); } catch { return {}; }
}
function saveEdgeOffset(id: string, off: EdgeOffset) {
  const m = loadEdgeOffsets();
  if (off.dx === 0 && off.dy === 0) delete m[id];
  else m[id] = off;
  localStorage.setItem(EDGE_OFFSETS_KEY, JSON.stringify(m));
}
function clearAllEdgeOffsets() {
  localStorage.removeItem(EDGE_OFFSETS_KEY);
}

// =============================== Узел персонажа ===============================
function CharacterNode({ data }: {
  data: {
    name: string; is_pc: boolean; kind: string | null; life_status?: string;
    clan: string | null; portrait_url: string | null;
    selected?: boolean;
    subtitle?: string;
    factionIcons?: { id: string; icon: string; name: string }[];
  };
}) {
  let borderClass = 'border-2 border-gold/40';
  if (data.is_pc) borderClass = 'border-[3px] border-black ring-2 ring-bone/60';
  else if (data.kind === 'human') borderClass = 'border-2 border-sky-500/80';
  else if (data.kind === 'kindred' || data.kind === 'ghoul') borderClass = 'border-2 border-bloodlight';
  else if (data.kind === 'group') borderClass = 'border-[3px] border-double border-gold/70 ring-1 ring-gold/20';

  const ring = data.selected ? 'outline outline-2 outline-rose outline-offset-2' : '';
  const dim = data.life_status && data.life_status !== 'active' ? 'opacity-70 grayscale-[40%]' : '';

  return (
    <div className={`relative bg-crypt rounded-xl shadow-crypt px-3 py-2 ${data.kind === 'group' ? 'min-w-[220px]' : 'min-w-[180px]'} ${borderClass} ${ring} ${dim}`}>
      {/* target-хэндлы рендерим ПЕРВЫМИ и делаем inert: нужны только как якоря для рисования рёбер, не должны перехватывать pointer-события и инвертировать направление */}
      <Handle id="t2" type="target" position={Position.Top}    style={targetHandleStyle} />
      <Handle id="r2" type="target" position={Position.Right}  style={targetHandleStyle} />
      <Handle id="b2" type="target" position={Position.Bottom} style={targetHandleStyle} />
      <Handle id="l2" type="target" position={Position.Left}   style={targetHandleStyle} />
      <Handle id="t"  type="source" position={Position.Top}    style={sourceHandleStyle} />
      <Handle id="r"  type="source" position={Position.Right}  style={sourceHandleStyle} />
      <Handle id="b"  type="source" position={Position.Bottom} style={sourceHandleStyle} />
      <Handle id="l"  type="source" position={Position.Left}   style={sourceHandleStyle} />

      <div className="flex items-center gap-2">
        {data.portrait_url ? (
          <img src={data.portrait_url} alt="" className="w-11 h-11 rounded-lg object-cover" />
        ) : (
          <div className="w-11 h-11 rounded-lg bg-velvet flex items-center justify-center text-bone">
            {data.kind === 'group' ? '👥' : (data.name?.[0]?.toUpperCase() ?? '?')}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-display text-base leading-tight truncate text-bone">{data.name}</div>
          <div className="text-[10px] text-ash leading-tight truncate">
            {data.kind === 'group' ? 'Group / Mob' : (
              <>
                {data.is_pc ? 'PC' : 'NPC'}
                {data.kind && data.kind !== 'kindred' ? ` · ${data.kind}` : ''}
                {data.clan ? ` · ${data.clan}` : ''}
              </>
            )}
          </div>
          {data.subtitle && (
            <div className="text-[10px] text-rose italic mt-0.5 truncate">{data.subtitle}</div>
          )}
        </div>
      </div>
      {data.factionIcons && data.factionIcons.length > 0 && (
        <div className="absolute -top-2 -right-2 flex gap-0.5">
          {data.factionIcons.slice(0, 3).map(f => (
            <span
              key={f.id}
              title={f.name}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-ink border border-gold/40 text-sm leading-none"
            >
              {f.icon}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
const handleStyle = { width: 8, height: 8, background: '#8a0e1a', border: '1px solid #c8a96a' } as const;
// Source-хэндлы видимые, перехватывают pointer-события и лежат сверху (zIndex выше).
const sourceHandleStyle = { ...handleStyle, zIndex: 2 } as const;
// Target-хэндлы — невидимые "якоря" для рисования рёбер.
// pointerEvents:'none' критично: иначе они оказываются drop-/start-целью и React Flow
// в Loose-режиме инвертирует source/target (баг "PC→NPC становится NPC→PC").
const targetHandleStyle = { ...handleStyle, opacity: 0, pointerEvents: 'none' as const, zIndex: 0 } as const;

// Стиль SVG-текста, идущего вдоль ребра. paintOrder:'stroke' нет в React.CSSProperties,
// поэтому собираем стиль через cast.
const textAlongLineStyle = {
  fontSize: 10,
  fontFamily: 'Inter, sans-serif',
  paintOrder: 'stroke',
  pointerEvents: 'none',
  userSelect: 'none',
  fontWeight: 600,
  letterSpacing: 0.2,
} as unknown as CSSProperties;

// =============================== Кастомное изгибаемое ребро ===============================
function ChronicleEdge(props: EdgeProps) {
  const {
    id, sourceX, sourceY, targetX, targetY,
    markerEnd, markerStart, style, data,
  } = props;
  const { screenToFlowPosition } = useReactFlow();

  // Авто-смещение для параллельных рёбер: 0, +40, -40, +80, -80...
  const parIdx = (data as any)?.parallelIdx ?? 0;
  const autoOffset = parIdx === 0
    ? 0
    : (parIdx % 2 === 1 ? 1 : -1) * Math.ceil(parIdx / 2) * 40;

  // Сохранённое пользовательское смещение
  const [stored, setStored] = useState<EdgeOffset>(() => loadEdgeOffsets()[id] ?? { dx: 0, dy: 0 });
  const [hovered, setHovered] = useState(false);
  const offsetRef = useRef(stored);
  useEffect(() => { offsetRef.current = stored; }, [stored]);

  // Перпендикуляр к прямой source→target
  const lineDx = targetX - sourceX;
  const lineDy = targetY - sourceY;
  const len = Math.hypot(lineDx, lineDy) || 1;
  const nx = -lineDy / len;
  const ny = lineDx / len;

  // Контрольная точка
  const baseMx = (sourceX + targetX) / 2;
  const baseMy = (sourceY + targetY) / 2;
  const cx = baseMx + nx * autoOffset + stored.dx;
  const cy = baseMy + ny * autoOffset + stored.dy;

  // Quadratic Bezier — визуальное ребро
  const path = `M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`;
  // Если стрелка идёт справа-налево или снизу-вверх — для textPath используем «развёрнутый» путь,
  // чтобы буквы не оказались вверх ногами.
  const textReversed = (targetX < sourceX) || (Math.abs(targetX - sourceX) < 1 && targetY < sourceY);
  const textPathD = textReversed
    ? `M ${targetX} ${targetY} Q ${cx} ${cy} ${sourceX} ${sourceY}`
    : path;
  const textPathId = `edge-textpath-${id}`;

  // Точка на середине кривой (t = 0.5)
  const midX = 0.25 * sourceX + 0.5 * cx + 0.25 * targetX;
  const midY = 0.25 * sourceY + 0.5 * cy + 0.25 * targetY;

  // Подписи из data (передаются раздельно из buildEdge)
  const typeName: string = ((data as any)?.typeName ?? '') as string;
  // tooltip — массив сторон связи (для двунаправленных: обе стороны с их описаниями)
  const tooltip = (((data as any)?.tooltip ?? []) as { dir: string; type: string; desc: string }[]);
  const hasTip = tooltip.some(t => t.type || t.desc);
  // persistent (тумблер «показывать описание» нажат) → подпись висит всегда; иначе — при наведении
  const persistent = !!(data as any)?.persistent;
  // В постоянном режиме показываем только стороны с описанием (чтобы не плодить пустые пузыри),
  // при наведении — все стороны (тип полезен, даже если описания нет).
  const bubbleItems = hovered ? tooltip.filter(t => t.type || t.desc) : tooltip.filter(t => t.desc);
  const showBubble = (hovered || persistent) && bubbleItems.length > 0;
  const strokeColor: string = ((style as any)?.stroke ?? '#a89c9b') as string;

  // Описание сдвигаем перпендикулярно от линии — в ту же сторону, что и изгиб
  // (для parallelIdx=0 — фиксированно вверх-вправо). Так пузырь не сидит на тексте-вдоль-линии.
  const descPerp = 26;
  const sign = autoOffset === 0 ? 1 : (autoOffset > 0 ? 1 : -1);
  const descX = midX + nx * descPerp * sign;
  const descY = midY + ny * descPerp * sign;

  const draggingRef = useRef<{ startFx: number; startFy: number; baseDx: number; baseDy: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    draggingRef.current = {
      startFx: flow.x,
      startFy: flow.y,
      baseDx: offsetRef.current.dx,
      baseDy: offsetRef.current.dy,
    };
    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      const f = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      const next = {
        dx: draggingRef.current.baseDx + (f.x - draggingRef.current.startFx),
        dy: draggingRef.current.baseDy + (f.y - draggingRef.current.startFy),
      };
      setStored(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      saveEdgeOffset(id, offsetRef.current);
      draggingRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [id, screenToFlowPosition]);

  const isOffset = stored.dx !== 0 || stored.dy !== 0;

  return (
    <>
      {/* Невидимый путь специально для textPath — чтобы буквы шли по нему слева-направо */}
      <defs>
        <path id={textPathId} d={textPathD} fill="none" />
      </defs>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} markerStart={markerStart} style={style} />

      {/* Широкий прозрачный путь поверх ребра — ловит наведение для тултипа */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: 'stroke', cursor: hasTip ? 'help' : 'default' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* Название типа — вдоль линии, цветом ребра, с тёмной обводкой для читаемости поверх фона */}
      {typeName && (
        <text
          dy={-5}
          fill={strokeColor}
          stroke="#0c0608"
          strokeWidth={3}
          strokeLinejoin="round"
          style={textAlongLineStyle}
        >
          <textPath href={`#${textPathId}`} startOffset="50%" textAnchor="middle">
            {typeName}
          </textPath>
        </text>
      )}

      {/* Подпись с описанием. Тумблер «показывать описание» нажат → висит постоянно
          (и попадает в картинку PDF); иначе — появляется при наведении.
          Для двунаправленных рёбер показываются обе стороны, чтобы ничего не терялось. */}
      {showBubble && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${descX}px, ${descY}px)`,
              padding: '6px 9px',
              borderRadius: 6,
              background: persistent && !hovered ? 'rgba(20,11,15,0.9)' : 'rgba(20,11,15,0.97)',
              border: `1px solid ${strokeColor}77`,
              borderLeft: `3px solid ${strokeColor}`,
              fontSize: persistent && !hovered ? 10 : 11,
              color: '#e8e2d4',
              fontFamily: 'Inter, sans-serif',
              maxWidth: persistent && !hovered ? 200 : 240,
              whiteSpace: 'pre-wrap',
              lineHeight: 1.3,
              boxShadow: '0 2px 10px rgba(0,0,0,0.7)',
              pointerEvents: 'none',
              zIndex: hovered ? 1000 : 5,
            }}
          >
            {bubbleItems.map((t, i, arr) => (
              <div key={i} style={{ marginBottom: i < arr.length - 1 ? 7 : 0 }}>
                <div style={{ color: strokeColor, fontWeight: 600 }}>
                  {t.dir}{t.type ? ` · ${t.type}` : ''}
                </div>
                {t.desc && <div style={{ marginTop: 1 }}>{t.desc}</div>}
              </div>
            ))}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Видимая ручка для перетаскивания середины ребра */}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto chronicle-edge-handle"
          data-export-hide="1"
          onPointerDown={onPointerDown}
          title="Перетащи, чтобы изогнуть"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${midX}px, ${midY + 14}px)`,
            width: 10, height: 10,
            borderRadius: 9999,
            background: isOffset ? '#c0233a' : 'rgba(200,169,106,0.45)',
            border: '1px solid #1d1014',
            cursor: 'grab',
          }}
        />
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { character: CharacterNode };
const edgeTypes = { chronicle: ChronicleEdge };

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
        .select('id,name,is_pc,kind,clan,sect,portrait_url,mindmap_x,mindmap_y,life_status,sire_id,kind_data,enemies')
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
        .select('id,from_character_id,to_character_id,type_id,description,strength, type:relationship_types(id,name,category,color,dashed,thickness,hidden_from_manual)');
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
        .from('factions').select('id,name,icon,kind');
      if (error) throw error;
      return data as unknown as Pick<Faction,'id'|'name'|'icon'|'kind'>[];
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
  const [hideTheDead, setHideTheDead] = useState(false);
  const [clanFilter, setClanFilter] = useState<string>('');
  const [factionFilter, setFactionFilter] = useState<string>('');
  const [minStrength, setMinStrength] = useState<number>(1);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [focusMode, setFocusMode] = useState<FilterFocus>('all');
  const [focusId, setFocusId] = useState<string>('');
  const [hops, setHops] = useState<number>(1);
  const [lockPositions, setLockPositions] = useState(true);
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [showTypes, setShowTypes] = useState(true);

  const [pendingConnect, setPendingConnect] = useState<{ from: string; to: string } | null>(null);

  const charactersInFaction = useMemo(() => {
    if (!factionFilter || !factionMembers.data) return null;
    return new Set(factionMembers.data.filter(m => m.faction_id === factionFilter).map(m => m.character_id));
  }, [factionFilter, factionMembers.data]);

  const computed = useMemo(() => {
    if (!characters.data || !relationships.data) return { nodes: [] as Node[], edges: [] as Edge[] };

    const visibleChars = new Set<string>();
    for (const c of characters.data) {
      if (showPcOnly && !c.is_pc) continue;
      if (hideTheDead && c.life_status === 'dead') continue;
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

    // Раскладка: PC в центре, NPC — снаружи
    const ids = [...visibleChars];
    const charById = new Map(characters.data.map(c => [c.id, c]));
    const fallback = new Map<string, { x: number; y: number }>();

    if (focusMode === 'one' && focusId && visibleChars.has(focusId)) {
      fallback.set(focusId, { x: 0, y: 0 });
      const others = ids.filter(i => i !== focusId);
      others.forEach((id, idx) => {
        const a = (idx / Math.max(others.length, 1)) * Math.PI * 2;
        const r = 320;
        fallback.set(id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
      });
    } else {
      const pcIds  = ids.filter(i => charById.get(i)?.is_pc);
      const npcIds = ids.filter(i => !charById.get(i)?.is_pc);
      pcIds.forEach((id, idx) => {
        const a = (idx / Math.max(pcIds.length, 1)) * Math.PI * 2 - Math.PI / 2;
        const r = pcIds.length <= 1 ? 0 : 130;
        fallback.set(id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
      });
      npcIds.forEach((id, idx) => {
        const a = (idx / Math.max(npcIds.length, 1)) * Math.PI * 2;
        const r = 320 + Math.min(280, npcIds.length * 8);
        fallback.set(id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
      });
    }

    // Карта фракций по character_id для отображения иконок на узлах
    const factionIconsByChar = new Map<string, { id: string; icon: string; name: string }[]>();
    if (factionMembers.data && factions.data) {
      const factionById = new Map(factions.data.map(f => [f.id, f]));
      for (const m of factionMembers.data) {
        const f = factionById.get(m.faction_id);
        if (!f?.icon) continue;
        if (!factionIconsByChar.has(m.character_id)) factionIconsByChar.set(m.character_id, []);
        factionIconsByChar.get(m.character_id)!.push({ id: f.id, icon: f.icon, name: f.name });
      }
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
          life_status: c.life_status,
          portrait_url: c.portrait_url, selected: focusId === id,
          factionIcons: factionIconsByChar.get(id) ?? [],
        },
      };
    });

    // ---------- Синтезируем mechanic-связи из полей персонажей ----------
    // (Sire/Childe из characters.sire_id, Touchstone/BloodBond из kind_data,
    //  Ghoul/Domitor из kind_data.domitor_id)
    const synthesized: RelEdge[] = [];
    const findType = (name: string) => (relTypes.data ?? []).find(t => t.name === name);
    for (const c of characters.data) {
      // Sire → этот персонаж (направление: Sire => Childe)
      if (c.sire_id) {
        const t = findType('Sire');
        if (t) synthesized.push({
          id: `synth-sire-${c.id}`,
          from_character_id: c.sire_id,
          to_character_id: c.id,
          type_id: t.id,
          description: null, started_at_date: null, started_at_session: null,
          strength: 5, created_by: null, created_at: '',
          type: { id: t.id, name: t.name, category: t.category, color: t.color, dashed: t.dashed, thickness: t.thickness },
        });
      }
      // Touchstones (только Kindred используют)
      const kd = (c.kind_data ?? {}) as KindredData & GhoulData;
      if (Array.isArray(kd.touchstones)) {
        const t = findType('Touchstone');
        if (t) for (const tid of kd.touchstones) {
          if (!tid) continue;
          synthesized.push({
            id: `synth-touchstone-${c.id}-${tid}`,
            from_character_id: c.id,
            to_character_id: tid,
            type_id: t.id,
            description: null, started_at_date: null, started_at_session: null,
            strength: 4, created_by: null, created_at: '',
            type: { id: t.id, name: t.name, category: t.category, color: t.color, dashed: t.dashed, thickness: t.thickness },
          });
        }
      }
      // Ghoul: domitor → ghoul. Если есть blood bond К ТОМУ ЖЕ домитору — мерджим в одну метку.
      const domitorBondLevel = (c.kind === 'ghoul' && kd.domitor_id && Array.isArray(kd.blood_bonded_to))
        ? (kd.blood_bonded_to.find(b => b?.character_id === kd.domitor_id)?.level ?? null)
        : null;
      if (c.kind === 'ghoul' && kd.domitor_id) {
        const t = findType('Ghoul');
        if (t) {
          const label = domitorBondLevel ? `Ghoul · BB ${domitorBondLevel}` : 'Ghoul';
          synthesized.push({
            id: `synth-ghoul-${c.id}`,
            from_character_id: kd.domitor_id,
            to_character_id: c.id,
            type_id: t.id,
            description: null, started_at_date: null, started_at_session: null,
            strength: 5, created_by: null, created_at: '',
            type: { id: t.id, name: label, category: t.category, color: t.color, dashed: t.dashed, thickness: t.thickness },
          });
        }
      }
      // Blood Bonds (но не до домитора если это гуль — уже включили в Ghoul-метку)
      if (Array.isArray(kd.blood_bonded_to)) {
        for (const b of kd.blood_bonded_to) {
          if (!b?.character_id) continue;
          if (c.kind === 'ghoul' && kd.domitor_id === b.character_id) continue;
          const t = findType(`Blood Bond ${b.level}`);
          if (!t) continue;
          synthesized.push({
            id: `synth-bb-${c.id}-${b.character_id}-${b.level}`,
            from_character_id: c.id,
            to_character_id: b.character_id,
            type_id: t.id,
            description: null, started_at_date: null, started_at_session: null,
            strength: 3 + (b.level ?? 1),
            created_by: null, created_at: '',
            type: { id: t.id, name: t.name, category: t.category, color: t.color, dashed: t.dashed, thickness: t.thickness },
          });
        }
      }
      // Herd: смертные источники крови
      if (Array.isArray(kd.herd)) {
        const t = findType('Herd') ?? findType('Стадо');
        for (const hid of kd.herd) {
          if (!hid) continue;
          if (!t) continue;
          synthesized.push({
            id: `synth-herd-${c.id}-${hid}`,
            from_character_id: c.id,
            to_character_id: hid,
            type_id: t.id,
            description: null, started_at_date: null, started_at_session: null,
            strength: 2, created_by: null, created_at: '',
            type: { id: t.id, name: t.name, category: t.category, color: t.color, dashed: t.dashed, thickness: t.thickness },
          });
        }
      }
      // Enemies (общее для всех kinds, лежит в characters.enemies)
      if (Array.isArray(c.enemies) && c.enemies.length > 0) {
        const t = findType('Враг') ?? findType('Enemy');
        for (const eid of c.enemies) {
          if (!eid || !t) continue;
          synthesized.push({
            id: `synth-enemy-${c.id}-${eid}`,
            from_character_id: c.id,
            to_character_id: eid,
            type_id: t.id,
            description: null, started_at_date: null, started_at_session: null,
            strength: 4, created_by: null, created_at: '',
            type: { id: t.id, name: t.name, category: t.category, color: t.color, dashed: t.dashed, thickness: t.thickness },
          });
        }
      }
      // Mortal Allies
      if (Array.isArray(kd.mortal_allies)) {
        const t = findType('Mortal Ally') ?? findType('Союзник') ?? findType('Ally');
        for (const aid of kd.mortal_allies) {
          if (!aid) continue;
          if (!t) continue;
          synthesized.push({
            id: `synth-mally-${c.id}-${aid}`,
            from_character_id: c.id,
            to_character_id: aid,
            type_id: t.id,
            description: null, started_at_date: null, started_at_session: null,
            strength: 3, created_by: null, created_at: '',
            type: { id: t.id, name: t.name, category: t.category, color: t.color, dashed: t.dashed, thickness: t.thickness },
          });
        }
      }
    }

    // ---------- Грани: исключаем mechanic-rows, которые мы синтезируем ----------
    const hiddenTypeIds = new Set((relTypes.data ?? []).filter(t => t.hidden_from_manual).map(t => t.id));
    const dbRels = relationships.data.filter(r => !hiddenTypeIds.has(r.type_id));

    const allRels = [...dbRels, ...synthesized]
      .filter(r => visibleChars.has(r.from_character_id) && visibleChars.has(r.to_character_id))
      .filter(r => (r.strength ?? 3) >= minStrength)
      .filter(r => categoryFilter === 'all' ? true : (r.type?.category ?? 'personal') === categoryFilter);

    const pairKey = (a: string, b: string) => [a, b].sort().join('|');
    const groups = new Map<string, RelEdge[]>();
    for (const r of allRels) {
      const k = pairKey(r.from_character_id, r.to_character_id);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }

    // Карта позиций для smart-routing хэндлов
    const posById = new Map<string, { x: number; y: number }>();
    for (const n of nodes) posById.set(n.id, n.position);
    // Имена для подписей в тултипе
    const nameById = new Map<string, string>(characters.data.map(c => [c.id, c.name]));

    const edges: Edge[] = [];
    for (const [, rels] of groups) {
      // === Слияние Ghoul + Blood Bond в одну линию "Ghoul · BB N" ===
      // Работает независимо от источника (синтез/старая таблица) и направлений.
      const isGhoulName = (n: string | undefined) => !!n && (n === 'Ghoul' || n.startsWith('Ghoul ·'));
      const bbMatch = (n: string | undefined) => n?.match(/^Blood Bond\s*(\d)/i)?.[1] ?? null;
      const ghoulRel = rels.find(r => isGhoulName(r.type?.name));
      const bbRel    = rels.find(r => bbMatch(r.type?.name));
      let workSet = rels;
      if (ghoulRel && bbRel && ghoulRel !== bbRel) {
        const level = bbMatch(bbRel.type?.name) ?? '?';
        const mergedLabel = `Ghoul · BB ${level}`;
        const merged: RelEdge = {
          ...ghoulRel,
          id: `${ghoulRel.id}+${bbRel.id}`,
          type: ghoulRel.type ? { ...ghoulRel.type, name: mergedLabel } : undefined,
        };
        workSet = [merged, ...rels.filter(r => r !== ghoulRel && r !== bbRel)];
      }

      // Сортируем чтобы личное было первым (parallelIdx=0, центральная линия)
      const sorted = [...workSet].sort((a, b) => {
        const aP = a.type?.category === 'personal' ? 0 : 1;
        const bP = b.type?.category === 'personal' ? 0 : 1;
        return aP - bP;
      });
      if (sorted.length === 1) {
        edges.push(buildEdge(sorted[0], false, undefined, 0, showDescriptions, showTypes, posById, nameById));
        continue;
      }
      const reciprocalPair = findReciprocalPair(sorted);
      if (reciprocalPair) {
        const [r1, r2] = reciprocalPair;
        edges.push(buildEdge(r1, false, r2, 0, showDescriptions, showTypes, posById, nameById));
        const remaining = sorted.filter(x => x !== r1 && x !== r2);
        remaining.forEach((r, idx) => edges.push(buildEdge(r, true, undefined, idx + 1, showDescriptions, showTypes, posById, nameById)));
      } else {
        sorted.forEach((r, idx) => edges.push(buildEdge(r, idx > 0, undefined, idx, showDescriptions, showTypes, posById, nameById)));
      }
    }

    return { nodes, edges };
  }, [characters.data, relationships.data, relTypes.data, showPcOnly, hideTheDead, clanFilter, charactersInFaction, focusMode, focusId, hops, minStrength, lockPositions, categoryFilter, showDescriptions, showTypes]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  const sig = useMemo(() => {
    const ns = computed.nodes.map(n => `${n.id}:${Math.round(n.position.x)}:${Math.round(n.position.y)}:${(n.data as any)?.selected ? 1 : 0}:${n.draggable ? 1 : 0}`).join('|');
    const es = computed.edges.map(e => {
      const d = (e.data as any) ?? {};
      const tip = (d.tooltip ?? []).map((t: any) => `${t.type}|${t.desc}`).join(';');
      return `${e.id}:${e.source}:${e.target}:${d.typeName ?? ''}:${tip}:${d.parallelIdx ?? 0}:${d.persistent ? 1 : 0}:${e.style?.strokeDasharray ?? ''}`;
    }).join('~');
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

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (focusMode === 'one') setFocusId(node.id);
    else nav(`/characters/${node.id}`);
  }, [focusMode, nav]);

  const onNodeDragStop = useCallback(async (_: any, node: Node) => {
    const { error } = await supabase
      .from('characters')
      .update({ mindmap_x: node.position.x, mindmap_y: node.position.y } as any)
      .eq('id', node.id);
    if (!error) {
      qc.setQueryData<(CharMM & { life_status: string })[]>(['mm-characters'], (old) =>
        old?.map(c => c.id === node.id ? { ...c, mindmap_x: node.position.x, mindmap_y: node.position.y } : c) ?? old
      );
    }
  }, [qc]);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    setPendingConnect({ from: c.source, to: c.target });
  }, []);

  const resetPositions = useCallback(async () => {
    if (!confirm('Сбросить все позиции узлов И изгибы рёбер?')) return;
    const ids = (characters.data ?? []).map(c => c.id);
    if (ids.length > 0) {
      await supabase.from('characters').update({ mindmap_x: null, mindmap_y: null } as any).in('id', ids);
      qc.invalidateQueries({ queryKey: ['mm-characters'] });
    }
    clearAllEdgeOffsets();
    // форсим перерендер рёбер
    qc.invalidateQueries({ queryKey: ['mm-relationships'] });
  }, [characters.data, qc]);

  // ------------------ Экспорт PDF ------------------
  const [exporting, setExporting] = useState(false);

  const exportPdf = useCallback(async () => {
    if (rfNodes.length === 0) {
      alert('На карте никого нет — добавь персонажей или ослабь фильтры.');
      return;
    }
    try {
      setExporting(true);

      const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement | null;
      if (!viewportEl) throw new Error('Не нашли viewport React Flow');

      // Считаем bounding box всех узлов (берём width/height из DOM, если уже измерены)
      const nodeEls = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node'));
      const sizeById = new Map<string, { w: number; h: number }>();
      for (const el of nodeEls) {
        const id = el.getAttribute('data-id');
        if (!id) continue;
        sizeById.set(id, { w: el.offsetWidth || 200, h: el.offsetHeight || 80 });
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of rfNodes) {
        const s = sizeById.get(n.id) ?? { w: (n as any).width ?? 200, h: (n as any).height ?? 80 };
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + s.w);
        maxY = Math.max(maxY, n.position.y + s.h);
      }
      const pad = 80;
      const graphW = Math.max(600, maxX - minX);
      const graphH = Math.max(400, maxY - minY);
      const totalW = graphW + pad * 2;
      const totalH = graphH + pad * 2;

      // Рендерим viewport в PNG. Сбрасываем transform — html-to-image берёт inline-style.
      const dataUrl = await toPng(viewportEl, {
        backgroundColor: '#0c0608',
        width: totalW,
        height: totalH,
        pixelRatio: 2,
        cacheBust: true,
        style: {
          width: `${totalW}px`,
          height: `${totalH}px`,
          transform: `translate(${-minX + pad}px, ${-minY + pad}px) scale(1)`,
          transformOrigin: 'top left',
        },
        filter: (node) => {
          // Прячем ручки-перетаскивашки рёбер (маленькие кружки под подписями)
          if ((node as HTMLElement)?.dataset?.exportHide === '1') return false;
          return true;
        },
      });

      // Собираем PDF (A4 landscape; вписываем картинку сохраняя пропорции)
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      // Встраиваем кириллический шрифт (иначе русский текст превращается в кашу)
      pdf.addFileToVFS('DejaVuSans.ttf', DEJAVU_SANS_BASE64);
      pdf.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
      pdf.setFont('DejaVuSans');

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Фон цвета крипта
      pdf.setFillColor(12, 6, 8);
      pdf.rect(0, 0, pageW, pageH, 'F');

      // Заголовок
      pdf.setTextColor(232, 226, 212);
      pdf.setFontSize(14);
      pdf.text('Vampire: The Masquerade — Карта связей', 24, 28);

      // Под-заголовок: дата + активные фильтры
      const filters: string[] = [];
      if (showPcOnly) filters.push('PC only');
      if (hideTheDead) filters.push('hide dead');
      if (clanFilter) filters.push(`clan: ${clanFilter}`);
      if (factionFilter) {
        const f = (factions.data ?? []).find(x => x.id === factionFilter);
        if (f) filters.push(`faction: ${f.name}`);
      }
      if (focusMode === 'one' && focusId) {
        const c = (characters.data ?? []).find(x => x.id === focusId);
        if (c) filters.push(`focus: ${c.name} (${hops} hop${hops > 1 ? 's' : ''})`);
      }
      if (categoryFilter !== 'all') {
        filters.push(`category: ${categoryFilter}`);
      }
      if (minStrength > 1) filters.push(`strength >= ${minStrength}`);
      if (!showTypes) filters.push('no type labels');
      if (!showDescriptions) filters.push('no descriptions');

      const dateStr = new Date().toLocaleString('ru-RU');
      pdf.setFontSize(9);
      pdf.setTextColor(168, 156, 155);
      pdf.text(dateStr, 24, 44);
      if (filters.length > 0) {
        // Перенос длинной строки фильтров вручную
        const filtersLine = pdf.splitTextToSize('Фильтры: ' + filters.join(' / '), pageW - 200);
        pdf.text(filtersLine, 200, 44);
      }

      // Область для картинки
      const areaX = 24;
      const areaY = 56;
      const areaW = pageW - 48;
      const areaH = pageH - 76;

      const aspect = totalW / totalH;
      let drawW = areaW;
      let drawH = areaW / aspect;
      if (drawH > areaH) {
        drawH = areaH;
        drawW = areaH * aspect;
      }
      const drawX = areaX + (areaW - drawW) / 2;
      const drawY = areaY + (areaH - drawH) / 2;

      pdf.addImage(dataUrl, 'PNG', drawX, drawY, drawW, drawH, undefined, 'FAST');

      // ---------- Приложение: все видимые связи с полными описаниями ----------
      // Берём из тех же рёбер, что на карте (computed.edges) — описания лежат в data.tooltip
      // и присутствуют независимо от тумблера, поэтому в PDF они попадут всегда.
      const seen = new Set<string>();
      const relList: { dir: string; type: string; desc: string }[] = [];
      for (const e of computed.edges) {
        const tip = (((e.data as any)?.tooltip ?? []) as { dir: string; type: string; desc: string }[]);
        for (const t of tip) {
          const desc = (t.desc ?? '').trim();
          const key = `${t.dir}|${t.type}|${desc}`;
          if (seen.has(key)) continue;
          seen.add(key);
          relList.push({ dir: t.dir, type: t.type, desc });
        }
      }
      // Сначала связи с описанием, затем по алфавиту
      relList.sort((a, b) =>
        (b.desc ? 1 : 0) - (a.desc ? 1 : 0) || a.dir.localeCompare(b.dir, 'ru'),
      );
      const withDesc = relList.filter(r => r.desc).length;

      if (relList.length > 0) {
        pdf.addPage('a4', 'landscape');
        const newPage = () => {
          pdf.setFillColor(12, 6, 8);
          pdf.rect(0, 0, pageW, pageH, 'F');
        };
        newPage();
        let y = 40;
        pdf.setTextColor(232, 226, 212);
        pdf.setFontSize(15);
        pdf.text('Все связи и описания', 24, y);
        y += 16;
        pdf.setFontSize(9);
        pdf.setTextColor(168, 156, 155);
        pdf.text(`Всего связей: ${relList.length} · с описанием: ${withDesc}`, 24, y);
        y += 20;

        const leftX = 24;
        const wrapW = pageW - 60;
        const ensureSpace = (need: number) => {
          if (y + need > pageH - 28) {
            pdf.addPage('a4', 'landscape');
            newPage();
            y = 40;
          }
        };

        for (const r of relList) {
          const header = r.type ? `${r.dir}   ·   ${r.type}` : r.dir;
          const descLines: string[] = r.desc ? pdf.splitTextToSize(r.desc, wrapW - 14) : [];
          const blockH = 14 + descLines.length * 11 + 9;
          ensureSpace(blockH);
          pdf.setFontSize(10.5);
          pdf.setTextColor(216, 83, 110); // rose — шапка связи
          pdf.text(header, leftX, y);
          y += 14;
          if (descLines.length > 0) {
            pdf.setFontSize(9.5);
            pdf.setTextColor(206, 198, 186);
            pdf.text(descLines, leftX + 14, y);
            y += descLines.length * 11;
          }
          y += 9;
        }
      }

      const fname = `chronicle-map-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.pdf`;
      pdf.save(fname);
    } catch (e: any) {
      console.error(e);
      alert('Не удалось выгрузить PDF: ' + (e?.message ?? String(e)) +
        '\n\nЧасто помогает: 1) нажать "Авто-раскладка" и попробовать снова; 2) убедиться, что портреты ссылаются на CORS-разрешённые источники (Imgur, Supabase Storage).');
    } finally {
      setExporting(false);
    }
  }, [rfNodes, computed, showPcOnly, hideTheDead, clanFilter, factionFilter, factions.data, focusMode, focusId, hops, categoryFilter, minStrength, showTypes, showDescriptions, characters.data]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="heading">🕸 Карта связей</h1>
        <Legend />
      </div>

      <div className="card flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" className="w-4 h-4 accent-blood" checked={showPcOnly} onChange={e => setShowPcOnly(e.target.checked)} />
            только PC
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" className="w-4 h-4 accent-blood" checked={hideTheDead} onChange={e => setHideTheDead(e.target.checked)} />
            скрыть мёртвых
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" className="w-4 h-4 accent-blood" checked={showTypes} onChange={e => setShowTypes(e.target.checked)} />
            показывать типы связей
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" className="w-4 h-4 accent-blood" checked={showDescriptions} onChange={e => setShowDescriptions(e.target.checked)} />
            показывать описание
          </label>
        </div>

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
          <label className="label">Сила связи</label>
          <select className="input" value={minStrength} onChange={e => setMinStrength(parseInt(e.target.value))}>
            <option value={1}>≥ 1</option>
            <option value={2}>≥ 2</option>
            <option value={3}>≥ 3</option>
            <option value={4}>≥ 4</option>
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
            title={lockPositions ? 'Разблокировать перетаскивание узлов и создание связей' : 'Зафиксировать узлы'}
          >
            {lockPositions ? '🔒 Заблокировано' : '🔓 Можно тащить'}
          </button>
          <button type="button" onClick={resetPositions} className="btn-ghost text-sm" title="Сбросить позиции и изгибы">
            ↻ Авто-раскладка
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={exporting}
            className="btn-primary text-sm"
            title="Скачать текущую карту в PDF (с учётом фильтров)"
          >
            {exporting ? '⏳ Готовим PDF…' : '📄 Экспорт PDF'}
          </button>
        </div>
      </div>

      {!lockPositions && (
        <p className="text-xs text-ash">
          💡 Чтобы создать связь — наведись на край узла, тяни линию к другому узлу. Чтобы изогнуть стрелку — тащи маленький круг под её подписью.
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
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            attributionPosition="bottom-right"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#3a1a22" gap={24} />
            <MiniMap
              nodeColor={(n) => {
                const d = n.data as any;
                if (d?.is_pc) return '#000';
                if (d?.kind === 'group') return '#c8a96a';
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
// Выбор хэндлов на основе геометрии: стрелка выходит из ближайшей грани узла-источника
// и заходит в противоположную грань узла-приёмника.
function pickHandles(
  src: { x: number; y: number } | undefined,
  tgt: { x: number; y: number } | undefined,
): { sourceHandle: string; targetHandle: string } {
  if (!src || !tgt) return { sourceHandle: 'b', targetHandle: 't2' };
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'r', targetHandle: 'l2' }
      : { sourceHandle: 'l', targetHandle: 'r2' };
  } else {
    return dy >= 0
      ? { sourceHandle: 'b', targetHandle: 't2' }
      : { sourceHandle: 't', targetHandle: 'b2' };
  }
}

function buildEdge(
  r: RelEdge,
  offset: boolean,
  reciprocal: RelEdge | undefined,
  parallelIdx: number,
  showDescription: boolean,
  showTypes: boolean,
  posById: Map<string, { x: number; y: number }>,
  nameById: Map<string, string>,
): Edge {
  const cat = r.type?.category ?? 'personal';
  // Цвет/пунктир/толщина — сначала из настроек типа в БД, потом фоллбэк по имени
  const color = r.type?.color || edgeColor(r.type?.name ?? '', cat);
  const dashed = r.type?.dashed ?? (cat === 'personal');
  const thickness = r.type?.thickness ?? 1.0;
  const isBidirectional = !!reciprocal;

  const typeName = r.type?.name ?? '';
  const otherTypeName = reciprocal?.type?.name ?? '';
  const titleLine = showTypes
    ? (reciprocal
        ? (typeName === otherTypeName ? typeName : `${typeName} ↔ ${otherTypeName}`)
        : typeName)
    : '';
  const fromName = nameById.get(r.from_character_id) ?? '?';
  const toName = nameById.get(r.to_character_id) ?? '?';
  // Стороны связи для подписи. Для двунаправленного ребра — обе, чтобы
  // не терять описание второй стороны (баг: показывалась только заведённая первой).
  // Описание кладём ВСЕГДА — наведение покажет его независимо от тумблера.
  // Тумблер showDescription управляет лишь тем, висит ли подпись постоянно (persistent).
  const tooltip: { dir: string; type: string; desc: string }[] = [
    {
      dir: `${fromName} → ${toName}`,
      type: typeName,
      desc: r.description ?? '',
    },
  ];
  if (reciprocal) {
    tooltip.push({
      dir: `${toName} → ${fromName}`,
      type: reciprocal.type?.name ?? '',
      desc: reciprocal.description ?? '',
    });
  }

  const { sourceHandle, targetHandle } = pickHandles(
    posById.get(r.from_character_id),
    posById.get(r.to_character_id),
  );

  // Толщина: базовая по силе, помноженная на коэффициент типа.
  // Для синтезированных (без strength) используем strength=3.
  const baseStroke = (1 + ((r.strength ?? 3) - 1) * 0.4) * thickness;
  // Личное всегда чуть ярче и толще, механика — слегка приглушённая
  const isPersonal = cat === 'personal';
  return {
    id: r.id,
    source: r.from_character_id,
    target: r.to_character_id,
    sourceHandle,
    targetHandle,
    // label больше не используем — ChronicleEdge сам рендерит typeName (вдоль линии) и description (в пузыре сбоку)
    type: 'chronicle',
    style: {
      stroke: color,
      strokeWidth: baseStroke * (isPersonal ? 1.15 : 0.9),
      strokeDasharray: dashed ? '6 4' : undefined,
      opacity: offset ? 0.85 : 1,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color },
    markerStart: isBidirectional ? { type: MarkerType.ArrowClosed, color } : undefined,
    data: {
      parallelIdx,
      isBidirectional,
      typeName: titleLine,
      tooltip,
      persistent: showDescription,
    },
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
  // Механика
  if (t.startsWith('sire') || t === 'childe')        return '#c0233a';
  if (t.startsWith('blood bond'))                     return '#8a0e1a';
  if (t === 'ghoul')                                  return '#d8536e';
  if (t === 'touchstone')                             return '#dcd0e3';
  if (t === 'ally')                                   return '#a89c9b';
  if (t === 'coterie member')                         return '#dcd0e3';
  if (t.startsWith('boon'))                           return '#c8a96a';
  if (t === 'knows about')                            return '#c8a96a';
  // Личное (русский) и старые английские
  if (t === 'любовь' || t === 'lover')                return '#d8536e';
  if (t === 'враг' || t === 'enemy')                  return '#7a1a1a';
  if (t === 'ненависть' || t === 'hates')             return '#7a1a1a';
  if (t === 'соперник' || t === 'rival')              return '#c8a96a';
  if (t === 'наставник' || t === 'mentor')            return '#a89c9b';
  if (t === 'доверие' || t === 'trusts')              return '#a89c9b';
  if (t === 'страх' || t === 'fears')                 return '#5b4a6e';
  if (t === 'недоверие' || t === 'distrusts')         return '#5b4a6e';
  return category === 'mechanic' ? '#c8a96a' : '#a89c9b';
}

// ============================== Легенда ==============================
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="chip border-black/80 bg-black/40">⬛ PC</span>
      <span className="chip border-bloodlight bg-blood/15">🟥 Vampire/Ghoul</span>
      <span className="chip border-sky-500/80 bg-sky-500/10">🟦 Human</span>
      <span className="chip border-gold/70 border-double bg-gold/5">👥 Group</span>
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
  // Только разрешённые в ручном добавлении (механика типа Sire/Touchstone — нет, она через чарник)
  const manualTypes  = relTypes.filter(t => !t.hidden_from_manual);
  const personalTypes = manualTypes.filter(t => t.category === 'personal');
  const mechanicTypes = manualTypes.filter(t => t.category === 'mechanic');

  const [typeId, setTypeId] = useState(manualTypes[0]?.id ?? '');
  const [desc, setDesc] = useState('');
  const [strength, setStrength] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedType = relTypes.find(t => t.id === typeId);
  const reciprocalName = selectedType ? RECIPROCAL[selectedType.name] : undefined;
  const descRequired = !!fromChar?.is_pc || !!toChar?.is_pc;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (descRequired && !desc.trim()) {
      setErr('Связь касается игрока — обязательно опиши, что между ними происходит.');
      return;
    }
    setBusy(true); setErr(null);
    try {
      await createRelWithReciprocal({
        from_character_id: fromId,
        to_character_id: toId,
        type_id: typeId,
        description: desc.trim() || null,
        started_at_date: null,
        started_at_session: null,
        strength,
        created_by: createdBy,
      }, relTypes);
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
          {reciprocalName && (
            <p className="text-xs text-ash mt-1">
              ✓ Обратная связь <span className="text-rose">«{reciprocalName}»</span> от {toChar?.name} к {fromChar?.name} будет создана автоматически.
            </p>
          )}
        </div>

        <div>
          <label className="label">
            Описание {descRequired && <span className="text-rose">*</span>}
            {!descRequired && <span className="text-ash text-xs ml-1">(не обязательно — связь NPC↔NPC)</span>}
          </label>
          <textarea
            className="input min-h-[60px]"
            required={descRequired}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder={descRequired ? 'Связь касается игрока — опиши историю...' : 'Опционально...'}
          />
        </div>

        <div>
          <label className="label">Сила (1–5)</label>
          <input type="number" min={1} max={5} className="input w-24" value={strength} onChange={e => setStrength(parseInt(e.target.value || '3'))} />
        </div>

        {err && <p className="text-rose text-sm">{err}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-ghost">Отмена</button>
          <button type="submit" className="btn-primary" disabled={busy || (descRequired && !desc.trim())}>
            {busy ? 'Связываем...' : 'Создать связь'}
          </button>
        </div>
      </form>
    </div>
  );
}
.name} будет создана автоматически.
            </p>
          )}
        </div>

        <div>
          <label className="label">
            Описание {descRequired && <span className="text-rose">*</span>}
            {!descRequired && <span className="text-ash text-xs ml-1">(не обязательно — связь NPC↔NPC)</span>}
          </label>
          <textarea
            className="input min-h-[60px]"
            required={descRequired}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder={descRequired ? 'Связь касается игрока — опиши историю...' : 'Опционально...'}
          />
        </div>

        <div>
          <label className="label">Сила (1–5)</label>
          <input type="number" min={1} max={5} className="input w-24" value={strength} onChange={e => setStrength(parseInt(e.target.value || '3'))} />
        </div>

        {err && <p className="text-rose text-sm">{err}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-ghost">Отмена</button>
          <button type="submit" className="btn-primary" disabled={busy || (descRequired && !desc.trim())}>
            {busy ? 'Связываем...' : 'Создать связь'}
          </button>
        </div>
      </form>
    </div>
  );
}
