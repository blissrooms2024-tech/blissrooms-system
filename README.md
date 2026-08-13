# Bliss Rooms System

Bliss Rooms Enterprise 出租管理系统 — 4 个角色（boss / admin / agent / tenant），涵盖房间管理、合同全流程（草稿→提交→批准→电子签名生效）、IC 上传、Move-in/Move-out 检查表、分项收租、双语租约文件打印、邮箱验证/忘记密码。

技术栈：**Next.js 16 (App Router) + TypeScript + Neon (Postgres) + Prisma 7 + Vercel Blob + Resend**，部署在 **Vercel**，代码托管在 **GitHub**。全部免费额度可用。

## 本地开发

1. 安装依赖

   ```bash
   npm install
   ```

2. 准备一个 Postgres 数据库（本地装一个，或者直接用下面第二节的 Neon 免费数据库，开发阶段也可以直接连 Neon）。

3. 复制 `.env.example` 为 `.env`，把 `DATABASE_URL` / `DIRECT_URL` 填成你的数据库连接串，其他变量先留空也能跑（邮件/文件上传会自动降级成「本地写文件/console.log」，不会报错）。

4. 建表 + 灌种子数据（4 个测试账号 + 12 间假房）

   ```bash
   npx prisma migrate dev
   npm run seed
   ```

5. 启动

   ```bash
   npm run dev
   ```

   打开 http://localhost:3000，用下面的测试账号登录。

### 测试账号（密码都是 `1234`）

| 角色 | Email |
|---|---|
| Boss | boss@bliss.com |
| Admin | admin@bliss.com |
| Agent | agent@bliss.com |
| Tenant | tenant@bliss.com |

## 部署到 Vercel（免费）

### 1. Neon — 数据库

1. 去 [neon.tech](https://neon.tech) 免费注册，建一个新项目。
2. 项目建好后，Neon 会给你两条连接串：
   - **Pooled connection**（带 `-pooler` 的那条）→ 填到 `DATABASE_URL`，app 运行时用这条（适合 serverless，能扛住并发）。
   - **Direct connection**（不带 `-pooler`）→ 填到 `DIRECT_URL`，只有 `prisma migrate` 建表/改表结构时会用这条（Migrate 需要的锁在 PgBouncer 连接池模式下不支持）。
3. 本地跑一次 `npx prisma migrate deploy`（或 `migrate dev`）把表结构建到 Neon 上。

### 2. Vercel Blob — 文件存储（IC 照片/签名/Move-in 照片）

1. 在 Vercel 项目的 **Storage** 标签页新建一个 **Blob** store。
2. 建好后 Vercel 会给一个 `BLOB_READ_WRITE_TOKEN`，加到项目的环境变量里。
3. 没配这个变量之前，本地开发会自动把图片写到 `public/uploads/`（已加进 `.gitignore`，不会误提交），不影响开发调试。

### 3. Resend — 发验证邮箱 / 忘记密码邮件（免费额度 3000 封/月）

1. 去 [resend.com](https://resend.com) 免费注册，拿一个 API Key，填到 `RESEND_API_KEY`。
2. `EMAIL_FROM` 填发件人（免费额度下可以先用 Resend 提供的 `onboarding@resend.dev` 测试；正式用建议绑定自己的域名）。
3. 没配 `RESEND_API_KEY` 之前，系统不会报错，只会把邮件内容打到日志、并记一笔到数据库 `Log` 表（方便你本地调试整个流程，不需要真的收邮件）。

### 4. Vercel 部署

1. 在 Vercel 上 **Import** 这个 GitHub 仓库。
2. 把 `.env.example` 里列的所有变量加到 Vercel 项目的环境变量（Production + Preview）：
   - `DATABASE_URL`、`DIRECT_URL`（Neon）
   - `AUTH_SECRET`（随便生成一个长随机字符串：`openssl rand -base64 32`）
   - `BLOB_READ_WRITE_TOKEN`（Vercel Blob）
   - `RESEND_API_KEY`、`EMAIL_FROM`（Resend）
   - `CRON_SECRET`（随便生成一个随机字符串，Vercel 会自动用它给 Cron 请求签名认证，不用手动配置 header）
   - `NEXT_PUBLIC_APP_URL`（部署后的正式网址，例如 `https://blissrooms.vercel.app`）
3. 部署。`vercel.json` 里已经配好每天一次的 Cron Job（`/api/cron/auto-delete-drafts`），会自动清理超过 3 天没提交的草稿合同，释放对应房间。
4. 第一次部署完，本地执行一次针对生产数据库的迁移和种子（只需要跑一次）：

   ```bash
   DATABASE_URL="<Neon 连接串>" DIRECT_URL="<Neon direct 连接串>" npx prisma migrate deploy
   DATABASE_URL="<Neon 连接串>" npm run seed   # 可选：建 4 个测试账号，正式上线前记得把密码改掉或删掉测试账号
   ```

## 关于合同 Appendix 图片（logo + 10 张 House Rules 图）

已经从原来的 Google Drive 资料夹拉下来，存成静态文件放在 `public/contract-images/`，跟着代码一起提交，不依赖 Drive 链接是否还有效。以后要换图，直接替换 `public/contract-images/` 里对应文件名的图片再重新部署即可；如果想不改代码临时换图，也可以配置这两个环境变量覆盖默认值：

```
NEXT_PUBLIC_CONTRACT_LOGO_URL="https://.../logo.png"
NEXT_PUBLIC_CONTRACT_NOTICE_URLS="https://.../n1.png,https://.../n2.png,...(共10张，按合同 Appendix 顺序用逗号隔开)"
```

## 项目结构速览

- `prisma/schema.prisma` — 数据模型（对照原 Google Sheets 字段 1:1 迁移）
- `src/lib/` — 业务逻辑与常量（收费标准、合同条款原文、Move-in/out 23 项检查表等，照抄原 Apps Script 逻辑）
- `src/app/api/` — 后端 API（对应原本每个 Apps Script 函数）
- `src/app/(app)/` — 登录后各角色页面（dashboard / rooms / contracts / users / my-tenancy）
- `src/app/agreement/[contractId]` — 完整双语租约文件预览 + 打印
- `src/proxy.ts` — 路由守卫（Next.js 16 把 `middleware.ts` 改名成了 `proxy.ts`）

## 楼盘 (Unit) 管理与月报

`Property` 表代表一个"楼盘/Unit"（一栋房子），底下挂多个 `Room`。Admin 在 **楼盘** 页面建 Unit（可以填 Landlord + 管理费 %，留空 Landlord 就代表是自己名下的房产），加房间时要选 Unit 而不是自己打字。每个 Unit 详情页（`/units/[propertyCode]`）能按月生成收入报表：每个房间收了多少、按项目（房租/水电/押金…）拆分明细，如果这个 Unit 有填 Landlord，还会自动算管理费和应付给 Landlord 的净额，可以直接打印/存 PDF 给 Landlord。

**部署这个功能后，第一次要跑一次性的数据迁移**：老数据里房间只有 `propertyName` 这个自由文本字段，没有真正连到 Property 表。跑一次下面这个命令，它会把现有房间按 `propertyName` 分组，自动建对应的 Unit 并把房间连上去（可以重复跑，已经连上的房间会跳过）：

```bash
DATABASE_URL="<Neon 连接串>" npm run backfill-properties
```

## 常用命令

```bash
npm run dev            # 本地开发
npm run build           # 生产构建
npm run lint             # ESLint 检查
npx prisma studio        # 图形化查看/编辑数据库
npx prisma migrate dev   # 本地改了 schema.prisma 后建迁移
npm run seed              # 灌种子数据
npm run backfill-properties  # 一次性：把老房间按 propertyName 分组建 Unit 并连上
```
