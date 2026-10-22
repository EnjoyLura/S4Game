import { Node } from 'cc';
import { HeroSequenceAnimation } from './HeroSequenceAnimation';

export class PyroIdleAnimation extends HeroSequenceAnimation {
  constructor(parent: Node, onLoaded: () => void) {
    super(parent, onLoaded, 'pyroIdleAnimation', 'pyro_idle_loop_v2', 'pyro_attack_user_v2');
  }
}
