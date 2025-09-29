// src/store/sidebarStore.js (new file)
import { create } from 'zustand';

export const useSidebarStore = create((set) => ({
  isOpen: window.innerWidth >= 768,
  isCollapsed: false,
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setOpen: (value) => set({ isOpen: value }),
  setCollapsed: (value) => set({ isCollapsed: value }),
}));