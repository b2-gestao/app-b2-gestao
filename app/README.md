# B2 Gestão e Operações — app

Implementação em React + Vite + TypeScript do design `project/SaaS Home.dc.html`
(Claude Design): tela inicial, painel, Configurações (Usuários, Departamentos,
Perfis), Financeiro (Saldos bancários, Lançamentos manuais, Programação do dia,
Fluxo de caixa) e BI (painéis do Power BI publicados na web).

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
| Saldos bancários | só as contas adicionadas em `app_saldo_contas_selecionadas` (escolhidas entre as de `contas_correntes` com status ENABLED, via "Informar saldo"; o botão de lixeira remove); o saldo digitado ou importado pelo CSV-modelo vai para `app_saldo_contas_manual` (um registro por conta e dia) |
| Programação do dia | títulos em aberto de `parcelas_pagar_raw` no período + lançamentos manuais, contra o saldo inicial: saldo informado do primeiro dia + parcelas a receber em aberto no período (`app_receber_periodo`, sem Bens, Permuta e Financiamento pelo `grupo_parcela` de `payment_term_descriptions`; empresas em `app_fluxo_empresas_sem_receber` — plano empresário — não somam recebíveis) |
| Fluxo de caixa | `parcelas_receber` (receitas) e `parcelas_pagar_raw` (pagamentos) em aberto, no período escolhido na tela (padrão: 10 dias a partir de hoje; até 62), por empresa; visão Consolidado (soma das empresas do filtro, aportes se anulam) ou Por SPE; aportes calculados para a holding (`VITE_HOLDING_EMPRESA_ID`). Empresas em `app_fluxo_empresas_sem_receber` (engrenagem da tela, com motivo) ficam com receitas zeradas — recebíveis já comprometidos |
| Painel (Visão Geral) | totais diários de receber/pagar, próximos vencimentos, ranking por empresa e por segmento (`business_area_name`); pago, juros (juros + multa) e descontos por data de pagamento em `parcelas_pagar_payments` (`app_pagos_diario`) |
| Lançamentos manuais | `app_rec_financeiro_lancamento`. Uma recorrência ("Mensal · 6x") grava 6 linhas com o mesmo `grupo_id` (parcela 1/6 … 6/6); cada parcela é editada/excluída sozinha |
| Usuários | tabela `app_usuarios` + Supabase Auth, pela edge function `app-usuarios` (convite, status, links de senha, exclusão) |
| Categorias (Cadastros › Financeiro) | `app_lancamento_categorias`. As ativas aparecem no campo Categoria dos lançamentos manuais; `app_rec_financeiro_lancamento.categoria` é FK para o nome (`on update cascade`), então renomear atualiza os lançamentos e categoria em uso não pode ser excluída, só inativada |
| Departamentos, Perfis | `app_departamentos` e `app_perfis`. A "Função" do usuário é o nome do perfil (FK com `on update cascade`) |
| BI | `app_bi_paineis` (nome, link público do Power BI, ordem, ativo, ocultar rodapé). Cada painel ativo vira um item do menu BI e abre o relatório num iframe (`src/screens/BiPage.tsx`); "Gerenciar painéis" (`BiCfgModal.tsx`) cadastra pelo link ou pelo código `<iframe>` do *Publicar na Web*. Não há back-end: o app lê e grava a tabela direto |
| Notas Fiscais › Cadastros | Cadastro de nota de compra no Sienge a partir do PDF (NF-e, NFS-e, boleto, fatura), portado do projeto `sienge-nf-automatica`: edge function `app-nf` (leitura do PDF por Gemini/OpenAI, fornecedor/empresa pelo CNPJ, pedidos em aberto, sugestão de vínculo dos insumos, gravação da nota, vencimento +17 dias e anexos no título). Histórico em `app_nf_cadastros`, gravado só pela função. Permissão `notas.cadastros`: ver = histórico; editar = cadastrar. Tela escrita à mão: `src/screens/NotasCadastrosPage.tsx` + `src/logic/vals/notasCadastros.ts` |
| Chamado de conferência (nota cadastrada) | TomTicket pela edge function `app-tomticket` (`src/lib/tomticket.ts`): abre o chamado no nome do usuário logado (e-mail do login = cliente no TomTicket), no departamento Contabilidade, com a categoria e a mensagem editáveis no modal. `/ticket/new` não devolve o número: ele é lido em `/ticket/list` logo depois. Nada é gravado no banco |
| Indicadores (tela inicial) | API SGS do Banco Central pela edge function `app-indicadores` (cache de 1 h); se ela falhar, direto do navegador |
| Análise com IA | edge function `app-ia` (modelo configurável, ver abaixo); sem modelo configurado, regras fixas sobre os dados |

Saldos e lançamentos que tinham ficado salvos só no navegador (versão anterior) são
enviados ao banco automaticamente no primeiro acesso com permissão de edição.

### Perfis e permissões

- Cada perfil tem permissões de **ver** e **editar** por menu (`app_perfis.permissoes`).
  Menus sem "ver" somem da barra lateral; a tela também é bloqueada se aberta por outro caminho.
- BI: cada painel é um item da matriz (`bi.<id do painel>`), então a liberação é por painel.
  `bi.gerenciar` com "editar" cadastra/altera os painéis e vê todos. A RLS de `app_bi_paineis`
  só devolve os painéis liberados, então o link de um painel não chega a quem não tem acesso
  (mas o link do *Publicar na Web* em si é público).
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
| `IA_REASONING_EFFORT` | opcional; `low`, `medium`... (sem ele, o padrão do modelo) |
| `IA_CACHE_HORAS` | opcional; validade do cache compartilhado, padrão 4 |

Modelo escolhido (24/09): `gpt-5.6-luna` (OpenAI, aceita `/chat/completions` e JSON mode).

A faixa de análise da Programação do dia e do Fluxo de caixa mostra a análise por regras e só
chama a IA quando o usuário clica em **Analisar com IA** (decisão de 24/09, para controlar custo).
Enquanto espera, mostra "A IA está pensando…" com o nome do modelo. Se os dados mudarem, a faixa
volta para as regras e o botão volta a ser "Analisar com IA"; voltar para dados já analisados na
sessão mostra a análise de novo sem chamar a IA. No modal da Programação, **Baixar PDF** gera o
relatório (pontos de atenção + empresas que precisam de aporte) sem nova chamada.

O app manda à IA um bloco `resumo` com os totais já calculados (os mesmos dos cards) e o prompt
proíbe recalcular: a IA só escolhe e escreve. A função guarda cada resposta na tabela
`app_ia_cache` (chave = hash dos dados + tela + data + modelo + versão do prompt): outro usuário
que pede os mesmos dados no mesmo dia recebe a mesma resposta, sem custo. Mudou o prompt? Suba
`PROMPT_VERSAO` na função. Chamadas pagas, reaproveitadas e tokens das últimas 24 h:

```sql
select count(*) as chamadas_pagas, coalesce(sum(hits), 0) as reaproveitadas,
       sum(tokens_entrada) as entrada, sum(tokens_saida) as saida, sum(tokens_raciocinio) as raciocinio
from app_ia_cache where criado_em > now() - interval '1 day';
```

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
   ✅ (24/09) `20260924090000_app_fluxo_empresas_sem_receber.sql` (engrenagem do Fluxo de caixa).
   ✅ (24/09) `20260924100000_app_bi_paineis.sql` (seção BI).
   ✅ (24/09) `20260924110000_app_saldo_contas_selecionadas.sql` (contas listadas em Saldos bancários).
   ✅ (24/09) `20260924120000_app_lancamento_categorias.sql` (Cadastros › Financeiro › Categorias).
   ✅ (24/09) `20260924130000_app_receber_periodo.sql` (a receber no saldo inicial da Programação do dia).
   ✅ (24/09) `20260924140000_app_ia_cache.sql` (cache compartilhado da Análise com IA).
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
