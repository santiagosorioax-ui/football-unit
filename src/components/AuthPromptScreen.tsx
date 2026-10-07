import { useState } from 'react';
import { User } from 'firebase/auth';
import { LogIn, UserX, ShieldCheck, Sparkles, Trophy, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';
import { sounds } from '../utils/audio';

interface AuthPromptScreenProps {
  currentUser: User | null;
  onContinueWithAuth: (user: User) => void;
  onContinueAsGuest: () => void;
}

export default function AuthPromptScreen({
  currentUser,
  onContinueWithAuth,
  onContinueAsGuest,
}: AuthPromptScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    sounds.playBounce();
    setIsLoading(true);
    setAuthError(null);
    try {
      const user = await signInWithGoogle();
      sounds.playCheer();
      onContinueWithAuth(user);
    } catch (err: unknown) {
      console.error('Login error:', err);
      const message =
        err instanceof Error && err.message.includes('popup-closed-by-user')
          ? 'Ventana cerrada por el usuario. Intenta nuevamente si deseas iniciar sesión.'
          : 'No se pudo completar el inicio de sesión. Puedes continuar como invitado.';
      setAuthError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    sounds.playKick();
    onContinueAsGuest();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      {/* Stadium & Field Atmospheric Background */}
      <div className="absolute inset-0 bg-radial-gradient from-emerald-950/40 via-slate-950 to-black pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

      {/* Decorative Pitch Lines */}
      <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full border-2 border-white" />
        <div className="absolute w-full h-[2px] bg-white top-1/2" />
      </div>

      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-lg bg-slate-900/90 border-2 border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col items-center text-center space-y-6">
        {/* Header Badge */}
        <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-black text-xs tracking-wider uppercase">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Acceso al Juego • Firebase Cloud</span>
        </div>

        {/* Brand Title */}
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-wider text-white drop-shadow-md">
            FOOTBALL <span className="text-amber-400">UNIT</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto">
            ¿Deseas iniciar sesión con tu cuenta antes de ingresar al campo de juego?
          </p>
        </div>

        {/* Existing Session Detected */}
        {currentUser ? (
          <div className="w-full bg-slate-950/80 border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'Usuario'}
                  className="w-12 h-12 rounded-full border-2 border-emerald-400 object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-emerald-600/30 border border-emerald-400 flex items-center justify-center font-black text-emerald-300 text-lg">
                  {currentUser.displayName?.[0] || 'U'}
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sesión Activa</span>
                </div>
                <div className="font-black text-white text-sm sm:text-base truncate max-w-[200px]">
                  {currentUser.displayName || 'Entrenador'}
                </div>
                <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                  {currentUser.email}
                </div>
              </div>
            </div>

            <button
              onClick={() => onContinueWithAuth(currentUser)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              <span>Entrar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null}

        {/* Action Choice Buttons */}
        <div className="w-full space-y-3.5 pt-1">
          {/* Option 1: Iniciar Sesión con Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full group relative overflow-hidden py-3.5 px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-black text-sm uppercase tracking-wider shadow-[0_4px_20px_rgba(37,99,235,0.4)] active:scale-[0.98] transition-all flex items-center justify-between border border-blue-400/40 disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-md">
                  {/* Google SVG Icon */}
                  <svg className="w-full h-full" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
              )}
              <div className="text-left">
                <div className="leading-tight font-black">
                  {isLoading ? 'Conectando con Google...' : 'Sí, Iniciar Sesión'}
                </div>
                <div className="text-[10px] font-medium text-blue-200/80 normal-case">
                  Guardar monedas y progresos en la nube
                </div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-200 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Option 2: No Iniciar Sesión / Continuar como Invitado */}
          <button
            onClick={handleSkip}
            disabled={isLoading}
            className="w-full py-3.5 px-5 rounded-2xl bg-slate-950/80 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-sm tracking-wider uppercase border border-white/10 hover:border-white/25 active:scale-[0.98] transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400">
                <UserX className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="leading-tight font-black text-slate-200">
                  No Iniciar Sesión
                </div>
                <div className="text-[10px] font-medium text-slate-400 normal-case">
                  Jugar como invitado (guardado local)
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Error notification if login canceled */}
        {authError && (
          <div className="w-full p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs text-left">
            {authError}
          </div>
        )}

        {/* Benefits Footnote */}
        <div className="pt-2 border-t border-white/10 w-full grid grid-cols-2 gap-2 text-left">
          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Sincroniza tus fichajes y monedas</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Seguridad y persistencia garantizadas</span>
          </div>
        </div>
      </div>
    </div>
  );
}
