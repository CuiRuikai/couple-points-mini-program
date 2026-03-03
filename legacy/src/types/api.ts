import { Transaction, Message, Role } from "./models";

export interface DashboardData {
  role?: Role;
  couple_id?: string;
  anniversary_date?: string;
  balance?: number;
  total_rules_daily?: number;
  done_daily?: number;
  recent_transactions?: Transaction[];
  recent_messages?: (Message & { profile?: any; nickname?: string })[];
  member_count?: number;
}

export interface GetDataParams {
  type:
    | "messages"
    | "ledger"
    | "ledger_stats"
    | "transaction_detail"
    | "redemption_detail"
    | "checkins"
    | "checkin_stats"
    | "recent_checkins"
    | "memos";
  id?: string;
  params?: {
    offset?: number;
    limit?: number;
    type?: string;
    start_date?: string;
    end_date?: string;
    today?: string;
    notebook_id?: string;
  };
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}
