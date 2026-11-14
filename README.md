# Doc Share：私密 Word / Excel 分享站

- **管理员**（两三个人）：用“ID + 密码”登录 `/admin`，上传、修改标题、替换文件、延长期限、更换链接、删除。每个人只能看到和管理**自己的**文档。
- **访问者**：打开某个文档的独立链接 `/d/<随机令牌>`，输入该文档所属管理员设定的 **4 位数字密码**，然后可以在线预览或下载。访问者不能上传。
- **自动删除**：上传 30 天后自动删除（管理员可以点“延长”重新计 30 天）。

技术栈：Next.js（部署在 Vercel）+ Supabase（Auth、Postgres、Storage 私有桶）。

---

## 部署步骤

### 1. Supabase（可以直接用已有项目，例如 memo）

1. **SQL Editor** → 粘贴 `supabase/schema.sql` 全部内容 → Run。会创建 `sharedoc_` 开头的表和私有存储桶 `sharedoc-files`。
2. **管理员 = 这个项目 Authentication → Users 里的用户**，不需要另外登记。登录 ID 可以是完整邮箱，也可以只写 `@` 前面的部分（例如 `co2sou`）；密码就是该用户在 Supabase 里的密码。要增加管理员，在 Users 里 Add user 即可。
3. **Authentication → Sign In / Providers**：关闭 *Allow new users to sign up*。否则任何人都能自己注册账号，然后登录后台。
4. **Project Settings → API**：复制 `Project URL`、`anon key` 和 `service_role key`，下一步要用。

### 2. Vercel

1. **Add New → Project** → 导入这个 GitHub 仓库。项目名就是域名前缀，例如 `private-doc-share-box` → `private-doc-share-box.vercel.app`。
2. 在 **Environment Variables** 里填这 3 个变量：

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |

3. 点 **Deploy**。自动删除用的定时任务已经写在 `vercel.json` 里，每天运行一次，不需要另外设置。

### 3. 开始使用

打开 `https://<你的域名>/admin/login` → 用 ID 和密码登录 → 先设置 4 位查看密码 → 上传文档 → 复制链接发给对方。

**以后增加或删除管理员**：只需在 Supabase → Authentication → Users 里增删用户，不用重新部署 Vercel。

---

## 安全设计说明

| 风险 | 对策 |
|---|---|
| 别人猜到链接 | 每个文档的令牌是 96 bit 随机数，不可能猜中；首页和错误令牌都返回 404 |
| 搜索引擎收录 | `robots.txt` 禁止抓取，并对所有页面加 `X-Robots-Tag: noindex` |
| 暴力尝试 4 位密码 | 同一 IP 对同一文档 15 分钟内最多错 5 次；同一文档 1 小时内合计最多错 30 次 |
| 文件被直接下载 | 存储桶是私有的；下载时只签发 60 秒有效的临时地址 |
| 浏览器直接读写数据库 | 所有表都开启 RLS 并且不设任何策略；只有服务器端用 service_role 访问 |
| 陌生人自己注册账号 | 在 Supabase 关闭新用户注册；项目里的用户才能登录后台 |
| 管理员改了密码 | 旧的“已输入密码”Cookie 会立即失效 |
| 链接被转发出去 | 后台点“更换链接”，旧链接立刻失效 |

**在线预览说明**：预览功能使用微软 Office Online，会把一个 30 分钟有效的临时文件地址交给微软服务器读取。如果文件比较敏感，可以在 Vercel 里加环境变量 `ENABLE_OFFICE_PREVIEW=false`，这样访问者只能下载。

**与其他应用共用 Supabase 项目时**：不要给 `sharedoc-files` 桶添加任何 Policy；同时要确认 `storage.objects` 上没有“未限定 `bucket_id`”的宽泛读取规则。

## 本地开发

```bash
cp .env.example .env.local   # 填好 3 个变量
npm install
npm run dev
```
