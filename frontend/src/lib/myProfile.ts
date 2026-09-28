import { create } from 'zustand';
import api from '@/lib/api';
import type { Person } from '@/lib/chat';

interface MyProfileState {
  /** My public profile (@ID, display name, status, avatar); null until loaded or before the friends setup. */
  profile: Person | null;
  load: () => Promise<void>;
  set: (profile: Person) => void;
}

/** Loaded once on the dashboard; the sidebar, chats and friends screen all read it. */
export const useMyProfile = create<MyProfileState>((set) => ({
  profile: null,
  load: async () => {
    try {
      const response = await api.get('/profile');
      set({ profile: response.data.profile });
    } catch {
      // Profiles are set up with the friends migration; without it there is simply no profile.
    }
  },
  set: (profile) => set({ profile }),
}));
