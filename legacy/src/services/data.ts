import { callFunction, auth } from "@/lib/cloudbase";
import { GetDataParams } from "@/types";
import { Transaction, Rule, Reward, Redemption } from "@/types/models";
import { CacheUtils } from "@/utils/cache";

export class DataService {
  static async getData<T>(params: GetDataParams, cacheTtl = 0): Promise<T> {
    const cacheKey = `data_${params.type}_${JSON.stringify(params)}`;

    if (cacheTtl > 0) {
        const cached = CacheUtils.get<T>(cacheKey);
        if (cached) return cached;
    }

    try {
      const result = await callFunction<T>("get_data", { ...params, uid: auth.currentUser?.uid });

      if (cacheTtl > 0 && result) {
          CacheUtils.set(cacheKey, result, cacheTtl);
      }

      return result;
    } catch (err) {
      console.error(`Fetch data failed: ${params.type}`, err);
      throw err;
    }
  }

  static async getMessages(offset = 0, limit = 20) {
    return this.getData<any[]>({
      type: "messages",
      params: { offset, limit }
    });
  }

  static async getLedger(params: { type?: string; start_date?: string; offset?: number; limit?: number }) {
    return this.getData<Transaction[]>({
      type: "ledger",
      params
    });
  }

  static async getTransactionDetail(id: string) {
    return this.getData<Transaction>({
      type: "transaction_detail",
      id
    }, 60); // Cache detail for 1 minute
  }

  static async getCheckins(today: string) {
    return this.getData<any[]>({
      type: "checkins",
      params: { today }
    });
  }

  static async getRules() {
     const cacheKey = "rules_list";
     const cached = CacheUtils.get<Rule[]>(cacheKey);
     if (cached) return cached;

     const result = await callFunction<{ rules: Rule[] }>("get_rules", { uid: auth.currentUser?.uid });
     const rules = result.rules || [];
     CacheUtils.set(cacheKey, rules, 600); // Cache rules for 10 minutes
     return rules;
  }

  static async getRewards(role?: string) {
     const cacheKey = `rewards_list_${role}`;
     const cached = CacheUtils.get<Reward[]>(cacheKey);
     if (cached) return cached;

     const result = await callFunction<{ rewards: Reward[] }>("get_rewards", { uid: auth.currentUser?.uid });
     const rewards = result.rewards || [];
     CacheUtils.set(cacheKey, rewards, 300); // Cache rewards for 5 minutes
     return rewards;
  }

  static async getRule(id: string): Promise<Rule | null> {
    try {
      const result = await callFunction<{ rule?: Rule | null }>("get_rules", {
        ruleId: id,
        uid: auth.currentUser?.uid,
      });
      return result?.rule ?? null;
    } catch (err) {
      console.error("Get rule failed", err);
      return null;
    }
  }

  static async getReward(id: string): Promise<Reward | null> {
    try {
      const result = await callFunction<{ reward?: Reward | null }>("get_rewards", {
        rewardId: id,
        uid: auth.currentUser?.uid,
      });
      return result?.reward ?? null;
    } catch (err) {
      console.error("Get reward failed", err);
      return null;
    }
  }

  static async getRedemption(id: string): Promise<Redemption | null> {
    try {
      const result = await this.getData<Redemption | null>({
        type: "redemption_detail",
        id
      });
      return result ?? null;
    } catch (err) {
      console.error("Get redemption failed", err);
      return null;
    }
  }
}
