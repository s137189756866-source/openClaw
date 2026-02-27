// 动画配置文件

// 头部摆动动画参数
export const HEAD_SWAY_CONFIG = {
  enabled: true,
  amplitude: 3, // 摆动幅度（像素）
  frequency: 0.5, // 摆动频率（Hz）
};

// 呼吸动画参数
export const BREATHING_CONFIG = {
  enabled: true,
  minScale: 0.98,
  maxScale: 1.02,
  frequency: 0.3, // 呼吸频率（Hz）
};

// 说话动画参数
export const SPEAKING_CONFIG = {
  enabled: true,
  minMouthOpen: 0.8, // 最小嘴部张合比例
  maxMouthOpen: 1.3, // 最大嘴部张合比例
  frequency: 4, // 说话频率（Hz）
};

// 欢迎动画参数
export const WELCOME_CONFIG = {
  enabled: true,
  duration: 1500, // 欢迎动画持续时间（ms）
  scale: {
    start: 0,
    end: 1,
    overshoot: 1.1, // 弹性效果
  },
  rotate: {
    amplitude: 0.1, // 旋转幅度（弧度）
    frequency: 3,
  },
};

// 动画状态管理
export class AnimationState {
  constructor() {
    this.isSpeaking = false;
    this.welcomeStartTime = 0;
    this.welcomePlayed = false;
  }

  setSpeaking(speaking) {
    this.isSpeaking = speaking;
  }

  startWelcome() {
    this.welcomeStartTime = performance.now();
    this.welcomePlayed = true;
  }

  getWelcomeProgress(now) {
    if (!this.welcomePlayed) return null;
    const elapsed = now - this.welcomeStartTime;
    if (elapsed > WELCOME_CONFIG.duration) return null;
    return elapsed / WELCOME_CONFIG.duration;
  }
}
