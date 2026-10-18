# Refúgio Botânico

Vitrine responsiva em português para o salão Refúgio Botânico, com curadoria demonstrativa de produtos de beleza e autocuidado.

## Como visualizar

Configure primeiro o projeto Supabase conforme os passos abaixo; depois, abra `index.html` em um navegador ou publique os arquivos em um host estático HTTPS.

O catálogo oferece busca, filtros por categoria e uma sacola com quantidades e subtotal. A finalização abre uma mensagem com o resumo do pedido para o WhatsApp `+55 65 99212-8239`; pagamento e disponibilidade são confirmados diretamente com o salão. O símbolo da árvore está em `assets/refugio-botanico-tree.png`; as fotografias e fontes são carregadas de serviços externos.

## Configurar a administração segura de produtos

1. Crie um projeto no Supabase e execute `supabase-schema.sql` no SQL Editor. O script cria a tabela pública do catálogo, configura o bucket público `product-images` (até 5 MB por foto) e restringe alterações no catálogo e uploads/remoções de imagens a contas cuja claim protegida `app_metadata.role` seja `admin`. Se já configurou o projeto, execute o script atualizado novamente para adicionar o bucket e as permissões de armazenamento sem apagar os produtos existentes.
2. No painel do projeto, copie a **Project URL** e a chave pública **anon** (ou **publishable**) para `url` e `anonKey` em `supabase-config.js`. Essa chave pública pode ser usada no site; nunca coloque uma `service_role`/secret key no navegador.
3. Em Authentication, desative o cadastro público e crie a conta do administrador. No SQL Editor, atribua a permissão à conta, substituindo o endereço abaixo pelo e-mail criado:

   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'seu-email@example.com';
   ```

4. Saia e entre novamente para receber a claim atualizada. No site, dê dois cliques na árvore da logo para abrir o painel, entre com essa conta e use **Adicionar produto** ou **Editar produto**. Escolha uma foto JPG, PNG ou WebP de até 5 MB na galeria do dispositivo; ela é enviada ao Supabase Storage e aparece no catálogo público. Ao editar, a foto atual é mantida se nenhuma nova for escolhida.

As permissões são verificadas no servidor pelo Supabase RLS, não apenas pela interface oculta. Sem as credenciais do projeto, o painel permanece indisponível; o catálogo demonstrativo continua visível. As alterações do catálogo e o login só funcionam depois da configuração do Supabase.
