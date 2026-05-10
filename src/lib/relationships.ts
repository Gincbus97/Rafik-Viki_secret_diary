import { supabase } from './supabase';
import { RECIPROCAL, type RelationshipType } from './types';

export interface RelPayload {
  from_character_id: string;
  to_character_id: string;
  type_id: string;
  description: string | null;
  started_at_date: string | null;
  started_at_session: number | null;
  strength: number;
  created_by: string | null;
}

/**
 * Создать связь и (если у типа есть взаимная пара) автоматически добавить обратную.
 * Например: создаёшь Sire → авто-создаёт Childe в обратную сторону.
 * Симметричные типы (Lover/Ally/Enemy/Rival/Coterie member) тоже получают зеркало.
 * Если зеркальная связь уже есть в БД — не дублируем.
 */
export async function createRelWithReciprocal(payload: RelPayload, types: RelationshipType[]) {
  const { error } = await supabase.from('relationships').insert(payload);
  if (error) throw error;

  const main = types.find(t => t.id === payload.type_id);
  if (!main) return;
  const reciprocalName = RECIPROCAL[main.name];
  if (!reciprocalName) return;
  const reciprocalType = types.find(t => t.name === reciprocalName);
  if (!reciprocalType) return;

  // Проверим, нет ли уже встречной связи
  const { data: existing } = await supabase
    .from('relationships')
    .select('id')
    .eq('from_character_id', payload.to_character_id)
    .eq('to_character_id',   payload.from_character_id)
    .eq('type_id', reciprocalType.id)
    .maybeSingle();
  if (existing) return;

  await supabase.from('relationships').insert({
    from_character_id: payload.to_character_id,
    to_character_id:   payload.from_character_id,
    type_id: reciprocalType.id,
    description: payload.description,
    started_at_date: payload.started_at_date,
    started_at_session: payload.started_at_session,
    strength: payload.strength,
    created_by: payload.created_by,
  });
}

/**
 * Обновить связь и при смене типа — пересоздать reciprocal.
 */
export async function updateRelWithReciprocal(
  id: string,
  patch: Omit<RelPayload, 'created_by'>,
  types: RelationshipType[],
) {
  // Сначала запомним старую связь
  const { data: old } = await supabase
    .from('relationships')
    .select('id, from_character_id, to_character_id, type_id')
    .eq('id', id)
    .single();
  const { error } = await supabase.from('relationships').update(patch).eq('id', id);
  if (error) throw error;

  if (!old) return;

  // Если тип изменился — старый reciprocal удаляем, новый создаём
  if (old.type_id !== patch.type_id) {
    const oldType = types.find(t => t.id === old.type_id);
    if (oldType) {
      const oldReciprocalName = RECIPROCAL[oldType.name];
      if (oldReciprocalName) {
        const oldReciprocalType = types.find(t => t.name === oldReciprocalName);
        if (oldReciprocalType) {
          await supabase
            .from('relationships')
            .delete()
            .eq('from_character_id', old.to_character_id)
            .eq('to_character_id',   old.from_character_id)
            .eq('type_id', oldReciprocalType.id);
        }
      }
    }
    // Создаём новый reciprocal
    const newType = types.find(t => t.id === patch.type_id);
    if (newType) {
      const reciprocalName = RECIPROCAL[newType.name];
      if (reciprocalName) {
        const reciprocalType = types.find(t => t.name === reciprocalName);
        if (reciprocalType) {
          const { data: existing } = await supabase
            .from('relationships')
            .select('id')
            .eq('from_character_id', patch.to_character_id)
            .eq('to_character_id',   patch.from_character_id)
            .eq('type_id', reciprocalType.id)
            .maybeSingle();
          if (!existing) {
            await supabase.from('relationships').insert({
              from_character_id: patch.to_character_id,
              to_character_id:   patch.from_character_id,
              type_id: reciprocalType.id,
              description: patch.description,
              started_at_date: patch.started_at_date,
              started_at_session: patch.started_at_session,
              strength: patch.strength,
              created_by: null,
            });
          }
        }
      }
    }
  }
}

/**
 * Удалить связь и её reciprocal (если он автоматический).
 */
export async function deleteRelWithReciprocal(id: string, types: RelationshipType[]) {
  const { data: rel } = await supabase
    .from('relationships')
    .select('id, from_character_id, to_character_id, type_id')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('relationships').delete().eq('id', id);
  if (error) throw error;

  if (!rel) return;
  const t = types.find(t => t.id === rel.type_id);
  if (!t) return;
  const reciprocalName = RECIPROCAL[t.name];
  if (!reciprocalName) return;
  const reciprocalType = types.find(t => t.name === reciprocalName);
  if (!reciprocalType) return;

  await supabase
    .from('relationships')
    .delete()
    .eq('from_character_id', rel.to_character_id)
    .eq('to_character_id',   rel.from_character_id)
    .eq('type_id', reciprocalType.id);
}
