export interface TeamCustomization {
  teamName: string;
  playerName: string;
  playerNumber: number;
  jerseyColor: string;
  shortsColor: string;
  rivalColor: string;
  ballStyle: 'classic' | 'gold' | 'cyber' | 'crimson';
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

export type AppScreen = 'loading' | 'home' | 'match' | 'team' | 'shop';
