import { Node } from 'cc';
import { HeroSequenceAnimation } from './HeroSequenceAnimation';

export class SniperIdleAnimation extends HeroSequenceAnimation {
  constructor(parent: Node, onLoaded: () => void) {
    super(parent, onLoaded, 'sniperIdleAnimation', 'sniper_idle_natural_v2', 'sniper_attack_clean_v1');
  }
}
