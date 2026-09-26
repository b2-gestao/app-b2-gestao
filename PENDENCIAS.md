# B2 Gestão e Operações — pendências e visão geral

Atualizado em 23/09/2026. Detalhes técnicos do app em [`app/README.md`](app/README.md).

## Tecnologias

| Parte | Linguagem / ferramenta | Onde |
| --- | --- | --- |
| Tela (front-end) | **React 19** escrito em **TypeScript**, empacotado com Vite | `app/` |
| Ferramentas de desenvolvimento | **Node.js** + npm (instalar, `npm run dev`, build, testes). Em produção não há Node rodando: o build gera arquivos estáticos | `app/package.json` |
| Banco de dados | **SQL / PL/pgSQL** (Postgres) | `supabase/migrations/` |
| Edge functions (código no servidor) | **TypeScript** rodando em Deno (ambiente do Supabase, não Node) | `supabase/functions/` |
| Testes automáticos | JavaScript (Node) + Playwright | `app/scripts/` |
| Design de origem | HTML/CSS/JS do Claude Design | `project/` |

## Por que Supabase

- **Já era o banco da empresa.** Os dados do Sienge e do SharePoint já estavam lá, carregados
  pelo n8n e pelo GitHub Actions, e o MCP já consultava esse mesmo banco. Usar outro back-end
  obrigaria a copiar ou sincronizar esses dados.
- **Faz o papel do back-end sem servidor para manter:** login (Auth), banco (Postgres), regras de
  acesso (RLS), código com segredos (edge functions) e tarefas agendadas (pg_cron).
- **Segurança no próprio banco:** as permissões por perfil são conferidas pelo Postgres, e valem
  mesmo para quem tentar acessar sem passar pelo app.
- **Custo e operação:** o app vira um site estático (Vercel, Netlify, Cloudflare Pages) falando
  direto com o Supabase. Não há servidor para atualizar, escalar ou monitorar.

## Arquitetura

```
Navegador (React, app/)
   │  login + chave pública
   ▼
Supabase
   ├─ Auth ............ login, convite, senha, bloqueio de inativos
   ├─ Postgres
   │   ├─ dados do Sienge (só leitura, pelas funções app_*)
   │   ├─ tabelas do app: app_usuarios, app_perfis, app_departamentos,
   │   │   app_saldo_contas_manual, app_rec_financeiro_lancamento (RLS por perfil)
   │   └─ pg_cron ..... atualiza mv_parcelas_receber / mv_parcelas_pagar 2x/dia
   └─ Edge functions .. app-usuarios, app-indicadores, app-ia
        ▲                              ▲
 n8n / GitHub Actions (service_role)   MCP (mcp_conector)
```

## Já feito (23/09)

- 6 migrations aplicadas no projeto `kmloqrhydlqsvbgxwzgh`; 3 edge functions publicadas.
- Saldos, lançamentos (com recorrência), perfis e departamentos gravados no banco.
- Perfis controlam os menus (ver/editar).
- Juros do painel vindos dos pagamentos reais (`parcelas_pagar_payments`).
- Baixas ADT retiradas da Programação do dia.
- Tela de login no design "SaaS Login".
- Fluxo de caixa e Painel lendo `mv_parcelas_receber`: de ~5 s para ~0,7 s.

## Pendências

### Para colocar no ar (você, no painel do Supabase)

- [ ] **Edge Functions › Secrets:** criar `APP_URL` = `http://localhost:5173` (depois, o endereço publicado).
- [ ] **Authentication › URL Configuration:** Site URL = `APP_URL`; Redirect URLs = `APP_URL/**`.
- [ ] **Authentication › Providers › Email:** desligar *Allow new users to sign up*.
- [ ] **Authentication › SMTP:** configurar SMTP próprio (o envio padrão tem limite baixo de e-mails por hora).
- [ ] **Primeiro administrador:** convidar seu e-mail em Authentication › Users › Invite e rodar o
      `insert` do topo de `supabase/migrations/20260923200000_app_usuarios.sql`, ou pedir ao Claude.
- [ ] **`app/.env`:** preencher `VITE_SUPABASE_PUBLISHABLE_KEY` (Settings › API Keys).
- [ ] **Seção BI:** migration `20260924100000_app_bi_paineis.sql` já aplicada (24/09); falta cadastrar os
      painéis em BI › Gerenciar painéis e liberar cada um nos perfis (Configurações › Perfis, seção BI).

- [ ] **Notas Fiscais › Cadastros:** migration `20260925100000_app_nf_cadastros.sql` aplicada e edge function `app-nf`
      publicada (25/09). Falta criar os segredos: `SIENGE_API_USER`, `SIENGE_API_PASSWORD` (Painel de Integrações) e
      `OPENAI_API_KEY` (a leitura do PDF usa OpenAI por padrão; `OPENAI_MODEL` opcional, padrão `gpt-4.1-mini`), e opcionais
      `SIENGE_FORMATO_PEDIDO`, `SIENGE_DOCUMENT_ID_*`, `SIENGE_MOVEMENT_TYPE_ID`, `NF_TOLERANCIA_VALOR`,
      `NF_SENHA_VENCIMENTO` (sem ela o vencimento fica travado em +17 dias). Liberar `notas.cadastros` nos perfis.
- [ ] **Chamado de conferência no TomTicket** (botão na tela de nota cadastrada): publicar a edge function
      `app-tomticket` e criar os segredos. `TOMTICKET_TOKEN` vem do TomTicket em Administração › Configurações da
      Conta › API › Novo Token, com "Pode criar e modificar dados" e sem restrição de IP. Opcionais:
      `TOMTICKET_DEPARTAMENTO` (padrão `Contabilidade`) e `TOMTICKET_CATEGORIA_PADRAO` (padrão `Conferência de
      Título Programação Vigente`), por nome ou id. Cada usuário precisa estar cadastrado como cliente no TomTicket
      com o mesmo e-mail do login. No primeiro uso, conferir no TomTicket se o chamado saiu no nome certo.

### Validar no primeiro uso real

- [ ] Primeiro teste de ponta a ponta: login real, telas com dados reais, gravar saldo e lançamento.
      Até agora só foi testado com o Supabase simulado e por SQL direto no banco.
- [ ] Indicadores (SELIC, IPCA…): confirmar que `app-indicadores` alcança o Banco Central (ver logs da função).
- [ ] Fluxo de caixa durante a atualização da MV (06:30 e 13:00): confirmar que cai na tabela de
      origem em vez de dar erro. Não foi possível simular.

### Decisões suas

- [ ] **IA:** criar os segredos `IA_API_KEY` e `IA_MODEL` (id exato do modelo na documentação da
      OpenAI). Sem eles, o painel usa a análise por regras.
- [ ] **Segurança (antigo, anterior ao app):** as funções `swap_parcelas_*`, `truncate_*_staging`,
      `sharepoint_upsert_row`, `sharepoint_finalizar_carga`, `delete_parcelas_receber_by_keys` e
      `refresh_mv_parcelas_receber` podem ser chamadas com a chave pública (anon). n8n e GitHub
      usam service_role, então revogar não deve afetar a ingestão. Aguardando seu ok.
- [ ] **Juros no painel:** hoje = juros + multa. Decidir se a correção monetária entra.
- [ ] **Importar saldos:** aceita só CSV. Decidir se precisa de .xlsx.
- [ ] **Publicação:** escolher onde hospedar o site (Vercel, Netlify, Cloudflare Pages) e trocar o
      `APP_URL`. Enquanto for localhost, o link do e-mail só abre na máquina onde o app roda.

### Próximos passos técnicos

- [ ] **Refatorar o Painel Inicial** (combinado para depois dos demais tópicos). O card de juros
      lê `app_pagos_diario`.
- [ ] Renomear os arquivos de migration com as versões registradas no banco, para o
      `supabase db push` não tentar rodá-las de novo.
- [ ] Índice por data em contas a pagar (~0,7 s hoje), se o volume crescer.
- [ ] Menu "Financeiro" continua visível mesmo quando o perfil não vê nenhuma das telas dele.
- [ ] Revisar o uso total do banco (CPU, memória, conexões) antes de liberar para a equipe.
- [ ] Avisos antigos do Security Advisor: funções sem `search_path` fixo (sync e sdr).
