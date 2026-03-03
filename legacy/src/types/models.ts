export type Role = "earner" | "reviewer";

export interface Couple {
  _id: string;
  name?: string;
  invite_code: string;
  created_at: number;
}

export interface Profile {
  _id: string;
  user_id: string;
  nickname?: string;
  avatar_url?: string;
  quick_score_plus_options?: string[];
  quick_score_minus_options?: string[];
}

export interface CoupleMember {
  _id: string;
  couple_id: string;
  user_id: string;
  role: Role;
  joined_at: number;
}

export type TransactionType = "checkin" | "special" | "redemption" | "manual";

export interface Transaction {
  _id: string;
  couple_id: string;
  user_id: string;
  type: TransactionType;
  title: string;
  note?: string;
  points_suggested: number;
  points_final?: number;
  event_date: string; // ISO date
  period_start?: string; // ISO date for checkin
  period_type?: string;
  rule_id?: string;
  redemption_id?: string;
  created_at: number;
}

export interface Rule {
  _id: string;
  couple_id: string;
  title: string;
  description?: string;
  points: number;
  frequency: "day";
  active: boolean;
  created_at: number;
}

export interface Reward {
  _id: string;
  couple_id: string;
  title: string;
  description?: string;
  cost_points: number;
  image_url?: string | null;
  redeemed_count?: number;
  used_count?: number;
  active?: boolean;
  stock?: number;
  created_at: number;
}

export interface Message {
  _id: string;
  couple_id: string;
  content: string;
  created_by: string;
  created_at: number;
  deleted_at?: number;
}

export interface Redemption {
  _id: string;
  couple_id: string;
  user_id: string;
  reward_id: string;
  created_at: number;
}
