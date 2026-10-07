export interface TeamCustomization {
  teamName: string;
  playerName: string;
  playerNumber: number;
  jerseyColor: string;
  shortsColor: string;
  rivalColor: string;
  ballStyle: 'classic' | 'gold' | 'cyber' | 'crimson';
  playerId?: string;
  playerGrl?: number;
  playerPosition?: string;
  playerCountry?: string;
  lineup?: { [slotIndex: number]: string };
}

export interface MailboxMessage {
  id: string;
  type: 'win' | 'loss' | 'abandon' | 'system';
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  reward?: number;
}

export type AppScreen = 'auth' | 'loading' | 'home' | 'match' | 'team' | 'shop';

export interface GlobalStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  totalGoals: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'wins' | 'goals' | 'matches';
  requirement: number;
  icon: string;
  rewardCoins: number;
}

export interface TrainingDrill {
  id: string;
  title: string;
  category: 'tiro_libre' | 'penaltis' | 'pases' | 'tiros' | 'regates' | 'centros';
  description: string;
  rewardCoins: number;
  difficulty: 'Fácil' | 'Media' | 'Avanzada';
  attributeBoost: string;
}
