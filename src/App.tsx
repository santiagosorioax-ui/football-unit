import { useState, useEffect, useRef } from 'react';
import LoadingScreen from './components/LoadingScreen';
import HomeScreen from './components/HomeScreen';
import FootballGame from './components/FootballGame';
import TeamScreen from './components/TeamScreen';
import MailboxModal from './components/MailboxModal';
import ShopModal from './components/ShopModal';
import AchievementsModal from './components/AchievementsModal';
import AchievementNotification from './components/AchievementNotification';
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
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [loadingDestination, setLoadingDestination] = useState<AppScreen>('home');
  const [gameMode, setGameMode] = useState<'match' | 'training'>('match');
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
      const reward = 60;
      setCoins((c) => c + reward);
      addMailboxMessage({
        type: 'win',
        title: '¡Gran Victoria en la Cancha!',
        body: `¡Excelente desempeño! Derrotaste a la IA con un marcador de ${pScore} a ${aScore}. Has ganado +${reward} monedas.`,
        read: false,
      });
    } else if (result === 'loss') {
      addMailboxMessage({
        type: 'loss',
        title: 'Derrota Frente a la IA',
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
    if (abandoned && gameMode === 'match') {
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

  const unreadMailCount = messages.filter((m) => !m.read).length;

  return (
    <main className="w-screen h-screen overflow-hidden bg-black select-none">
      {/* 1. Loading Screen (Pantalla de Carga) */}
      {screen === 'loading' && (
        <LoadingScreen
          durationSeconds={loadingDestination === 'home' ? 8 : 4}
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
          onPlay={() => {
            setGameMode('match');
            setLoadingDestination('match');
            setScreen('loading');
          }}
          onTraining={() => {
            setGameMode('training');
            setLoadingDestination('match');
            setScreen('loading');
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
          onShowLoading={() => {
            setLoadingDestination('home');
            setScreen('loading');
          }}
          onExitToMenu={handleExitMatch}
          onMatchComplete={handleMatchComplete}
          onGoalScored={handleGoalScored}
        />
      )}

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
