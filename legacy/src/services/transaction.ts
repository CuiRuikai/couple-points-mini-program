import { callFunction } from "@/lib/cloudbase";

export class TransactionService {
  static async submitCheckin(data: { rule_id: string; title: string; points: number; date: string; period_start: string }) {
    return callFunction("submit_checkin", data);
  }

  static async submitSpecial(data: { title: string; content?: string; points: number; date: string }) {
    return callFunction("submit_special", data);
  }
}
