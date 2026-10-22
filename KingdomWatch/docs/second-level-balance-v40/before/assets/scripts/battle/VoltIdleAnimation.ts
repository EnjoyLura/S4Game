import { Node } from 'cc';
import { HeroSequenceAnimation } from './HeroSequenceAnimation';

export class VoltIdleAnimation extends HeroSequenceAnimation {
  constructor(parent: Node, onLoaded: () => void) {
    super(parent, onLoaded, 'voltIdleAnimation', 'volt_idle_natural_v1', 'volt_attack_user_v2');
  }
}
