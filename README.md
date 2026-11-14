# Doc Share

用链接 + 4 位密码分享 Word / Excel 文件。文件 30 天后自动删除。

## 使用方法

### 管理员

1. 打开 `https://<域名>/admin/login`
2. 用 Supabase 账号登录（ID 填邮箱 `@` 前面的部分即可）
3. 第一次登录先设置 **4 位查看密码**
4. 上传文件 → 点 **复制链接** 或 **生成二维码** 发给对方

列表中的每个文件都可以：修改标题、替换文件、延长 30 天、更换链接（旧链接失效）、删除。

### 访问者

打开收到的链接 → 输入 4 位密码 → 预览或下载。

## 部署

### Supabase

1. SQL Editor 中运行 `supabase/schema.sql`
2. Authentication → Users 中的用户就是管理员（要加人就 Add user）
3. Authentication → Sign In / Providers 中关闭 **Allow new users to sign up**

### Vercel

导入本仓库，在 Environment Variables 中填写以下 3 项（Supabase → Project Settings → API）后部署：

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

可选：`ENABLE_OFFICE_PREVIEW=false` 关闭在线预览（只允许下载）。
