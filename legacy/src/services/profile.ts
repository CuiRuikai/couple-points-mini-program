import { callFunction } from "@/lib/cloudbase";
import { auth } from "@/lib/cloudbase";
import { Profile } from "@/types/models";

export const ProfileService = {
  async getProfile() {
    return callFunction<Profile | null>("get_profile", {
      uid: auth.currentUser?.uid,
    });
  },

  async updateProfile(data: {
    nickname?: string;
    avatar_url?: string;
    quick_score_plus_options?: string[];
    quick_score_minus_options?: string[];
  }) {
    return callFunction("manage_profile", {
      action: "update_profile",
      data,
      uid: auth.currentUser?.uid,
    });
  },

  async uploadAvatar(blob: Blob): Promise<string> {
    // Convert Blob to Base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const fileContent = await base64Promise;
    const fileName = "avatar.jpg";

    const result = await callFunction("manage_profile", {
      action: "upload_avatar",
      data: { fileContent, fileName },
      uid: auth.currentUser?.uid,
    });

    return result.fileID;
  },
};
