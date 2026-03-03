# Couple Points（情侣积分）

一款移动端优先的情侣积分 PWA 应用，支持日常打卡、特殊事件、奖励兑换与使用、留言板，以及基于角色的管理能力。面向 iOS Safari“添加到主屏幕”的类 App 体验。

## 主要功能
- 移动端优先 UI + 底部 Tab 导航
- PWA（standalone、图标、启动入口）
- CloudBase Auth（邮箱+密码）+ Data Models (MySQL)
- 邀请码绑定情侣空间
- 每日打卡、补签、特殊事件提交（云函数处理，立即生效）
- 奖励兑换（即时扣分）
- 奖励使用统计（已兑换/已用/剩余）
- 留言板（权限控制删除）

## 角色与权限
- **积分方（Earner）**：打卡、提交特殊事件、发起兑换/使用、查看流水、留言（只能删自己的）。
- **管理方（Reviewer）**：管理奖励与打卡规则、删除任意留言。

## 路由结构（核心）
- `/` 入口加载页（判定后跳转）
- `/auth/login` `/auth/register`
- `/onboarding` 创建/加入情侣空间
- `/home` 首页摘要
- `/checkin` 每日打卡 & 规则管理（管理方）
- `/special/new` 提交特殊事件
- `/ledger` `/ledger/:id` 流水列表/详情
- `/rewards` `/rewards/:id` 奖励列表/详情
- `/rewards/uses` 奖励使用与统计
- `/messages` 留言板
- `/settings` 设置

## 技术架构 (重构后)
项目采用分层架构：
- **UI 层**: Next.js App Router (`src/app`)
- **逻辑层**: Services (`src/services`) & Hooks (`src/hooks`)
- **数据层**: CloudBase (Auth + NoSQL + Cloud Functions)
- **类型系统**: TypeScript (`src/types`)

## 日期口径
- 所有按日统计、打卡去重、补签窗口、默认日期均按北京时间（`Asia/Shanghai`, UTC+8）计算。

详见 [ARCH.md](./ARCH.md) 和 [API.md](./API.md)。

## 快速开始

### 1) 安装依赖
```bash
npm install
```

### 2) 环境变量
参考 `.env.example` 创建 `.env.local`：
```
NEXT_PUBLIC_CLOUDBASE_ENV_ID=your-env-id
```

### 3) 初始化数据库与云函数
1. 在 CloudBase 控制台创建 MySQL 实例（或使用 Data Models）。
2. 使用 `cloudfunctions/` 目录下的代码部署云函数。

### 4) 本地运行
```bash
npm run dev
```
访问 http://localhost:3000

## 兑换与使用逻辑
- **兑换**：创建 `Redemption`，同时创建 `Transaction(type='redemption')` 立即扣分。
- **奖励使用**：积分方发起使用后直接创建 `RewardUsage`；页面显示已兑换/已用/剩余。

## 部署（CloudBase Static Hosting）
- 构建项目：`npm run build`
- 上传 `out` 目录文件到 CloudBase 静态网站托管。

## 常见操作
- 管理方创建打卡规则：`/checkin`
- 管理方创建奖励：`/rewards`
- 创建/加入情侣空间：`/onboarding`

---
如需更详细的运维/测试/产品说明，可继续告诉我补充。
