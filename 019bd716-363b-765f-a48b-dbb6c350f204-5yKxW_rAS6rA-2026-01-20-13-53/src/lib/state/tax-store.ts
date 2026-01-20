/**
 * Zustand store for Tax Optimizer state management
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CountryMode = 'india' | 'us';

export interface Lead {
  id: string;
  email: string;
  date: string;
  mode: CountryMode;
  estimatedSavings: number;
}

interface TaxStore {
  // Country mode
  countryMode: CountryMode;
  setCountryMode: (mode: CountryMode) => void;

  // Leads
  leads: Lead[];
  addLead: (lead: Omit<Lead, 'id'>) => void;
  clearLeads: () => void;
  isEmailUsedToday: (email: string) => boolean;

  // Rate limiting
  lastReportTimestamp: number | null;
  setLastReportTimestamp: (timestamp: number | null) => void;
  canGenerateReport: () => boolean;

  // Email gate
  unlockedEmail: string | null;
  setUnlockedEmail: (email: string) => void;
  clearUnlockedEmail: () => void;
}

export const useTaxStore = create<TaxStore>()(
  persist(
    (set, get) => ({
      // Country mode
      countryMode: 'india',
      setCountryMode: (mode) => set({ countryMode: mode }),

      // Leads
      leads: [],
      addLead: (lead) => {
        const id = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        set((state) => ({
          leads: [...state.leads, { ...lead, id }],
        }));
      },
      clearLeads: () => set({ leads: [] }),
      isEmailUsedToday: (email: string) => {
        const { leads } = get();
        const normalizedEmail = email.trim().toLowerCase();
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

        return leads.some((lead) => {
          const leadTime = new Date(lead.date).getTime();
          return lead.email.toLowerCase() === normalizedEmail && leadTime > oneDayAgo;
        });
      },

      // Rate limiting - 24 hour cooldown
      lastReportTimestamp: null,
      setLastReportTimestamp: (timestamp) => set({ lastReportTimestamp: timestamp }),
      canGenerateReport: () => {
        const { lastReportTimestamp } = get();
        if (!lastReportTimestamp) return true;
        const hoursElapsed = (Date.now() - lastReportTimestamp) / (1000 * 60 * 60);
        return hoursElapsed >= 24;
      },

      // Email gate
      unlockedEmail: null,
      setUnlockedEmail: (email) => set({ unlockedEmail: email }),
      clearUnlockedEmail: () => set({ unlockedEmail: null }),
    }),
    {
      name: 'tax-optimizer-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        leads: state.leads,
        lastReportTimestamp: state.lastReportTimestamp,
        countryMode: state.countryMode,
      }),
    }
  )
);
