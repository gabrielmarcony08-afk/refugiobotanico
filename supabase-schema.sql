create table if not exists public.products (
  id text primary key,
  name text not null check (length(trim(name)) between 1 and 100),
  brand text not null check (length(trim(brand)) between 1 and 80),
  category text not null check (category in ('cabelo', 'pele', 'bem-estar')),
  tag text check (tag is null or length(tag) <= 40),
  price numeric(10, 2) not null check (price > 0),
  image_url text not null check (image_url like 'https://%'),
  alt_text text not null check (length(trim(alt_text)) between 1 and 160)
);

alter table public.products enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update on public.products to authenticated;

drop policy if exists "Products are visible to everyone" on public.products;
create policy "Products are visible to everyone"
  on public.products for select
  to anon, authenticated
  using (true);

drop policy if exists "Administrators can add products" on public.products;
create policy "Administrators can add products"
  on public.products for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Administrators can edit products" on public.products;
create policy "Administrators can edit products"
  on public.products for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into public.products (id, name, brand, category, tag, price, image_url, alt_text)
values
  ('oleo-essencial', 'Óleo Essencial de Lavanda', 'Alma Botânica', 'bem-estar', 'Mais amado', 68,
    'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=80',
    'Frasco de óleo essencial natural'),
  ('shampoo-nutritivo', 'Shampoo Nutritivo Botânico', 'Raiz & Flor', 'cabelo', 'Uso diário', 82,
    'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80',
    'Produtos botânicos para cuidado dos cabelos'),
  ('creme-facial', 'Creme Facial Calmante', 'Casa Serena', 'pele', 'Novo', 96,
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
    'Creme natural para cuidados com a pele'),
  ('mascara-hidratacao', 'Máscara de Hidratação Profunda', 'Raiz & Flor', 'cabelo', null, 114,
    'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=800&q=80',
    'Máscara de tratamento em pote')
on conflict (id) do nothing;
