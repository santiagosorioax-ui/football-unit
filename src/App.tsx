import { useState, useEffect } from 'react';
import LoadingScreen from './components/LoadingScreen';
import HomeScreen from './components/HomeScreen';
import FootballGame from './components/FootballGame';
import TeamScreen from './components/TeamScreen';
import MailboxModal from './components/MailboxModal';
import ShopModal from './components/ShopModal';
import { AppScreen, MailboxMessage, TeamCustomization } from './types/game';
import { sounds } from './utils/audio';

const DEFAULT_TEAM: TeamCustomization = {
  teamName: 'Football Unit FC',
  playerName: 'Capitán',
  playerNumber: 10,
  jerseyColor: '#2563eb',
  shortsColor: '#f8fafc',
  rivalColor: '#dc2626',
  ballStyle: 'classic',
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
  const [isMailboxOpen, setIsMailboxOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
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

  // Match Outcome Handlers
  const handleMatchComplete = (result: 'win' | 'loss' | 'tie', pScore: number, aScore: number) => {
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
    if (abandoned) {
      addMailboxMessage({
        type: 'abandon',
        title: 'Partido Abandonado',
        body: `Abandonaste el partido antes de completarse cuando el resultado era ${pScore} - ${aScore}. ¡La próxima vez no bajes los brazos!`,
        read: false,
      });
    }
    setScreen('home');
  };

  // Shop Handlers
  const handleBuyItem = (itemId: string, price: number) => {
    if (coins >= price && !unlockedItems.includes(itemId)) {
      setCoins((c) => c - price);
      setUnlockedItems((items) => [...items, itemId]);
      sounds.playCheer();
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
          unreadMailCount={unreadMailCount}
          onPlay={() => {
            setLoadingDestination('match');
            setScreen('loading');
          }}
          onOpenTeam={() => setScreen('team')}
          onOpenShop={() => setIsShopOpen(true)}
          onOpenMailbox={() => setIsMailboxOpen(true)}
        />
      )}

      {/* 3. Team Screen (Personalización de Equipo) */}
      {screen === 'team' && (
        <TeamScreen
          customization={team}
          onSave={(updated) => setTeam(updated)}
          onBack={() => setScreen('home')}
        />
      )}

      {/* 4. Match Screen (3D Football Game) */}
      {screen === 'match' && (
        <FootballGame
          team={team}
          onShowLoading={() => {
            setLoadingDestination('home');
            setScreen('loading');
          }}
          onExitToMenu={handleExitMatch}
          onMatchComplete={handleMatchComplete}
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

      {/* Shop Modal */}
      <ShopModal
        isOpen={isShopOpen}
        coins={coins}
        unlockedItems={unlockedItems}
        onClose={() => setIsShopOpen(false)}
        onBuyItem={handleBuyItem}
      />
    </main>
  );
}
