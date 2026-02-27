// 情绪配置文件 - 定义多啦B梦的各种表情

// 情绪类型定义
export const EMOTIONS = {
  NORMAL: 'normal',
  HAPPY: 'happy',
  SAD: 'sad',
  THINKING: 'thinking',
  SURPRISED: 'surprised',
  SLEEPY: 'sleepy',
  ANGRY: 'angry',
  CONFUSED: 'confused',
  PROUD: 'proud',
  SHY: 'shy',
};

// 情绪关键词映射
export const EMOTION_KEYWORDS = {
  [EMOTIONS.HAPPY]: ['开心', '高兴', '太棒了', '好的', '没问题', '哈哈', 'success', 'great', 'happy', '嘿嘿', '耶', '赞'],
  [EMOTIONS.SAD]: ['难过', '伤心', '抱歉', '不好意思', 'sorry', 'sad', '哭泣', '呜呜'],
  [EMOTIONS.THINKING]: ['让我想想', '思考', '嗯...', '思考中', 'think', 'hmm', '考虑'],
  [EMOTIONS.SURPRISED]: ['哇', '天哪', '真的吗', 'wow', 'amazing', '什么', '天啊'],
  [EMOTIONS.SLEEPY]: ['困', '累了', 'sleepy', 'tired', '想睡', '哈欠'],
  [EMOTIONS.ANGRY]: ['生气', '愤怒', '讨厌', '烦人', 'angry', 'mad', 'hate', '滚'],
  [EMOTIONS.CONFUSED]: ['疑惑', '不懂', '什么意思', 'confused', '奇怪', '搞不懂', '为啥'],
  [EMOTIONS.PROUD]: ['厉害', '牛逼', '棒', 'awesome', '聪明', '成功', '做到了'],
  [EMOTIONS.SHY]: ['害羞', '不好意思', 'shy', '羞涩', '脸红', '哎呀'],
};

// 每种情绪的表情参数
export const EMOTION_FACES = {
  [EMOTIONS.NORMAL]: {
    // 正常表情
    eyeSize: 7,
    eyeY: 100,
    eyeSpacing: 28,
    mouthType: 'smile', // smile, flat, sad, o, surprise
    mouthCurvature: 0.15, // 微笑弧度
    mouthWidth: 0.35, // 弧度范围（π 的倍数）
    mouthY: 155,
    blush: false,
    eyebrowAngle: 0,
  },
  [EMOTIONS.HAPPY]: {
    // 开心表情
    eyeSize: 7,
    eyeY: 100,
    eyeSpacing: 28,
    mouthType: 'smile',
    mouthCurvature: 0.25, // 更大的微笑
    mouthWidth: 0.4,
    mouthY: 155,
    blush: true, // 腮红
    eyebrowAngle: 0.1, // 眉毛上扬
  },
  [EMOTIONS.SAD]: {
    // 难过表情
    eyeSize: 7,
    eyeY: 105, // 眼睛稍微向下
    eyeSpacing: 28,
    mouthType: 'sad', // 倒弧
    mouthCurvature: -0.15,
    mouthWidth: 0.3,
    mouthY: 160,
    blush: false,
    eyebrowAngle: -0.15, // 眉毛下垂
  },
  [EMOTIONS.THINKING]: {
    // 思考表情
    eyeSize: 6, // 眼睛稍微变小
    eyeY: 100,
    eyeSpacing: 28,
    mouthType: 'flat', // 平嘴
    mouthCurvature: 0,
    mouthWidth: 0.2,
    mouthY: 155,
    blush: false,
    eyebrowAngle: -0.1,
  },
  [EMOTIONS.SURPRISED]: {
    // 惊讶表情
    eyeSize: 9, // 眼睛变大
    eyeY: 100,
    eyeSpacing: 28,
    mouthType: 'o', // O 型嘴
    mouthCurvature: 0,
    mouthWidth: 0,
    mouthY: 155,
    blush: false,
    eyebrowAngle: 0.2,
  },
  [EMOTIONS.SLEEPY]: {
    // 困倦表情
    eyeSize: 2, // 眼睛很小
    eyeY: 100,
    eyeSpacing: 28,
    mouthType: 'flat',
    mouthCurvature: 0,
    mouthWidth: 0.15,
    mouthY: 158,
    blush: false,
    eyebrowAngle: 0,
  },
  [EMOTIONS.ANGRY]: {
    // 生气表情
    eyeSize: 7,
    eyeY: 100,
    eyeSpacing: 28,
    mouthType: 'sad', // 倒弧嘴
    mouthCurvature: -0.25, // 更大的倒弧
    mouthWidth: 0.35,
    mouthY: 158,
    blush: false,
    eyebrowAngle: -0.3, // 眉毛下垂更明显
  },
  [EMOTIONS.CONFUSED]: {
    // 疑惑表情
    eyeSize: 6,
    eyeY: 100,
    eyeSpacing: 28,
    mouthType: 'flat',
    mouthCurvature: 0.05, // 微微倾斜
    mouthWidth: 0.25,
    mouthY: 155,
    blush: false,
    eyebrowAngle: 0.15, // 一边眉毛上扬
  },
  [EMOTIONS.PROUD]: {
    // 得意表情
    eyeSize: 8, // 眼睛变大
    eyeY: 98, // 眼睛稍向上
    eyeSpacing: 28,
    mouthType: 'smile',
    mouthCurvature: 0.3, // 大大的微笑
    mouthWidth: 0.45,
    mouthY: 153,
    blush: true,
    eyebrowAngle: 0.15,
  },
  [EMOTIONS.SHY]: {
    // 害羞表情
    eyeSize: 5, // 眼睛稍小
    eyeY: 102, // 眼睛向下看
    eyeSpacing: 28,
    mouthType: 'smile',
    mouthCurvature: 0.1, // 小小的微笑
    mouthWidth: 0.25,
    mouthY: 156,
    blush: true, // 明显的腮红
    eyebrowAngle: 0.05,
  },
};

// 默认情绪
export const DEFAULT_EMOTION = EMOTIONS.NORMAL;

// 根据文本检测情绪
export function detectEmotionFromText(text) {
  const lowerText = text.toLowerCase();

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return emotion;
      }
    }
  }

  return EMOTIONS.NORMAL;
}

// 获取情绪的过渡参数（用于动画）
export function getEmotionTransition(fromEmotion, toEmotion, progress) {
  const from = EMOTION_FACES[fromEmotion] || EMOTION_FACES[EMOTIONS.NORMAL];
  const to = EMOTION_FACES[toEmotion] || EMOTION_FACES[EMOTIONS.NORMAL];

  return {
    eyeSize: from.eyeSize + (to.eyeSize - from.eyeSize) * progress,
    eyeY: from.eyeY + (to.eyeY - from.eyeY) * progress,
    mouthCurvature: from.mouthCurvature + (to.mouthCurvature - from.mouthCurvature) * progress,
    mouthWidth: from.mouthWidth + (to.mouthWidth - from.mouthWidth) * progress,
    mouthY: from.mouthY + (to.mouthY - from.mouthY) * progress,
    eyebrowAngle: from.eyebrowAngle + (to.eyebrowAngle - from.eyebrowAngle) * progress,
    blush: progress > 0.5 ? to.blush : from.blush,
    mouthType: progress > 0.5 ? to.mouthType : from.mouthType,
  };
}
