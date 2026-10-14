import SoccerScene from './SoccerScene';
import BasketballScene from './BasketballScene';
import FlagFootballScene from './FlagFootballScene';
import TrackScene from './TrackScene';
import UltimateScene from './UltimateScene';
import ConfettiScene from './ConfettiScene';

/* Scene name (from sceneFor in src/utils/celebration.js) -> component. */
export const SCENES = {
  soccer: SoccerScene,
  basketball: BasketballScene,
  flag_football: FlagFootballScene,
  track: TrackScene,
  ultimate: UltimateScene,
  confetti: ConfettiScene,
};
