# 系统设计框架（不开发，仅规格约束）

## 目标
- 记录10名玩家角色候选、发言、投票、夜间事件
- 推演每人身份/阵营概率
- 给出基于身份的发言建议
- 语音识别 + 术语纠错 + 结构化录入

## 数据模型（核心字段）

### Player
- seat: 座位号
- name: 昵称
- alive: 存活
- roleProb: 角色概率分布
- campProb: 阵营概率分布
- badge: 是否警长
- giftedSkill: 商人赠礼（None/SeerCheck/WitchPoison/Shield）
- shieldUsed: 护盾是否触发
- notes: 人工修正备注

### Round
- index: 回合序号
- phase: Night/Day
- events: 事件列表

### Event
- 夜间：WolfKill(target)
- 夜间：WitchSave(target)
- 夜间：WitchPoison(target)
- 夜间：SeerCheck(target,result)
- 夜间：MerchantGift(type,target)
- 夜间：ShieldBlock(target)
- 夜间：WolfKingShot(target)
- 白天：Speech(seat,text)
- 白天：Vote(from,to)
- 白天：BadgeElect(candidate)
- 白天：BadgePass(from,to)
- 白天：MerchantDie(reason)

## 推理引擎结构

### 规则过滤层（硬规则）
- 商人赠礼仅一次且不能给自己
- 护盾仅挡刀一次
- 女巫第二夜不可自救
- 赠礼“毒”仅一次毒，不含救
- 狼王被毒不可开枪
- 商人赠礼给狼人未在首轮投票后暴毙为矛盾

### 证据评分层（软证据）
- 投票一致性
- 站边一致性
- 发言逻辑一致性
- 宣称与夜间事实吻合
- 警徽流完整度与兑现
- “幸运儿”话术触发条件符合性（仅声明）

### 结果输出
- 角色概率分布
- 阵营概率分布
- 关键推断依据（解释列表）

## 语音与术语
- 本地语音转写为主，结构化事件录入为辅
- 术语字典：金水、查杀、悍跳、警徽流、倒钩、穿神、抿身份、防爆
- 转写后支持关键词修正

## UI 信息架构（iPhone）
1. 局设置：选择板子、座位与昵称
2. 回合记录：夜间事件、发言转写、投票与警徽
3. 推理与建议：概率热力图、解释原因、按身份发言建议

## 采集与浮窗（iPhone）
- 采用 PiP 浮窗 + 打点辅助 + 实时建议
- 录屏与麦克风音频通过广播扩展采集
- 浮窗仅展示关键信息与实时建议，不提供交互
- 打点用于标记发言/投票等关键节点
- 实时建议为轻量推断，赛后解析为高精度结论

## 约束
- 不把“幸运儿”当角色，仅当话术声明
- 所有推理结果必须可解释（列出依据）
- 默认离线，本地处理语音与推断
- 录屏/录音与 PiP 并行，禁止抓包或读取游戏内部数据
- 实时建议不得输出“确定身份”，只给提示性建议
