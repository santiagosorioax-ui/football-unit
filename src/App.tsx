import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  auth,
  onAuthStateChanged,
  testConnection,
  saveUserDataToFirestore,
  loadUserDataFromFirestore,
  signOutUser,
  MatchRoomData,
  leaveOrCancelMatchRoom,
} from './lib/firebase';
import AuthPromptScreen from './components/AuthPromptScreen';
import LoadingScreen from './components/LoadingScreen';
import HomeScreen from './components/HomeScreen';
import FootballGame, { MatchPeriod } from './components/FootballGame';
import TeamScreen from './components/TeamScreen';
import MailboxModal from './components/MailboxModal';
import ShopModal from './components/ShopModal';
import AchievementsModal from './components/AchievementsModal';
import AchievementNotification from './components/AchievementNotification';
import TrainingModal from './components/TrainingModal';
import MatchmakingModal from './components/MatchmakingModal';
import { AppScreen, MailboxMessage, TeamCustomization, GlobalStats, Achievement } from './types/game';
import { ACHIEVEMENTS } from './data/achievements';
import { STARTER_TEAM_PLAYER_IDS, PlayerData } from './data/players';
import { sounds } from './utils/audio';

const DEFAULT_TEAM: TeamCustomization = {
  teamName: 'Football Unit FC',
  playerName: 'J. Álvarez (Araña)',
  playerNumber: 9,
  jerseyColor: '#2563eb',
  shortsColor: '#f8fafc',
  rivalColor: '#dc2626',
  ballStyle: 'classic',
  playerId: 'starter_dc',
  playerGrl: 82,
  playerPosition: 'DC',
  playerCountry: 'Argentina',
};

const DEFAULT_STATS: GlobalStats = {
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  ties: 0,
  totalGoals: 0,
};

const INITIAL_MESSAGES: MailboxMessage[] = [
  {
    id: 'msg_welcome',
    type: 'system',
    title: '¡Bienvenido a Football Unit!',
    body: 'Te damos la bienvenida al juego de fútbol individual. Reclama tu recompensa inicial de 100 monedas para personalizar tu equipo en la tienda.',
    timestamp: 'Hoy',
    read: false,
    reward: 100,
  },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<AppScreen>('auth');
  const [loadingDestination, setLoadingDestination] = useState<AppScreen>('home');
  const [gameMode, setGameMode] = useState<'match' | 'training' | 'multiplayer'>('match');
  const [isMatchmakingOpen, setIsMatchmakingOpen] = useState(false);
  const [multiplayerRoom, setMultiplayerRoom] = useState<MatchRoomData | null>(null);
  const [multiplayerRole, setMultiplayerRole] = useState<'host' | 'guest'>('host');
  const [trainingDrill, setTrainingDrill] = useState<string>('tiro_libre');
  const [gameInitialPeriod, setGameInitialPeriod] = useState<MatchPeriod | undefined>(undefined);
  const [isTrainingOpen, setIsTrainingOpen] = useState(false);
  const [isMailboxOpen, setIsMailboxOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [activeAchievementNotification, setActiveAchievementNotification] = useState<Achievement | null>(null);
  const achievementQueueRef = useRef<Achievement[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Persistent State
  const [team, setTeam] = useState<TeamCustomization>(() => {
    try {
      const saved = localStorage.getItem('fu_team');
      return saved ? JSON.parse(saved) : DEFAULT_TEAM;
    } catch {
      return DEFAULT_TEAM;
    }
  });

  const [coins, setCoins] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('fu_coins');
      return saved ? Number(saved) : 50;
    } catch {
      return 50;
    }
  });

  const [stats, setStats] = useState<GlobalStats>(() => {
    try {
      const saved = localStorage.getItem('fu_stats');
      return saved ? JSON.parse(saved) : DEFAULT_STATS;
    } catch {
      return DEFAULT_STATS;
    }
  });

  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('fu_achievements');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Unlocked Players: Starts with the last 11 World Cup players (starter squad)
  const [unlockedPlayerIds, setUnlockedPlayerIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('fu_unlocked_players');
      if (saved) return JSON.parse(saved);
    } catch {}
    return STARTER_TEAM_PLAYER_IDS;
  });

  const [unlockedItems, setUnlockedItems] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('fu_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [messages, setMessages] = useState<MailboxMessage[]>(() => {
    try {
      const saved = localStorage.getItem('fu_mailbox');
      return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
    } catch {
      return INITIAL_MESSAGES;
    }
  });

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('fu_team', JSON.stringify(team));
  }, [team]);

  useEffect(() => {
    localStorage.setItem('fu_coins', String(coins));
  }, [coins]);

  useEffect(() => {
    localStorage.setItem('fu_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('fu_achievements', JSON.stringify(unlockedAchievementIds));
  }, [unlockedAchievementIds]);

  useEffect(() => {
    localStorage.setItem('fu_unlocked_players', JSON.stringify(unlockedPlayerIds));
  }, [unlockedPlayerIds]);

  useEffect(() => {
    localStorage.setItem('fu_items', JSON.stringify(unlockedItems));
  }, [unlockedItems]);

  useEffect(() => {
    localStorage.setItem('fu_mailbox', JSON.stringify(messages));
  }, [messages]);

  // Firebase Auth & Cloud Firestore Sync Initialization
  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const cloudData = await loadUserDataFromFirestore(user.uid);
          if (cloudData) {
            if (typeof cloudData.coins === 'number') setCoins(cloudData.coins);
            if (cloudData.team) setTeam(cloudData.team);
            if (cloudData.stats) setStats(cloudData.stats);
            if (Array.isArray(cloudData.unlockedPlayerIds)) setUnlockedPlayerIds(cloudData.unlockedPlayerIds);
            if (Array.isArray(cloudData.unlockedAchievementIds)) setUnlockedAchievementIds(cloudData.unlockedAchievementIds);
          }
        } catch (err) {
          console.error('Error fetching cloud user profile:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Save to Firestore when currentUser is active and data changes
  useEffect(() => {
    if (currentUser) {
      saveUserDataToFirestore(currentUser.uid, {
        userId: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        coins,
        stats,
        team,
        unlockedPlayerIds,
        unlockedAchievementIds,
      }).catch((err) => console.error('Failed to sync to Firestore:', err));
    }
  }, [currentUser, coins, stats, team, unlockedPlayerIds, unlockedAchievementIds]);

  // Audio Sync
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.enabled = next;
  };

  // Mailbox Handlers
  const addMailboxMessage = (msg: Omit<MailboxMessage, 'id' | 'timestamp'>) => {
    const newMsg: MailboxMessage = {
      ...msg,
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [newMsg, ...prev]);
  };

  const handleMarkAllRead = () => {
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
  };

  const handleDeleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const handleClaimReward = (id: string, reward: number) => {
    setCoins((prev) => prev + reward);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read: true, reward: undefined } : m))
    );
    sounds.playCheer();
  };

  // Achievements notification dispatcher
  const showNextAchievement = () => {
    if (achievementQueueRef.current.length > 0) {
      const next = achievementQueueRef.current.shift()!;
      setActiveAchievementNotification(next);
    } else {
      setActiveAchievementNotification(null);
    }
  };

  const checkAchievementsWithStats = (updatedStats: GlobalStats, currentUnlocked: string[]) => {
    const newlyUnlocked: Achievement[] = [];
    let addedCoins = 0;

    for (const ach of ACHIEVEMENTS) {
      if (currentUnlocked.includes(ach.id)) continue;

      let progress = 0;
      if (ach.category === 'wins') progress = updatedStats.wins;
      else if (ach.category === 'goals') progress = updatedStats.totalGoals;
      else if (ach.category === 'matches') progress = updatedStats.matchesPlayed;

      if (progress >= ach.requirement) {
        newlyUnlocked.push(ach);
        addedCoins += ach.rewardCoins;
      }
    }

    if (newlyUnlocked.length > 0) {
      const newIds = newlyUnlocked.map((a) => a.id);
      setUnlockedAchievementIds((prev) => [...prev, ...newIds]);
      setCoins((c) => c + addedCoins);
      sounds.playCheer();

      // Enqueue notification for display
      achievementQueueRef.current.push(...newlyUnlocked);
      if (!activeAchievementNotification) {
        showNextAchievement();
      }

      // Add a commemorative mailbox entry
      newlyUnlocked.forEach((ach) => {
        addMailboxMessage({
          type: 'win',
          title: `¡Logro Desbloqueado: ${ach.title}!`,
          body: `¡Felicidades! Has completado el logro "${ach.title}" (${ach.description}). Has recibido automáticamente +${ach.rewardCoins} monedas.`,
          read: false,
        });
      });
    }
  };

  // Real-time Goal Scored Handler
  const handleGoalScored = () => {
    setStats((prev) => {
      const updated: GlobalStats = {
        ...prev,
        totalGoals: prev.totalGoals + 1,
      };
      checkAchievementsWithStats(updated, unlockedAchievementIds);
      return updated;
    });
  };

  // Match Outcome Handlers
  const handleMatchComplete = (result: 'win' | 'loss' | 'tie', pScore: number, aScore: number) => {
    setStats((prev) => {
      const updated: GlobalStats = {
        ...prev,
        matchesPlayed: prev.matchesPlayed + 1,
        wins: result === 'win' ? prev.wins + 1 : prev.wins,
        losses: result === 'loss' ? prev.losses + 1 : prev.losses,
        ties: result === 'tie' ? prev.ties + 1 : prev.ties,
      };
      checkAchievementsWithStats(updated, unlockedAchievementIds);
      return updated;
    });

    if (result === 'win') {
      const reward = 100;
      setCoins((c) => c + reward);
      addMailboxMessage({
        type: 'win',
        title: gameMode === 'multiplayer' ? '¡Gran Victoria Multijugador Online!' : '¡Gran Victoria en la Cancha!',
        body: gameMode === 'multiplayer'
          ? `¡Excelente desempeño! Derrotaste a tu rival en línea con un marcador de ${pScore} a ${aScore}. Has ganado +${reward} monedas oficiales.`
          : `¡Excelente desempeño! Derrotaste a la IA con un marcador de ${pScore} a ${aScore}. Has ganado +${reward} monedas.`,
        read: false,
      });
    } else if (result === 'loss') {
      addMailboxMessage({
        type: 'loss',
        title: gameMode === 'multiplayer' ? 'Derrota Frente a Rival Online' : 'Derrota Frente a la IA',
        body: `El partido finalizó con marcador de ${pScore} a ${aScore} a favor del rival. ¡Revisa tu táctica y vuelve por la revancha!`,
        read: false,
      });
    } else {
      const reward = 25;
      setCoins((c) => c + reward);
      addMailboxMessage({
        type: 'system',
        title: 'Empate Emocionante',
        body: `El partido terminó igualado ${pScore} a ${aScore}. Ambos equipos demostraron gran nivel (+${reward} monedas).`,
        read: false,
      });
    }
  };

  const handleExitMatch = (abandoned: boolean, pScore: number, aScore: number) => {
    if (multiplayerRoom) {
      const pId =
        currentUser?.uid ||
        sessionStorage.getItem('fu_session_player_id') ||
        localStorage.getItem('fu_guest_id') ||
        'guest';
      leaveOrCancelMatchRoom(multiplayerRoom.id, pId).catch((err) =>
        console.warn('Error leaving multiplayer room:', err)
      );
      setMultiplayerRoom(null);
    }

    if (abandoned && (gameMode === 'match' || gameMode === 'multiplayer')) {
      setStats((prev) => {
        const updated: GlobalStats = {
          ...prev,
          matchesPlayed: prev.matchesPlayed + 1,
          losses: prev.losses + 1,
        };
        checkAchievementsWithStats(updated, unlockedAchievementIds);
        return updated;
      });

      addMailboxMessage({
        type: 'abandon',
        title: 'Partido Abandonado',
        body: `Abandonaste el partido antes de completarse cuando el resultado era ${pScore} - ${aScore}. ¡La próxima vez no bajes los brazos!`,
        read: false,
      });
    }
    setScreen('home');
  };

  const handlePlayAI = () => {
    setIsMatchmakingOpen(false);
    setGameMode('match');
    setMultiplayerRoom(null);
    setGameInitialPeriod(undefined);
    setLoadingDestination('match');
    setScreen('loading');
  };

  const handleMatchFound = (roomData: MatchRoomData, role: 'host' | 'guest') => {
    setIsMatchmakingOpen(false);
    setGameMode('multiplayer');
    setMultiplayerRoom(roomData);
    setMultiplayerRole(role);
    setGameInitialPeriod(undefined);
    setLoadingDestination('match');
    setScreen('loading');
  };

  // Player Shop Purchase Handler
  const handleBuyPlayer = (player: PlayerData, price: number) => {
    if (coins >= price && !unlockedPlayerIds.includes(player.id)) {
      setCoins((c) => c - price);
      setUnlockedPlayerIds((prev) => [...prev, player.id]);
      sounds.playCheer();

      addMailboxMessage({
        type: 'win',
        title: `¡Fichaje Estrella: ${player.name}!`,
        body: `Has fichado a ${player.name} (${player.shortName}) con GRL ${player.grl} por ${price} monedas. ¡Ya puedes alinearlo en tu equipo!`,
        read: false,
      });
    }
  };

  // Training reward & 3D launch handlers (+10 coins)
  const handleRewardTrainingCoins = (amount: number, reason: string) => {
    setCoins((c) => c + amount);
    sounds.playCheer();
    addMailboxMessage({
      type: 'system',
      title: `¡Entrenamiento Completado: +${amount} Monedas!`,
      body: `Has completado la sesión técnica de ${reason}. Se han acreditado +${amount} monedas a tu saldo oficial.`,
      read: false,
    });
  };

  const handleStart3DPractice = (drillType: string) => {
    setIsTrainingOpen(false);
    setGameMode('training');
    setTrainingDrill(drillType);
    setGameInitialPeriod(undefined);
    setLoadingDestination('match');
    setScreen('loading');
  };

  const handleContinueWithAuth = async (user: User) => {
    setCurrentUser(user);
    try {
      const cloudData = await loadUserDataFromFirestore(user.uid);
      if (cloudData) {
        if (typeof cloudData.coins === 'number') setCoins(cloudData.coins);
        if (cloudData.team) setTeam(cloudData.team);
        if (cloudData.stats) setStats(cloudData.stats);
        if (Array.isArray(cloudData.unlockedPlayerIds)) setUnlockedPlayerIds(cloudData.unlockedPlayerIds);
        if (Array.isArray(cloudData.unlockedAchievementIds)) setUnlockedAchievementIds(cloudData.unlockedAchievementIds);
      } else {
        await saveUserDataToFirestore(user.uid, {
          userId: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          coins,
          stats,
          team,
          unlockedPlayerIds,
          unlockedAchievementIds,
        });
      }
    } catch (err) {
      console.error('Error syncing on auth continue:', err);
    }
    setLoadingDestination('home');
    setScreen('loading');
  };

  const handleContinueAsGuest = () => {
    setLoadingDestination('home');
    setScreen('loading');
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
    } catch (err) {
      console.error('Error during sign out:', err);
    }
  };

  const unreadMailCount = messages.filter((m) => !m.read).length;

  return (
    <main className="w-screen h-screen overflow-hidden bg-black select-none">
      {/* 0. Auth Choice Screen (Antes de la pantalla de carga) */}
      {screen === 'auth' && (
        <AuthPromptScreen
          currentUser={currentUser}
          onContinueWithAuth={handleContinueWithAuth}
          onContinueAsGuest={handleContinueAsGuest}
        />
      )}

      {/* 1. Loading Screen (Pantalla de Carga) */}
      {screen === 'loading' && (
        <LoadingScreen
          durationSeconds={gameMode === 'training' ? 2 : loadingDestination === 'home' ? 8 : 4}
          onComplete={() => {
            setScreen(loadingDestination);
          }}
        />
      )}

      {/* 2. Home Screen (Pantalla de Inicio matching the video) */}
      {screen === 'home' && (
        <HomeScreen
          team={team}
          coins={coins}
          stats={stats}
          unlockedAchievementsCount={unlockedAchievementIds.length}
          totalAchievementsCount={ACHIEVEMENTS.length}
          unreadMailCount={unreadMailCount}
          currentUser={currentUser}
          onOpenAuth={() => setScreen('auth')}
          onSignOut={handleSignOut}
          onPlay={() => {
            setIsMatchmakingOpen(true);
          }}
          onPlayAI={handlePlayAI}
          onTraining={() => {
            setIsTrainingOpen(true);
          }}
          onOpenTeam={() => setScreen('team')}
          onOpenShop={() => setIsShopOpen(true)}
          onOpenMailbox={() => setIsMailboxOpen(true)}
          onOpenAchievements={() => setIsAchievementsOpen(true)}
        />
      )}

      {/* 3. Team Screen (Personalización de Equipo) */}
      {screen === 'team' && (
        <TeamScreen
          customization={team}
          unlockedPlayerIds={unlockedPlayerIds}
          onSave={(updated) => setTeam(updated)}
          onBack={() => setScreen('home')}
          onOpenShop={() => setIsShopOpen(true)}
        />
      )}

      {/* 4. Match Screen (3D Football Game) */}
      {screen === 'match' && (
        <FootballGame
          team={team}
          mode={gameMode}
          multiplayerRoomId={multiplayerRoom?.id}
          multiplayerRole={multiplayerRole}
          opponentName={
            multiplayerRole === 'host'
              ? multiplayerRoom?.guestName || undefined
              : multiplayerRoom?.hostName || undefined
          }
          opponentTeam={
            multiplayerRole === 'host'
              ? multiplayerRoom?.guestTeam || undefined
              : multiplayerRoom?.hostTeam || undefined
          }
          trainingDrill={trainingDrill}
          initialPeriod={gameInitialPeriod}
          onShowLoading={() => {
            setLoadingDestination('home');
            setScreen('loading');
          }}
          onExitToMenu={handleExitMatch}
          onMatchComplete={handleMatchComplete}
          onGoalScored={handleGoalScored}
          onTrainingReward={handleRewardTrainingCoins}
          onSwitchTrainingDrill={(drill) => setTrainingDrill(drill)}
          onOpenTrainingMenu={() => setIsTrainingOpen(true)}
        />
      )}

      {/* Matchmaking Modal for Online Multiplayer */}
      <MatchmakingModal
        isOpen={isMatchmakingOpen}
        onClose={() => setIsMatchmakingOpen(false)}
        team={team}
        currentUser={currentUser}
        onPlayAI={handlePlayAI}
        onMatchFound={handleMatchFound}
      />

      {/* Training Modal */}
      <TrainingModal
        isOpen={isTrainingOpen}
        coins={coins}
        team={team}
        onClose={() => setIsTrainingOpen(false)}
        onRewardCoins={handleRewardTrainingCoins}
        onStart3DPractice={handleStart3DPractice}
      />

      {/* Mailbox Modal */}
      <MailboxModal
        isOpen={isMailboxOpen}
        messages={messages}
        onClose={() => setIsMailboxOpen(false)}
        onMarkAllRead={handleMarkAllRead}
        onDeleteMessage={handleDeleteMessage}
        onClaimReward={handleClaimReward}
      />

      {/* Shop Fullscreen */}
      <ShopModal
        isOpen={isShopOpen || screen === 'shop'}
        coins={coins}
        unlockedPlayerIds={unlockedPlayerIds}
        onClose={() => {
          setIsShopOpen(false);
          if (screen === 'shop') setScreen('home');
        }}
        onBuyPlayer={handleBuyPlayer}
      />

      {/* Achievements Modal */}
      <AchievementsModal
        isOpen={isAchievementsOpen}
        unlockedAchievementIds={unlockedAchievementIds}
        stats={stats}
        onClose={() => setIsAchievementsOpen(false)}
      />

      {/* Achievement Notification Banner */}
      <AchievementNotification
        achievement={activeAchievementNotification}
        onDismiss={showNextAchievement}
      />
    </main>
  );
}
