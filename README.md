# Doctor Funnels OS

Sistema operacional para organizar jornadas clínicas e o relacionamento entre equipe, clientes e documentos em uma única aplicação.

## Visão do produto

O projeto separa experiências públicas, administrativas e do cliente. A base inclui autenticação, áreas protegidas, verificação de documentos e fluxos operacionais para acompanhar a jornada sem depender de controles dispersos.

## Módulos

- portal e autenticação de usuários;
- área administrativa;
- área do cliente;
- verificação de assinatura e documentos;
- serviços e contextos compartilhados;
- persistência e integrações via Supabase.

## Stack

`React 19` · `TypeScript` · `Vite` · `Tailwind CSS` · `shadcn/ui` · `Supabase`

## Executar localmente

```bash
pnpm install
pnpm dev
```

Antes de executar, configure as variáveis de ambiente exigidas pela instância Supabase utilizada pelo projeto.

## Comandos

```bash
pnpm dev
pnpm build
pnpm lint
pnpm format
pnpm preview
```

## Organização

```text
src/pages/admin/       operação administrativa
src/pages/auth/        autenticação e recuperação
src/pages/client/      experiência do cliente
src/pages/VerifySignature.tsx
src/services/          integrações e acesso a dados
supabase/              configuração do backend
```

## Segurança

Este repositório contém a estrutura da aplicação, não credenciais. Em novos ambientes, aplique RLS, revise permissões anônimas e mantenha segredos exclusivamente no provedor de deploy.
