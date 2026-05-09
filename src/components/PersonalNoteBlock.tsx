import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface Props { characterId: string; }

export default function PersonalNoteBlock({ characterId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState(false);

  const note = useQuery({
    queryKey: ['note', user?.id, characterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_notes')
        .select('*')
        .eq('author_id', user!.id)
        .eq('character_id', characterId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => { if (note.data) setBody(note.data.body ?? ''); }, [note.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        author_id: user!.id,
        character_id: characterId,
        body,
      };
      const { error } = await supabase
        .from('personal_notes')
        .upsert(payload, { onConflict: 'author_id,character_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['note', user?.id, characterId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });

  return (
    <div className="card border-rose/20 bg-velvet/30">
      <h2 className="text-xl mb-2">📝 Личные заметки</h2>
      <p className="text-xs text-ash mb-2">Видны только тебе.</p>
      <textarea
        className="input min-h-[100px] font-hand text-base"
        placeholder="Что ты думаешь о нём/ней? Что тебе сказали по секрету?"
        value={body}
        onChange={e => setBody(e.target.value)}
      />
      <div className="flex items-center justify-between mt-2">
        <button
          className="btn-ghost text-sm"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {save.isPending ? 'Шепчем...' : 'Сохранить'}
        </button>
        {saved && <span className="text-rose text-sm">сохранено ✓</span>}
      </div>
    </div>
  );
}
