import { Node } from 'cc';
import { HeroSequenceAnimation } from './HeroSequenceAnimation';

export class MoraIdleAnimation extends HeroSequenceAnimation {
  constructor(parent: Node, onLoaded: () => void) {
    super(parent, onLoaded, 'moraIdleAnimation', 'mora_idle_user_v1', 'mora_attack_user_v1');
  }
}
