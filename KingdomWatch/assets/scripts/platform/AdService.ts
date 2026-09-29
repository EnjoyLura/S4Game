/**
 * AdService（§12.6）：UI 只调本接口。
 * M0/Debug：MockAdService 本地模拟直发奖；M1 替换为 TapTap 广告桥实现。
 */
export interface RewardedResult { success: boolean; reason?: string; }

export interface IAdService {
  /** 拉取并展示激励视频；结果经回调返回（onReward 只在完整观看后触发） */
  showRewarded(placement: string, onReward: () => void, onFail: (reason: string) => void): void;
  isReady(placement: string): boolean;
}

export class MockAdService implements IAdService {
  isReady(): boolean { return true; }

  showRewarded(_placement: string, onReward: () => void, onFail: (reason: string) => void): void {
    // 模拟加载+观看耗时；10% 模拟失败以验证置灰/重试路径
    setTimeout(() => {
      if (Math.random() < 0.1) onFail('mock_no_fill');
      else onReward();
    }, 600);
  }
}

export const AdService: IAdService = new MockAdService();
