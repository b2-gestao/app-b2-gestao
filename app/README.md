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
| `src/auth/AuthGate.tsx`, `LoginScreen.tsx` | Login com Supabase Auth no design "SaaS Login" (`project/SaaS Login.dc.html`): entrar, manter conectado, esqueci minha senha, definir senha do convite e "acesso não liberado". |

## Dados

Os dados do Sienge vêm só por funções `app_*` (SECURITY DEFINER) de
`../supabase/migrations/20260923190000_app_rpc_financeiro.sql`. As tabelas próprias do app
(`app_*`, migration `20260923210000_app_cadastros_financeiro.sql`) são lidas e gravadas
direto, protegidas por RLS: leitura para membros, escrita conforme o perfil.

| Tela | Fonte |
| --- | --- |
| Empresas (filtros, seletores) | `empresas` LEFT JOIN `de_para_sharepoint` (nome do empreendimento; várias linhas no De Para viram uma lista, sem duplicar a empresa) |
| Centros de custo | `centros_custo` |
| Saldos bancários | contas de `contas_correntes` (status ENABLED); o saldo digitado ou importado pelo CSV-modelo vai para `app_saldo_contas_manual` (um registro por conta e dia) |
| Programação do dia | títulos em aberto de `parcelas_pagar_raw` no período + lançamentos manuais, contra o saldo informado do primeiro dia |
| Fluxo de caixa | `parcelas_receber` (receitas) e `parcelas_pagar_raw` (pagamentos) em aberto, 10 dias, por empresa; aportes calculados para a holding (`VITE_HOLDING_EMPRESA_ID`). Empresas em `app_fluxo_empresas_sem_receber` (engrenagem da tela, com motivo) ficam com receitas zeradas — recebíveis já comprometidos |
| Painel (Visão Geral) | totais diários de receber/pagar, próximos vencimentos, ranking por empresa e por segmento (`business_area_name`); pago, juros (juros + multa) e descontos por data de pagamento em `parcelas_pagar_payments` (`app_pagos_diario`) |
| Lançamentos manuais | `app_rec_financeiro_lancamento`. Uma recorrência ("Mensal · 6x") grava 6 linhas com o mesmo `grupo_id` (parcela 1/6 … 6/6); cada parcela é editada/excluída sozinha |
| Usuários | tabela `app_usuarios` + Supabase Auth, pela edge function `app-usuarios` (convite, status, links de senha, exclusão) |
| Departamentos, Perfis | `app_departamentos` e `app_perfis`. A "Função" do usuário é o nome do perfil (FK com `on update cascade`) |
| Indicadores (tela inicial) | API SGS do Banco Central pela edge function `app-indicadores` (cache de 1 h); se ela falhar, direto do navegador |
| Análise com IA | edge function `app-ia` (modelo configurável, ver abaixo); sem modelo configurado, regras fixas sobre os dados |

Saldos e lançamentos que tinham ficado salvos só no navegador (versão anterior) são
enviados ao banco automaticamente no primeiro acesso com permissão de edição.

### Perfis e permissões

- Cada perfil tem permissões de **ver** e **editar** por menu (`app_perfis.permissoes`).
  Menus sem "ver" somem da barra lateral; a tela também é bloqueada se aberta por outro caminho.
- As gravações em saldos, lançamentos, departamentos e perfis passam por `app_pode()` na RLS,
  então a regra vale mesmo fora do app.
- Gerenciar usuários exige "editar" em Configurações › Usuários (edge function `app-usuarios`).
- O perfil **Administrador** é do sistema: tem tudo e não pode ser renomeado, inativado nem excluído.
- Empresas vinculadas ao usuário **não** restringem o que ele vê (decisão de 23/09).

### Análise com IA

A edge function `app-ia` usa qualquer API compatível com OpenAI `/chat/completions`. Para
ligar, defina os segredos em *Edge Functions › Secrets* (sem mudar código):

| Segredo | Valor |
| --- | --- |
| `IA_API_KEY` | chave da OpenAI (ou `OPENAI_API_KEY`) |
| `IA_MODEL` | id exato do modelo, como está na documentação da OpenAI |
| `IA_API_URL` | opcional; padrão `https://api.openai.com/v1` (troque para usar outro provedor compatível) |
| `IA_JSON_MODE` | opcional; `false` se o provedor não aceitar `response_format: json_object` |

Trocar de modelo ou provedor = trocar os segredos. Enquanto não houver chave e modelo, a
função responde 503 e o painel mostra a análise por regras.

### Usuários e login

- Cadastrar um usuário na tela Configurações › Usuários cria o login no Supabase Auth e
  envia o **convite por e-mail**; o link abre o app na tela "Defina sua senha".
- Só entra quem tem cadastro em `app_usuarios` com status diferente de inativo.
  Inativar bloqueia o login (ban no Auth) e o acesso aos dados.
- Só usuários com função **Administrador** podem cadastrar/alterar/excluir.
- "Esqueci minha senha" na tela de login envia o e-mail de redefinição.

### Para colocar no ar

1. ✅ (23/09) Migrations aplicadas, nesta ordem: `20260923190000_app_rpc_financeiro.sql`,
   `20260923190100_fechar_tabelas_anon.sql`, `20260923200000_app_usuarios.sql`,
   `20260923210000_app_cadastros_financeiro.sql`, `20260923210100_app_endurece_triggers.sql`,
   `20260923220000_app_fluxo_diario_mv.sql`.
   **Falta** aplicar `20260924090000_app_fluxo_empresas_sem_receber.sql` (engrenagem do Fluxo de caixa).
2. ✅ (23/09) Edge functions publicadas: `app-usuarios`, `app-indicadores`, `app-ia`.
   **Falta** o segredo `APP_URL` (endereço onde o app roda; os links dos e-mails levam
   para lá). Rodando local, use `http://localhost:5173`.
3. Auth → URL Configuration: colocar o `APP_URL` em *Site URL* / *Redirect URLs*.
   Auth → Providers → Email: desligar **Allow new users to sign up**.
4. Configurar SMTP próprio (Auth → SMTP): o envio padrão do Supabase tem limite baixo
   de e-mails por hora.
5. Primeiro administrador: convidar pelo painel (Authentication › Users › Invite) e
   rodar o `insert` que está no topo de `20260923200000_app_usuarios.sql`.

### Desempenho

`app_fluxo_diario` lê as parcelas a receber de `mv_parcelas_receber` (índices por
`due_date`), não mais de `parcelas_receber` (1,3 mi linhas sem índice por data, ~5 s).
Medido em 23/09: Fluxo 10 dias 0,7 s e Painel 120 dias 0,7 s (1ª chamada 1,5–2,8 s), com
os mesmos totais. A MV é atualizada pelo pg_cron 30–60 min depois de cada carga do receber.
Durante o REFRESH dela (~5 min, 2x/dia) a função espera no máximo 200 ms e lê
`parcelas_receber` direto. Nada mudou no sync, no n8n, no GitHub Actions nem no MCP.

## Testes

```bash
npm run build && npx vite preview --port 4173 &
npm run smoke                     # modo demonstração, todas as telas

VITE_SUPABASE_URL=https://fake-project.supabase.co VITE_SUPABASE_ANON_KEY=fake \
  npx vite build --outDir dist-live && npx vite preview --outDir dist-live --port 4174 &
npm run smoke:live                # modo real com RPCs, tabelas app_* e edge functions simuladas (não toca no projeto)
```

Se o Chromium do Playwright não estiver instalado, use `PW_CHROMIUM=/caminho/do/chrome`.
