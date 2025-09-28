// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
export const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

// Service Categories
export const SERVICE_CATEGORIES = [
  {
    name: 'dgy',
    displayName: 'Dgy Services',
    description: 'Premium personal services',
    icon: '💎',
    startingPrice: 100,
    color: '#DC143C'
  },
  {
    name: 'romans',
    displayName: 'Romans Experience', 
    description: 'Authentic cultural experiences',
    icon: '🏛️',
    startingPrice: 150,
    color: '#8B0000'
  },
  {
    name: 'ridin',
    displayName: 'Ridin Adventures',
    description: 'Exciting adventure services',
    icon: '🚗',
    startingPrice: 80,
    color: '#FF1493'
  },
  {
    name: 'bb_suk',
    displayName: 'Bb Suk Special',
    description: 'Exclusive premium offerings',
    icon: '⭐',
    startingPrice: 200,
    color: '#B22222'
  }
];

// Trust Tiers
export const TRUST_TIERS = {
  1: { name: 'Basic', color: '#808080' },
  2: { name: 'Advanced', color: '#FFA500' },
  3: { name: 'Pro', color: '#32CD32' },
  4: { name: 'Elite', color: '#FFD700' }
};

// Transaction Statuses
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  ESCROWED: 'escrowed',
  COMPLETED: 'completed',
  DISPUTED: 'disputed',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled'
};
