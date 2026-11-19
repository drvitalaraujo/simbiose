// Menu inicial e configurações. API pública para os outros sistemas:
//   onPlay('ffa', ({ map, nickname }) => ...)   liga um modo do menu (sem handler = "em breve")
//   getSensitivity() / getFov() / getVolume() / getQuality() / getNickname() / getReducedMotion()
//   settings().onChange(fn)                      escuta mudanças das configurações
export { Menu, type MenuOptions } from './menu';
export { MODES, onPlay, hasHandler, requestPlay, type PlayHandler, type PlayMode, type PlayRequest } from './modes';
export {
  getFov,
  getNickname,
  getQuality,
  getReducedMotion,
  getSensitivity,
  getVolume,
  mapFromSearch,
  resolveArenaMap,
  searchWithMap,
  settings,
  type ArenaMapId,
  type Difficulty,
  type MapId,
  type QualityPref,
  type Settings,
} from './settings';
export { withQualityPref } from './bridge';
export { REDUCE_MOTION_CLASS } from './motion';
export { onlineSearch, PauseOverlay } from './online-entry';
