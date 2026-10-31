# Prompt Expander — Next.js 全栈 Web 应用模板

> 适用于：CRUD 业务系统、仪表盘、表单工作流、REST API + 前端联调、第三方 API 集成、全栈 MVP
>
> 注意：此模板不包含「视觉规格」「动画时序」章节，因为 Web 应用优先保证功能完整与数据持久化，UI 风格由 Tailwind 工具类控制，无需在提示词中过度指定。

---

# 任务：{一句话任务}

{角色注入段。示例：你是一名资深 Next.js 全栈工程师、React/TypeScript 专家和数据库设计者。请在一个已有的 Next.js 项目中实现{任务描述}。你不会收到任何原始代码文件，以下规格是唯一实现依据。所有代码直接写入项目对应文件，安装依赖通过专用工具进行，不手动修改 package.json。最终交付必须是可构建、可启动的全栈应用，任何 mock/占位/半截代码的结果均不合格。}

```markdown
运行平台：opencode
多智能体约定：本提示词内所有 `@general：` 子代理指令必须实际分发执行，主代理不得自行代劳；主代理只负责汇总、契约校验、风格统一与最终验收。
```

## 0. 交付要求与边界

- 交付物形态：项目内直接创建/修改文件，最终为可运行的 Next.js 全栈应用
- 典型目录约定：
  ```
  src/app/             — 页面与布局（App Router）
  src/app/api/         — API Route Handlers
  src/db/              — 数据库客户端与 schema
  src/components/      — 可复用组件
  src/lib/             — 工具函数/hooks
  public/              — 静态资源
  ```
- 运行方式：`npm run dev` 开发 / `npm run build && npm run start` 生产
- 技术栈锁定：
  - 框架：Next.js（App Router）
  - 语言：TypeScript + React
  - 样式：Tailwind CSS（globals.css 已接入）
  - 数据库：PostgreSQL
  - ORM：Drizzle ORM（`src/db/index.ts`，`DATABASE_URL`）
  - Schema 定义：`src/db/schema.ts`（drizzle-orm/pg-core）
  - API：App Router Route Handlers（`app/api/.../route.ts`）
  - 服务端：Server Components / Server Actions / API Routes
  - 环境变量：服务端 `process.env.*`；客户端仅 `NEXT_PUBLIC_*`
  - 密钥：不落盘硬编码；需密钥的外部调用走服务端 API 代理
- 数据操作能力：
  - 改 `schema.ts` 后 `npx drizzle-kit push` 同步库结构
  - `psql` 执行原始 SQL
  - 服务端代码里 `import { db } from '@/db'` 做 CRUD
- 核心要求：
  1. 所有数据必须真实持久化到 PostgreSQL，不得使用 mock 数据
  2. DB schema 变更后必须执行 drizzle-kit push 同步
  3. 最终必须通过 `npm run build` 生产构建，无 TypeScript 错误
  4. API 与页面必须打通，数据流完整，不能是半截 demo
  5. 移动端基本可用（Tailwind 响应式断点）

## 1. 整体架构

{填写指导：按页面/模块组织，列出所有需要创建的页面、API 路由、数据表。}

1. **页面路由**：{列出所有 page.tsx 路径及功能}
2. **API 路由**：{列出所有 route.ts 路径及方法}
3. **数据表**：{列出所有 drizzle schema 表名及用途}
4. **组件**：{列出需要创建的客户端/服务端组件}
5. **数据流**：{描述页面 → API → DB 的完整数据流向}

## 2. 数据层（Drizzle Schema）

{填写指导：每个表的字段定义，包括类型、默认值、关联关系。}

### 2.1 表：{表名}

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| {field} | {type} | {default} | {description} |

- 关联：{与其他表的外键关系}
- 索引：{需要建立的索引}

### 2.2 种子数据

{填写指导：初始数据要求，如预设分类、演示账号等。}

```sql
-- 示例种子 SQL
INSERT INTO {table} ({columns}) VALUES ({values});
```

## 3. 页面规格

{填写指导：每个页面的功能清单、路由参数、数据获取方式。}

### 3.1 页面：{路径}

- 路由：`{path}`
- 类型：{服务端组件 / 客户端组件}
- 数据获取方式：{Server Component 直接查询 / API fetch / Server Action}
- 功能清单：
  1. {功能 1}
  2. {功能 2}
- 交互状态：{加载态 / 空态 / 错误态 / 边界情况}

### 3.2 表单/交互

- 表单字段：{字段列表及校验规则}
- 提交方式：{Server Action / API POST}
- 校验规则：{前端 + 后端校验}
- 成功/失败反馈：{Toast / 行内错误 / 跳转}

## 4. API 规格

{填写指导：每个 API 路由的请求/响应格式、状态码。}

### 4.1 `{method} {path}`

- 功能：{描述}
- 请求体：
  ```typescript
  { type: ..., properties: {...} }
  ```
- 成功响应（200）：
  ```typescript
  { data: ..., message: "ok" }
  ```
- 错误响应（4xx/5xx）：
  ```typescript
  { error: "错误信息" }
  ```

## 5. 验收清单

{填写指导：每条可验证，必须含反面判定。}

1. {验收项 1：验证方式 + 期望结果}
2. {验收项 2}
3. ...

- 完成判定：所有验收项通过，`npm run build` 无报错，页面与 API 数据打通
- 不合格情形：数据 mock 而非真实 DB 持久化、TypeScript 报错、构建失败、API 返回 500、页面白屏
- 最终回复须提供：启动命令、目录树、关键文件变更摘要