import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { BatSticker, BloodDropSticker, MoonSticker, RoseSticker, CoffinSticker } from '@/components/Stickers';

export default function LoginPage() {
  const { user, signInMagic, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (sent) setErr(null); }, [sent]);

  if (!loading && user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await signInMagic(email.trim().toLowerCase());
    setBusy(false);
    if (r.error) setErr(r.error);
    else setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="absolute top-8 left-8 opacity-70"><MoonSticker /></div>
      <div className="absolute top-12 right-10 opacity-70"><BatSticker /></div>
      <div className="absolute bottom-10 left-12 opacity-50"><RoseSticker /></div>
      <div className="absolute bottom-14 right-14 opacity-50"><CoffinSticker /></div>

      <div className="card w-full max-w-md relative">
        <div className="absolute -top-6 -right-6"><BloodDropSticker /></div>
        <h1 className="heading text-center mb-1">Chronicle</h1>
        <p className="text-center text-ash text-sm mb-6 font-hand text-base">
          добро пожаловать в склеп
        </p>

        {sent ? (
          <div className="text-center space-y-3">
            <p className="text-bone">Магическая ссылка отправлена на</p>
            <p className="text-rose font-medium">{email}</p>
            <p className="subtle">Проверь почту (и папку «Спам»). Кликни по ссылке — войдёшь автоматически.</p>
            <button onClick={() => { setSent(false); setEmail(''); }} className="btn-ghost mt-3">
              Войти под другим email
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                required
                placeholder="kindred@chronicle.eu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {err && <p className="text-rose text-sm">{err}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Призываем...' : 'Прислать магическую ссылку'}
            </button>
            <p className="subtle text-center">
              Никаких паролей. Откроешь письмо — окажешься внутри.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
