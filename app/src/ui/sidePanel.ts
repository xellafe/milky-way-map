/*
 * System View side panels (#23): 18 rem wide, from top-16 (below the header)
 * to 1rem above the expanded music player. Sizes are aesthetic choices (not
 * data), in rem. The player is 3.5rem tall (measured); below lg it sits at
 * bottom-20: 4 + 5 + 3.5 + 1 = 13.5rem; from lg at bottom-4: 4 + 1 + 3.5 + 1 =
 * 9.5rem.
 */
export const SIDE_PANEL_CLASS =
  'absolute top-16 z-10 max-h-[calc(100%-13.5rem)] lg:max-h-[calc(100%-9.5rem)] w-72 overflow-y-auto p-4';
