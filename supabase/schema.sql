-- 在 Supabase → SQL Editor 中整段执行一次即可

-- 1) 文档表：每个文档属于一个管理员，有自己独立的链接令牌
create table if not exists public.sharedoc_documents (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  owner_email      text not null,
  token            text not null unique,
  title            text not null,
  file_path        text not null,
  original_name    text not null,
  mime_type        text,
  size_bytes       bigint,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  reminder_sent_at timestamptz
);
create index if not exists sharedoc_documents_owner_idx   on public.sharedoc_documents(owner_id);
create index if not exists sharedoc_documents_expires_idx on public.sharedoc_documents(expires_at);

-- 2) 每个管理员各自设置的 4 位查看密码（只存哈希）
create table if not exists public.sharedoc_admin_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  pin_hash   text,
  updated_at timestamptz not null default now()
);

-- 3) 密码错误次数记录（防暴力破解）
create table if not exists public.sharedoc_pin_attempts (
  key          text primary key,
  fails        int not null default 0,
  window_start timestamptz not null default now()
);

-- 开启行级安全且不写任何策略 = 浏览器端（anon key）完全无法读写；
-- 只有服务器端的 service_role 能访问
alter table public.sharedoc_documents      enable row level security;
alter table public.sharedoc_admin_settings enable row level security;
alter table public.sharedoc_pin_attempts   enable row level security;

-- 4) 私有存储桶：单文件 20MB，只允许 Word / Excel
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
-- 存储桶同样不加任何 storage.objects 策略：上传/下载都通过服务器签发的一次性签名地址
