-- Nightjar & Co. — Postgres schema (Neon in production, PGlite locally).
-- Shapes follow Shopify's data model (design.md §8.6). Money = integer pence.
-- Statements are idempotent; ensureSchema() runs them when SCHEMA_VERSION changes.

create table if not exists meta (key text primary key, value jsonb not null);

create table if not exists products (
  id bigint primary key,
  handle text unique not null,
  title text not null,
  body_html text not null default '',
  vendor text not null default 'Nightjar & Co.',
  product_type text not null,
  tags text[] not null default '{}',
  status text not null default 'active' check (status in ('active','draft','archived')),
  options jsonb not null default '[]',
  images jsonb not null default '[]',
  metafields jsonb not null default '{}',
  sales_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists variants (
  id bigint primary key,
  product_id bigint not null references products(id) on delete cascade,
  title text not null,
  option1 text, option2 text, option3 text,
  sku text,
  price int not null check (price >= 0),
  compare_at_price int,
  grams int not null default 400,
  inventory_quantity int not null default 0,
  inventory_management text default 'shopify',
  inventory_policy text not null default 'deny',
  position int not null default 1,
  metafields jsonb not null default '{}'
);
create index if not exists variants_product_idx on variants(product_id);

create sequence if not exists product_id_seq start 9000000000;
create sequence if not exists variant_id_seq start 49000000000;

create table if not exists discounts (
  code text primary key,
  type text not null check (type in ('percentage','fixed_amount')),
  value int not null check (value > 0),
  description text not null default '',
  minimum int not null default 0,
  usage_limit int,
  used int not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id bigserial primary key,
  email text unique not null,
  first_name text not null default '',
  last_name text not null default '',
  password_hash text,
  accepts_marketing boolean not null default false,
  is_admin boolean not null default false,
  default_address jsonb,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,               -- sha256 of the cookie token
  customer_id bigint not null references customers(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists password_resets (
  id text primary key,               -- sha256 of the emailed token
  customer_id bigint not null references customers(id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false
);

create table if not exists auth_throttle (
  key text primary key,
  failures int not null default 0,
  window_start timestamptz not null default now()
);

create table if not exists carts (
  token text primary key,
  items jsonb not null default '[]',
  note text not null default '',
  attributes jsonb not null default '{}',
  discount_code text,
  updated_at timestamptz not null default now()
);

create sequence if not exists order_number_seq start 1001;

create table if not exists orders (
  id bigserial primary key,
  number int unique not null default nextval('order_number_seq'),
  token text unique not null,
  cart_token text,
  customer_id bigint references customers(id) on delete set null,
  email text not null,
  currency text not null default 'GBP',
  status text not null default 'pending' check (status in ('pending','paid','cancelled','refunded')),
  fulfillment_status text,
  customer jsonb not null default '{}',
  shipping_address jsonb not null default '{}',
  line_items jsonb not null default '[]',
  discount_codes jsonb not null default '[]',
  subtotal_price int not null,
  total_discounts int not null default 0,
  shipping_lines jsonb not null default '[]',
  total_tax int not null default 0,
  total_price int not null,
  note text not null default '',
  gateway text not null default 'stripe',
  stripe_session_id text,
  stripe_payment_intent text,
  fulfillments jsonb not null default '[]',
  refunds jsonb not null default '[]',
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists orders_email_idx on orders(email);
create index if not exists orders_status_idx on orders(status, created_at);

create table if not exists subscribers (
  email text primary key,
  source text not null default 'popup',
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id bigserial primary key,
  product_id bigint not null references products(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text not null default '',
  body text not null,
  author text not null,
  email text not null,
  verified boolean not null default false,
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(),
  unique (product_id, email)
);

create table if not exists wishlists (
  owner text not null,               -- 'c:<customer id>' or 'v:<visitor token>'
  product_id bigint not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, product_id)
);

create table if not exists emails (
  id bigserial primary key,
  to_email text not null,
  subject text not null,
  html text not null,
  kind text not null default 'transactional',
  status text not null default 'logged',
  created_at timestamptz not null default now()
);

create table if not exists events (
  id bigserial primary key,
  topic text not null,
  ref text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
)
