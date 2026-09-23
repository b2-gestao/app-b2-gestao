# B2 Gestão e Operações — app

Implementação em React + Vite + TypeScript do design `project/SaaS Home.dc.html`
(Claude Design): tela inicial, painel, Configurações (Usuários, Departamentos,
Perfis) e Financeiro (Saldos bancários, Lançamentos manuais, Programação do dia,
Fluxo de caixa).

```bash
cd app
npm install
cp .env.example .env    # preencha a publishable/anon key do projeto db_fluxo
npm run dev
```

Sem `VITE_SUPABASE_URL`/chave, o app abre em **modo demonstração**, com os dados de
exemplo do protótipo (útil para revisar o design).

## Como o código está organizado

| Pasta | O que tem |
| --- | --- |
| `src/screens/generated/` | Marcação das telas, **gerada** a partir do protótipo por `npm run convert` (`scripts/convert-template.mjs`). Não editar à mão: mude o protótipo ou o conversor. Mantém os estilos inline e os estados de hover/active do design pixel a pixel. |
| `src/dc/runtime.ts` | `css()` (texto CSS → objeto de estilo) e `hv()` (classes para hover/active/focus). |
| `src/logic/AppLogic.ts` + `src/logic/vals/*.ts` | Lógica das telas, portada do protótipo (estado, filtros, modais, animações). Cada arquivo em `vals/` monta os valores de uma tela. |
| `src/logic/data.ts`, `*Data.ts`, `saldosLive.ts`, `insights.ts` | Dados reais: chamadas ao Supabase, cache por período e cálculos (fluxo, aportes, análises). |
| `src/lib/api.ts` | Tipos e chamadas às funções RPC do Supabase. |
| `src/auth/AuthGate.tsx` | Login com Supabase Auth (tela simples; o design "SaaS Login" ainda não foi portado). |

## Dados

O front-end não lê tabelas diretamente. Ele chama funções `app_*` (SECURITY DEFINER)
criadas em `../supabase/migrations/20260923190000_app_rpc_financeiro.sql`:

| Tela | Fonte |
| --- | --- |
| Empresas (filtros, seletores) | `empresas` LEFT JOIN `de_para_sharepoint` (nome do empreendimento; várias linhas no De Para viram uma lista, sem duplicar a empresa) |
| Centros de custo | `centros_custo` |
| Saldos bancários | contas de `contas_correntes` (status ENABLED). **O saldo é digitado ou importado pelo CSV-modelo e fica salvo neste navegador** — não há tabela de saldos. |
| Programação do dia | títulos em aberto de `parcelas_pagar_raw` no período + lançamentos manuais, contra o saldo informado |
| Fluxo de caixa | `parcelas_receber` (receitas) e `parcelas_pagar_raw` (pagamentos) em aberto, 10 dias, por empresa; aportes calculados para a holding (`VITE_HOLDING_EMPRESA_ID`) |
| Painel (Visão Geral) | totais diários de receber/pagar, próximos vencimentos, ranking por empresa e por segmento (`business_area_name`) |
| Lançamentos manuais | **ficam salvos neste navegador** — não há tabela |
| Usuários | tabela `app_usuarios` + Supabase Auth, pela edge function `app-usuarios` (convite, status, links de senha, exclusão) |
| Departamentos, Perfis | **em memória** (perdidos ao recarregar) — não há tabelas |

### Usuários e login

- Cadastrar um usuário na tela Configurações › Usuários cria o login no Supabase Auth e
  envia o **convite por e-mail**; o link abre o app na tela "Defina sua senha".
- Só entra quem tem cadastro em `app_usuarios` com status diferente de inativo.
  Inativar bloqueia o login (ban no Auth) e o acesso aos dados.
- Só usuários com função **Administrador** podem cadastrar/alterar/excluir.
- "Esqueci minha senha" na tela de login envia o e-mail de redefinição.

### Para colocar no ar

1. Aplicar, nesta ordem: `20260923190000_app_rpc_financeiro.sql`,
   `20260923190100_fechar_tabelas_anon.sql` (impacto verificado — ver cabeçalho do
   arquivo) e `20260923200000_app_usuarios.sql`.
2. Publicar a edge function: `supabase functions deploy app-usuarios` e definir o
   segredo `APP_URL` (endereço onde o app roda; os links dos e-mails levam para lá).
3. Auth → URL Configuration: colocar o `APP_URL` em *Site URL* / *Redirect URLs*.
   Auth → Providers → Email: desligar **Allow new users to sign up**.
4. Configurar SMTP próprio (Auth → SMTP): o envio padrão do Supabase tem limite baixo
   de e-mails por hora.
5. Primeiro administrador: convidar pelo painel (Authentication › Users › Invite) e
   rodar o `insert` que está no topo de `20260923200000_app_usuarios.sql`.

### Desempenho

`app_fluxo_diario` varre `parcelas_receber` (1,3 mi linhas) sem índice por data —
cerca de 4–5 s. Um índice em `(due_date) where balance_amount > 0` resolveria, mas
precisa ser criado dentro de `swap_parcelas_receber` (a tabela é recriada a cada sync).

## Testes

```bash
npm run build && npx vite preview --port 4173 &
npm run smoke                     # modo demonstração, todas as telas

VITE_SUPABASE_URL=https://fake-project.supabase.co VITE_SUPABASE_ANON_KEY=fake \
  npx vite build --outDir dist-live && npx vite preview --outDir dist-live --port 4174 &
npm run smoke:live                # modo real com RPCs simuladas (não toca no projeto)
```

Se o Chromium do Playwright não estiver instalado, use `PW_CHROMIUM=/caminho/do/chrome`.
