-- 在 Supabase → SQL Editor 中整段执行即可（重复执行也安全）
-- 所有对象都以 sharedoc 开头，可以和其他应用（如 memo）共用同一个项目

-- 1) 管理员白名单：登录 ID ↔ Supabase 用户邮箱
create table if not exists public.sharedoc_admins (
  login_id   text primary key,
  email      text not null unique,
  created_at timestamptz not null default now()
);

-- 2) 文档表：每个文档属于一个管理员，有自己独立的链接令牌
create table if not exists public.sharedoc_documents (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  owner_email   text not null,
  token         text not null unique,
  title         text not null,
  file_path     text not null,
  original_name text not null,
  mime_type     text,
  size_bytes    bigint,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);
create index if not exists sharedoc_documents_owner_idx   on public.sharedoc_documents(owner_id);
create index if not exists sharedoc_documents_expires_idx on public.sharedoc_documents(expires_at);

-- 3) 每个管理员各自设置的 4 位查看密码（只存哈希）
create table if not exists public.sharedoc_admin_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  pin_hash   text,
  updated_at timestamptz not null default now()
);

-- 4) 密码错误次数记录（防暴力破解）
create table if not exists public.sharedoc_pin_attempts (
  key          text primary key,
  fails        int not null default 0,
  window_start timestamptz not null default now()
);

-- 开启行级安全且不写任何策略 = 浏览器端（anon key）完全无法读写；
-- 只有服务器端的 service_role 能访问
alter table public.sharedoc_admins         enable row level security;
alter table public.sharedoc_documents      enable row level security;
alter table public.sharedoc_admin_settings enable row level security;
alter table public.sharedoc_pin_attempts   enable row level security;

-- 5) 私有存储桶：单文件 20MB，只允许 Word / Excel（不要给它加任何 Policy）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sharedoc-files', 'sharedoc-files', false, 20971520,
  array[
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- 6) 添加管理员（先在 Authentication → Users 里用同一邮箱创建用户）
--    把下面的示例改成你们自己的 ID 和邮箱，去掉注释后执行：
--
-- insert into public.sharedoc_admins (login_id, email) values
--   ('alice', 'alice@example.com'),
--   ('bob',   'bob@example.com')
-- on conflict (login_id) do update set email = excluded.email;
-- ============================================================
