# Doc Share：私密 Word / Excel 分享站

- **管理员**（两三个人）：用“ID + 密码”登录 `/admin`，上传、修改标题、替换文件、延长期限、更换链接、删除。每个人只能看到和管理**自己的**文档。
- **访问者**：打开某个文档的独立链接 `/d/<随机令牌>`，输入该文档所属管理员设定的 **4 位数字密码**，然后可以在线预览或下载。访问者不能上传。
- **自动删除**：默认 30 天后删除。到期前 3 天会给该文档的管理员发提醒邮件；**没有发出过提醒的文档不会被删除**。

技术栈：Next.js（部署在 Vercel）+ Supabase（Auth、Postgres、Storage 私有桶）+ Resend（邮件）。

---

## 部署步骤

### 1. Supabase

1. 新建项目，或者直接用已有的项目（见下方“与已有项目共用”）。
2. **SQL Editor** → 粘贴 `supabase/schema.sql` 全部内容并运行（创建 3 张 `sharedoc_` 开头的表和私有存储桶 `sharedoc-files`）。
3. **Authentication → Sign In / Providers**：关闭 *Allow new users to sign up*，这样任何人都无法自行注册。（如果和其他需要注册功能的应用共用这个项目，就**不要关闭**。本站只认 `ADMIN_ACCOUNTS` 里列出的人，其他用户登录不了后台。）
4. **Authentication → Users → Add user → Create new user**：给每个管理员创建一个账号，填写邮箱和密码，并勾选 *Auto Confirm User*。
5. **Project Settings → API**：记下 `Project URL`、`anon key` 和 `service_role key`。

### 2. Resend（提醒邮件）

1. 在 resend.com 注册账号，创建 API Key。
2. 如果没有验证自己的域名，发件人只能用 `onboarding@resend.dev`，**而且只能发给 Resend 注册时使用的邮箱**。要给多位管理员发提醒，需要在 Resend 里验证一个自己的域名。

### 3. Vercel

1. 导入这个 GitHub 仓库。项目名就是域名前缀，例如项目名 `private-doc-share-box` → `private-doc-share-box.vercel.app`。
2. **Settings → Environment Variables**：按 `.env.example` 填写全部变量。重点如下：
   - `ADMIN_ACCOUNTS=alice:alice@example.com,bob:bob@example.com`：冒号前是登录用的 ID，冒号后的邮箱要和第 1 步创建的 Supabase 用户邮箱一致；
   - `UNLOCK_SECRET` 和 `CRON_SECRET`：各填一串随机字符，可以用下面的命令生成：
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
     ```
   - `SITE_URL`：最终的网址（提醒邮件里的链接会用到）。
3. 部署。`vercel.json` 里设置了定时任务，每天 UTC 0:00（日本时间 9:00）运行一次清理。

### 4. 第一次使用

打开 `https://<你的域名>/admin/login` → 用 ID 和密码登录 → 先设置 4 位查看密码 → 上传文档 → 复制链接发给对方。

---

## 安全设计说明

| 风险 | 对策 |
|---|---|
| 别人猜到链接 | 每个文档的令牌是 96 bit 随机数，不可能猜中；首页和错误令牌都返回 404 |
| 搜索引擎收录 | `robots.txt` 禁止抓取，并对所有页面加 `X-Robots-Tag: noindex` |
| 暴力尝试 4 位密码 | 同一 IP 对同一文档 15 分钟内最多错 5 次；同一文档 1 小时内合计最多错 30 次 |
| 文件被直接下载 | 存储桶是私有的；下载时只签发 60 秒有效的临时地址 |
| 浏览器直接读写数据库 | 所有表都开启 RLS 并且不设任何策略；只有服务器端用 service_role 访问 |
| 管理员改了密码 | 旧的“已输入密码”Cookie 会立即失效 |
| 链接被转发出去 | 后台点“更换链接”，旧链接立刻失效 |

**在线预览说明**：预览功能使用微软 Office Online，会把一个 30 分钟有效的临时文件地址交给微软服务器读取。如果文件比较敏感，可以设置 `ENABLE_OFFICE_PREVIEW=false`，这样访问者只能下载。

**Supabase 免费版注意**：项目连续一段时间没有访问（大约 7 天）会被自动暂停，暂停后需要到控制台手动恢复。具体规则以官方说明为准。

## 与已有 Supabase 项目共用（例如 memo）

可以共用。本站的表都以 `sharedoc_` 开头，存储桶叫 `sharedoc-files`，不会和其他应用的同名对象冲突。共用前请先检查以下几点：

1. **存储策略**：在 Storage → Policies 里查看 `storage.objects` 上的策略。如果有类似“已登录用户可以读取所有对象”、却**没有限定 `bucket_id`** 的策略，那么另一个应用的用户也能读到本站的文件。请把这类策略改成只作用于那个应用自己的桶。
2. **账号是共享的**：两个应用用的是同一个用户表（auth.users）。本站通过 `ADMIN_ACCOUNTS` 白名单做限制，只有名单里的人能进后台。
3. **密钥是共享的**：`service_role key` 一旦泄露，两个应用的数据都会暴露。
4. **免费额度是共享的**：数据库和存储空间合计计算。好处是只要其中一个应用有人在用，项目就不会因长期不活跃而被暂停。

## 本地开发

```bash
cp .env.example .env.local   # 填好变量
npm install
npm run dev
```
