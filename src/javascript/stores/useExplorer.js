import { create } from "zustand";
import battleUrl from "../../WW2_LocationData_Clean - GeoBattleData_YZ.csv?url";
import { parseBattles, filterBattles } from "../data/battles";
import {
  loadSceneSettings,
  sceneSettings,
  DEFAULT_SCENE_SETTINGS,
} from "../data/sceneSettings";
let loading;
export const useExplorer = create((set, get) => ({
  battles: [],
  status: "loading",
  error: "",
  selectedId: null,
  year: "all",
  theatre: "all",
  query: "",
  playing: false,
  atEvent: false,
  aircraft: "allies_airplane_ww2",
  cameraMode: "flight",
  flightReset: 0,
  touchAxes: { roll: 0, pitch: 0 },
  pressed: {},
  modelStatus: "loading",
  drawer: null,
  readingTab: "event",
  comparisonId: null,
  paused: true,
  navigationMode: "free",
  viewDistance: 84,
  ...loadSceneSettings(),
  soundEnabled: false,
  soundVolume: 0.35,
  soundError: "",
  setSoundEnabled: (soundEnabled) => set({ soundEnabled, soundError: "" }),
  setSoundError: (soundError) => set({ soundEnabled: false, soundError }),
  setSoundVolume: (soundVolume) =>
    set({ soundVolume: Math.max(0, Math.min(1, Number(soundVolume))) }),
  setSceneSettings: (changes) =>
    set((state) => {
      const next = sceneSettings({ ...state, ...changes });
      try {
        globalThis.localStorage?.setItem(
          "ldc-scene-settings-v1",
          JSON.stringify(next),
        );
      } catch {}
      return {
        ...next,
        paused: true,
        pressed: {},
        touchAxes: { roll: 0, pitch: 0 },
      };
    }),
  resetSceneSettings: () => get().setSceneSettings(DEFAULT_SCENE_SETTINGS),
  eventProgress: 0,
  readingSeconds: 18,
  expandedClusterId: null,
  selectedCountryId: null,
  hoveredCountryId: null,
  nearbyId: null,
  destinationId: null,
  travelVersion: 0,
  telemetry: {
    x: 0,
    y: 3.5,
    z: 0,
    heading: 0,
    speed: 4.0,
    pitch: 0,
    bank: 0,
    turnRate: 0,
    climbRate: 0,
  },
  load: () => {
    if (!loading)
      loading = fetch(battleUrl)
        .then((response) => {
          if (!response.ok) throw new Error("Não foi possível carregar o CSV.");
          return response.text();
        })
        .then((text) => {
          const battles = parseBattles(text);
          if (!battles.length)
            throw new Error("O CSV não contém eventos válidos.");
          set({
            battles,
            selectedId: battles[0].id,
            status: "ready",
            error: "",
          });
        })
        .catch((error) => {
          loading = null;
          set({ status: "error", error: error.message });
        });
    return loading;
  },
  setFilter: (filter) =>
    set((state) => {
      const visible = filterBattles(state.battles, { ...state, ...filter });
      return {
        ...filter,
        playing: false,
        navigationMode: "free",
        destinationId: null,
        expandedClusterId: null,
        nearbyId: null,
        selectedId: visible.some((b) => b.id === state.selectedId)
          ? state.selectedId
          : (visible[0]?.id ?? null),
      };
    }),
  setViewDistance: (viewDistance) =>
    set({ viewDistance: Number(viewDistance) }),
  setEventProgress: (eventProgress) => set({ eventProgress }),
  setNavigationMode: (mode) => {
    if (mode === "free") {
      set({
        navigationMode: "free",
        atEvent: false,
        playing: false,
        destinationId: null,
        paused: false,
        cameraMode: "flight",
        drawer: null,
        expandedClusterId: null,
        touchAxes: { roll: 0, pitch: 0 },
        pressed: {},
      });
      return;
    }
    const state = get(),
      visible = filterBattles(state.battles, state);
    if (!visible.length) return;

    set({
      navigationMode: "events",
      atEvent: false,
      playing: true,
      destinationId: visible[0].id,
      selectedId: visible[0].id,
      eventProgress: 0,
      travelVersion: state.travelVersion + 1,
      paused: false,
      cameraMode: "flight",
      drawer: null,
      expandedClusterId: null,
      touchAxes: { roll: 0, pitch: 0 },
      pressed: {},
    });
  },
  setReadingSeconds: (readingSeconds) => set({ readingSeconds }),
  hoverCountry: (hoveredCountryId) =>
    set((state) =>
      state.hoveredCountryId === hoveredCountryId ? {} : { hoveredCountryId },
    ),
  openCountry: (selectedCountryId) =>
    set({
      selectedCountryId,
      expandedClusterId: null,
      drawer: "country",
      paused: true,
      touchAxes: { roll: 0, pitch: 0 },
      pressed: {},
      playing: false,
      navigationMode: "free",
      destinationId: null,
    }),
  openCluster: (expandedClusterId) =>
    set({
      expandedClusterId,
      drawer: "cluster",
      paused: true,
      touchAxes: { roll: 0, pitch: 0 },
      pressed: {},
      playing: false,
      navigationMode: "free",
      destinationId: null,
    }),
  closeCluster: () => set({ expandedClusterId: null, drawer: null }),
  setReadingTab: (readingTab) => set({ readingTab }),
  setComparison: (comparisonId) => set({ comparisonId, paused: true }),
  openReadings: (readingTab = "event") =>
    set((state) => ({
      drawer: "event",
      readingTab,
      selectedId: state.selectedId ?? state.battles[0]?.id ?? null,
      paused: true,
      touchAxes: { roll: 0, pitch: 0 },
      pressed: {},
      playing: false,
      navigationMode: "free",
      destinationId: null,
    })),
  select: (selectedId) => set({ selectedId, paused: true }),
  reactToEvent: (selectedId) => set({ selectedId }),
  navigate: (destinationId) =>
    set((state) => ({
      destinationId,
      atEvent: false,
      navigationMode: "events",
      travelVersion: state.travelVersion + 1,
      playing: false,
      paused: false,
      cameraMode: "flight",
      drawer: null,
      expandedClusterId: null,
    })),
  cancelRoute: () =>
    set({
      destinationId: null,
      playing: false,
      paused: false,
      navigationMode: "free",
    }),
  setProximity: (cluster) =>
    set((state) => ({
      nearbyId: cluster?.id ?? null,
      selectedId:
        state.drawer || state.playing || state.destinationId
          ? state.selectedId
          : cluster
            ? cluster.events.some((b) => b.id === state.selectedId)
              ? state.selectedId
              : cluster.events[0].id
            : state.selectedId,
    })),
  togglePlay: () => {
    if (get().playing) {
      set({
        playing: false,
        destinationId: null,
        navigationMode: "free",
        paused: true,
      });
      return;
    }
    get().setNavigationMode("events");
  },
  advanceTour: () =>
    set((state) => {
      const visible = filterBattles(state.battles, state);
      const index = visible.findIndex((b) => b.id === state.destinationId);
      if (index < 0 || index === visible.length - 1)
        return {
          playing: false,
          destinationId: null,
          paused: true,
          navigationMode: "free",
        };
      return {
        destinationId: visible[index + 1].id,
        selectedId: visible[index + 1].id,
        eventProgress: 0,
        atEvent: false,
        travelVersion: state.travelVersion + 1,
        paused: false,
      };
    }),
  arrived: () =>
    set((state) => ({
      selectedId: state.destinationId ?? state.selectedId,
      atEvent: true,
      paused: true,
      ...(state.playing
        ? {}
        : { destinationId: null, paused: true, navigationMode: "free" }),
    })),
  setAircraft: (aircraft) =>
    set((state) =>
      aircraft === state.aircraft ? {} : { aircraft, modelStatus: "loading" },
    ),
  setCamera: (cameraMode) => set({ cameraMode, pressed: {} }),
  togglePause: () => {
    const state = get();
    if (state.playing && state.atEvent && state.paused) {
      state.advanceTour();
      return;
    }
    set({
      paused: !state.paused,
      pressed: {},
      touchAxes: { roll: 0, pitch: 0 },
    });
  },
  openDrawer: (drawer) =>
    set((state) => ({
      drawer: state.drawer === drawer ? null : drawer,
      touchAxes: { roll: 0, pitch: 0 },
      pressed: {},
      ...(drawer ? { paused: true } : {}),
      ...(drawer === "event" ? { readingTab: "event" } : {}),
      ...(drawer === null ? { expandedClusterId: null } : {}),
    })),
  setTouchAxes: (roll, pitch) => set({ touchAxes: { roll, pitch } }),
  press: (key, value) =>
    set((state) => ({ pressed: { ...state.pressed, [key]: value } })),
  release: () => set({ pressed: {}, touchAxes: { roll: 0, pitch: 0 } }),
  resetFlight: () =>
    set((state) => ({
      flightReset: state.flightReset + 1,
      pressed: {},
      touchAxes: { roll: 0, pitch: 0 },
      navigationMode: "free",
      destinationId: null,
      playing: false,
      paused: false,
    })),
  setModelStatus: (modelStatus) => set({ modelStatus }),
  updateTelemetry: (telemetry) => set({ telemetry }),
}));
