/* CRC › Entregas — lógica do HTML "Habitat · Gestão de Entrega" (entregas-v4), mantida como estava.
   Roda como script clássico (as telas usam onclick="..." com as funções globais) dentro do
   elemento .crc-ent que CrcEntregasPage.tsx monta uma vez só.
   O que mudou em relação ao HTML:
   - load()/save(): os dados vêm do Supabase e cada save() grava as diferenças (crcStore.ts,
     via window.__crcBridge) em vez do localStorage;
   - nome do usuário = login do sistema; IA = edge function app-ia (chave no servidor);
   - anexos vão para o Storage; projeto tem empresa do Sienge;
   - alert/confirm/prompt do navegador viram toast e caixas de diálogo no visual do sistema;
   - today() em horário local (o HTML usava UTC e virava o dia às 21h). */
const crcBridge = window.__crcBridge;
const crcRoot = document.querySelector('.crc-ent');
function crcAlert(msg){ crcBridge.toast(String(msg)); }

/* Caixa de diálogo no lugar de confirm()/prompt(): devolve Promise<boolean> / Promise<string|null>. */
function crcDialog(msg, opts){
  opts = opts || {};
  return new Promise(resolve=>{
    const modal = document.getElementById('modalCrcDialog');
    const inpWrap = document.getElementById('crcDlgInputWrap');
    const inp = document.getElementById('crcDlgInput');
    const ok = document.getElementById('crcDlgOk');
    const cancel = document.getElementById('crcDlgCancel');
    document.getElementById('crcDlgTitle').textContent = opts.title || (opts.prompt ? 'Informe' : 'Confirmar');
    document.getElementById('crcDlgMsg').textContent = msg;
    inpWrap.classList.toggle('hidden', !opts.prompt);
    inp.value = opts.value || '';
    ok.textContent = opts.okLabel || 'Confirmar';
    ok.className = 'btn' + (opts.danger ? ' danger' : '');
    const done = v=>{
      modal.classList.remove('show');
      ok.onclick = cancel.onclick = inp.onkeydown = modal.onclick = null;
      resolve(v);
    };
    ok.onclick = ()=>done(opts.prompt ? inp.value : true);
    cancel.onclick = ()=>done(opts.prompt ? null : false);
    modal.onclick = e=>{ if(e.target===modal) done(opts.prompt ? null : false); };
    inp.onkeydown = e=>{ if(e.key==='Enter') ok.onclick(); if(e.key==='Escape') cancel.onclick(); };
    modal.classList.add('show');
    setTimeout(()=>(opts.prompt ? inp : ok).focus(), 30);
  });
}
function crcConfirm(msg, opts){ return crcDialog(msg, opts); }
function crcPrompt(msg, value, opts){ return crcDialog(msg, Object.assign({prompt:true, value, okLabel:'OK'}, opts||{})); }

/* ========= DEFAULTS ========= */
const DEFAULT_RESPS = ["APROVAÇÃO","CONTABILIDADE","CONTROLADORIA","CRC","CRC/QUALIDADE","CRC/JURIDICO","DESENV. PRODUTO","FINANCEIRO","INCORPORAÇÃO","INCORPORAÇÃO/APROVAÇÃO","JURIDICO","JURIDICO/INCORP","MKT","MKT/CRC","OBRA","OBRA/JURIDICO","PERSONALIZAÇÃO","QUALIDADE","QUALIDADE/OBRA/CRC","QUALIDADE/OBRA"];

const MODELO_BASE = {
  id:"tpl_base", name:"Modelo Base Habitat — Casa Laguna",
  blocks:[
    {name:"MANUAL DO PROPRIETÁRIO E ÁREA COMUM",actions:[{name:"COTAÇÃO E FECHAMENTO DA EMPRESA",resps:["QUALIDADE"]},{name:"ELABORAÇÃO DOS MANUAIS DE USO E OPERAÇÃO",resps:["OBRA"]},{name:"CONTRATAÇÃO AS BUILT",resps:["OBRA"]},{name:"ELABORAÇÃO DAS PLANTAS HUMANIZADAS (PROCONSULT) COM MEDIDAS",resps:["QUALIDADE"]},{name:"VALIDAÇÃO DO MANUAL PELAS AREAS",resps:["QUALIDADE"]},{name:"ENTREGA MANUAL DO PROPRIETÁRIO",resps:["CRC"]}]},
    {name:"DESLIGAMENTO",actions:[{name:"RELAÇÃO UNIDADES LIBERADAS - VMD",resps:["CONTROLADORIA"]},{name:"EMISSÃO DE TERMO DE QUITAÇÃO E BAIXA DE HIPOTECA (BANCO)",resps:["CONTROLADORIA"]},{name:"AVERBAÇÃO DE BAIXA DE HIPOTECA",resps:["JURIDICO"]}]},
    {name:"LIGAÇÕES DEFINITIVAS - EQUATORIAL",actions:[{name:"CARTA DE ORÇAMENTO PARA EXTENSÃO DE REDE",resps:["OBRA/JURIDICO"]},{name:"PROJETO APROVADO",resps:["INCORPORAÇÃO"]},{name:"PROTOCOLO DE SOLICITAÇÃO AUTORIZAÇÃO DE LIGAÇÃO AL",resps:["JURIDICO"]},{name:"POSTE + SUBESTAÇÃO",resps:["OBRA"]},{name:"VISTORIA EQUATORIAL - LIGAÇÃO EXTENSÃO DE REDE",resps:["OBRA"]},{name:"CADASTRO IMOVEIS  NA CONCESSIONARIA",resps:["APROVAÇÃO"]},{name:"TRANSFERENCIA TITULARIDADE ENERGIA",resps:["CRC"]}]},
    {name:"LIGAÇÕES DEFINITIVAS - ÁGUA E ESGOTO",actions:[{name:"ELABORAÇÃO DE PROJETO DE EXTENSÃO DE REDE",resps:["INCORPORAÇÃO"]},{name:"TENTATIVA DE PARCERIA COM A SANEAGO",resps:["JURIDICO/INCORP"]},{name:"EXTENSÃO REDE AGUA",resps:["OBRA"]},{name:"SOLICITAÇÃO LIGAÇÃO DE ESGOTO",resps:["INCORPORAÇÃO"]},{name:"SOLICITAÇÃO LIGAÇÃO DE ÁGUA",resps:["INCORPORAÇÃO"]},{name:"CADASTRO IMOVEIS  NA CONCESSIONARIA",resps:["APROVAÇÃO"]},{name:"POÇO ARTESIANO",resps:["OBRA"]},{name:"TRANSFERENCIA TITULARIDADE AGUA",resps:["CRC"]}]},
    {name:"AMMA",actions:[{name:"CONTRATAR O RELATÓRIO DE GERENCIAMENTO DE RESÍDUOS E ENVIAR PARA INCORPORADORA FINALIZAR O PROCESSO DE LICENÇA DE INSTALAÇÃO (LI) NA AMMA",resps:["APROVAÇÃO"]},{name:"LI - PROTOCOLAR REQUERIMENTO SUGERINDO NA AMMA, JUNTAMENTE COM O PROJETO DA CALÇADA E UMA SUGESTÃO DO PAISAGISMO QUANTO AO TIPO DE PLANTA",resps:["APROVAÇÃO"]},{name:"EXECUTAR CALÇADA - INCLUSIVE PLANTAR MUDAS E PISO ACESSÍVEL",resps:["OBRA"]},{name:"VISTORIA AMMA PARA HABITE-SE/CERTIDÃO AMMA",resps:["APROVAÇÃO"]}]},
    {name:"BOMBEIROS",actions:[{name:"REAPROVAÇÃO O PROJETO DE BOMBEIROS",resps:["INCORPORAÇÃO"]},{name:"RESPONSÁVEL PASSAR DIRETRIZES DO QUE PRECISA ESTAR PRONTO PARA VISTORIA DO BOMBEIRO",resps:["OBRA"]},{name:"PROTOCOLO PROCESSO BOMBEIRO",resps:["APROVAÇÃO"]},{name:"ENVIO DO COMPROVANTE DE PAGAMENTO PARA RESPONSÁVEL",resps:["FINANCEIRO"]},{name:"1ª VISTORIA DO BOMBEIRO",resps:["OBRA"]},{name:"2ª VISTORIA DO BOMBEIRO",resps:["OBRA"]},{name:"EMISSÃO DA CERTIDÃO BOMBEIRO",resps:["OBRA"]}]},
    {name:"HABITE-SE PREFEITURA",actions:[{name:"PROTOCOLOCAR PROCESSO DE HABITE-SE",resps:["APROVAÇÃO"]},{name:"1ª VISTORIA DE HABITE-SE PREFEITURA",resps:["OBRA"]},{name:"REAPROVAÇÃO PROJETO DE ARQUITETURA (DEP PROJETOS / PERSONALIZAÇÃO)",resps:["INCORPORAÇÃO"]},{name:"2ª VISTORIA DO HABITE-SE",resps:["OBRA"]},{name:"CERTIDÃO DE HABITE-SE",resps:["OBRA"]},{name:"AVERBAÇÃO CERTIDÃO DE HABITE-SE",resps:["APROVAÇÃO"]}]},
    {name:"DOCUMENTAÇÃO",actions:[{name:"PREENCHIMENTO QUADRO DE ÁREAS",resps:["INCORPORAÇÃO"]},{name:"MODELO DE FECHAMENTO VARANDA E DEFINIÇÃO SE AS SACADAS PODERÃO SER INTEGRADAS",resps:["QUALIDADE/OBRA/CRC"]},{name:"ABRIR PROCESSO DE ALTERAÇÃO DE ITU PARA IPTU (CERTIDÕES DE LANÇAMENTO) - VIRTUAL E DEFINITIVA",resps:["APROVAÇÃO"]},{name:"FINANCEIRO FORNECER DOCUMENTAÇÃO PARA ISS",resps:["FINANCEIRO"]},{name:"PROTOCOLO CÁLCULO DO ISS/LIBERAÇÃO ISS",resps:[]},{name:"RETIFICAR MEMORIAL DE INCORPORAÇÃO - VAGAS",resps:[]},{name:"CERTIDÃO DE LANÇAMENTO DE IPTU - PARA AVERBAÇÃO",resps:["APROVAÇÃO"]},{name:"CND-INSS",resps:["CONTABILIDADE"]},{name:"REVISAR MINUTA CONVENÇÃO DE CONDOMÍNIO",resps:["JURIDICO"]},{name:"ADITIVO CONTRATO DE FINANCIAMENTO DA OBRA - AVERBAÇÃO NA MATRÍCULA",resps:["FINANCEIRO"]},{name:"EMISSÃO DE CONTRATOS DE CLIENTE - AVERBAÇÃO MATRÍCULA (PILOTO FB)",resps:["CRC"]},{name:"LAUDO AVALIAÇÃO UNIDADES (BANCO)",resps:["CRC"]},{name:"PASTA MAE PARA FB (BANCO)",resps:["CRC"]},{name:"PROTOCOLO DA CONVENÇÃO E INSTITUIÇÃO DO CONDOMÍNIO (NO MOMENTO DA AVERBAÇÃO)",resps:["JURIDICO"]}]},
    {name:"VISTORIA INTERNA OBRA",actions:[{name:"MONTAR CHECK LIST",resps:["QUALIDADE"]},{name:"TREINAMENTO EQUIPE PARA VISTORIA",resps:["QUALIDADE"]},{name:"CHECK LIST PERSONALIZAÇÃO",resps:["PERSONALIZAÇÃO"]}]},
    {name:"VISTORIA INTERNA - CRC E QUALIDADE",actions:[{name:"VISTORIA PREVIA DE AREA COMUM",resps:["OBRA"]}]},
    {name:"ORGANIZAÇÃO PARA ENTREGA",actions:[{name:"GESTÃO DESLIGAMENTO FINANCEIRO",resps:["CRC"]},{name:"DEFINIÇÃO E AQUISIÇÃO DE BRINDE PARA ENTREGA AO CLIENTE",resps:["MKT"]},{name:"LAUDO VISTORIA PRIME ADMINISTRADORA",resps:["CRC"]},{name:"REPAROS AREA COMUM LAUDO PRIME",resps:["OBRA"]}]},
    {name:"MONTAGEM AREA COMUM ÁREA COMUM",actions:[{name:"FABRICAÇÃO DA MARCENARIA",resps:["OBRA"]},{name:"ASSINATURA DO CADERNO TÉCNICO - FECHAR MATERIAL DE VENDA COMO O QUE SERÁ ENTREGUE",resps:["DESENV. PRODUTO"]},{name:"MONTAGEM ÁREA COMUM",resps:["DESENV. PRODUTO"]},{name:"RECEBIMENTO INTERNO DA MONTAGEM DAS AREAS COMUNS",resps:["DESENV. PRODUTO"]},{name:"MONTAGEM ACADEMIA",resps:["DESENV. PRODUTO"]},{name:"MONTAGEM E INSTALAÇÃO GERADOR",resps:["OBRA"]},{name:"MANUTENÇÃO E TESTE GERADOR",resps:["OBRA"]},{name:"MANUTENÇÃO ELEVADORES",resps:["OBRA"]},{name:"INSTALAÇÃO QR CODE DO MANUAL DO PROPRIETARIO E SINDICO",resps:["CRC/QUALIDADE"]},{name:"IMPLANTAÇÃO E TESTE SISTEMA DE MONITORAMENTO",resps:["OBRA"]},{name:"IMPLANTAÇÃO E TESTE SISTEMA DE ACESSO",resps:["OBRA"]}]},
    {name:"VISTORIAS DE UNIDADES PRIVATIVAS",actions:[{name:"LIBERAÇÃO UNIDADES PARA VISTORIA DA QUALIDADE",resps:["OBRA"]},{name:"LIBERAÇÃO UNIDADES PARA VISTORIA DO CLIENTE",resps:["QUALIDADE"]},{name:"EQUIPE SUPORTE OBRA PARA MOMENTO VISTORIA",resps:["OBRA"]},{name:"PREPARAÇÃO DA UNIDADE PARA VISTORIA COM O CLIENTE",resps:["OBRA"]},{name:"VISTORIA COM O CLIENTE",resps:["CRC/QUALIDADE"]}]},
    {name:"VISTORIA AREA COMUM",actions:[{name:"CHECK LIST OBRA",resps:["QUALIDADE"]},{name:"INVENTARIO",resps:["DESENV. PRODUTO"]},{name:"PREPARAÇÃO DAS AREAS PARA VISTORIA COM O CONDOMINIO",resps:["OBRA"]},{name:"AGENDAMENTO DE VISTORIA COM SINDICO E REPRESENTANTES",resps:["CRC"]},{name:"VISTORIA",resps:["CRC/QUALIDADE"]},{name:"TERMO DE ACORDO DE ENTREGA",resps:["JURIDICO"]}]},
    {name:"ENTREGA DE CHAVES",actions:[{name:"DESLISGAMENTO/ESCRITURAÇÃO CLIENTE",resps:["CRC"]},{name:"FORMALIZAÇÃO DA ENTREGA - ASSINATURA TERMO DE ENTREGA",resps:["CRC"]}]},
    {name:"COMUNICAÇÃO VISUAL",actions:[{name:"PROGRAMAR FOTOS E VIDEO DA ÁREA COMUM FINALIZADA E PRODUÇÃO",resps:["MKT"]},{name:"COMUNICAÇÃO VISUAL DO EMPREENDIMENTO - ARTE",resps:["MKT"]},{name:"INSTALAÇÃO DA PLACA DE TOPO DO PRÉDIO",resps:["MKT"]},{name:"IDENTIFICAÇÃO AREA COMUNS E UNIDADES",resps:["MKT"]},{name:"TOTEM E COMUNICAÇÃO NA FACHADA",resps:["MKT"]},{name:"INSTALAR NUMERAÇÃO DA OBRA",resps:["MKT"]}]},
    {name:"EVENTO",actions:[{name:"VISTORIA DE PERSONALIZAÇÃO",resps:["PERSONALIZAÇÃO"]},{name:"EVENTO DE INSTALAÇÃO DO ELEVADOR",resps:["CRC"]},{name:"VISITA CLIENTE PARA MEDIÇÃO DE ARMARIO",resps:["CRC"]},{name:"ELABORAR EVENTO DE ENTREGA",resps:["MKT"]},{name:"CONVITES IMPRESSOS/DIGITAL PARA EVENTO DE ENTREGA",resps:["MKT/CRC"]},{name:"COMUNICAÇÃO COM CLIENTE",resps:["CRC"]},{name:"DIA DO EVENTO DE ENTREGA",resps:["MKT/CRC"]}]},
    {name:"ASSEMBLEIA/ENTREGA",actions:[{name:"EDITAL CONVOCAÇÃO ASSEMBLEIA",resps:["JURIDICO"]},{name:"DISPARO EDITAL",resps:["CRC"]},{name:"VIDEO EVOLUÇÃO DA OBRA",resps:["MKT"]},{name:"TEMPLATE E APRESENTAÇÃO ASSEMBLEIA",resps:["MKT"]},{name:"PREVISÃO ORÇAMENTARIA",resps:["CRC"]},{name:"ASSEMBLEIA",resps:["CRC/JURIDICO"]},{name:"ENTREGA DA DOCUMENTAÇÃO/PROJETOS QUE SERÁ FORNECIDA AO SÍNDICO",resps:["QUALIDADE"]},{name:"ENTREGA DAS NOTAS FISCAIS E INVENTÁRIO/TERMO DE RECEBIMENTO DO MOBILIÁRIO DA COMUM",resps:["DESENV. PRODUTO"]},{name:"TREINAMENTO SÍNDICO E ZELADOR (EMPRESAS QUE EXECUTARAM OS SERVIÇOS)",resps:["QUALIDADE/OBRA/CRC"]},{name:"INSTITUIÇÃO E AVERBAÇÃO DO CONDOMÍNIO",resps:["JURIDICO"]},{name:"DEFINIÇÃO E CONTRATAÇÃO ADMINISTRADORA",resps:["CRC/JURIDICO"]},{name:"PROJETO DE COMO SERÁ CORTINA DE VIDRO (COM DETALHAMENTO ALINHADO COM A OBRA)",resps:["DESENV. PRODUTO"]},{name:"ACOMPANHAR IMPLANTAÇÃO DE CRONOGRAMA DE MANUTENÇÕES",resps:["CRC/QUALIDADE"]}]},
    {name:"QUALIDADE",actions:[{name:"AREAS APRESENTAREM LIÇÕES APRENDIDAS",resps:[]}]}
  ]
};

/* ========= STATE ========= */
let db = load();
let currentCommitteeId = db.currentCommitteeId;
let currentView = 'dashboard';
let editingActionRef = null, editingBlockId = null, editingRespIdx = null;
let meetingBlockIndex = 0;
let aiState = null;
let filters = { committees:new Set(), resps:new Set(), statuses:new Set() };
let kpiFilter = null, commKpiFilter = null;
let tempResps = { ea: [], na: [] };
let newActionBid = null;
let dragCtx = null;
let projectView = 'list'; // 'list' | 'kanban'
let commHeaderExpanded = (uiPref('commHeaderExpanded')==='1');
let sbGroupsOpen = {
  active: uiPref('sbGroupActive')!=='0',
  done: uiPref('sbGroupDone')==='1',
  paused: uiPref('sbGroupPaused')==='1'
};
let dashTab = 'consolidated'; // 'consolidated' | 'compare' | 'production'
let dashPeriod = 0; // 0 = todos; N = últimos N dias

/* ========= DATA LOAD/SAVE ========= */
/* Normalização do HTML (campos antigos, Laguna). Hoje só roda no "Importar backup". */
function normalizeDb(d){
  if(!d.settings) d.settings={responsibles:[...DEFAULT_RESPS]};
  if(!d.settings.responsibles) d.settings.responsibles=[...DEFAULT_RESPS];
  if(!d.templates) d.templates=[];
  d.committees = d.committees || [];
  d.committees.forEach(c=>{
    if(!c.obraHistory) c.obraHistory=[];
    c.blocks = c.blocks || [];
    c.blocks.forEach(b=>{ b.actions = b.actions || []; b.actions.forEach(a=>{
      if(!a.resps){ a.resps = a.resp ? [a.resp] : [] }
      delete a.resp;
      if(a.milestone === undefined) a.milestone = false;
      if(a.status==='CONCLUIDO') a.status='CONCLUÍDO';
    })});
  });
  d.templates.forEach(t=>t.blocks.forEach(b=>b.actions.forEach(a=>{
    if(!a.resps){ a.resps = a.resp ? [a.resp] : [] }
  })));
  // MIGRAÇÃO 2026-09-29: enriquecer Casa Laguna com dados completos da planilha (114 ações),
  // sem duplicar atividades já existentes ou sobrescrever alterações do usuário
  if(!d._lagunaEnriched){
    const laguna = d.committees.find(c=>c.name && c.name.toUpperCase().includes('LAGUNA'));
    if(laguna){
      let addedB=0, addedA=0;
      MODELO_BASE.blocks.forEach(nb=>{
        let target = laguna.blocks.find(b=>b.name.trim().toUpperCase()===nb.name.trim().toUpperCase());
        if(!target){
          target = { id:'b_'+Math.random().toString(36).slice(2,10), name:nb.name, _open:false, actions:[] };
          laguna.blocks.push(target); addedB++;
        }
        nb.actions.forEach(na=>{
          const exists = target.actions.find(a=>a.name.trim().toUpperCase()===na.name.trim().toUpperCase());
          if(exists) return;
          target.actions.push({
            id:'a_'+Math.random().toString(36).slice(2,10),
            name:na.name, resps:[...(na.resps||[])],
            status:'NÃO INICIADO', start:null, end:null, actualEnd:null,
            obs:'', milestone:false,
            history:[{when:new Date().toISOString(),event:'CRIADO',note:'Importada da planilha Casa Laguna',user:(d.settings.userName&&d.settings.userName!=='Usuário'?d.settings.userName:db.settings.userName)||'Sistema'}],
            notes:[], attachments:[]
          });
          addedA++;
        });
      });
      console.log(`[Migração Laguna] +${addedB} blocos, +${addedA} atividades`);
      // Garante áreas usadas
      const usedResps = new Set();
      MODELO_BASE.blocks.forEach(b=>b.actions.forEach(a=>(a.resps||[]).forEach(r=>usedResps.add(r))));
      usedResps.forEach(r=>{ if(!d.settings.responsibles.includes(r)) d.settings.responsibles.push(r); });
      d.settings.responsibles.sort();
    }
    d._lagunaEnriched = true;
  }
  return d;
}
/* Preferências de tela que o HTML guardava junto dos dados ficam no navegador de cada usuário. */
function uiPref(key, val){
  try{
    if(val===undefined) return localStorage.getItem('crcEnt.'+key);
    localStorage.setItem('crcEnt.'+key, val);
  }catch(e){ return null }
}
function applyUiPrefs(d){
  let open = {};
  try{ open = JSON.parse(uiPref('blocosAbertos')||'{}') }catch(e){}
  d.committees.forEach(c=>c.blocks.forEach(b=>{ b._open = !!open[b.id] }));
  const cur = uiPref('projetoAtual');
  d.currentCommitteeId = d.committees.some(c=>c.id===cur) ? cur : (d.committees[0] ? d.committees[0].id : null);
  return d;
}
/* Dados do banco (crcStore.ts → window.__crcBridge). */
function load(){ return applyUiPrefs(crcBridge.boot()); }
function save(){
  db.currentCommitteeId=currentCommitteeId;
  if(currentCommitteeId) uiPref('projetoAtual', currentCommitteeId);
  const open = {};
  db.committees.forEach(c=>c.blocks.forEach(b=>{ if(b._open) open[b.id]=1 }));
  uiPref('blocosAbertos', JSON.stringify(open));
  crcBridge.save(db);
}
/* Recarga vinda do banco (outro usuário alterou, ou a gravação falhou e voltou ao estado salvo). */
function crcApplyServerDb(d){
  db = applyUiPrefs(d);
  if(!db.committees.some(c=>c.id===currentCommitteeId)) currentCommitteeId = db.currentCommitteeId;
  renderAll();
  if(editingActionRef && document.getElementById('modalEditAction').classList.contains('show')){
    const c=currentCommittee(), b=c&&c.blocks.find(x=>x.id===editingActionRef.bid), a=b&&b.actions.find(x=>x.id===editingActionRef.aid);
    if(a){ updateQuickButtons(a); renderHistory(a) }
  }
}
function uid(p='id'){ return p+'_'+Math.random().toString(36).slice(2,10) }
function committeeFromTemplate(tpl,name,delivery,start,companyId){
  return { id:uid('c'),companyId:companyId||null,name,delivery,start,units:null,obraHistory:[],
    blocks: tpl.blocks.map(b=>({
      id:uid('b'),name:b.name,
      actions:b.actions.map(a=>({id:uid('a'),name:a.name,resps: a.resps ? [...a.resps] : (a.resp?[a.resp]:[]),status:'NÃO INICIADO',start:null,end:null,actualEnd:null,obs:'',milestone:false,history:[],notes:[]}))
    }))
  };
}
function currentCommittee(){ return db.committees.find(c=>c.id===currentCommitteeId) || db.committees[0]; }

/* ========= HELPERS ========= */
function actionResps(a){ return a.resps && a.resps.length ? a.resps : (a.resp ? [a.resp] : []); }
function actionRespsStr(a){ const r=actionResps(a); return r.length?r.join(' + '):'—'; }
function actionRespsHtml(a){ const r=actionResps(a); return r.length? avatarsStackHtml(r, 3) : '<span class="muted" style="font-size:11px">—</span>'; }
function actionHasResp(a,resp){ return actionResps(a).includes(resp); }
function today(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') } // data local
function daysBetween(a,b){ if(!a||!b) return null; return Math.round((new Date(b)-new Date(a))/86400000) }
function fmt(d){ if(!d) return '—'; const [y,m,dd]=d.split('-'); return `${dd}/${m}/${y}` }
function actionSituation(a){
  const done = a.status==='CONCLUÍDO'||a.status==='CONCLUIDO';
  if(done){
    if(a.actualEnd && a.end && a.actualEnd > a.end){
      const late = daysBetween(a.end, a.actualEnd);
      return {label:`CONCLUÍDO +${late}d`, cls:'late', doneLate:true, lateDays:late};
    }
    return {label:'CONCLUÍDO', cls:'ok', doneOnTime:true};
  }
  if(a.status==='NÃO SE APLICA') return {label:'N/A',cls:'neutral'};
  if(!a.end) return {label:'SEM PRAZO',cls:'neutral'};
  const d = daysBetween(today(),a.end);
  if(d<0) return {label:`ATRASO ${Math.abs(d)}d`, cls:'danger', delayed:true, delayDays:Math.abs(d)};
  if(d<=7) return {label:`${d}d`, cls:'warn', dueDays:d};
  return {label:`${d}d`, cls:'ok', dueDays:d};
}
function blockProgress(b){
  const total=b.actions.filter(a=>a.status!=='NÃO SE APLICA').length;
  if(!total) return {pct:0,done:0,total:0,delayed:0};
  const done=b.actions.filter(a=>a.status==='CONCLUÍDO'||a.status==='CONCLUIDO').length;
  const delayed=b.actions.filter(a=>actionSituation(a).cls==='danger').length;
  return {pct:Math.round(done/total*100),done,total,delayed};
}
function currentObraPct(c){ if(!c.obraHistory||!c.obraHistory.length) return null; return c.obraHistory[c.obraHistory.length-1].pct; }
function statusBadgeCls(status){
  if(status==='CONCLUÍDO'||status==='CONCLUIDO') return 'ok';
  if(status==='EM ANDAMENTO') return 'primary';
  return 'neutral';
}
function truncateStr(str,n){ return str.length>n ? str.slice(0,n-1)+'…' : str }
/* ========= HELPERS ========= */
/* CRM: avatar por área — cor determinística baseada no nome */
const AVATAR_PALETTE = ['#7c3aed','#2563eb','#0891b2','#059669','#ca8a04','#DC2626','#db2777','#4f46e5','#0d9488','#ea580c','#65a30d','#0284c7','#9333ea','#c026d3','#1F7A5C'];
function respColor(name){
  if(!name) return '#94A3B8';
  let h=0; for(let i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function respInitials(name){
  if(!name) return '?';
  const clean = name.replace(/[^\wÀ-ú/ ]/g,'').trim();
  const parts = clean.split(/[\s/]+/).filter(Boolean);
  if(!parts.length) return '?';
  if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
}
function avatarHtml(name, size){
  const cls = size==='sm'?'avatar sm':size==='lg'?'avatar lg':'avatar';
  return `<span class="${cls}" style="background:${respColor(name)}" title="${esc(name)}">${respInitials(name)}</span>`;
}
function avatarsStackHtml(names, max){
  max = max||3;
  const list = names.slice(0,max);
  const rest = names.length - list.length;
  return `<span class="avatars-stack">${list.map(n=>avatarHtml(n,'sm')).join('')}${rest>0?`<span class="avatars-more" title="${esc(names.slice(max).join(', '))}">+${rest}</span>`:''}</span>`;
}

function esc(s){ return (s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;') }

/* Registra evento no histórico da ação, sempre com usuário e timestamp */
function pushHistory(a, event, note){
  a.history = a.history || [];
  a.history.push({
    when: new Date().toISOString(),
    event,
    note: note || '',
    user: (db.settings && db.settings.userName) || 'Usuário'
  });
}
function saveUserName(v){
  db.settings.userName = (v||'').trim() || 'Usuário';
  save();
}

/* ========= SIDEBAR ========= */
function toggleSidebar(){
  const collapsed = crcRoot.classList.toggle('sb-collapsed');
  uiPref('sbCollapsed', collapsed?'1':'0');
  document.getElementById('sbToggleIcon').textContent = collapsed ? '▶' : '◀';
  const toggle = document.querySelector('.sb-toggle');
  if(toggle) toggle.setAttribute('data-label', collapsed ? 'Expandir menu' : 'Recolher menu');
}
(function initSidebar(){
  if(uiPref('sbCollapsed')==='1'){
    crcRoot.classList.add('sb-collapsed');
    const icon=document.getElementById('sbToggleIcon'); if(icon) icon.textContent='▶';
    const toggle=document.querySelector('.sb-toggle'); if(toggle) toggle.setAttribute('data-label','Expandir menu');
  }
})();

/* ========= NAV ========= */
function renderCommitteeSelect(){
  const sel=document.getElementById('committeeSelect');
  sel.innerHTML=db.committees.map(c=>`<option value="${c.id}" ${c.id===currentCommitteeId?'selected':''}>${c.name} · entrega ${fmt(c.delivery)}</option>`).join('');
  renderSidebarProjects();
}
function renderSidebarProjects(){
  const el = document.getElementById('sbProjectsGroups');
  if(!el) return;
  const active = db.committees.filter(c=>!c.completed && !c.paused);
  const paused = db.committees.filter(c=>c.paused && !c.completed);
  const done = db.committees.filter(c=>c.completed);
  const subitem = (c)=>{
    const isCur = c.id===currentCommitteeId && currentView==='project';
    const st = projectQuickStats(c);
    return `<button class="sb-subitem ${isCur?'active':''} ${c.completed?'done':''} ${c.paused?'paused':''}" onclick="pickCommittee('${c.id}')" title="${esc(c.name)} · ${esc(empresaNome(c.companyId))} · ${st.pct}% · ${st.delayed} atraso(s)">
      <span class="sb-sub-dot"></span>
      <span class="sb-subitem-name">${esc(c.name)}</span>
      <span class="sb-subitem-meta">${c.completed?'✓':c.paused?'⏸':st.pct+'%'}</span>
    </button>`;
  };
  el.innerHTML = `
    <div class="sb-group ${sbGroupsOpen.active?'open':''}">
      <button class="sb-group-head" onclick="toggleSbGroup('active')">
        <span class="sb-group-chevron">▶</span>
        <span>Em andamento</span>
        <span class="sb-group-count">${active.length}</span>
      </button>
      <div class="sb-group-body">
        ${active.length ? active.map(subitem).join('') : '<div class="sb-empty-sub">Nenhum projeto ativo</div>'}
      </div>
    </div>
    <div class="sb-group ${sbGroupsOpen.paused?'open':''}">
      <button class="sb-group-head" onclick="toggleSbGroup('paused')">
        <span class="sb-group-chevron">▶</span>
        <span>Suspensos</span>
        <span class="sb-group-count">${paused.length}</span>
      </button>
      <div class="sb-group-body">
        ${paused.length ? paused.map(subitem).join('') : '<div class="sb-empty-sub">Nenhum suspenso</div>'}
      </div>
    </div>
    <div class="sb-group ${sbGroupsOpen.done?'open':''}">
      <button class="sb-group-head" onclick="toggleSbGroup('done')">
        <span class="sb-group-chevron">▶</span>
        <span>Concluídos</span>
        <span class="sb-group-count">${done.length}</span>
      </button>
      <div class="sb-group-body">
        ${done.length ? done.map(subitem).join('') : '<div class="sb-empty-sub">Nenhum concluído ainda</div>'}
      </div>
    </div>`;
}
function projectQuickStats(c){
  let t=0,d=0,dly=0;
  c.blocks.forEach(b=>b.actions.forEach(a=>{
    if(a.status==='NÃO SE APLICA') return;
    t++; if(a.status==='CONCLUÍDO'||a.status==='CONCLUIDO') d++;
    if(actionSituation(a).cls==='danger') dly++;
  }));
  return {t,d,dly,delayed:dly,pct:t?Math.round(d/t*100):0};
}
function toggleSbSection(k){
  const el = crcRoot.querySelector('.sb-section[data-sec="'+k+'"]');
  if(!el) return;
  const closed = el.classList.toggle('closed');
  uiPref('sbSec'+k, closed?'0':'1');
}
(function initSbSections(){
  crcRoot.querySelectorAll('.sb-section[data-sec]').forEach(el=>{
    if(uiPref('sbSec'+el.dataset.sec)==='0') el.classList.add('closed');
  });
})();
function toggleSbGroup(g){
  sbGroupsOpen[g] = !sbGroupsOpen[g];
  const key = 'sbGroup'+g.charAt(0).toUpperCase()+g.slice(1);
  uiPref(key, sbGroupsOpen[g]?'1':'0');
  renderSidebarProjects();
}
function pickCommittee(id){
  currentCommitteeId = id;
  save();
  switchView('project');
}
function switchCommittee(id){ currentCommitteeId=id; save(); renderAll() }
function switchView(v){
  currentView=v;
  document.querySelectorAll('.sb-item').forEach(t=>t.classList.toggle('active',t.dataset.view===v));
  ['dashboard','project','calendar','responsible','meeting','ai','templates','settings'].forEach(x=>{
    document.getElementById('view-'+x).classList.toggle('hidden',x!==v);
  });
  if(v==='calendar'){
    // sincroniza botões do view-toggle
    ['Month','Week','Agenda'].forEach(k=>{
      const el = document.getElementById('cv'+k);
      if(el) el.classList.toggle('active', calView===k.toLowerCase());
    });
  }
  if(window.innerWidth<960) document.getElementById('sidebar').classList.remove('mobile-open');
  renderAll();
}

/* ========= CHIP SELECT ========= */
function addRespChip(kind){
  const selEl = document.getElementById(kind+'RespAdd');
  const val = selEl.value; if(!val) return;
  if(!tempResps[kind].includes(val)) tempResps[kind].push(val);
  renderChipSelect(kind);
}
function removeRespChip(kind,val){
  tempResps[kind] = tempResps[kind].filter(x=>x!==val);
  renderChipSelect(kind);
}
function renderChipSelect(kind){
  const chipsEl = document.getElementById(kind+'RespsChips');
  const selEl = document.getElementById(kind+'RespAdd');
  chipsEl.innerHTML = tempResps[kind].length ? tempResps[kind].map(r=>`<span class="chip-select-chip">${r}<button onclick="removeRespChip('${kind}','${r}')" type="button">×</button></span>`).join('') : '<span class="muted">Nenhum responsável — adicione abaixo</span>';
  const avail = db.settings.responsibles.filter(r=>!tempResps[kind].includes(r));
  selEl.innerHTML = '<option value="">Selecione...</option>'+avail.map(r=>`<option>${r}</option>`).join('');
}

/* ========= DASHBOARD ========= */
function filterUniverse(cat){
  if(cat==='committees') return db.committees.map(c=>c.id);
  if(cat==='resps') return [...new Set(db.committees.flatMap(c=>c.blocks.flatMap(b=>b.actions.flatMap(a=>actionResps(a)))))].sort();
  return ['NÃO INICIADO','EM ANDAMENTO','CONCLUÍDO','NÃO SE APLICA'];
}
function initFilters(){
  // Na 1ª execução, marca tudo. Também garante que novos itens (ex: nova área usada) entrem já marcados.
  ['committees','resps','statuses'].forEach(cat=>{
    const uni = filterUniverse(cat);
    if(!filters['_init_'+cat]){
      uni.forEach(x=>filters[cat].add(x));
      filters['_init_'+cat] = true;
    } else {
      // adiciona novos itens que ainda não foram vistos
      uni.forEach(x=>{ if(!filters['_seen_'+cat] || !filters['_seen_'+cat].has(x)) filters[cat].add(x); });
    }
    filters['_seen_'+cat] = new Set(uni);
  });

  const bar = document.getElementById('chipFilterBar');
  if(!bar) return;

  const commIds = db.committees.map(c=>c.id);
  const commsSelected = commIds.filter(x=>filters.committees.has(x)).length;
  const allResps = filterUniverse('resps');
  const respsSelected = allResps.filter(x=>filters.resps.has(x)).length;
  const statuses = filterUniverse('statuses');

  bar.innerHTML = `
    <span class="chip-filter-label">Projetos</span>
    <button class="chip-filter ${commsSelected===commIds.length?'active':''}" onclick="filterAll('committees')">Todos <span class="count">${commIds.length}</span></button>
    <button class="chip-filter" onclick="filterNone('committees')">Nenhum</button>
    ${commIds.map(id=>{const c=db.committees.find(x=>x.id===id); return `<button class="chip-filter ${filters.committees.has(id)?'active':''}" onclick="toggleFilter('committees','${id}',${!filters.committees.has(id)})">${esc(c.name)}</button>`}).join('')}
    <span class="chip-filter-sep"></span>
    <span class="chip-filter-label">Áreas</span>
    <button class="chip-filter ${respsSelected===allResps.length?'active':''}" onclick="filterAll('resps')">Todas <span class="count">${allResps.length}</span></button>
    <button class="chip-filter" onclick="filterNone('resps')">Nenhuma</button>
    ${allResps.slice(0,10).map(r=>`<button class="chip-filter ${filters.resps.has(r)?'active':''}" onclick="toggleFilter('resps','${r.replace(/'/g,"\\'")}',${!filters.resps.has(r)})">${avatarHtml(r,'sm')} ${esc(r)}</button>`).join('')}
    ${allResps.length>10?`<span class="muted" style="font-size:11px;padding:0 4px">+${allResps.length-10} áreas</span>`:''}
    <span class="chip-filter-sep"></span>
    <span class="chip-filter-label">Status</span>
    ${statuses.map(s=>`<button class="chip-filter ${filters.statuses.has(s)?'active':''}" onclick="toggleFilter('statuses','${s}',${!filters.statuses.has(s)})">${esc(s)}</button>`).join('')}
    <span class="chip-filter-sep"></span>
    <button class="chip-filter" onclick="clearFilters()" style="color:var(--text-2)">↻ Reset</button>
  `;
}
function toggleFilter(cat,val,checked){
  if(checked) filters[cat].add(val); else filters[cat].delete(val);
  renderDashboard();
}
function filterAll(cat){ filterUniverse(cat).forEach(x=>filters[cat].add(x)); renderDashboard(); }
function filterNone(cat){ filters[cat].clear(); renderDashboard(); }
function clearFilters(){
  filters={committees:new Set(),resps:new Set(),statuses:new Set()};
  kpiFilter=null;
  initFilters(); renderDashboard();
}
function setDashKpi(k){ kpiFilter = (kpiFilter===k?null:k); renderDashboard() }

function filteredActions(){
  const list=[];
  db.committees.forEach(c=>{
    if(!filters.committees.has(c.id)) return;
    c.blocks.forEach(b=>b.actions.forEach(a=>{
      const resps = actionResps(a);
      // se a ação não tem responsável cadastrado, ela só aparece se pelo menos alguma área estiver marcada (evita "sumir tudo")
      const respOk = resps.length ? resps.some(r=>filters.resps.has(r)) : filters.resps.size>0;
      if(!respOk) return;
      if(!filters.statuses.has(a.status)) return;
      list.push({c,b,a});
    }));
  });
  return list;
}

function renderDashboard(){
  initFilters();
  const list=filteredActions();
  const active = list.filter(x=>x.a.status!=='NÃO SE APLICA');
  const done = active.filter(x=>x.a.status==='CONCLUÍDO'||x.a.status==='CONCLUIDO').length;
  const inProgress = active.filter(x=>x.a.status==='EM ANDAMENTO').length;
  const notStarted = active.filter(x=>x.a.status==='NÃO INICIADO').length;
  const delayed = active.filter(x=>actionSituation(x.a).cls==='danger').length;
  const soon = active.filter(x=>actionSituation(x.a).cls==='warn').length;
  const doneLate = active.filter(x=>actionSituation(x.a).doneLate).length;
  const doneOnTime = done - doneLate;
  const pct = active.length?Math.round(done/active.length*100):0;

  // Pipeline: fluxo de conclusão (status). "Em atraso" e "≤7d" ficam nos KPIs, pois são dimensão de PRAZO — não de STATUS.
  const total = active.length;
  const pctOf = v => total ? Math.round(v/total*100) : 0;
  const seg = (cls, val, lbl)=> val>0 ? `<div class="pipeline-seg ${cls}" style="flex:${val}" title="${lbl}: ${val} (${pctOf(val)}%)">${val>=Math.max(3, total*0.04)?val:''}</div>` : '';
  const legendItem = (color, cls, val, lbl)=> `<div class="item" title="${lbl}"><span class="dot" style="background:${color}"></span><span class="lbl">${lbl}</span><span class="val">${val}</span><span class="pct">${pctOf(val)}%</span></div>`;

  const pipelineHtml = total ? `
    <div class="pipeline-card">
      <div class="pipeline-title">
        <h3>📊 Distribuição por status</h3>
        <div class="total"><b>${total}</b> ações ativas</div>
      </div>
      <div class="pipeline-strip">
        ${seg('notstarted', notStarted, 'Não iniciado')}
        ${seg('progress', inProgress, 'Em andamento')}
        ${seg('done', doneOnTime, 'Concluído no prazo')}
        ${seg('late', doneLate, 'Concluído com atraso')}
      </div>
      <div class="pipeline-legend">
        ${legendItem('#94A3B8','notstarted', notStarted, 'Não iniciado')}
        ${legendItem('#3B82F6','progress', inProgress, 'Em andamento')}
        ${legendItem('#43B997','done', doneOnTime, 'Concluído no prazo')}
        ${legendItem('#facc15','late', doneLate, 'Concluído com atraso')}
      </div>
    </div>` : '';

  document.getElementById('dashPipeline').innerHTML = pipelineHtml;

  document.getElementById('dashKpis').innerHTML = `
    <div class="kpi clickable primary ${kpiFilter==='all'?'active':''}" onclick="setDashKpi('all')"><div class="kpi-label">Ações no filtro</div><div class="kpi-value">${total}</div><div class="kpi-sub">${done} concluídas</div></div>
    <div class="kpi clickable ${kpiFilter==='done'?'active':''} ${pct>=70?'ok':pct>=40?'warn':'danger'}" onclick="setDashKpi('done')"><div class="kpi-label">Conclusão</div><div class="kpi-value">${pct}%</div><div class="kpi-sub">clique p/ ver concluídas</div></div>
    <div class="kpi clickable ${kpiFilter==='delayed'?'active':''} ${delayed?'danger':'ok'}" onclick="setDashKpi('delayed')"><div class="kpi-label">Em atraso</div><div class="kpi-value">${delayed}</div><div class="kpi-sub">${delayed?'ativas c/ prazo vencido':'nenhuma vencida'}</div></div>
    <div class="kpi clickable ${kpiFilter==='soon'?'active':''} warn" onclick="setDashKpi('soon')"><div class="kpi-label">Vencem em ≤7 dias</div><div class="kpi-value">${soon}</div><div class="kpi-sub">${soon?'próximas do prazo':'sem urgências'}</div></div>`;

  renderMonthlyChart(list);

  let drillList=null;
  if(kpiFilter==='delayed') drillList = active.filter(x=>actionSituation(x.a).cls==='danger');
  else if(kpiFilter==='soon') drillList = active.filter(x=>actionSituation(x.a).cls==='warn');
  else if(kpiFilter==='done') drillList = active.filter(x=>x.a.status==='CONCLUÍDO'||x.a.status==='CONCLUIDO');
  else if(kpiFilter==='all') drillList = active;
  const drillEl = document.getElementById('dashDrill');
  if(drillList){
    drillEl.innerHTML = `<div class="card"><div class="card-head"><h3>📋 Detalhamento (${drillList.length})</h3><button class="btn ghost sm" onclick="setDashKpi(null)">✕ Fechar</button></div><div class="dash-list">${drillList.map(x=>{
      const s=actionSituation(x.a);
      return `<div class="dash-list-item">
        <span class="badge ${s.cls}">${s.label}</span>
        <div class="d-info"><div class="d-name" data-obs="${esc(x.a.obs)}" data-actname="${esc(x.a.name)}" data-status="${x.a.status}" data-end="${x.a.end||''}">${x.a.name}</div><div class="d-meta">${x.c.name} · ${x.b.name} · ${actionRespsStr(x.a)} · prazo ${fmt(x.a.end)}</div></div>
        <button class="btn xs" onclick="quickJumpEdit('${x.c.id}','${x.b.id}','${x.a.id}')">✏️ Editar</button>
      </div>`;
    }).join('') || '<div class="muted" style="padding:14px">Nenhuma ação neste critério</div>'}</div></div>`;
  } else drillEl.innerHTML='';

  const delays=list.filter(x=>actionSituation(x.a).cls==='danger').map(x=>({...x,d:daysBetween(x.a.end,today())}));
  delays.sort((x,y)=>y.d-x.d);
  document.getElementById('dashDelays').innerHTML = delays.length? delays.slice(0,8).map(x=>`
    <div class="dash-list-item">
      <span class="badge danger">${x.d}d</span>
      <div class="d-info"><div class="d-name" data-obs="${esc(x.a.obs)}" data-actname="${esc(x.a.name)}" data-status="${x.a.status}" data-end="${x.a.end||''}">${x.a.name}</div><div class="d-meta">${x.c.name} · ${x.b.name} · ${actionRespsStr(x.a)}</div></div>
      <button class="btn xs" onclick="quickJumpEdit('${x.c.id}','${x.b.id}','${x.a.id}')">✏️ Editar</button>
    </div>`).join('') : '<div class="muted" style="padding:14px">Nenhum atraso 🎉</div>';

  const upcoming=list.filter(x=>{
    if(!x.a.end||x.a.status==='CONCLUÍDO'||x.a.status==='NÃO SE APLICA') return false;
    const d=daysBetween(today(),x.a.end); return d>=0 && d<=15;
  }).map(x=>({...x,d:daysBetween(today(),x.a.end)}));
  upcoming.sort((a,b)=>a.d-b.d);
  document.getElementById('dashUpcoming').innerHTML = upcoming.length? upcoming.slice(0,8).map(x=>`
    <div class="dash-list-item">
      <span class="badge ${x.d<=7?'warn':'primary'}">${x.d}d</span>
      <div class="d-info"><div class="d-name" data-obs="${esc(x.a.obs)}" data-actname="${esc(x.a.name)}" data-status="${x.a.status}" data-end="${x.a.end||''}">${x.a.name}</div><div class="d-meta">${x.c.name} · ${actionRespsStr(x.a)} · ${fmt(x.a.end)}</div></div>
      <button class="btn xs" onclick="quickJumpEdit('${x.c.id}','${x.b.id}','${x.a.id}')">✏️ Editar</button>
    </div>`).join('') : '<div class="muted" style="padding:14px">Nada nos próximos 15 dias</div>';

  const cs = db.committees.filter(c=>!filters.committees.size||filters.committees.has(c.id));
  document.getElementById('obraProgressList').innerHTML = cs.map(c=>{
    const p=currentObraPct(c);
    const last=c.obraHistory&&c.obraHistory.length?c.obraHistory[c.obraHistory.length-1]:null;
    return `<div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div><b>${c.name}</b> <span class="muted">· entrega ${fmt(c.delivery)}</span></div>
        <div><b style="font-size:15px">${p!=null?p+'%':'—'}</b> ${last?`<span class="muted">em ${fmt(last.date)}</span>`:''}</div>
      </div>
      <div class="progress-obra"><div class="progress-obra-fill" style="width:${p||0}%"></div></div>
    </div>`;
  }).join('') || '<div class="muted">Nenhum projeto no filtro</div>';

  renderTimeline();
}
function quickJumpEdit(cid,bid,aid){ currentCommitteeId=cid; save(); editAction(bid,aid); }

function renderMonthlyChart(list){
  const now=new Date();
  const months=[];
  for(let i=11;i>=0;i--){
    const dt=new Date(now.getFullYear(),now.getMonth()-i,1);
    months.push({y:dt.getFullYear(),m:dt.getMonth(),label:dt.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'})});
  }
  const data=months.map(m=>{
    const doneInMonth=list.filter(x=>{
      const end=x.a.actualEnd||((x.a.status==='CONCLUÍDO'||x.a.status==='CONCLUIDO')?x.a.end:null);
      if(!end) return false;
      const d=new Date(end);
      return d.getFullYear()===m.y && d.getMonth()===m.m;
    }).length;
    return {label:m.label,value:doneInMonth};
  });
  const max = Math.max(1,...data.map(d=>d.value));
  const w=880, h=240, padL=44, padB=34, padT=14, padR=14;
  const chartW=w-padL-padR, chartH=h-padT-padB;
  const barW = chartW/data.length*0.72;
  const gap = chartW/data.length*0.28;
  let bars='';
  data.forEach((d,i)=>{
    const x=padL+i*(barW+gap)+gap/2;
    const barH = d.value/max*chartH;
    const y = padT+chartH-barH;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="#43B997" opacity="${d.value?0.92:0.15}"></rect>`;
    if(d.value) bars += `<text x="${x+barW/2}" y="${y-6}" text-anchor="middle" font-size="11" fill="#111827" font-weight="700">${d.value}</text>`;
    bars += `<text x="${x+barW/2}" y="${h-10}" text-anchor="middle" font-size="10" fill="#64748B">${d.label}</text>`;
  });
  let grid='';
  for(let i=0;i<=4;i++){
    const y=padT+chartH-(chartH*i/4);
    const val=Math.round(max*i/4);
    grid+=`<line x1="${padL}" y1="${y}" x2="${w-padR}" y2="${y}" stroke="#EEEEF1"></line>`;
    grid+=`<text x="${padL-8}" y="${y+4}" text-anchor="end" font-size="10" fill="#94A3B8">${val}</text>`;
  }
  document.getElementById('chartWrap').innerHTML = `<svg viewBox="0 0 ${w} ${h}" class="chart-svg" preserveAspectRatio="xMidYMid meet">${grid}${bars}</svg>
    <div class="muted" style="text-align:center;margin-top:6px">Ações concluídas por mês (baseado na data real de conclusão)</div>`;
}

function renderTimeline(){
  const c=currentCommittee();
  document.getElementById('timelineTitle').textContent = c ? c.name : '—';
  const el=document.getElementById('timelineWrap');
  if(!c){ el.innerHTML=''; return }
  const milestones = c.blocks.flatMap(b=>b.actions.filter(a=>a.milestone).map(a=>({b,a})));
  if(!milestones.length){
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🎯</div>
      <h3>Nenhum marco selecionado</h3>
      <p>Vá em <b>Projeto</b>, clique no ⭐ das atividades-chave que devem aparecer aqui.</p>
    </div>`;
    return;
  }
  const dated = milestones.filter(x=>x.a.end).sort((x,y)=>x.a.end.localeCompare(y.a.end));
  const undated = milestones.filter(x=>!x.a.end);
  if(!dated.length){
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>Marcos sem data prevista</h3><p>${milestones.length} marco(s) selecionado(s), mas nenhum tem data de término.</p></div>`;
    return;
  }
  const now=new Date();
  const dates=dated.map(x=>new Date(x.a.end));
  let minD=new Date(Math.min(now, ...dates));
  let maxD=new Date(Math.max(...dates, c.delivery?new Date(c.delivery):now));
  minD.setDate(minD.getDate()-15);
  maxD.setDate(maxD.getDate()+15);
  const totalMs=maxD-minD;
  const monthsSpan=(maxD.getFullYear()-minD.getFullYear())*12 + maxD.getMonth()-minD.getMonth() + 1;

  const MAX_NAME = 26;
  const CHAR_W = 6.2; // px por caractere (font-size 11)
  const LABEL_PAD = 10; // margem entre labels
  const LEVEL_H = 34; // altura de cada nível de rótulos
  const BASE_TOP = 40; // espaço reservado para os selos HOJE / ENTREGA
  const BASE_BOTTOM = 32; // espaço para os nomes dos meses

  const w=Math.max(960, monthsSpan*110);

  // --- Prepara os marcos com posição X e largura estimada do rótulo ---
  const items = dated.map(m=>{
    const d = new Date(m.a.end);
    const x = ((d-minD)/totalMs)*w;
    const s = actionSituation(m.a);
    const color = s.doneLate ? '#facc15'
                : (m.a.status==='CONCLUÍDO'||m.a.status==='CONCLUIDO') ? '#43B997'
                : s.cls==='danger' ? '#EF4444'
                : s.cls==='warn' ? '#F59E0B'
                : '#3B82F6';
    const name = truncateStr(m.a.name, MAX_NAME);
    const dateStr = fmt(m.a.end);
    // Largura = max entre nome truncado e a data
    const w1 = name.length * CHAR_W;
    const w2 = dateStr.length * CHAR_W;
    const halfW = Math.max(w1, w2) / 2 + LABEL_PAD/2;
    return { m, x, color, name, dateStr, halfW };
  });

  // --- Distribui em níveis alternando acima/abaixo, empilhando quando colide ---
  // side: 'above' | 'below'. level: 0, 1, 2...
  const placed = [];
  items.forEach((it, i)=>{
    // Alterna lado inicial para distribuir
    let side = i % 2 === 0 ? 'above' : 'below';
    let level = 0;
    // Tenta encontrar um slot livre
    // Verifica colisão contra placed com mesmo side + level
    const collides = (sd, lv)=>{
      return placed.some(p=>p.side===sd && p.level===lv
        && Math.abs(p.x - it.x) < (p.halfW + it.halfW));
    };
    // Tenta 6 níveis; se não achar, joga no lado oposto
    let found = false;
    for(let attempt=0; attempt<12; attempt++){
      if(!collides(side, level)){ found = true; break }
      // Alterna lado
      if(side==='above'){ side='below'; }
      else { side='above'; level++; } // sobe o nível depois de tentar ambos
    }
    if(!found) level = 5; // fallback
    it.side = side;
    it.level = level;
    placed.push(it);
  });

  const maxLevelAbove = Math.max(0, ...placed.filter(p=>p.side==='above').map(p=>p.level));
  const maxLevelBelow = Math.max(0, ...placed.filter(p=>p.side==='below').map(p=>p.level));
  const topSpace = BASE_TOP + (maxLevelAbove+1) * LEVEL_H;
  const bottomSpace = BASE_BOTTOM + (maxLevelBelow+1) * LEVEL_H;
  const midY = topSpace;
  const h = topSpace + bottomSpace;

  let grid='';
  const monthCursor=new Date(minD.getFullYear(),minD.getMonth(),1);
  while(monthCursor<=maxD){
    const x=((monthCursor-minD)/totalMs)*w;
    grid+=`<line x1="${x}" y1="${BASE_TOP-8}" x2="${x}" y2="${h-BASE_BOTTOM+8}" stroke="#EEEEF1"/>`;
    grid+=`<text x="${x+4}" y="${h-4}" font-size="10" fill="#64748B">${monthCursor.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'})}</text>`;
    monthCursor.setMonth(monthCursor.getMonth()+1);
  }
  grid+=`<line x1="0" y1="${midY}" x2="${w}" y2="${midY}" stroke="#94A3B8" stroke-width="2"/>`;
  const nowX=((now-minD)/totalMs)*w;
  grid+=`<line x1="${nowX}" y1="${BASE_TOP-8}" x2="${nowX}" y2="${h-BASE_BOTTOM+8}" stroke="#EF4444" stroke-dasharray="5,4" stroke-width="2"/>`;
  grid+=`<rect x="${nowX-19}" y="14" width="42" height="15" rx="3" fill="#EF4444"/>`;
  grid+=`<text x="${nowX+2}" y="25" font-size="10" fill="#fff" font-weight="700" text-anchor="middle">HOJE</text>`;
  if(c.delivery){
    const delX=((new Date(c.delivery)-minD)/totalMs)*w;
    grid+=`<line x1="${delX}" y1="${BASE_TOP-8}" x2="${delX}" y2="${h-BASE_BOTTOM+8}" stroke="#43B997" stroke-dasharray="5,4" stroke-width="2"/>`;
    grid+=`<rect x="${delX-34}" y="14" width="70" height="15" rx="3" fill="#43B997"/>`;
    grid+=`<text x="${delX+2}" y="25" font-size="10" fill="#fff" font-weight="700" text-anchor="middle">ENTREGA</text>`;
  }

  let marks='';
  placed.forEach(it=>{
    const {m, x, color, name, dateStr, side, level} = it;
    // Distância do centro até o rótulo (nome + data em 2 linhas)
    const offset = 20 + level*LEVEL_H;
    let labelY, dateY, lineY1, lineY2;
    if(side==='above'){
      lineY1 = midY - 8;
      lineY2 = midY - offset;
      labelY = lineY2 - 14;      // nome fica mais para cima
      dateY  = lineY2 - 2;       // data próxima da linha
    } else {
      lineY1 = midY + 8;
      lineY2 = midY + offset;
      labelY = lineY2 + 12;
      dateY  = lineY2 + 24;
    }
    marks+=`<g class="tl-mark" data-obs="${esc(m.a.obs)}" data-actname="${esc(m.a.name)}" data-status="${m.a.status}" data-end="${m.a.end}" onclick="editAction('${m.b.id}','${m.a.id}')">
      <line x1="${x}" y1="${lineY1}" x2="${x}" y2="${lineY2}" stroke="${color}" stroke-width="1.5"/>
      <circle cx="${x}" cy="${midY}" r="7" fill="${color}" stroke="#fff" stroke-width="2"/>
      <text x="${x}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="600" fill="#111827">${esc(name)}</text>
      <text x="${x}" y="${dateY}" text-anchor="middle" font-size="10" fill="#64748B">${dateStr}</text>
    </g>`;
  });

  el.innerHTML = `
    <div style="overflow-x:auto;padding:10px 0">
      <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="display:block">
        ${grid}${marks}
      </svg>
    </div>
    ${undated.length?`<div class="muted" style="padding:6px 20px">⚠ ${undated.length} marco(s) sem data prevista, não exibido(s): ${undated.map(x=>x.a.name).join(', ')}</div>`:''}
    <div class="tl-legend">
      <span><span class="dot" style="background:#43B997"></span>Concluído</span>
      <span><span class="dot" style="background:#EF4444"></span>Em atraso</span>
      <span><span class="dot" style="background:#F59E0B"></span>≤7 dias</span>
      <span><span class="dot" style="background:#3B82F6"></span>Planejado</span>
      <span style="margin-left:auto">💡 Clique num marco para abrir a ação</span>
    </div>`;
}

/* ========= PROJECT ========= */
function renderCommittee(){
  const c=currentCommittee(); if(!c) return;
  const st = (()=>{ let t=0,d=0,dly=0,soon=0;
    c.blocks.forEach(b=>b.actions.forEach(a=>{
      if(a.status==='NÃO SE APLICA') return;
      t++; if(a.status==='CONCLUÍDO'||a.status==='CONCLUIDO') d++;
      const s=actionSituation(a); if(s.cls==='danger') dly++; if(s.cls==='warn') soon++;
    }));
    return {t,d,dly,soon,pct:t?Math.round(d/t*100):0};
  })();
  const daysToDelivery = daysBetween(today(),c.delivery);
  const obraPct = currentObraPct(c);

  const dColor = daysToDelivery<0?'danger':daysToDelivery<90?'warn':'ok';
  const pctColor = st.pct>=70?'ok':st.pct>=40?'warn':'danger';
  document.getElementById('commHeaderBar').className = 'comm-header-bar' + (commHeaderExpanded?' expanded':'');
  document.getElementById('commHeaderBar').innerHTML=`
    <input class="comm-hb-name" value="${esc(c.name)}" onchange="updateCommName(this.value)" title="Nome do projeto">
    <span class="comm-hb-sep"></span>
    <div class="comm-hb-stat"><span class="l">Entrega</span><span class="v ${dColor}">${daysToDelivery!=null?daysToDelivery+'d':'—'}</span></div>
    <div class="comm-hb-stat"><span class="l">Data</span><span class="v" style="font-size:13px">${fmt(c.delivery)}</span></div>
    <span class="comm-hb-sep"></span>
    <div class="comm-hb-stat clickable ${commKpiFilter==='all'?'active':''}" onclick="setCommKpi('all')"><span class="l">Conclusão</span><span class="v ${pctColor}">${st.pct}%</span></div>
    <div class="comm-hb-stat clickable ${commKpiFilter==='delayed'?'active':''}" onclick="setCommKpi('delayed')"><span class="l">Atrasos</span><span class="v ${st.dly?'danger':'ok'}">${st.dly}</span></div>
    <div class="comm-hb-stat clickable ${commKpiFilter==='soon'?'active':''}" onclick="setCommKpi('soon')"><span class="l">≤7 dias</span><span class="v warn">${st.soon}</span></div>
    <span class="comm-hb-sep"></span>
    <div class="comm-hb-obra">
      <div class="l-row"><span>% Obra</span><span class="v">${obraPct!=null?obraPct+'%':'—'}</span></div>
      <div class="bar"><div style="width:${obraPct||0}%"></div></div>
    </div>
    <div class="comm-hb-actions">
      ${c.completed ? `<button class="btn warn sm" onclick="toggleCommCompleted()" title="Reabrir projeto">↩ Reabrir</button>` :
        c.paused ? `<button class="btn warn sm" onclick="toggleCommPaused()" title="Retomar projeto">▶ Retomar</button>` :
        `<button class="btn secondary sm" onclick="toggleCommCompleted()" title="Marcar como concluído">✓ Concluído</button>
         <button class="btn secondary sm" onclick="toggleCommPaused()" title="Suspender/paralisar projeto">⏸ Suspender</button>`}
      <button class="btn sm" onclick="openReportModal()">📄 Relatório</button>
      <button class="comm-hb-expand" onclick="toggleCommHeader()" title="${commHeaderExpanded?'Ocultar detalhes':'Mostrar mais'}">${commHeaderExpanded?'▲ Ocultar':'▼ Detalhes'}</button>
    </div>`;

  const expanded = document.getElementById('commHeaderExpanded');
  expanded.classList.toggle('show', commHeaderExpanded);
  expanded.innerHTML = commHeaderExpanded ? `
    <div class="meta-inline" style="margin-top:0">
      <div class="meta-item"><label>Data de entrega</label><input type="date" value="${c.delivery||''}" onchange="updateCommDate(this.value)"></div>
      <div class="meta-item"><label>Início do projeto</label><input type="date" value="${c.start||''}" onchange="updateCommStart(this.value)"></div>
      <div class="meta-item"><label>Unidades</label><input type="number" value="${c.units||''}" onchange="updateCommUnits(this.value)" style="width:80px"></div>
      <div class="meta-item"><label>Empresa (Sienge)</label><select id="commEmpresa" onchange="updateCommEmpresa(this.value)" style="padding:5px 9px;border:1px solid var(--border-strong);border-radius:var(--r);background:#fff;font-size:12.5px;max-width:320px"></select></div>
      <div style="margin-left:auto;display:flex;gap:6px">
        <button class="btn secondary sm" onclick="openObraUpdate()">🏗️ Atualizar % obra</button>
        <button class="btn danger sm" onclick="deleteCommittee()">🗑️ Excluir projeto</button>
      </div>
    </div>` : '';
  if(commHeaderExpanded) fillEmpresaSelect(document.getElementById('commEmpresa'), c.companyId);

  const allResps=[...new Set(c.blocks.flatMap(b=>b.actions.flatMap(a=>actionResps(a))))].sort();
  const respSel=document.getElementById('commRespFilter');
  const curResp=respSel.value;
  respSel.innerHTML=`<option value="">Todos</option>`+allResps.map(r=>`<option ${r===curResp?'selected':''}>${r}</option>`).join('');

  const fResp=document.getElementById('commRespFilter').value;
  const fStatus=document.getElementById('commStatusFilter').value;
  const fPrazo=document.getElementById('commPrazoFilter').value;
  const fSearch=(document.getElementById('commSearch').value||'').toLowerCase();
  const anyFilter = fResp || fStatus || fPrazo || fSearch || commKpiFilter;
  const dragEnabled = !anyFilter;

  const kpiBanner = commKpiFilter && commKpiFilter!=='all' ? `<div class="filter-banner">
    <b>Filtro ativo:</b> mostrando apenas ${commKpiFilter==='delayed'?'ações em atraso':'ações que vencem em ≤7 dias'}
    <button class="btn xs secondary" onclick="setCommKpi(null)">✕ Limpar</button>
  </div>` : '';
  const dragBanner = !dragEnabled ? `<div class="drag-locked-banner">🔒 Reordenar por arrastar está desabilitado enquanto há filtros ativos.</div>` : '';

  document.getElementById('commBlocks').innerHTML = kpiBanner + dragBanner + c.blocks.map((b,bi)=>{
    const p=blockProgress(b);
    const cls=p.delayed?'danger':p.pct===100?'ok':p.pct>=50?'ok':'warn';
    const filteredActions = b.actions.filter(a=>{
      if(fResp && !actionHasResp(a,fResp)) return false;
      if(fStatus && a.status!==fStatus) return false;
      if(fPrazo){
        const s = actionSituation(a);
        if(fPrazo==='com' && !a.end) return false;
        if(fPrazo==='sem' && a.end) return false;
        if(fPrazo==='atraso' && s.cls!=='danger') return false;
        if(fPrazo==='7d' && s.cls!=='warn') return false;
      }
      if(fSearch && !a.name.toLowerCase().includes(fSearch) && !(a.obs||'').toLowerCase().includes(fSearch)) return false;
      if(commKpiFilter==='delayed' && actionSituation(a).cls!=='danger') return false;
      if(commKpiFilter==='soon' && actionSituation(a).cls!=='warn') return false;
      return true;
    });
    if(anyFilter && !filteredActions.length) return '';
    return `<div class="block ${b._open||anyFilter?'open':''}" data-block-id="${b.id}" ${dragEnabled?'draggable="true"':''} ondragstart="onDragStartBlock(event,'${b.id}')" ondragover="onDragOverBlock(event,'${b.id}')" ondragleave="onDragLeaveEl(event)" ondrop="onDropBlock(event,'${b.id}')" ondragend="onDragEnd(event)">
      <div class="block-head">
        ${dragEnabled?'<span class="drag-handle" title="Arraste para reordenar">⋮⋮</span>':''}
        <button class="block-toggle" onclick="toggleBlock(${bi})">
          <span class="block-chevron">▶</span>
          <span class="block-title">${bi+1}. ${b.name}</span>
        </button>
        <div class="block-stats">${p.done}/${p.total} · ${p.delayed?`<span style="color:var(--danger)">${p.delayed} atraso</span>`:'em dia'}</div>
        <div class="block-progress"><div class="block-progress-fill ${cls}" style="width:${p.pct}%"></div></div>
        <div style="font-size:12px;font-weight:600;width:38px;text-align:right">${p.pct}%</div>
        <div class="block-actions">
          <button class="btn xs secondary" onclick="editBlock('${b.id}')" title="Renomear">✏️</button>
          <button class="btn xs danger" onclick="deleteBlock('${b.id}')" title="Excluir">🗑️</button>
        </div>
      </div>
      <div class="block-body">
        ${filteredActions.map(a=>{
          const s=actionSituation(a);
          return `<div class="action-row" data-action-id="${a.id}" data-block-id="${b.id}" ${dragEnabled?'draggable="true"':''} ondragstart="onDragStartAction(event,'${b.id}','${a.id}')" ondragover="onDragOverAction(event,'${b.id}','${a.id}')" ondragleave="onDragLeaveEl(event)" ondrop="onDropAction(event,'${b.id}','${a.id}')" ondragend="onDragEnd(event)">
            ${dragEnabled?'<span class="drag-handle" title="Arraste para reordenar">⋮⋮</span>':'<span></span>'}
            <div class="action-name" data-obs="${esc(a.obs)}" data-actname="${esc(a.name)}" data-status="${a.status}" data-end="${a.end||''}" onclick="editAction('${b.id}','${a.id}')">${a.name}${a.obs?`<span class="obs-badge" title="Tem observação — passe o mouse para ver">💬</span>`:''}${(a.attachments||[]).length?`<span class="att-badge" onclick="event.stopPropagation();editAction('${b.id}','${a.id}')" title="${(a.attachments||[]).length} anexo(s)">📎 ${(a.attachments||[]).length}</span>`:''}</div>
            <div><div class="resps-chips">${actionRespsHtml(a)}</div></div>
            <div class="status-cell"><span class="badge ${statusBadgeCls(a.status)}" onclick="startEditStatus(event, '${b.id}','${a.id}')" title="Clique para alterar o status">${a.status}</span></div>
            <div class="end-cell">
              <span class="end-txt ${!a.end?'empty':''}" onclick="startEditEnd(event, '${b.id}','${a.id}')" title="Clique para editar o prazo">${a.end?fmt(a.end):'—'}</span>
              <button class="end-edit-btn" onclick="startEditEnd(event, '${b.id}','${a.id}')" title="Editar prazo">📅</button>
            </div>
            <div><span class="badge ${s.cls}">${s.label}</span></div>
            <div style="display:flex;gap:3px;justify-content:flex-end">
              <button class="btn xs star ${a.milestone?'on':''}" onclick="toggleMilestone('${b.id}','${a.id}')" title="${a.milestone?'Remover da linha do tempo':'Adicionar à linha do tempo'}">⭐</button>
              <button class="btn xs secondary" onclick="quickAttach('${b.id}','${a.id}')" title="Anexar arquivo">📎</button>
              <button class="btn xs secondary" onclick="editAction('${b.id}','${a.id}')" title="Editar">✏️</button>
              <button class="btn xs" onclick="quickStatus('${b.id}','${a.id}','CONCLUÍDO')" title="Concluir">✓</button>
              <button class="btn xs danger" onclick="quickDelete('${b.id}','${a.id}')" title="Excluir">🗑️</button>
            </div>
          </div>`;
        }).join('')}
        <div style="padding:12px 20px 16px 44px"><button class="btn secondary sm" onclick="openNewAction('${b.id}')">+ Ação neste bloco</button></div>
      </div>
    </div>`;
  }).join('') || '<div class="empty-state"><div class="empty-icon">📋</div><h3>Sem blocos</h3><p>Clique em "+ Bloco" para começar</p></div>';
}
function clearCommFilters(){ document.getElementById('commRespFilter').value=''; document.getElementById('commStatusFilter').value=''; document.getElementById('commPrazoFilter').value=''; document.getElementById('commSearch').value=''; commKpiFilter=null; renderCommittee(); if(projectView==='kanban') renderKanban(); }
function setCommKpi(k){ commKpiFilter = (commKpiFilter===k?null:k); renderCommittee() }
function toggleBlock(bi){ const c=currentCommittee(); c.blocks[bi]._open=!c.blocks[bi]._open; renderCommittee() }
function toggleCommHeader(){
  commHeaderExpanded = !commHeaderExpanded;
  uiPref('commHeaderExpanded', commHeaderExpanded?'1':'0');
  renderCommittee();
}
async function toggleCommCompleted(){
  const c = currentCommittee();
  if(!c.completed){
    if(!(await crcConfirm(`Marcar "${c.name}" como concluído? Ele vai para a lista de Concluídos na sidebar.`))) return;
    c.completed = true;
    c.completedAt = new Date().toISOString();
    c.paused = false;
    sbGroupsOpen.done = true;
    uiPref('sbGroupDone', '1');
  } else {
    if(!(await crcConfirm(`Reabrir "${c.name}"? Ele volta para a lista Em andamento.`))) return;
    c.completed = false;
    c.completedAt = null;
    sbGroupsOpen.active = true;
    uiPref('sbGroupActive', '1');
  }
  save();
  renderAll();
}
async function toggleCommPaused(){
  const c = currentCommittee();
  if(!c.paused){
    const reason = await crcPrompt(`Suspender "${c.name}"? Informe o motivo (opcional):`, '', {title:'Suspender projeto', okLabel:'Suspender'});
    if(reason===null) return;
    c.paused = true;
    c.pausedAt = new Date().toISOString();
    c.pausedReason = reason.trim() || '';
    c.completed = false;
    sbGroupsOpen.paused = true;
    uiPref('sbGroupPaused', '1');
  } else {
    if(!(await crcConfirm(`Retomar "${c.name}"? Ele volta para a lista Em andamento.`))) return;
    c.paused = false;
    c.pausedAt = null;
    c.pausedReason = null;
    sbGroupsOpen.active = true;
    uiPref('sbGroupActive', '1');
  }
  save();
  renderAll();
}
function updateCommName(v){ const c=currentCommittee(); c.name=v.trim()||c.name; save(); renderCommitteeSelect() }
function updateCommDate(v){ const c=currentCommittee(); c.delivery=v||null; save(); renderCommittee(); renderCommitteeSelect() }
function updateCommStart(v){ const c=currentCommittee(); c.start=v||null; save() }
function updateCommUnits(v){ const c=currentCommittee(); c.units=+v||null; save() }
function updateCommEmpresa(v){ const c=currentCommittee(); if(!+v){ renderCommittee(); return } c.companyId=+v; save() }
async function deleteCommittee(){
  if(!(await crcConfirm('Excluir este projeto? Não é possível desfazer.', {danger:true, okLabel:'Excluir'}))) return;
  db.committees=db.committees.filter(c=>c.id!==currentCommitteeId);
  // No HTML um projeto "Novo projeto" era recriado quando a lista ficava vazia; aqui a lista
  // é de todos os usuários, então só mostra o estado vazio.
  currentCommitteeId=db.committees[0]?db.committees[0].id:null; save(); switchView(db.committees.length?currentView:'dashboard');
}

/* ========= DRAG & DROP ========= */
function clearDropMarks(){ document.querySelectorAll('.drop-before,.drop-after').forEach(el=>{ el.classList.remove('drop-before','drop-after') }) }
function onDragStartBlock(e,bid){ e.stopPropagation(); dragCtx={type:'block',bid}; e.currentTarget.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',bid) }
function onDragStartAction(e,bid,aid){ e.stopPropagation(); dragCtx={type:'action',bid,aid}; e.currentTarget.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',aid) }
function onDragOverBlock(e,tbid){
  if(!dragCtx||dragCtx.type!=='block'||dragCtx.bid===tbid) return;
  e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect='move';
  clearDropMarks();
  const r=e.currentTarget.getBoundingClientRect();
  e.currentTarget.classList.add((e.clientY-r.top<r.height/2)?'drop-before':'drop-after');
}
function onDragOverAction(e,tbid,taid){
  if(!dragCtx||dragCtx.type!=='action'||dragCtx.bid!==tbid||dragCtx.aid===taid) return;
  e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect='move';
  clearDropMarks();
  const r=e.currentTarget.getBoundingClientRect();
  e.currentTarget.classList.add((e.clientY-r.top<r.height/2)?'drop-before':'drop-after');
}
function onDragLeaveEl(e){ if(!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('drop-before','drop-after') }
function onDropBlock(e,tbid){
  if(!dragCtx||dragCtx.type!=='block'||dragCtx.bid===tbid) return;
  e.preventDefault(); e.stopPropagation();
  const r=e.currentTarget.getBoundingClientRect();
  const before=(e.clientY-r.top)<r.height/2;
  const c=currentCommittee();
  const from=c.blocks.findIndex(b=>b.id===dragCtx.bid);
  if(from<0) return;
  const [m]=c.blocks.splice(from,1);
  const to=c.blocks.findIndex(b=>b.id===tbid);
  c.blocks.splice(before?to:to+1,0,m);
  clearDropMarks(); dragCtx=null; save(); renderAll();
}
function onDropAction(e,tbid,taid){
  if(!dragCtx||dragCtx.type!=='action'||dragCtx.bid!==tbid||dragCtx.aid===taid) return;
  e.preventDefault(); e.stopPropagation();
  const r=e.currentTarget.getBoundingClientRect();
  const before=(e.clientY-r.top)<r.height/2;
  const c=currentCommittee();
  const b=c.blocks.find(b=>b.id===tbid);
  const from=b.actions.findIndex(a=>a.id===dragCtx.aid);
  if(from<0) return;
  const [m]=b.actions.splice(from,1);
  const to=b.actions.findIndex(a=>a.id===taid);
  b.actions.splice(before?to:to+1,0,m);
  clearDropMarks(); dragCtx=null; save(); renderAll();
}
function onDragEnd(e){ document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging')); clearDropMarks(); dragCtx=null; }

/* ========= BLOCK CRUD ========= */
function editBlock(bid){ editingBlockId=bid; const b=currentCommittee().blocks.find(b=>b.id===bid); document.getElementById('nbTitle').textContent='Renomear bloco'; document.getElementById('nbName').value=b.name; openModal('modalNewBlock') }
function saveBlock(){
  const name=document.getElementById('nbName').value.trim(); if(!name) return crcAlert('Informe o nome');
  const c=currentCommittee();
  if(editingBlockId){ const b=c.blocks.find(b=>b.id===editingBlockId); b.name=name }
  else { c.blocks.push({id:uid('b'),name,actions:[],_open:true}) }
  editingBlockId=null; save(); closeModal('modalNewBlock'); renderAll();
}
async function deleteBlock(bid){
  const b=currentCommittee().blocks.find(b=>b.id===bid);
  if(!(await crcConfirm(`Excluir o bloco "${b.name}" e todas as suas ${b.actions.length} ações?`, {danger:true, okLabel:'Excluir'}))) return;
  const c=currentCommittee(); c.blocks=c.blocks.filter(b=>b.id!==bid); save(); renderAll();
}

/* ========= ACTION CRUD ========= */
function editAction(bid,aid){
  const c=currentCommittee();
  const b=c.blocks.find(b=>b.id===bid); if(!b) return;
  const a=b.actions.find(a=>a.id===aid); if(!a) return;
  editingActionRef={bid,aid};
  historyExpanded = false;
  document.getElementById('eaTitle').textContent=a.name;
  // Meta badges no topo do modal
  const s = actionSituation(a);
  const metaEl = document.getElementById('eaTitleMeta');
  metaEl.innerHTML = `
    <span class="badge ${statusBadgeCls(a.status)}">${a.status}</span>
    <span class="badge ${s.cls}">${s.label}</span>
    ${a.milestone?'<span class="badge warn">⭐ Marco</span>':''}
    <span class="muted" style="font-size:12px">${esc(b.name)}</span>`;
  document.getElementById('eaName').value=a.name;
  tempResps.ea = [...actionResps(a)];
  renderChipSelect('ea');
  document.getElementById('eaStatus').value=a.status;
  document.getElementById('eaStart').value=a.start||'';
  document.getElementById('eaEnd').value=a.end||'';
  document.getElementById('eaActual').value=a.actualEnd||'';
  document.getElementById('eaReason').value='';
  document.getElementById('eaMilestone').checked = !!a.milestone;
  updateQuickButtons(a);
  renderHistory(a);
  openModal('modalEditAction');
}
function updateQuickButtons(a){
  const attN = (a.attachments||[]).length;
  const attBtn = document.querySelector('.ea-quick-btn[onclick="openAttachFromEdit()"]');
  document.getElementById('eaAttBtnTitle').textContent = attN ? `📎 ${attN} anexo${attN>1?'s':''}` : 'Adicionar anexo';
  document.getElementById('eaAttBtnSub').textContent = attN ? 'Clique para gerenciar' : 'Documentos, imagens, PDFs';
  if(attBtn) attBtn.classList.toggle('has-content', attN>0);

  const hasObs = a.obs && a.obs.trim();
  const obsBtn = document.querySelector('.ea-quick-btn[onclick="openObsFromEdit()"]');
  document.getElementById('eaObsBtnTitle').textContent = hasObs ? '💬 Última: "'+truncateStr(a.obs,32)+'"' : 'Adicionar observação';
  document.getElementById('eaObsBtnSub').textContent = hasObs ? 'Clique para adicionar nova' : 'Fica registrada no histórico';
  if(obsBtn) obsBtn.classList.toggle('has-content', !!hasObs);
}
function openAttachFromEdit(){
  if(!editingActionRef) return;
  quickAttach(editingActionRef.bid, editingActionRef.aid);
}
function openObsFromEdit(){
  if(!editingActionRef) return;
  const c=currentCommittee();
  const b=c.blocks.find(b=>b.id===editingActionRef.bid);
  const a=b.actions.find(a=>a.id===editingActionRef.aid);
  document.getElementById('obsInput').value='';
  const prev = document.getElementById('obsPrev');
  const prevTxt = document.getElementById('obsPrevText');
  if(a.obs && a.obs.trim()){
    prev.classList.remove('hidden');
    prevTxt.textContent = a.obs;
  } else {
    prev.classList.add('hidden');
    prevTxt.textContent = '';
  }
  openModal('modalNewObs');
}
function saveNewObs(){
  if(!editingActionRef) return;
  const txt = document.getElementById('obsInput').value.trim();
  if(!txt){ crcAlert('Digite a observação antes de registrar.'); return }
  const c=currentCommittee();
  const b=c.blocks.find(b=>b.id===editingActionRef.bid);
  const a=b.actions.find(a=>a.id===editingActionRef.aid);
  pushHistory(a,'COMENTÁRIO',txt);
  a.obs = txt;
  save();
  closeModal('modalNewObs');
  updateQuickButtons(a);
  renderHistory(a);
  renderCommittee();
}
async function clearActionObsFromModal(){
  if(!editingActionRef) return;
  if(!(await crcConfirm('Limpar a observação atual? Fica registrado no histórico.'))) return;
  const c=currentCommittee();
  const b=c.blocks.find(b=>b.id===editingActionRef.bid);
  const a=b.actions.find(a=>a.id===editingActionRef.aid);
  const prev = a.obs;
  a.obs = '';
  pushHistory(a,'COMENTÁRIO',`Observação anterior removida: "${truncateStr(prev,120)}"`);
  save();
  closeModal('modalNewObs');
  updateQuickButtons(a);
  renderHistory(a);
  renderCommittee();
}
function clearActionObs(){ // mantida para compat, mesma função
  clearActionObsFromModal();
}
let historyExpanded = false;
function renderHistory(a){
  const all = (a.history||[]).slice().reverse();
  const el = document.getElementById('eaHistory');
  if(!all.length){ el.innerHTML='<div class="muted">Sem histórico ainda</div>'; return }
  const LIMIT = 5;
  const show = historyExpanded ? all : all.slice(0, LIMIT);
  const evClass = (ev)=>{
    const e=(ev||'').toUpperCase();
    if(e.includes('ATRASO') && e.includes('CONCL')) return 'late';
    if(e.includes('REPLAN')) return 'replan';
    if(e.includes('CONCL')) return 'done';
    if(e.includes('ANEXO')) return 'anexo';
    if(e.includes('RISCO')) return 'risk';
    if(e.includes('STATUS')) return 'status';
    if(e==='EDICAO' || e==='EDIÇÃO' || e==='RENOMEACAO') return 'edit';
    return '';
  };
  const fmtDate = (iso)=>{
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  };
  el.innerHTML = `<div class="timeline">${show.map((x,i)=>{
    const cls = evClass(x.event);
    return `<div class="timeline-item ${cls}">
      <div class="timeline-head">
        <span class="timeline-event ${cls}">${x.event}</span>
        <span class="timeline-user">👤 ${esc(x.user||'Usuário')}</span>
        <span class="timeline-date">${fmtDate(x.when)}</span>
      </div>
      ${x.note?`<div class="timeline-note">${esc(x.note)}</div>`:''}
    </div>`;
  }).join('')}</div>
  ${all.length>LIMIT ? `<div class="timeline-more"><button onclick="toggleHistoryExpand()">${historyExpanded?'▲ Recolher':'▼ Ver todos os '+all.length+' registros'}</button></div>` : ''}`;
}
function toggleHistoryExpand(){
  historyExpanded = !historyExpanded;
  const c=currentCommittee();
  const b=c.blocks.find(b=>b.id===editingActionRef.bid);
  const a=b.actions.find(a=>a.id===editingActionRef.aid);
  renderHistory(a);
}
function saveAction(){
  const c=currentCommittee();
  const b=c.blocks.find(b=>b.id===editingActionRef.bid);
  const a=b.actions.find(a=>a.id===editingActionRef.aid);
  const newName=document.getElementById('eaName').value.trim()||a.name;
  const newResps=[...tempResps.ea];
  const newStatus=document.getElementById('eaStatus').value;
  const newStart=document.getElementById('eaStart').value||null;
  const newEnd=document.getElementById('eaEnd').value||null;
  const newActual=document.getElementById('eaActual').value||null;
  const newMilestone=document.getElementById('eaMilestone').checked;
  const reason=document.getElementById('eaReason').value.trim();
  const arrEq=(x,y)=>{x=x||[];y=y||[];return x.length===y.length && x.every(v=>y.includes(v))};

  if(newName!==a.name) pushHistory(a,'EDIÇÃO',`Nome: "${a.name}" → "${newName}"`);
  if(!arrEq(actionResps(a),newResps)) pushHistory(a,'EDIÇÃO',`Responsáveis: ${actionRespsStr(a)||'—'} → ${newResps.length?newResps.join(' + '):'—'}`);
  if(newEnd!==a.end) pushHistory(a,'REPLANEJAMENTO',`Término: ${fmt(a.end)} → ${fmt(newEnd)}${reason?' · Motivo: '+reason:''}`);
  if(newStart!==a.start) pushHistory(a,'EDIÇÃO',`Início: ${fmt(a.start)} → ${fmt(newStart)}`);
  if(newActual!==a.actualEnd) pushHistory(a,'EDIÇÃO',`Concluída em: ${fmt(a.actualEnd)||'—'} → ${fmt(newActual)||'—'}`);
  if(newStatus!==a.status){
    if(newStatus==='CONCLUÍDO'){
      const effectiveActual = newActual || today();
      if(newEnd && effectiveActual > newEnd){
        const late = daysBetween(newEnd, effectiveActual);
        pushHistory(a,'CONCLUSÃO COM ATRASO',`Prazo era ${fmt(newEnd)}, concluída em ${fmt(effectiveActual)} — ${late} dia(s) de atraso`);
      } else {
        pushHistory(a,'CONCLUSÃO',`Status: ${a.status} → ${newStatus}`);
      }
    } else {
      pushHistory(a,'STATUS',`Status: ${a.status} → ${newStatus}`);
    }
  }
  if(newMilestone!==!!a.milestone) pushHistory(a,'EDIÇÃO',newMilestone?'⭐ Adicionada à linha do tempo':'Removida da linha do tempo');

  a.name=newName;
  a.resps=newResps;
  delete a.resp;
  a.status=newStatus; a.start=newStart; a.end=newEnd;
  a.actualEnd=newActual;
  a.milestone=newMilestone;
  save(); closeModal('modalEditAction'); renderAll();
}
async function deleteAction(){
  if(!(await crcConfirm('Excluir esta ação?', {danger:true, okLabel:'Excluir'}))) return;
  const c=currentCommittee();
  const b=c.blocks.find(b=>b.id===editingActionRef.bid);
  b.actions=b.actions.filter(a=>a.id!==editingActionRef.aid);
  save(); closeModal('modalEditAction'); renderAll();
}
/* Edição inline do status */
function startEditStatus(evt, bid, aid){
  evt.stopPropagation();
  const cell = evt.currentTarget.closest('.status-cell');
  if(!cell) return;
  const c=currentCommittee(); const b=c.blocks.find(b=>b.id===bid); const a=b.actions.find(a=>a.id===aid);
  if(!a) return;
  const opts = ['NÃO INICIADO','EM ANDAMENTO','CONCLUÍDO','NÃO SE APLICA'];
  cell.innerHTML = `<select autofocus>${opts.map(o=>`<option ${o===a.status?'selected':''}>${o}</option>`).join('')}</select>`;
  const sel = cell.querySelector('select');
  sel.focus();
  const cancel = ()=>{ renderCommittee(); if(projectView==='kanban') renderKanban(); };
  sel.addEventListener('change', ()=>{
    const newStatus = sel.value;
    if(newStatus === a.status){ cancel(); return }
    quickStatus(bid, aid, newStatus);
  });
  sel.addEventListener('blur', ()=>{
    // se não mudou, cancela
    if(sel.value === a.status) cancel();
  });
  sel.addEventListener('keydown', e=>{
    if(e.key==='Escape') cancel();
  });
}

/* Edição inline do prazo */
function startEditEnd(evt, bid, aid){  evt.stopPropagation();
  const cell = evt.currentTarget.closest('.end-cell');
  if(!cell) return;
  const c=currentCommittee(); const b=c.blocks.find(b=>b.id===bid); const a=b.actions.find(a=>a.id===aid);
  if(!a) return;
  const current = a.end || '';
  cell.innerHTML = `<input type="date" value="${current}" autofocus>`;
  const inp = cell.querySelector('input');
  inp.focus();
  let committed = false; // Enter + change chegam juntos; o motivo é pedido uma vez só
  const commit = ()=>{
    if(committed) return;
    committed = true;
    const newVal = inp.value || null;
    applyEndDate(bid, aid, newVal);
  };
  const cancel = ()=>{ renderCommittee(); if(projectView==='kanban') renderKanban(); };
  inp.addEventListener('change', commit);
  inp.addEventListener('blur', ()=>{
    // Se saiu sem mudar, cancela
    if((inp.value||null) === (current||null)) cancel();
  });
  inp.addEventListener('keydown', e=>{
    if(e.key==='Escape') cancel();
    if(e.key==='Enter') commit();
  });
}
async function applyEndDate(bid, aid, newEnd){
  const c=currentCommittee(); const b=c.blocks.find(b=>b.id===bid); const a=b.actions.find(a=>a.id===aid);
  if(!a) return;
  const oldEnd = a.end;
  if(oldEnd === newEnd){
    renderCommittee(); if(projectView==='kanban') renderKanban();
    return;
  }
  if(oldEnd){
    // Já existia data → pede justificativa (replanejamento)
    const reason = await crcPrompt(`Alterando prazo de "${a.name}"\nDe ${fmt(oldEnd)} para ${fmt(newEnd)}.\n\nQual o motivo do replanejamento?`, '', {title:'Replanejamento', okLabel:'Salvar'});
    if(reason===null){
      // Cancelou — restaura render
      renderCommittee(); if(projectView==='kanban') renderKanban();
      return;
    }
    a.end = newEnd;
    pushHistory(a,'REPLANEJAMENTO',`Término: ${fmt(oldEnd)} → ${fmt(newEnd)}${reason.trim()?' · Motivo: '+reason.trim():' · Sem motivo informado'}`);
  } else {
    // Não tinha data → apenas define, sem pedir motivo
    a.end = newEnd;
    pushHistory(a,'EDIÇÃO',`Prazo definido: ${fmt(newEnd)}`);
  }
  save();
  renderAll();
}

function quickStatus(bid,aid,st){  const c=currentCommittee(); const b=c.blocks.find(b=>b.id===bid); const a=b.actions.find(a=>a.id===aid);
  const old=a.status;
  a.status=st; if(st==='CONCLUÍDO'&&!a.actualEnd) a.actualEnd=today();
  if(st==='CONCLUÍDO' && a.end && a.actualEnd && a.actualEnd>a.end){
    const late = daysBetween(a.end, a.actualEnd);
    pushHistory(a,'CONCLUSÃO COM ATRASO',`Prazo era ${fmt(a.end)}, concluído em ${fmt(a.actualEnd)} — ${late} dia(s) de atraso`);
  } else {
    pushHistory(a, st==='CONCLUÍDO'?'CONCLUSÃO':'STATUS', `Status: ${old} → ${st}`);
  }
  save(); renderAll();
}
async function quickDelete(bid,aid){
  if(!(await crcConfirm('Excluir esta ação?', {danger:true, okLabel:'Excluir'}))) return;
  const c=currentCommittee(); const b=c.blocks.find(b=>b.id===bid);
  b.actions=b.actions.filter(a=>a.id!==aid); save(); renderAll();
}
function toggleMilestone(bid,aid){
  const c=currentCommittee(); const b=c.blocks.find(b=>b.id===bid); const a=b.actions.find(a=>a.id===aid);
  a.milestone=!a.milestone;
  pushHistory(a,'EDIÇÃO', a.milestone?'⭐ Adicionada à linha do tempo':'Removida da linha do tempo');
  save(); renderAll();
}
function openNewAction(bid){
  newActionBid=bid;
  document.getElementById('naName').value='';
  document.getElementById('naStart').value=''; document.getElementById('naEnd').value='';
  document.getElementById('naMilestone').checked=false;
  tempResps.na=[]; renderChipSelect('na');
  openModal('modalNewAction');
}
function createAction(){
  const name=document.getElementById('naName').value.trim(); if(!name) return crcAlert('Informe o nome');
  const c=currentCommittee(); const b=c.blocks.find(b=>b.id===newActionBid);
  const a={id:uid('a'),name,resps:[...tempResps.na],status:'NÃO INICIADO',start:document.getElementById('naStart').value||null,end:document.getElementById('naEnd').value||null,actualEnd:null,obs:'',milestone:document.getElementById('naMilestone').checked,history:[],notes:[]};
  pushHistory(a,'CRIADO','Ação criada manualmente');
  b.actions.push(a);
  save(); closeModal('modalNewAction'); renderAll();
}

/* ========= OBRA ========= */
function openObraUpdate(){
  document.getElementById('obraDate').value=today();
  const c=currentCommittee();
  document.getElementById('obraPct').value=currentObraPct(c)||'';
  document.getElementById('obraNote').value='';
  renderObraHistory();
  openModal('modalObraUpdate');
}
function renderObraHistory(){
  const c=currentCommittee();
  const h=(c.obraHistory||[]).slice().reverse();
  document.getElementById('obraHistoryBox').innerHTML = h.length? `<div class="timeline">${h.map(x=>`
    <div class="timeline-item done">
      <div class="timeline-date">${fmt(x.date)} · ${x.pct}%</div>
      <div class="timeline-note">${x.note||''}</div>
    </div>`).join('')}</div>` : '<div class="muted">Sem registros ainda</div>';
}
function saveObraUpdate(){
  const d=document.getElementById('obraDate').value; const p=parseFloat(document.getElementById('obraPct').value);
  if(!d||isNaN(p)) return crcAlert('Informe data e %');
  const c=currentCommittee(); c.obraHistory=c.obraHistory||[];
  c.obraHistory.push({date:d,pct:p,note:document.getElementById('obraNote').value.trim()});
  c.obraHistory.sort((a,b)=>a.date.localeCompare(b.date));
  save(); closeModal('modalObraUpdate'); renderAll();
}

/* ========= RESPONSIBLE VIEW ========= */
function renderResponsible(){
  const c=currentCommittee();
  const sel=document.getElementById('responsibleSelect');
  const resps=[...new Set(c.blocks.flatMap(b=>b.actions.flatMap(a=>actionResps(a))))].sort();
  const cur=sel.value||resps[0]||'';
  sel.innerHTML=resps.map(r=>`<option ${r===cur?'selected':''}>${r}</option>`).join('');
  const list=[];
  c.blocks.forEach(b=>b.actions.forEach(a=>{ if(actionHasResp(a,cur)) list.push({b,a}) }));
  document.getElementById('responsibleList').innerHTML = list.length? list.map(x=>{
    const s=actionSituation(x.a);
    return `<div class="action-row" style="grid-template-columns:1fr 140px 110px 110px auto">
      <div class="action-name" data-obs="${esc(x.a.obs)}" data-actname="${esc(x.a.name)}" data-status="${x.a.status}" data-end="${x.a.end||''}" onclick="editAction('${x.b.id}','${x.a.id}')">${x.a.name}<span class="sub">${x.b.name} · ${actionRespsStr(x.a)}</span></div>
      <div><span class="badge ${statusBadgeCls(x.a.status)}">${x.a.status}</span></div>
      <div style="font-size:12px">${fmt(x.a.end)}</div>
      <div><span class="badge ${s.cls}">${s.label}</span></div>
      <div style="display:flex;gap:4px;justify-content:flex-end">
        <button class="btn sm" onclick="quickStatus('${x.b.id}','${x.a.id}','CONCLUÍDO')" title="Marcar concluída">✓</button>
        <button class="btn sm warn" onclick="quickStatus('${x.b.id}','${x.a.id}','EM ANDAMENTO')" title="Em andamento">↻</button>
        <button class="btn sm secondary" onclick="editAction('${x.b.id}','${x.a.id}')" title="Editar">✏️ Editar</button>
      </div>
    </div>`;
  }).join('') : '<div class="empty-state"><div class="empty-icon">👤</div><h3>Nenhuma ação para este responsável</h3></div>';
}

/* ========= MEETING ========= */
function renderMeeting(){
  const c=currentCommittee();
  if(!c.blocks.length){document.getElementById('meetingContent').innerHTML='<div class="empty-state"><h3>Sem blocos</h3></div>';return}
  if(meetingBlockIndex>=c.blocks.length) meetingBlockIndex=0;
  const b=c.blocks[meetingBlockIndex]; const p=blockProgress(b);
  document.getElementById('meetingBlockTitle').textContent=`${meetingBlockIndex+1}. ${b.name}`;
  document.getElementById('meetingBlockSub').textContent=`${p.done}/${p.total} concluídas · ${p.delayed} em atraso · ${p.pct}%`;
  document.getElementById('meetingIdx').textContent=`${meetingBlockIndex+1}/${c.blocks.length}`;
  document.getElementById('meetingContent').innerHTML = b.actions.map(a=>{
    const s=actionSituation(a);
    return `<div class="meeting-action">
      <span class="status-dot ${s.cls}"></span>
      <div style="flex:1"><div class="m-name">${a.name}</div><div class="m-meta">${actionRespsStr(a)} · ${a.status} · previsto ${fmt(a.end)} ${a.obs?' · '+a.obs:''}</div></div>
      <span class="badge ${s.cls}">${s.label}</span>
      <button class="btn sm secondary" onclick="editAction('${b.id}','${a.id}')">Editar</button>
    </div>`;
  }).join('');
  if(b.notes && b.notes.length){
    document.getElementById('meetingContent').innerHTML += `<div class="card" style="margin-top:16px"><div class="card-head"><h3>📝 Decisões registradas</h3></div><div class="card-body p">${b.notes.slice().reverse().map(n=>`<div style="padding:8px 0;border-bottom:1px solid var(--border)"><div class="muted">${new Date(n.when).toLocaleString('pt-BR')}</div><div>${n.text}</div></div>`).join('')}</div></div>`;
  }
}
function meetingPrev(){const c=currentCommittee();meetingBlockIndex=(meetingBlockIndex-1+c.blocks.length)%c.blocks.length;renderMeeting()}
function meetingNext(){const c=currentCommittee();meetingBlockIndex=(meetingBlockIndex+1)%c.blocks.length;renderMeeting()}
function saveMeetingNote(){
  const t=document.getElementById('meetingNote').value.trim(); if(!t) return;
  const c=currentCommittee(); const b=c.blocks[meetingBlockIndex];
  b.notes=b.notes||[]; b.notes.push({when:new Date().toISOString(),text:t});
  document.getElementById('meetingNote').value=''; save(); renderMeeting();
}

/* ========= NEW COMMITTEE ========= */
function openNewCommittee(){
  document.getElementById('ncName').value='';
  document.getElementById('ncDelivery').value='';
  document.getElementById('ncStart').value=today();
  document.getElementById('ncFrom').value='blank';
  const cur=currentCommittee(); fillEmpresaSelect(document.getElementById('ncEmpresa'), cur?cur.companyId:null);
  document.getElementById('ncTemplate').innerHTML=db.templates.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
  document.getElementById('ncClone').innerHTML=db.committees.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  toggleCloneOptions();
}
function toggleCloneOptions(){
  const v=document.getElementById('ncFrom').value;
  document.getElementById('ncTemplateWrap').classList.toggle('hidden',v!=='template');
  document.getElementById('ncCloneWrap').classList.toggle('hidden',v!=='clone');
}
function createCommittee(){
  const name=document.getElementById('ncName').value.trim(); if(!name) return crcAlert('Informe o nome');
  const delivery=document.getElementById('ncDelivery').value||null;
  const start=document.getElementById('ncStart').value||null;
  const from=document.getElementById('ncFrom').value;
  const companyId=+document.getElementById('ncEmpresa').value||null; if(!companyId) return crcAlert('Escolha a empresa do projeto');
  let nc;
  if(from==='blank'){ nc={id:uid('c'),name,delivery,start,units:null,obraHistory:[],blocks:[]} }
  else if(from==='template'){ const tpl=db.templates.find(t=>t.id===document.getElementById('ncTemplate').value); nc=committeeFromTemplate(tpl,name,delivery,start) }
  else{
    const src=db.committees.find(c=>c.id===document.getElementById('ncClone').value);
    const optResp=document.getElementById('cloneResp').checked;
    const optDates=document.getElementById('cloneDates').checked;
    const optObs=document.getElementById('cloneObs').checked;
    const optHist=document.getElementById('cloneHist').checked;
    const optStatus=document.getElementById('cloneStatus').checked;
    nc={id:uid('c'),name,delivery,start,units:null,obraHistory:[],blocks:src.blocks.map(b=>({
      id:uid('b'),name:b.name,
      actions:b.actions.map(a=>({id:uid('a'),name:a.name,resps:optResp?[...actionResps(a)]:[],status:optStatus?a.status:'NÃO INICIADO',start:optDates?a.start:null,end:optDates?a.end:null,actualEnd:null,obs:optObs?a.obs:'',milestone:a.milestone||false,history:optHist?[...(a.history||[])]:[],notes:[]}))
    }))};
  }
  nc.companyId=companyId;
  db.committees.push(nc); currentCommitteeId=nc.id; save(); closeModal('modalNewCommittee'); renderAll();
}

/* ========= TEMPLATES ========= */
function renderTemplates(){
  document.getElementById('templatesList').innerHTML = db.templates.map(t=>`
    <div style="padding:14px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px">
      <div style="flex:1"><div style="font-weight:600;font-size:14px">${t.name}</div><div class="muted">${t.blocks.length} blocos · ${t.blocks.reduce((s,b)=>s+b.actions.length,0)} ações</div></div>
      ${t.id!=='tpl_base'?`<button class="btn sm danger" onclick="deleteTemplate('${t.id}')">Excluir</button>`:'<span class="tag">padrão</span>'}
    </div>`).join('');
}
function saveCurrentAsTemplate(){ document.getElementById('stName').value=currentCommittee().name+' — modelo'; openModal('modalSaveTemplate') }
function doSaveTemplate(){
  const name=document.getElementById('stName').value.trim(); if(!name) return;
  const c=currentCommittee();
  const tpl={id:uid('tpl'),name,blocks:c.blocks.map(b=>({name:b.name,actions:b.actions.map(a=>({name:a.name,resps:[...actionResps(a)]}))}))};
  db.templates.push(tpl); save(); closeModal('modalSaveTemplate'); renderAll();
  crcAlert('Modelo salvo.');
}
async function deleteTemplate(id){ if(!(await crcConfirm('Excluir modelo?', {danger:true, okLabel:'Excluir'}))) return; db.templates=db.templates.filter(t=>t.id!==id); save(); renderTemplates() }

/* ========= SETTINGS - RESPS ========= */
function renderResps(){
  const usedResps = new Set(db.committees.flatMap(c=>c.blocks.flatMap(b=>b.actions.flatMap(a=>actionResps(a)))));
  const search=(document.getElementById('respSearch')?.value||'').toLowerCase();
  const list=db.settings.responsibles.filter(r=>!search||r.toLowerCase().includes(search));
  document.getElementById('respCount').textContent = `${list.length} de ${db.settings.responsibles.length} · ${usedResps.size} em uso`;
  document.getElementById('respList').innerHTML=list.map(r=>{
    const i=db.settings.responsibles.indexOf(r);
    const inUse=usedResps.has(r);
    return `<div class="resp-card ${inUse?'in-use':''}">
      <span class="r-name" title="${r}">${r}</span>
      <button class="btn xs secondary" onclick="openEditResp(${i})" title="Renomear">✏️</button>
      <button class="btn xs danger" onclick="deleteResp(${i})" ${inUse?'disabled title="em uso"':'title="Excluir"'}>🗑️</button>
    </div>`;
  }).join('') || '<div class="muted" style="padding:24px;text-align:center">Nenhuma área encontrada</div>';
}
function quickAddResp(){
  const inp=document.getElementById('respNewName');
  const name=(inp.value||'').trim().toUpperCase(); if(!name) return;
  if(db.settings.responsibles.includes(name)){ crcAlert('Já existe'); return }
  db.settings.responsibles.push(name); db.settings.responsibles.sort(); save();
  inp.value=''; renderResps();
}
function openEditResp(i){ editingRespIdx=i; document.getElementById('respTitle').textContent='Renomear área'; document.getElementById('respName').value=db.settings.responsibles[i]; openModal('modalResp') }
function saveResp(){
  const name=document.getElementById('respName').value.trim().toUpperCase(); if(!name) return crcAlert('Informe o nome');
  if(editingRespIdx==null){
    if(db.settings.responsibles.includes(name)) return crcAlert('Já existe');
    db.settings.responsibles.push(name);
  }else{
    const old=db.settings.responsibles[editingRespIdx];
    db.settings.responsibles[editingRespIdx]=name;
    db.committees.forEach(c=>c.blocks.forEach(b=>b.actions.forEach(a=>{
      if(a.resps){ a.resps = a.resps.map(r=>r===old?name:r) }
      if(a.resp===old) a.resp=name;
    })));
  }
  db.settings.responsibles.sort();
  save(); closeModal('modalResp'); renderAll();
}
async function deleteResp(i){ if(!(await crcConfirm('Excluir área?', {danger:true, okLabel:'Excluir'}))) return; db.settings.responsibles.splice(i,1); save(); renderResps() }

/* ========= SETTINGS - API ========= */
/* IA pela edge function app-ia (chave e modelo ficam nos segredos do Supabase). */
async function callIa(prompt, tipo){
  return crcBridge.ia(prompt, tipo);
}
function loadApiSettings(){
  const u=document.getElementById('userNameInput'); if(u) u.value=db.settings.userName||'Usuário';
}
async function testApiKey(){
  const el=document.getElementById('apiTestResult');
  el.textContent='Testando...'; el.style.color='var(--text-2)';
  try{
    await callIa('Responda apenas: OK', 'resumo');
    el.textContent='✓ IA funcionando'; el.style.color='var(--ok)';
  }catch(e){ el.textContent='✗ '+e.message; el.style.color='var(--danger)' }
}

/* ========= DATA ========= */
function exportData(){
  const blob=new Blob([JSON.stringify(crcBridge.exportDb(db),null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`entregas-backup-${today()}.json`; a.click();
}
/* Importar backup: soma ao que já está no sistema (o HTML substituía tudo, o que aqui apagaria
   projetos de outros usuários). Projetos com o mesmo id são substituídos pela versão do arquivo. */
let importBackupData = null;
function importData(e){
  const f=e.target.files[0]; if(!f) return;
  e.target.value='';
  const r=new FileReader(); r.onload=()=>{
    try{
      const d = normalizeDb(JSON.parse(r.result));
      if(!Array.isArray(d.committees)) throw new Error('sem projetos');
      importBackupData = d;
      const nAct = d.committees.reduce((s,c)=>s+c.blocks.reduce((t,b)=>t+b.actions.length,0),0);
      const nAtt = d.committees.reduce((s,c)=>s+c.blocks.reduce((t,b)=>t+b.actions.reduce((u,a)=>u+(a.attachments||[]).length,0),0),0);
      const repl = d.committees.filter(c=>db.committees.some(x=>x.id===c.id)).length;
      document.getElementById('ibSummary').innerHTML = `<b>✓ Arquivo lido:</b> ${d.committees.length} projeto(s) · ${nAct} atividade(s) · ${nAtt} anexo(s) · ${(d.templates||[]).length} modelo(s)`
        + (repl?`<br><span style="font-size:12px;color:#93370d">⚠ ${repl} projeto(s) já existem no sistema e serão substituídos.</span>`:'');
      fillEmpresaSelect(document.getElementById('ibEmpresa'), null);
      openModal('modalImportBackup');
    }catch(err){ crcAlert('Arquivo inválido') }
  };
  r.readAsText(f);
}
function applyImportBackup(){
  const d = importBackupData; if(!d) return;
  const emp = +document.getElementById('ibEmpresa').value;
  if(!emp){ crcAlert('Escolha a empresa dos projetos importados.'); return }
  d.committees.forEach(c=>{
    c.companyId = emp;
    const i = db.committees.findIndex(x=>x.id===c.id);
    if(i>=0) db.committees[i]=c; else db.committees.push(c);
  });
  (d.templates||[]).forEach(t=>{
    if(!t.id) t.id=uid('tpl');
    if(t.id==='tpl_base') return; // o modelo padrão já existe no sistema
    const i = db.templates.findIndex(x=>x.id===t.id);
    if(i>=0) db.templates[i]=t; else db.templates.push(t);
  });
  (d.settings.responsibles||[]).forEach(r=>{ r=String(r||'').trim().toUpperCase(); if(r && !db.settings.responsibles.includes(r)) db.settings.responsibles.push(r) });
  db.committees.forEach(c=>c.blocks.forEach(b=>b.actions.forEach(a=>actionResps(a).forEach(r=>{ if(r && !db.settings.responsibles.includes(r)) db.settings.responsibles.push(r) }))));
  db.settings.responsibles.sort();
  if(d.currentCommitteeId && d.committees.some(c=>c.id===d.currentCommitteeId)) currentCommitteeId=d.currentCommitteeId;
  else if(d.committees[0]) currentCommitteeId=d.committees[0].id;
  importBackupData = null;
  save(); closeModal('modalImportBackup'); renderAll();
  crcAlert(`Importado! ${d.committees.length} projeto(s). Os anexos são enviados em segundo plano.`);
}
/* Empresas do Sienge que o usuário pode ver (mesma lista dos demais módulos). */
function empresaNome(id){
  const e = (crcBridge.empresas()||[]).find(x=>x.id===id);
  return e ? e.label : (id ? 'Empresa '+id : '—');
}
function fillEmpresaSelect(sel, value){
  const list = crcBridge.empresas()||[];
  sel.innerHTML = '<option value="">Selecione a empresa...</option>' + list.map(e=>`<option value="${e.id}" ${e.id===value?'selected':''}>${esc(e.label)}</option>`).join('');
}

/* ========================================================= */
/* ========= IA — TOTALMENTE EDITÁVEL ANTES DE APLICAR ====== */
/* ========================================================= */

/* Estado editável — cada categoria é array de itens
   com "enabled" (checkbox) e campos editáveis pelo usuário */
function emptyAiState(){
  return { conclusoes:[], replanejamentos:[], novasAcoes:[], riscos:[],
           decisoes:[], obraPct:[], atualizacoesStatus:[], atualizacoesObs:[] };
}

async function analyzeTranscript(){
  const t=document.getElementById('aiTranscript').value.trim();
  if(!t) return crcAlert('Cole a transcrição primeiro');
  const c=currentCommittee();
  const acoes = c.blocks.flatMap(b=>b.actions.map(a=>({block:b.name,blockId:b.id,actionId:a.id,name:a.name,resps:actionResps(a),status:a.status,end:a.end,obs:a.obs})));
  document.getElementById('btnAnalyze').disabled=true;
  document.getElementById('aiLoading').classList.remove('hidden');
  const prompt = `Você é o assistente do Comitê de Entrega do projeto "${c.name}". Analise a transcrição/notas e extraia atualizações estruturadas.

AÇÕES DISPONÍVEIS (id | nome | responsáveis | status | término | observações):
${acoes.map(a=>`- ${a.actionId} | ${a.name} | ${(a.resps||[]).join('+')} | ${a.status} | ${a.end||'—'} | ${a.obs||''} [bloco: ${a.block} (id ${a.blockId})]`).join('\n')}

RESPONSÁVEIS DISPONÍVEIS: ${db.settings.responsibles.join(', ')}

STATUS VÁLIDOS: NÃO INICIADO, EM ANDAMENTO, CONCLUÍDO, NÃO SE APLICA

TRANSCRIÇÃO:
"""
${t}
"""

Devolva SOMENTE JSON válido, sem markdown:
{
  "conclusoes":[{"actionId":"...","date":"YYYY-MM-DD","evidence":"trecho"}],
  "replanejamentos":[{"actionId":"...","newEnd":"YYYY-MM-DD","reason":"motivo","evidence":"trecho"}],
  "novasAcoes":[{"blockId":"...","name":"...","resps":["..."],"end":"YYYY-MM-DD","evidence":"trecho"}],
  "riscos":[{"actionId":"...","note":"desc","evidence":"trecho"}],
  "decisoes":[{"blockId":"...","text":"decisão","evidence":"trecho"}],
  "obraPct":{"pct":90,"evidence":"trecho"},
  "atualizacoesStatus":[{"actionId":"...","newStatus":"EM ANDAMENTO","evidence":"trecho"}],
  "atualizacoesObs":[{"actionId":"...","newObs":"comentário/observação a adicionar","evidence":"trecho"}]
}
Use IDs exatos. "resps" é sempre array. Só inclua itens claramente mencionados. atualizacoesStatus para mudanças de etapa (ex: "iniciamos X" → EM ANDAMENTO). atualizacoesObs para comentários gerais / novas observações que devem ficar registradas na ação.`;
  try{
    let respText;
    respText = await callIa(prompt, "analise");
    let json;
    try{ json = JSON.parse(respText) }
    catch(e){ const m = respText.match(/\{[\s\S]*\}/); if(!m) throw new Error('A IA não retornou JSON'); json = JSON.parse(m[0]) }
    // Converte para aiState editável
    aiState = emptyAiState();
    (json.conclusoes||[]).forEach(x=>aiState.conclusoes.push({id:uid('s'),enabled:true,actionId:x.actionId,date:x.date||today(),evidence:x.evidence||''}));
    (json.replanejamentos||[]).forEach(x=>aiState.replanejamentos.push({id:uid('s'),enabled:true,actionId:x.actionId,newEnd:x.newEnd||'',reason:x.reason||'',evidence:x.evidence||''}));
    (json.novasAcoes||[]).forEach(x=>aiState.novasAcoes.push({id:uid('s'),enabled:true,blockId:x.blockId,name:x.name||'',resps:x.resps||(x.resp?[x.resp]:[]),end:x.end||'',milestone:false,evidence:x.evidence||''}));
    (json.riscos||[]).forEach(x=>aiState.riscos.push({id:uid('s'),enabled:true,actionId:x.actionId,note:x.note||'',evidence:x.evidence||''}));
    (json.decisoes||[]).forEach(x=>aiState.decisoes.push({id:uid('s'),enabled:true,blockId:x.blockId,text:x.text||'',evidence:x.evidence||''}));
    if(json.obraPct && (json.obraPct.pct!=null)) aiState.obraPct.push({id:uid('s'),enabled:true,pct:json.obraPct.pct,note:'',date:today(),evidence:json.obraPct.evidence||''});
    (json.atualizacoesStatus||[]).forEach(x=>aiState.atualizacoesStatus.push({id:uid('s'),enabled:true,actionId:x.actionId,newStatus:x.newStatus||'EM ANDAMENTO',evidence:x.evidence||''}));
    (json.atualizacoesObs||[]).forEach(x=>aiState.atualizacoesObs.push({id:uid('s'),enabled:true,actionId:x.actionId,newObs:x.newObs||'',mode:'append',evidence:x.evidence||''}));
    renderAiReview();
  }catch(e){ crcAlert('Erro: '+e.message); console.error(e) }
  document.getElementById('btnAnalyze').disabled=false;
  document.getElementById('aiLoading').classList.add('hidden');
}

function startBlankReview(){ aiState = emptyAiState(); renderAiReview(); }

/* Cria opções <option> para todas as ações do projeto atual */
function actionOptions(selectedId){
  const c=currentCommittee();
  const opts=[];
  c.blocks.forEach(b=>b.actions.forEach(a=>{
    opts.push(`<option value="${a.id}" ${a.id===selectedId?'selected':''}>${b.name} · ${a.name}</option>`);
  }));
  return `<option value="">Selecione a ação...</option>` + opts.join('');
}
function blockOptions(selectedId){
  const c=currentCommittee();
  return `<option value="">Selecione o bloco...</option>` + c.blocks.map(b=>`<option value="${b.id}" ${b.id===selectedId?'selected':''}>${b.name}</option>`).join('');
}
function respsSelectOptions(){
  return db.settings.responsibles.map(r=>`<option>${r}</option>`).join('');
}
function respsChipsEditor(item){
  return `<div class="chip-select-wrap" style="padding:8px">
    <div class="chip-select-chips" id="chips-${item.id}">
      ${item.resps.length ? item.resps.map(r=>`<span class="chip-select-chip">${r}<button type="button" onclick="aiRemoveResp('${item.id}','${r}')">×</button></span>`).join('') : '<span class="muted" style="font-size:12px">Nenhum responsável</span>'}
    </div>
    <div class="chip-select-add">
      <select id="chipsel-${item.id}"><option value="">Adicionar área...</option>${respsSelectOptions()}</select>
      <button type="button" class="btn xs secondary" onclick="aiAddResp('${item.id}')">+</button>
    </div>
  </div>`;
}
function aiAddResp(itemId){
  const it = aiFindItem(itemId); if(!it) return;
  const sel = document.getElementById('chipsel-'+itemId);
  const v = sel.value; if(!v) return;
  if(!it.resps.includes(v)) it.resps.push(v);
  renderAiReview();
}
function aiRemoveResp(itemId, r){
  const it = aiFindItem(itemId); if(!it) return;
  it.resps = it.resps.filter(x=>x!==r);
  renderAiReview();
}
function aiFindItem(id){
  if(!aiState) return null;
  for(const cat of Object.keys(aiState)){
    const list = aiState[cat];
    const it = list.find(x=>x.id===id);
    if(it) return it;
  }
  return null;
}

/* Atualiza campo do item (chamado no oninput/onchange) */
function aiSet(itemId, field, value){
  const it = aiFindItem(itemId); if(!it) return;
  it[field] = value;
}
function aiToggle(itemId, checked){
  const it = aiFindItem(itemId); if(!it) return;
  it.enabled = checked;
  const sug = document.querySelector(`.ai-sug[data-id="${itemId}"]`);
  if(sug) sug.classList.toggle('disabled', !checked);
}
function aiRemove(itemId){
  if(!aiState) return;
  for(const cat of Object.keys(aiState)){
    aiState[cat] = aiState[cat].filter(x=>x.id!==itemId);
  }
  renderAiReview();
}

/* Adiciona sugestão manual do tipo escolhido */
function aiAdd(type){
  if(!aiState) aiState = emptyAiState();
  document.getElementById('aiAddMenu').classList.remove('open');
  const c = currentCommittee();
  const firstBlock = c.blocks[0]?.id || '';
  const map = {
    conclusao:  ()=>aiState.conclusoes.push({id:uid('s'),enabled:true,actionId:'',date:today(),evidence:''}),
    replan:     ()=>aiState.replanejamentos.push({id:uid('s'),enabled:true,actionId:'',newEnd:'',reason:'',evidence:''}),
    nova:       ()=>aiState.novasAcoes.push({id:uid('s'),enabled:true,blockId:firstBlock,name:'',resps:[],end:'',milestone:false,evidence:''}),
    risco:      ()=>aiState.riscos.push({id:uid('s'),enabled:true,actionId:'',note:'',evidence:''}),
    decisao:    ()=>aiState.decisoes.push({id:uid('s'),enabled:true,blockId:firstBlock,text:'',evidence:''}),
    obra:       ()=>aiState.obraPct.push({id:uid('s'),enabled:true,pct:0,note:'',date:today(),evidence:''}),
    status:     ()=>aiState.atualizacoesStatus.push({id:uid('s'),enabled:true,actionId:'',newStatus:'EM ANDAMENTO',evidence:''}),
    obs:        ()=>aiState.atualizacoesObs.push({id:uid('s'),enabled:true,actionId:'',newObs:'',mode:'append',evidence:''}),
  };
  if(map[type]) map[type]();
  renderAiReview();
}

function toggleAddMenu(){
  document.getElementById('aiAddMenu').classList.toggle('open');
}

function renderAiReview(){
  const el = document.getElementById('aiReview');
  if(!aiState){ el.innerHTML=''; return }
  const total = Object.values(aiState).reduce((s,arr)=>s+arr.length,0);
  const c = currentCommittee();

  const groups = [
    { key:'conclusoes',        title:'✅ Conclusões',              typeCls:'',      renderItem: renderConclusao },
    { key:'atualizacoesStatus',title:'🔄 Atualizações de etapa',   typeCls:'stat',  renderItem: renderStatus },
    { key:'replanejamentos',   title:'📅 Replanejamentos',         typeCls:'repl',  renderItem: renderReplan },
    { key:'atualizacoesObs',   title:'💬 Comentários/observações', typeCls:'obs',   renderItem: renderObs },
    { key:'novasAcoes',        title:'🆕 Novas ações',             typeCls:'new',   renderItem: renderNova },
    { key:'riscos',            title:'⚠️ Riscos',                  typeCls:'risk',  renderItem: renderRisco },
    { key:'decisoes',          title:'📝 Decisões',                typeCls:'dec',   renderItem: renderDecisao },
    { key:'obraPct',           title:'🏗️ Atualização de % obra',   typeCls:'obra',  renderItem: renderObra },
  ];

  let html = `<div class="card"><div class="card-head">
    <div>
      <h3>Preview de atualizações · ${total} item${total===1?'':'s'}</h3>
      <span class="card-sub">Edite qualquer campo antes de aplicar. Nada é salvo até você clicar em "Aplicar selecionados".</span>
    </div>
    <div class="ai-add-menu" id="aiAddMenu">
      <button class="btn sm secondary" onclick="toggleAddMenu()">+ Adicionar manualmente ▾</button>
      <div class="ai-add-drop">
        <button onclick="aiAdd('conclusao')">✅ Conclusão</button>
        <button onclick="aiAdd('status')">🔄 Atualização de etapa</button>
        <button onclick="aiAdd('replan')">📅 Replanejamento</button>
        <button onclick="aiAdd('obs')">💬 Comentário/observação</button>
        <button onclick="aiAdd('nova')">🆕 Nova ação</button>
        <button onclick="aiAdd('risco')">⚠️ Risco</button>
        <button onclick="aiAdd('decisao')">📝 Decisão</button>
        <button onclick="aiAdd('obra')">🏗️ % de obra</button>
      </div>
    </div>
  </div>
  <div class="card-body p">`;

  if(!total){
    html += '<div class="empty-state"><div class="empty-icon">📋</div><h3>Nada por aqui ainda</h3><p>Rode uma análise ou clique em "+ Adicionar manualmente" para começar.</p></div>';
  } else {
    groups.forEach(g=>{
      const items = aiState[g.key];
      if(!items.length) return;
      html += `<h4 style="font-size:12px;text-transform:uppercase;color:var(--text-2);letter-spacing:.05em;margin:16px 0 10px">${g.title} <span class="muted" style="font-weight:500">· ${items.length}</span></h4>`;
      items.forEach(it=>{ html += g.renderItem(it, g.typeCls, g.title.replace(/^\S+\s/,'')); });
    });
    html += `<div style="margin-top:20px;display:flex;gap:8px;padding-top:16px;border-top:1px solid var(--border)">
      <button class="btn" onclick="applyAi()">✓ Aplicar selecionados</button>
      <button class="btn secondary" onclick="aiState=null;document.getElementById('aiReview').innerHTML=''">Descartar tudo</button>
    </div>`;
  }
  html += '</div></div>';
  el.innerHTML = html;
}

/* Renderers para cada tipo */
function evBox(evidence){
  return evidence ? `<div class="ai-sug-evidence">"${esc(evidence)}"</div>` : '';
}
function shell(item, typeCls, typeName, bodyHtml){
  return `<div class="ai-sug ${item.enabled?'':'disabled'}" data-id="${item.id}">
    <div class="ai-sug-head">
      <span class="ai-sug-type ${typeCls}">${typeName}</span>
      <span class="ai-sug-toggle">
        <label><input type="checkbox" ${item.enabled?'checked':''} onchange="aiToggle('${item.id}',this.checked)"> Aplicar este item</label>
        <button class="btn ghost xs" onclick="aiRemove('${item.id}')" title="Remover">🗑️</button>
      </span>
    </div>
    <div class="ai-sug-body">${bodyHtml}</div>
  </div>`;
}
function renderConclusao(it, typeCls, typeName){
  return shell(it, typeCls, typeName, `
    <div class="field-row">
      <div class="field"><label>Ação a concluir</label><select onchange="aiSet('${it.id}','actionId',this.value)">${actionOptions(it.actionId)}</select></div>
      <div class="field"><label>Data de conclusão</label><input type="date" value="${it.date||''}" onchange="aiSet('${it.id}','date',this.value)"></div>
    </div>
    ${evBox(it.evidence)}
  `);
}
function renderStatus(it, typeCls, typeName){
  return shell(it, typeCls, typeName, `
    <div class="field-row">
      <div class="field"><label>Ação</label><select onchange="aiSet('${it.id}','actionId',this.value)">${actionOptions(it.actionId)}</select></div>
      <div class="field"><label>Novo status (etapa)</label><select onchange="aiSet('${it.id}','newStatus',this.value)">
        <option ${it.newStatus==='NÃO INICIADO'?'selected':''}>NÃO INICIADO</option>
        <option ${it.newStatus==='EM ANDAMENTO'?'selected':''}>EM ANDAMENTO</option>
        <option ${it.newStatus==='CONCLUÍDO'?'selected':''}>CONCLUÍDO</option>
        <option ${it.newStatus==='NÃO SE APLICA'?'selected':''}>NÃO SE APLICA</option>
      </select></div>
    </div>
    ${evBox(it.evidence)}
  `);
}
function renderReplan(it, typeCls, typeName){
  return shell(it, typeCls, typeName, `
    <div class="field-row">
      <div class="field"><label>Ação a replanejar</label><select onchange="aiSet('${it.id}','actionId',this.value)">${actionOptions(it.actionId)}</select></div>
      <div class="field"><label>Novo prazo</label><input type="date" value="${it.newEnd||''}" onchange="aiSet('${it.id}','newEnd',this.value)"></div>
    </div>
    <div class="field"><label>Motivo do replanejamento</label><input value="${esc(it.reason||'')}" oninput="aiSet('${it.id}','reason',this.value)" placeholder="Ex: atraso da concessionária"></div>
    ${evBox(it.evidence)}
  `);
}
function renderObs(it, typeCls, typeName){
  return shell(it, typeCls, typeName, `
    <div class="field"><label>Ação</label><select onchange="aiSet('${it.id}','actionId',this.value)">${actionOptions(it.actionId)}</select></div>
    <div class="field"><label>Comentário / observação</label><textarea oninput="aiSet('${it.id}','newObs',this.value)" placeholder="Comentário a registrar na ação...">${esc(it.newObs||'')}</textarea></div>
    <div class="field"><label>Como aplicar</label><select onchange="aiSet('${it.id}','mode',this.value)">
      <option value="append" ${it.mode==='append'?'selected':''}>Adicionar ao final da observação atual</option>
      <option value="replace" ${it.mode==='replace'?'selected':''}>Substituir a observação atual</option>
    </select></div>
    ${evBox(it.evidence)}
  `);
}
function renderNova(it, typeCls, typeName){
  return shell(it, typeCls, typeName, `
    <div class="field"><label>Nome da nova ação</label><input value="${esc(it.name||'')}" oninput="aiSet('${it.id}','name',this.value)" placeholder="Ex: Contratar empresa de vistoria"></div>
    <div class="field-row">
      <div class="field"><label>Bloco</label><select onchange="aiSet('${it.id}','blockId',this.value)">${blockOptions(it.blockId)}</select></div>
      <div class="field"><label>Prazo</label><input type="date" value="${it.end||''}" onchange="aiSet('${it.id}','end',this.value)"></div>
    </div>
    <div class="field"><label>Responsáveis (áreas)</label>${respsChipsEditor(it)}</div>
    <div class="field"><label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0"><input type="checkbox" ${it.milestone?'checked':''} onchange="aiSet('${it.id}','milestone',this.checked)" style="width:auto"> ⭐ Exibir na linha do tempo</label></div>
    ${evBox(it.evidence)}
  `);
}
function renderRisco(it, typeCls, typeName){
  return shell(it, typeCls, typeName, `
    <div class="field"><label>Ação com risco</label><select onchange="aiSet('${it.id}','actionId',this.value)">${actionOptions(it.actionId)}</select></div>
    <div class="field"><label>Descrição do risco</label><textarea oninput="aiSet('${it.id}','note',this.value)">${esc(it.note||'')}</textarea></div>
    ${evBox(it.evidence)}
  `);
}
function renderDecisao(it, typeCls, typeName){
  return shell(it, typeCls, typeName, `
    <div class="field"><label>Bloco onde registrar</label><select onchange="aiSet('${it.id}','blockId',this.value)">${blockOptions(it.blockId)}</select></div>
    <div class="field"><label>Texto da decisão</label><textarea oninput="aiSet('${it.id}','text',this.value)">${esc(it.text||'')}</textarea></div>
    ${evBox(it.evidence)}
  `);
}
function renderObra(it, typeCls, typeName){
  return shell(it, typeCls, typeName, `
    <div class="field-row">
      <div class="field"><label>Data</label><input type="date" value="${it.date||today()}" onchange="aiSet('${it.id}','date',this.value)"></div>
      <div class="field"><label>% de obra</label><input type="number" min="0" max="100" step="0.1" value="${it.pct}" oninput="aiSet('${it.id}','pct',parseFloat(this.value)||0)"></div>
    </div>
    <div class="field"><label>Observação (opcional)</label><input value="${esc(it.note||'')}" oninput="aiSet('${it.id}','note',this.value)" placeholder="Ex: registrado na reunião"></div>
    ${evBox(it.evidence)}
  `);
}

/* Aplica todos os itens enabled */
function applyAi(){
  if(!aiState) return;
  const c = currentCommittee();
  const findAction = (aid)=>{ for(const b of c.blocks){ const a=b.actions.find(x=>x.id===aid); if(a) return {b,a} } return null };
  const findBlock  = (bid)=>c.blocks.find(b=>b.id===bid);
  let applied = 0, skipped = 0;

  // Conclusões
  aiState.conclusoes.filter(x=>x.enabled).forEach(x=>{
    const f=findAction(x.actionId); if(!f){ skipped++; return }
    f.a.status='CONCLUÍDO';
    f.a.actualEnd=x.date||today();
    if(f.a.end && f.a.actualEnd > f.a.end){
      const late = daysBetween(f.a.end, f.a.actualEnd);
      pushHistory(f.a,'CONCLUSÃO COM ATRASO',`Prazo era ${fmt(f.a.end)}, concluída em ${fmt(f.a.actualEnd)} — ${late} dia(s) de atraso${x.evidence?' · '+x.evidence:''}`);
    } else {
      pushHistory(f.a,'CONCLUSÃO',`Concluído via reunião${x.evidence?' · '+x.evidence:''}`);
    }
    applied++;
  });

  // Atualizações de status
  aiState.atualizacoesStatus.filter(x=>x.enabled).forEach(x=>{
    const f=findAction(x.actionId); if(!f){ skipped++; return }
    const oldSt=f.a.status;
    f.a.status=x.newStatus;
    if(x.newStatus==='CONCLUÍDO' && !f.a.actualEnd) f.a.actualEnd=today();
    if(x.newStatus==='CONCLUÍDO' && f.a.end && f.a.actualEnd > f.a.end){
      const late = daysBetween(f.a.end, f.a.actualEnd);
      pushHistory(f.a,'CONCLUSÃO COM ATRASO',`Prazo era ${fmt(f.a.end)}, concluída em ${fmt(f.a.actualEnd)} — ${late} dia(s) de atraso${x.evidence?' · '+x.evidence:''}`);
    } else {
      pushHistory(f.a, x.newStatus==='CONCLUÍDO'?'CONCLUSÃO':'STATUS', `Status: ${oldSt} → ${x.newStatus}${x.evidence?' · '+x.evidence:''}`);
    }
    applied++;
  });

  // Replanejamentos
  aiState.replanejamentos.filter(x=>x.enabled).forEach(x=>{
    const f=findAction(x.actionId); if(!f){ skipped++; return }
    pushHistory(f.a,'REPLANEJAMENTO',`Término: ${fmt(f.a.end)} → ${fmt(x.newEnd)} · Motivo: ${x.reason||'—'}`);
    f.a.end=x.newEnd||f.a.end;
    applied++;
  });

  // Comentários/observações
  aiState.atualizacoesObs.filter(x=>x.enabled && x.newObs).forEach(x=>{
    const f=findAction(x.actionId); if(!f){ skipped++; return }
    if(x.mode==='replace') f.a.obs = x.newObs;
    else f.a.obs = (f.a.obs ? f.a.obs+' · ' : '') + x.newObs;
    pushHistory(f.a,'COMENTÁRIO',x.newObs);
    applied++;
  });

  // Novas ações
  aiState.novasAcoes.filter(x=>x.enabled && x.name).forEach(x=>{
    const b=findBlock(x.blockId); if(!b){ skipped++; return }
    const na={
      id:uid('a'), name:x.name, resps:x.resps||[],
      status:'NÃO INICIADO', start:null, end:x.end||null, actualEnd:null,
      obs:'', milestone:!!x.milestone, history:[], notes:[]
    };
    pushHistory(na,'CRIADO',`Via reunião${x.evidence?' · '+x.evidence:''}`);
    b.actions.push(na);
    applied++;
  });

  // Riscos
  aiState.riscos.filter(x=>x.enabled && x.note).forEach(x=>{
    const f=findAction(x.actionId); if(!f){ skipped++; return }
    f.a.obs=(f.a.obs?f.a.obs+' · ':'')+'⚠ '+x.note;
    pushHistory(f.a,'RISCO',x.note);
    applied++;
  });

  // Decisões
  aiState.decisoes.filter(x=>x.enabled && x.text).forEach(x=>{
    const b=findBlock(x.blockId); if(!b){ skipped++; return }
    b.notes=b.notes||[];
    b.notes.push({when:new Date().toISOString(),text:x.text});
    applied++;
  });

  // Obra
  aiState.obraPct.filter(x=>x.enabled).forEach(x=>{
    c.obraHistory=c.obraHistory||[];
    c.obraHistory.push({date:x.date||today(), pct:x.pct, note:x.note||'Via reunião'});
    c.obraHistory.sort((a,b)=>a.date.localeCompare(b.date));
    applied++;
  });

  aiState=null;
  document.getElementById('aiTranscript').value='';
  save();
  renderAll();
  crcAlert(`${applied} atualização(ões) aplicada(s)${skipped?` · ${skipped} ignorada(s) por faltar seleção`:''}.`);
  switchView('dashboard');
}

/* ========= MODAL HELPERS ========= */
function openModal(id){
  if(id==='modalNewCommittee') openNewCommittee();
  document.getElementById(id).classList.add('show');
}
function closeModal(id){ document.getElementById(id).classList.remove('show') }
document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('show') }));

/* ========= TOOLTIP (só no nome da ação) ========= */
(function setupTooltip(){
  const box = document.getElementById('tooltipBox');
  document.addEventListener('mouseover', e=>{
    const row = e.target.closest('.action-name[data-obs], .tl-mark[data-obs], .d-name[data-obs]');
    if(!row){ box.classList.remove('show'); return }
    const obs = row.getAttribute('data-obs');
    const name = row.getAttribute('data-actname');
    const status = row.getAttribute('data-status');
    const end = row.getAttribute('data-end');
    box.innerHTML = `<div class="t-title">${name||'Ação'}</div>
      <div><b>Status:</b> ${status||'—'}</div>
      <div><b>Prazo:</b> ${end?fmt(end):'—'}</div>
      ${obs?`<div class="t-obs"><b>📝 Observação</b><br>${obs}</div>`:'<div class="muted" style="margin-top:6px;color:#94A3B8">Sem observação registrada</div>'}`;
    box.classList.add('show');
  });
  document.addEventListener('mousemove', e=>{
    if(!box.classList.contains('show')) return;
    box.style.left = Math.min(e.clientX+14, window.innerWidth-360)+'px';
    box.style.top = Math.min(e.clientY+14, window.innerHeight-180)+'px';
  });
  document.addEventListener('mouseout', e=>{
    if(!e.relatedTarget || !e.relatedTarget.closest?.('.action-name[data-obs], .tl-mark[data-obs], .d-name[data-obs]')) box.classList.remove('show');
  });
})();

/* Fecha o menu "+ Adicionar" quando clica fora */
document.addEventListener('click', e=>{
  const menu = document.getElementById('aiAddMenu');
  if(menu && !menu.contains(e.target)) menu.classList.remove('open');
});

/* ================================================ */
/* ============ ANEXOS ============================ */
/* ================================================ */
const MAX_ATT_SIZE = 5 * 1024 * 1024; // 5 MB

function fileToDataURL(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = ()=>rej(new Error('Falha ao ler '+file.name));
    r.readAsDataURL(file);
  });
}
function formatSize(bytes){
  if(bytes<1024) return bytes+' B';
  if(bytes<1024*1024) return (bytes/1024).toFixed(1)+' KB';
  return (bytes/1024/1024).toFixed(2)+' MB';
}
function fileIcon(type){
  if(!type) return '📄';
  if(type.startsWith('image/')) return '🖼️';
  if(type.includes('pdf')) return '📕';
  if(type.includes('word')||type.includes('document')) return '📘';
  if(type.includes('sheet')||type.includes('excel')||type.includes('csv')) return '📗';
  if(type.includes('zip')||type.includes('compressed')) return '🗜️';
  if(type.startsWith('video/')) return '🎬';
  if(type.startsWith('audio/')) return '🎵';
  return '📄';
}
async function attachFiles(a, files){
  a.attachments = a.attachments || [];
  let added = 0, skipped = 0;
  for(const f of files){
    if(f.size > MAX_ATT_SIZE){ skipped++; console.warn('Ignorado (>5MB):', f.name); continue }
    try{
      const dataUrl = await fileToDataURL(f);
      a.attachments.push({
        id: uid('att'),
        name: f.name,
        type: f.type,
        size: f.size,
        data: dataUrl,
        addedAt: new Date().toISOString()
      });
      pushHistory(a,'ANEXO',`Anexado: ${f.name} (${formatSize(f.size)})`);
      added++;
    }catch(e){ skipped++; console.error(e) }
  }
  try{ save(); }
  catch(e){
    // Se estourar quota, remove o último e avisa
    a.attachments = a.attachments.slice(0, a.attachments.length - added);
    crcAlert('⚠ Espaço insuficiente no navegador (~5-10MB total). Remova anexos antigos ou exporte um backup e limpe o histórico.');
    return {added:0, skipped:files.length};
  }
  return {added, skipped};
}
async function downloadAttachment(att){
  // Recém-anexado e ainda não enviado: usa o conteúdo em memória; senão, link do Storage.
  let href = att.data;
  if(!href){
    try{ href = await crcBridge.anexoUrl(att.path, att.name) }
    catch(e){ crcAlert('Não foi possível baixar o anexo: '+e.message); return }
  }
  const a = document.createElement('a');
  a.href = href; a.download = att.name; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}

/* --- Modal Editar: anexos --- */
function renderEaAttachments(){
  // Elemento inline foi substituído por botão + modal. Mantido para compat.
  if(!editingActionRef) return;
  const c = currentCommittee();
  const b = c.blocks.find(b=>b.id===editingActionRef.bid);
  const a = b.actions.find(x=>x.id===editingActionRef.aid);
  if(a) updateQuickButtons(a);
}
function downloadCurrentAtt(attId){
  const c = currentCommittee();
  const b = c.blocks.find(b=>b.id===editingActionRef.bid);
  const a = b.actions.find(x=>x.id===editingActionRef.aid);
  const att = (a.attachments||[]).find(x=>x.id===attId);
  if(att) downloadAttachment(att);
}
async function deleteEaAtt(attId){
  if(!(await crcConfirm('Excluir este anexo?', {danger:true, okLabel:'Excluir'}))) return;
  const c = currentCommittee();
  const b = c.blocks.find(b=>b.id===editingActionRef.bid);
  const a = b.actions.find(x=>x.id===editingActionRef.aid);
  const att = (a.attachments||[]).find(x=>x.id===attId);
  a.attachments = (a.attachments||[]).filter(x=>x.id!==attId);
  if(att) pushHistory(a,'ANEXO',`Anexo removido: ${att.name}`);
  save(); renderEaAttachments(); renderHistory(a);
}
async function onEaFilePick(files){
  if(!editingActionRef || !files.length) return;
  const c = currentCommittee();
  const b = c.blocks.find(b=>b.id===editingActionRef.bid);
  const a = b.actions.find(x=>x.id===editingActionRef.aid);
  const r = await attachFiles(a, files);
  renderEaAttachments();
  renderCommittee(); // atualiza indicador na linha
  if(r.skipped) crcAlert(`${r.added} anexado(s), ${r.skipped} ignorado(s) por tamanho (máx 5MB).`);
}

/* --- Atalho rápido: modal simples --- */
let quickAttachRef = null;
function quickAttach(bid, aid){
  quickAttachRef = {bid, aid};
  const c = currentCommittee();
  const b = c.blocks.find(x=>x.id===bid);
  const a = b.actions.find(x=>x.id===aid);
  document.getElementById('qaTitle').textContent = 'Anexar em: '+a.name;
  renderQaList();
  openModal('modalQuickAttach');
}
function renderQaList(){
  if(!quickAttachRef) return;
  const c = currentCommittee();
  const b = c.blocks.find(x=>x.id===quickAttachRef.bid);
  const a = b.actions.find(x=>x.id===quickAttachRef.aid);
  const atts = a.attachments||[];
  document.getElementById('qaList').innerHTML = atts.length ? atts.map(att=>`
    <div class="att-item">
      <span class="att-icon">${fileIcon(att.type)}</span>
      <span class="att-name" onclick="qaDownload('${att.id}')">${esc(att.name)}</span>
      <span class="att-meta">${formatSize(att.size)}</span>
      <button class="btn xs danger" onclick="qaDelete('${att.id}')">🗑️</button>
    </div>`).join('') : '<div class="muted" style="text-align:center;padding:8px">Sem anexos ainda</div>';
}
function qaDownload(attId){
  const c = currentCommittee();
  const b = c.blocks.find(x=>x.id===quickAttachRef.bid);
  const a = b.actions.find(x=>x.id===quickAttachRef.aid);
  const att = (a.attachments||[]).find(x=>x.id===attId);
  if(att) downloadAttachment(att);
}
async function qaDelete(attId){
  if(!(await crcConfirm('Excluir este anexo?', {danger:true, okLabel:'Excluir'}))) return;
  const c = currentCommittee();
  const b = c.blocks.find(x=>x.id===quickAttachRef.bid);
  const a = b.actions.find(x=>x.id===quickAttachRef.aid);
  const att = (a.attachments||[]).find(x=>x.id===attId);
  a.attachments = (a.attachments||[]).filter(x=>x.id!==attId);
  if(att) pushHistory(a,'ANEXO',`Anexo removido: ${att.name}`);
  save(); renderQaList(); renderCommittee();
  if(editingActionRef && editingActionRef.aid===quickAttachRef.aid){
    updateQuickButtons(a);
    renderHistory(a);
  }
}
async function onQaFilePick(files){
  if(!quickAttachRef || !files.length) return;
  const c = currentCommittee();
  const b = c.blocks.find(x=>x.id===quickAttachRef.bid);
  const a = b.actions.find(x=>x.id===quickAttachRef.aid);
  const r = await attachFiles(a, files);
  renderQaList();
  renderCommittee();
  // Se o modal editar está aberto para esta mesma ação, atualiza o botão
  if(editingActionRef && editingActionRef.aid===quickAttachRef.aid){
    updateQuickButtons(a);
    renderHistory(a);
  }
  if(r.skipped) crcAlert(`${r.added} anexado(s), ${r.skipped} ignorado(s) por tamanho (máx 5MB).`);
}

/* Setup dos inputs de arquivo + drag&drop */
(function setupAttachInputs(){
  const bind = (dropId, inputId, cb)=>{
    document.addEventListener('DOMContentLoaded', ()=>{
      const drop = document.getElementById(dropId);
      const inp = document.getElementById(inputId);
      if(!drop || !inp) return;
      inp.addEventListener('change', e=>{ cb(e.target.files); inp.value='' });
      drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag') });
      drop.addEventListener('dragleave', ()=>drop.classList.remove('drag'));
      drop.addEventListener('drop', e=>{ e.preventDefault(); drop.classList.remove('drag'); cb(e.dataTransfer.files) });
    });
  };
  // Como o script roda antes do DOMContentLoaded em alguns casos, faço binding direto agora se possível
  const doBind = ()=>{
    const eaInp = document.getElementById('eaAttInput');
    const eaDrop = document.getElementById('eaAttDrop');
    if(eaInp && !eaInp._bound){
      eaInp._bound=true;
      eaInp.addEventListener('change', e=>{ onEaFilePick(e.target.files); eaInp.value='' });
      eaDrop.addEventListener('dragover', e=>{ e.preventDefault(); eaDrop.classList.add('drag') });
      eaDrop.addEventListener('dragleave', ()=>eaDrop.classList.remove('drag'));
      eaDrop.addEventListener('drop', e=>{ e.preventDefault(); eaDrop.classList.remove('drag'); onEaFilePick(e.dataTransfer.files) });
    }
    const qaInp = document.getElementById('qaInput');
    const qaDrop = document.getElementById('qaDrop');
    if(qaInp && !qaInp._bound){
      qaInp._bound=true;
      qaInp.addEventListener('change', e=>{ onQaFilePick(e.target.files); qaInp.value='' });
      qaDrop.addEventListener('dragover', e=>{ e.preventDefault(); qaDrop.classList.add('drag') });
      qaDrop.addEventListener('dragleave', ()=>qaDrop.classList.remove('drag'));
      qaDrop.addEventListener('drop', e=>{ e.preventDefault(); qaDrop.classList.remove('drag'); onQaFilePick(e.dataTransfer.files) });
    }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', doBind);
  else doBind();
})();

/* ================================================ */
/* ============ IA — RESUMO DA REUNIÃO ============ */
/* ================================================ */
let lastTranscript = '';
let summaryCache = { email:'', whatsapp:'' };
let currentSummaryTab = 'email';

async function generateMeetingSummary(kind){
  const t = lastTranscript || document.getElementById('aiTranscript').value.trim();
  if(!t){ crcAlert('Cole a transcrição primeiro (ou rode a análise antes).'); return }
  const c = currentCommittee();
  document.getElementById('btnSummaryEmail').disabled = true;
  document.getElementById('btnSummaryWpp').disabled = true;
  const now = new Date().toLocaleDateString('pt-BR');

  // Contexto atual — para incluir próximas ações reais
  const acoes = c.blocks.flatMap(b=>b.actions.map(a=>({
    block:b.name, name:a.name, resps:actionResps(a), status:a.status, end:a.end
  })));

  const emailInstr = `Formato: e-mail formal em português.
- Assunto sugerido no topo (linha "Assunto: ...")
- Saudação
- Bloco "Resumo da reunião" com 3 a 6 bullets do que foi tratado
- Bloco "Decisões tomadas" com as decisões (se houver)
- Bloco "Próximas ações" — cada uma com: descrição, RESPONSÁVEL e PRAZO
- Bloco "Pontos de atenção / riscos" (se houver)
- Encerramento cordial
Use texto plano. NÃO use markdown com ** ou #.`;

  const wppInstr = `Formato: mensagem para WhatsApp em português, curta e escaneável.
- Título com emoji: 📋 *Reunião do Comitê — ${c.name}* — ${now}
- Seção "*✅ O que decidimos*" com bullets curtos
- Seção "*📌 Próximas ações*" — cada linha: "• descrição — *RESPONSÁVEL* — até PRAZO"
- Seção "*⚠️ Atenção*" com pontos críticos (se houver)
- No fim: "Qualquer dúvida, chama."
Use *asterisco* para negrito (padrão WhatsApp). Sem markdown com # ou **.`;

  const prompt = `Você é assistente do Comitê de Entrega do projeto "${c.name}".
Com base na transcrição/notas abaixo, gere um comunicado ${kind==='email'?'para e-mail':'para grupo de WhatsApp'}.

${kind==='email'?emailInstr:wppInstr}

Contexto — ações atuais do projeto (use para inferir responsáveis/prazos quando não estiverem explícitos na transcrição):
${acoes.slice(0,40).map(a=>`- ${a.block} · ${a.name} · ${a.resps.join('+')||'—'} · ${a.status} · prazo ${a.end||'—'}`).join('\n')}

TRANSCRIÇÃO/NOTAS:
"""
${t}
"""

Devolva SOMENTE o texto do comunicado, pronto para enviar. Sem explicações antes ou depois.`;

  try{
    let respText;
    respText = await callIa(prompt, "resumo");
    summaryCache[kind] = respText.trim();
    currentSummaryTab = kind;
    renderSummaryBox();
  }catch(e){ crcAlert('Erro: '+e.message) }
  finally{
    const be = document.getElementById('btnSummaryEmail'); if(be) be.disabled=false;
    const bw = document.getElementById('btnSummaryWpp'); if(bw) bw.disabled=false;
  }
}
function renderSummaryBox(){
  const box = document.getElementById('summaryBox');
  if(!box) return;
  const has = summaryCache.email || summaryCache.whatsapp;
  if(!has){ box.innerHTML=''; return }
  const active = summaryCache[currentSummaryTab] ? currentSummaryTab : (summaryCache.email?'email':'whatsapp');
  currentSummaryTab = active;
  box.innerHTML = `
    <div class="summary-box">
      <div class="summary-tabs">
        ${summaryCache.email?`<button type="button" class="summary-tab ${active==='email'?'active':''}" onclick="switchSummaryTab('email')">📧 E-mail</button>`:''}
        ${summaryCache.whatsapp?`<button type="button" class="summary-tab ${active==='whatsapp'?'active':''}" onclick="switchSummaryTab('whatsapp')">💬 WhatsApp</button>`:''}
        <div style="margin-left:auto;display:flex;gap:6px">
          <button class="btn xs secondary" onclick="copySummary()">📋 Copiar</button>
          <button class="btn xs secondary" onclick="downloadSummary()">⬇️ Baixar .txt</button>
        </div>
      </div>
      <div class="summary-content" id="summaryContent">${esc(summaryCache[active])}</div>
    </div>`;
}
function switchSummaryTab(t){ currentSummaryTab=t; renderSummaryBox(); }
function copySummary(){
  const txt = summaryCache[currentSummaryTab] || '';
  navigator.clipboard.writeText(txt).then(()=>{
    const el = document.getElementById('summaryContent');
    if(el){ const orig = el.style.background; el.style.background='#E9F8F2'; setTimeout(()=>el.style.background=orig, 400) }
  }).catch(()=>crcAlert('Não foi possível copiar. Selecione o texto manualmente.'));
}
function downloadSummary(){
  const txt = summaryCache[currentSummaryTab] || '';
  const c = currentCommittee();
  const blob = new Blob([txt],{type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `resumo-reuniao-${c.name.replace(/\s+/g,'-')}-${today()}.txt`;
  document.body.appendChild(a); a.click(); a.remove();
}

/* Guarda a transcrição depois da análise */
const _origAnalyze = analyzeTranscript;
analyzeTranscript = async function(){
  lastTranscript = document.getElementById('aiTranscript').value.trim();
  summaryCache = { email:'', whatsapp:'' };
  await _origAnalyze();
};

/* ================================================ */
/* ============ RELATÓRIO GERENCIAL =============== */
/* ================================================ */
let reportSel = null; // {[bid]: {included:bool, actions:{[aid]:bool}}}
let reportFilters = null; // {statuses:Set, resps:Set}
const RP_STATUSES = ['NÃO INICIADO','EM ANDAMENTO','CONCLUÍDO','NÃO SE APLICA'];

function openReportModal(){
  const c = currentCommittee();
  reportSel = {};
  c.blocks.forEach(b=>{
    reportSel[b.id] = { included:true, actions:{} };
    b.actions.forEach(a=>{ reportSel[b.id].actions[a.id] = true });
  });
  // Filtros começam com tudo marcado (padrão)
  const allResps = [...new Set(c.blocks.flatMap(b=>b.actions.flatMap(a=>actionResps(a))))].sort();
  reportFilters = {
    statuses: new Set(RP_STATUSES),
    resps: new Set(allResps),
    noRespsFlag: true // controla ações sem responsável
  };
  renderReportFilters();
  renderReportTree();
  openModal('modalReport');
}

function renderReportFilters(){
  const c = currentCommittee();
  // Status
  const statusEl = document.getElementById('rpStatusChips');
  const allStatusSelected = RP_STATUSES.every(s=>reportFilters.statuses.has(s));
  const noStatusSelected = RP_STATUSES.every(s=>!reportFilters.statuses.has(s));
  statusEl.innerHTML = `
    <button type="button" class="chip-filter ${allStatusSelected?'active':''}" onclick="reportFilterAll('statuses', true)">Todos</button>
    <button type="button" class="chip-filter ${noStatusSelected?'active':''}" onclick="reportFilterAll('statuses', false)">Nenhum</button>
    ${RP_STATUSES.map(s=>`<button type="button" class="chip-filter ${reportFilters.statuses.has(s)?'active':''}" onclick="reportFilterToggle('statuses','${s}')">${esc(s)}</button>`).join('')}`;

  // Responsáveis
  const allResps = [...new Set(c.blocks.flatMap(b=>b.actions.flatMap(a=>actionResps(a))))].sort();
  const respEl = document.getElementById('rpRespChips');
  const allRespSelected = allResps.every(r=>reportFilters.resps.has(r)) && reportFilters.noRespsFlag;
  const noRespSelected = allResps.every(r=>!reportFilters.resps.has(r)) && !reportFilters.noRespsFlag;
  respEl.innerHTML = `
    <button type="button" class="chip-filter ${allRespSelected?'active':''}" onclick="reportFilterAll('resps', true)">Todos</button>
    <button type="button" class="chip-filter ${noRespSelected?'active':''}" onclick="reportFilterAll('resps', false)">Nenhum</button>
    ${allResps.map(r=>`<button type="button" class="chip-filter ${reportFilters.resps.has(r)?'active':''}" onclick="reportFilterToggle('resps','${r.replace(/'/g,"\\'")}')">${avatarHtml(r,'sm')} ${esc(r)}</button>`).join('')}
    <button type="button" class="chip-filter ${reportFilters.noRespsFlag?'active':''}" onclick="reportToggleNoResp()" title="Ações sem área cadastrada">Sem área</button>`;
}

function reportFilterAll(cat, on){
  if(cat==='statuses'){
    reportFilters.statuses = on ? new Set(RP_STATUSES) : new Set();
  } else if(cat==='resps'){
    const c = currentCommittee();
    const allResps = [...new Set(c.blocks.flatMap(b=>b.actions.flatMap(a=>actionResps(a))))];
    reportFilters.resps = on ? new Set(allResps) : new Set();
    reportFilters.noRespsFlag = on;
  }
  applyReportFiltersToTree();
  renderReportFilters();
  renderReportTree();
}
function reportFilterToggle(cat, v){
  if(reportFilters[cat].has(v)) reportFilters[cat].delete(v);
  else reportFilters[cat].add(v);
  applyReportFiltersToTree();
  renderReportFilters();
  renderReportTree();
}
function reportToggleNoResp(){
  reportFilters.noRespsFlag = !reportFilters.noRespsFlag;
  applyReportFiltersToTree();
  renderReportFilters();
  renderReportTree();
}

/* Atualiza a árvore de atividades para refletir os filtros */
function applyReportFiltersToTree(){
  const c = currentCommittee();
  c.blocks.forEach(b=>{
    let anySel = false;
    b.actions.forEach(a=>{
      const statusOk = reportFilters.statuses.has(a.status);
      const resps = actionResps(a);
      const respOk = resps.length ? resps.some(r=>reportFilters.resps.has(r)) : reportFilters.noRespsFlag;
      const ok = statusOk && respOk;
      reportSel[b.id].actions[a.id] = ok;
      if(ok) anySel = true;
    });
    reportSel[b.id].included = anySel;
  });
}

function renderReportTree(){
  const c = currentCommittee();
  document.getElementById('reportTree').innerHTML = c.blocks.map(b=>{
    const sel = reportSel[b.id];
    const totalActs = b.actions.length;
    const selActs = Object.values(sel.actions).filter(Boolean).length;
    return `<div style="margin-bottom:8px">
      <label class="rb-block"><input type="checkbox" ${sel.included?'checked':''} onchange="toggleReportBlock('${b.id}',this.checked)"> ${b.name} <span class="muted" style="font-weight:400">(${selActs}/${totalActs})</span></label>
      <div style="padding-left:20px">
        ${b.actions.map(a=>`<label class="rb-action"><input type="checkbox" ${sel.actions[a.id]?'checked':''} onchange="toggleReportAction('${b.id}','${a.id}',this.checked)"> ${esc(a.name)}${a.milestone?' ⭐':''} <span class="muted" style="font-size:11px">· ${esc(a.status)}${actionResps(a).length?' · '+actionResps(a).join('+'):''}</span></label>`).join('')}
      </div>
    </div>`;
  }).join('');
}
function toggleReportBlock(bid, v){
  reportSel[bid].included = v;
  const c = currentCommittee();
  const b = c.blocks.find(x=>x.id===bid);
  b.actions.forEach(a=>reportSel[bid].actions[a.id]=v);
  renderReportTree();
}
function toggleReportAction(bid, aid, v){
  reportSel[bid].actions[aid] = v;
  const anySel = Object.values(reportSel[bid].actions).some(Boolean);
  reportSel[bid].included = anySel;
  renderReportTree();
}
function reportSelectAll(v){
  const c = currentCommittee();
  c.blocks.forEach(b=>{
    reportSel[b.id].included = v;
    b.actions.forEach(a=>reportSel[b.id].actions[a.id]=v);
  });
  renderReportTree();
}
function reportSelectDelayed(){
  const c = currentCommittee();
  c.blocks.forEach(b=>{
    let anySel = false;
    b.actions.forEach(a=>{
      const cls = actionSituation(a).cls;
      const isDelayed = cls==='danger';
      reportSel[b.id].actions[a.id] = isDelayed;
      if(isDelayed) anySel = true;
    });
    reportSel[b.id].included = anySel;
  });
  renderReportTree();
}
function reportSelectMilestones(){
  const c = currentCommittee();
  c.blocks.forEach(b=>{
    let anySel = false;
    b.actions.forEach(a=>{
      reportSel[b.id].actions[a.id] = !!a.milestone;
      if(a.milestone) anySel = true;
    });
    reportSel[b.id].included = anySel;
  });
  renderReportTree();
}

function generateReport(){
  const c = currentCommittee();
  const opts = {
    cover: document.getElementById('rpCover').checked,
    contracapa: document.getElementById('rpContracapa').checked,
    summary: document.getElementById('rpSummary').checked,
    obra: document.getElementById('rpObra').checked,
    analytic: document.getElementById('rpAnalytic').checked,
    resps: document.getElementById('rpDetResps').checked,
    status: document.getElementById('rpDetStatus').checked,
    obs: document.getElementById('rpDetObs').checked,
    hist: document.getElementById('rpDetHist').checked,
    att: document.getElementById('rpDetAtt').checked,
  };
  const html = buildReportHTML(c, opts, reportSel);
  const w = window.open('', '_blank');
  if(!w){ crcAlert('Bloqueado. Permita popups desta página e tente novamente.'); return }
  w.document.write(html); w.document.close();
  closeModal('modalReport');
}

function buildReportHTML(c, opts, sel){
  // Stats
  const allActs = c.blocks.flatMap(b=>b.actions);
  const active = allActs.filter(a=>a.status!=='NÃO SE APLICA');
  const done = active.filter(a=>a.status==='CONCLUÍDO'||a.status==='CONCLUIDO').length;
  const delayed = active.filter(a=>actionSituation(a).cls==='danger').length;
  const soon = active.filter(a=>actionSituation(a).cls==='warn').length;
  const pct = active.length ? Math.round(done/active.length*100) : 0;
  const dToDelivery = daysBetween(today(), c.delivery);
  const obraPct = currentObraPct(c);

  // Analítico com filtro por seleção
  let analyticHtml = '';
  if(opts.analytic){
    c.blocks.forEach((b,bi)=>{
      if(!sel[b.id]?.included) return;
      const acts = b.actions.filter(a=>sel[b.id].actions[a.id]);
      if(!acts.length) return;
      const bp = blockProgress(b);
      analyticHtml += `
        <section class="page">
          <div class="block-hdr">
            <div class="block-title-r">${bi+1}. ${esc(b.name)}</div>
            <div class="block-meta">${bp.done}/${bp.total} concluídas · ${bp.pct}% · ${bp.delayed?`<b style="color:#c9302c">${bp.delayed} em atraso</b>`:'em dia'}</div>
          </div>
          ${acts.map(a=>{
            const s = actionSituation(a);
            // Info de prazo/atraso
            let prazoInfo = '';
            if(s.doneLate){
              prazoInfo = `<tr><th>Situação da entrega</th><td class="cell-late"><b>⚠ Concluída com ${s.lateDays} dia(s) de atraso</b> (prazo era ${fmt(a.end)}, concluída em ${fmt(a.actualEnd)})</td></tr>`;
            } else if(s.doneOnTime){
              prazoInfo = `<tr><th>Situação da entrega</th><td class="cell-ok"><b>✓ Concluída dentro do prazo</b>${a.actualEnd?' em '+fmt(a.actualEnd):''}</td></tr>`;
            } else if(s.delayed){
              prazoInfo = `<tr><th>Dias em atraso</th><td class="cell-danger"><b>${s.delayDays} dia(s) vencido(s)</b> (prazo era ${fmt(a.end)})</td></tr>`;
            } else if(s.dueDays!=null){
              const cls = s.dueDays<=7 ? 'cell-warn' : 'cell-ok';
              prazoInfo = `<tr><th>Dias para vencer</th><td class="${cls}"><b>${s.dueDays} dia(s)</b> restantes</td></tr>`;
            }
            return `<div class="act">
              <div class="act-hdr">
                <div class="act-name">${a.milestone?'⭐ ':''}${esc(a.name)}</div>
                <div class="act-badge ${s.cls}">${s.label}</div>
              </div>
              <table class="act-meta">
                ${opts.resps?`<tr><th>Responsáveis</th><td>${actionRespsStr(a)}</td></tr>`:''}
                ${opts.status?`<tr><th>Status</th><td>${a.status}</td></tr>
                <tr><th>Início planejado</th><td>${fmt(a.start)}</td></tr>
                <tr><th>Término planejado</th><td>${fmt(a.end)}</td></tr>
                ${a.actualEnd?`<tr><th>Concluída em</th><td>${fmt(a.actualEnd)}</td></tr>`:''}
                ${prazoInfo}`:''}
                ${opts.obs && a.obs?`<tr><th>Observações</th><td>${esc(a.obs)}</td></tr>`:''}
                ${opts.att && (a.attachments||[]).length?`<tr><th>Anexos</th><td>${a.attachments.map(x=>esc(x.name)+' ('+formatSize(x.size)+')').join('<br>')}</td></tr>`:''}
              </table>
              ${opts.hist && (a.history||[]).length?`<div class="hist"><b>Histórico</b><ul>${a.history.slice().reverse().slice(0,8).map(h=>`<li><span class="hist-date">${new Date(h.when).toLocaleDateString('pt-BR')} ${new Date(h.when).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span> · <span class="hist-ev">${h.event}</span>${h.user?' · <i>'+esc(h.user)+'</i>':''} — ${esc(h.note||'')}</li>`).join('')}</ul></div>`:''}
            </div>`;
          }).join('')}
        </section>`;
    });
  }

  // CONTRACAPA: linha do tempo dos marcos + concluídos por mês
  let contracapaHtml = '';
  if(opts.contracapa){
    // 1) Linha do tempo — SVG horizontal (mesmo layout do dashboard, adaptado para papel)
    const milestones = c.blocks.flatMap(b=>b.actions.filter(a=>a.milestone).map(a=>({b,a})));
    const dated = milestones.filter(x=>x.a.end).sort((x,y)=>x.a.end.localeCompare(y.a.end));
    const undated = milestones.filter(x=>!x.a.end);

    let timelineTable;
    if(!milestones.length){
      timelineTable = '<p style="color:#94A3B8;font-style:italic">Nenhum marco selecionado neste projeto. Marque as atividades-chave com ⭐ para exibir aqui.</p>';
    } else if(!dated.length){
      timelineTable = `<p style="color:#94A3B8;font-style:italic">${milestones.length} marco(s) selecionado(s), mas nenhum tem data prevista.</p>`;
    } else {
      const now = new Date();
      const dates = dated.map(x=>new Date(x.a.end));
      let minD = new Date(Math.min(now, ...dates));
      let maxD = new Date(Math.max(...dates, c.delivery?new Date(c.delivery):now));
      minD.setDate(minD.getDate()-15);
      maxD.setDate(maxD.getDate()+15);
      const totalMs = maxD-minD;
      const monthsSpan = (maxD.getFullYear()-minD.getFullYear())*12 + maxD.getMonth()-minD.getMonth() + 1;
      const w = Math.max(760, monthsSpan*90);

      const RP_MAX_NAME = 26;
      const RP_CHAR_W = 6.2;
      const RP_LABEL_PAD = 10;
      const RP_LEVEL_H = 34;
      const RP_BASE_TOP = 40;
      const RP_BASE_BOTTOM = 32;

      const rpItems = dated.map(m=>{
        const d = new Date(m.a.end);
        const x = ((d-minD)/totalMs)*w;
        const s = actionSituation(m.a);
        const color = s.doneLate?'#facc15'
                    : (m.a.status==='CONCLUÍDO'||m.a.status==='CONCLUIDO')?'#43B997'
                    : s.cls==='danger'?'#EF4444'
                    : s.cls==='warn'?'#F59E0B'
                    : '#3B82F6';
        const name = truncateStr(m.a.name, RP_MAX_NAME);
        const dateStr = fmt(m.a.end);
        const halfW = Math.max(name.length, dateStr.length) * RP_CHAR_W / 2 + RP_LABEL_PAD/2;
        return { m, x, color, name, dateStr, halfW };
      });

      const rpPlaced = [];
      rpItems.forEach((it,i)=>{
        let side = i%2===0 ? 'above' : 'below';
        let level = 0;
        const collides = (sd,lv)=>rpPlaced.some(p=>p.side===sd && p.level===lv
          && Math.abs(p.x - it.x) < (p.halfW + it.halfW));
        let found = false;
        for(let attempt=0; attempt<12; attempt++){
          if(!collides(side, level)){ found=true; break }
          if(side==='above') side='below';
          else { side='above'; level++; }
        }
        if(!found) level=5;
        it.side = side; it.level = level;
        rpPlaced.push(it);
      });
      const rpMaxAbove = Math.max(0, ...rpPlaced.filter(p=>p.side==='above').map(p=>p.level));
      const rpMaxBelow = Math.max(0, ...rpPlaced.filter(p=>p.side==='below').map(p=>p.level));
      const rpTopSpace = RP_BASE_TOP + (rpMaxAbove+1) * RP_LEVEL_H;
      const rpBottomSpace = RP_BASE_BOTTOM + (rpMaxBelow+1) * RP_LEVEL_H;
      const midY = rpTopSpace;
      const h = rpTopSpace + rpBottomSpace;

      // Grid mensal
      let grid = '';
      const monthCursor = new Date(minD.getFullYear(), minD.getMonth(), 1);
      while(monthCursor <= maxD){
        const x = ((monthCursor-minD)/totalMs)*w;
        grid += `<line x1="${x}" y1="${RP_BASE_TOP-8}" x2="${x}" y2="${h-RP_BASE_BOTTOM+8}" stroke="#EEEEF1"/>`;
        grid += `<text x="${x+4}" y="${h-4}" font-size="10" fill="#64748B">${monthCursor.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'})}</text>`;
        monthCursor.setMonth(monthCursor.getMonth()+1);
      }
      grid += `<line x1="0" y1="${midY}" x2="${w}" y2="${midY}" stroke="#94A3B8" stroke-width="2"/>`;

      // Marca HOJE
      const nowX = ((now-minD)/totalMs)*w;
      if(nowX>=0 && nowX<=w){
        grid += `<line x1="${nowX}" y1="${RP_BASE_TOP-8}" x2="${nowX}" y2="${h-RP_BASE_BOTTOM+8}" stroke="#EF4444" stroke-dasharray="5,4" stroke-width="2"/>`;
        grid += `<rect x="${nowX-19}" y="14" width="42" height="15" rx="3" fill="#EF4444"/>`;
        grid += `<text x="${nowX+2}" y="25" font-size="10" fill="#fff" font-weight="700" text-anchor="middle">HOJE</text>`;
      }
      if(c.delivery){
        const delX = ((new Date(c.delivery)-minD)/totalMs)*w;
        if(delX>=0 && delX<=w){
          grid += `<line x1="${delX}" y1="${RP_BASE_TOP-8}" x2="${delX}" y2="${h-RP_BASE_BOTTOM+8}" stroke="#43B997" stroke-dasharray="5,4" stroke-width="2"/>`;
          grid += `<rect x="${delX-34}" y="14" width="70" height="15" rx="3" fill="#43B997"/>`;
          grid += `<text x="${delX+2}" y="25" font-size="10" fill="#fff" font-weight="700" text-anchor="middle">ENTREGA</text>`;
        }
      }

      // Marcos com múltiplos níveis anti-colisão
      let marks = '';
      rpPlaced.forEach(it=>{
        const {x, color, name, dateStr, side, level} = it;
        const offset = 20 + level*RP_LEVEL_H;
        let labelY, dateY, lineY1, lineY2;
        if(side==='above'){
          lineY1 = midY - 8; lineY2 = midY - offset;
          labelY = lineY2 - 14; dateY = lineY2 - 2;
        } else {
          lineY1 = midY + 8; lineY2 = midY + offset;
          labelY = lineY2 + 12; dateY = lineY2 + 24;
        }
        marks += `<g>
          <line x1="${x}" y1="${lineY1}" x2="${x}" y2="${lineY2}" stroke="${color}" stroke-width="1.5"/>
          <circle cx="${x}" cy="${midY}" r="7" fill="${color}" stroke="#fff" stroke-width="2"/>
          <text x="${x}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="600" fill="#111827">${esc(name)}</text>
          <text x="${x}" y="${dateY}" text-anchor="middle" font-size="10" fill="#64748B">${dateStr}</text>
        </g>`;
      });

      timelineTable = `
        <div style="overflow-x:auto;background:#fff;border:1px solid #EEEEF1;border-radius:6px;padding:10px 0;margin-bottom:8px">
          <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="display:block;max-width:100%;height:auto">${grid}${marks}</svg>
        </div>
        <div style="display:flex;gap:16px;font-size:11px;color:#64748B;flex-wrap:wrap;margin-bottom:12px">
          <span><span style="display:inline-block;width:10px;height:10px;background:#43B997;border-radius:50%;vertical-align:middle;margin-right:4px"></span>Concluído no prazo</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#facc15;border-radius:50%;vertical-align:middle;margin-right:4px"></span>Concluído com atraso</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#EF4444;border-radius:50%;vertical-align:middle;margin-right:4px"></span>Em atraso</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#F59E0B;border-radius:50%;vertical-align:middle;margin-right:4px"></span>≤7 dias</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#3B82F6;border-radius:50%;vertical-align:middle;margin-right:4px"></span>Planejado</span>
        </div>
        ${undated.length?`<p style="color:#94A3B8;font-size:11px;margin:0 0 10px">⚠ ${undated.length} marco(s) sem data prevista, não exibidos no gráfico: ${undated.map(x=>esc(x.a.name)).join(', ')}</p>`:''}`;
    }

    const timelineHeader = '<h3>📍 Linha do tempo — marcos</h3>';
    const timelineFullBlock = timelineHeader + timelineTable;

    // 2) Concluídos por mês — últimos 12 meses
    const now = new Date();
    const months = [];
    for(let i=11;i>=0;i--){
      const dt = new Date(now.getFullYear(), now.getMonth()-i, 1);
      months.push({y:dt.getFullYear(), m:dt.getMonth(), label:dt.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'})});
    }
    const allActsForChart = c.blocks.flatMap(b=>b.actions);
    const dataPerMonth = months.map(mo=>{
      const rec = allActsForChart.filter(a=>{
        const end = a.actualEnd || ((a.status==='CONCLUÍDO'||a.status==='CONCLUIDO')?a.end:null);
        if(!end) return false;
        const d = new Date(end);
        return d.getFullYear()===mo.y && d.getMonth()===mo.m;
      });
      const late = rec.filter(a=>{
        const s = actionSituation(a);
        return s.doneLate;
      }).length;
      return {label:mo.label, total:rec.length, late, onTime: rec.length-late};
    });
    const maxVal = Math.max(1, ...dataPerMonth.map(d=>d.total));
    const chartW = 720, chartH = 180, padL = 30, padB = 30, padT = 10, padR = 10;
    const innerW = chartW-padL-padR, innerH = chartH-padT-padB;
    const barW = innerW/dataPerMonth.length * 0.7;
    const gap = innerW/dataPerMonth.length * 0.3;
    let bars = '';
    dataPerMonth.forEach((d,i)=>{
      const x = padL + i*(barW+gap) + gap/2;
      const totalH = d.total/maxVal*innerH;
      const lateH = d.late/maxVal*innerH;
      const onTimeH = totalH - lateH;
      const yTotal = padT+innerH-totalH;
      // barra concluídos no prazo (verde)
      bars += `<rect x="${x}" y="${padT+innerH-onTimeH}" width="${barW}" height="${onTimeH}" fill="#43B997" rx="2"/>`;
      // barra atrasados (amarelo) empilhado
      if(lateH>0) bars += `<rect x="${x}" y="${yTotal}" width="${barW}" height="${lateH}" fill="#facc15" rx="2"/>`;
      if(d.total) bars += `<text x="${x+barW/2}" y="${yTotal-4}" text-anchor="middle" font-size="10" fill="#111827" font-weight="700">${d.total}</text>`;
      bars += `<text x="${x+barW/2}" y="${chartH-8}" text-anchor="middle" font-size="9" fill="#64748B">${d.label}</text>`;
    });
    // grid
    let grid = '';
    for(let i=0;i<=4;i++){
      const y = padT+innerH-(innerH*i/4);
      const val = Math.round(maxVal*i/4);
      grid += `<line x1="${padL}" y1="${y}" x2="${chartW-padR}" y2="${y}" stroke="#EEEEF1"/>`;
      grid += `<text x="${padL-6}" y="${y+3}" text-anchor="end" font-size="9" fill="#94A3B8">${val}</text>`;
    }

    // Total geral concluídos período
    const totalDone = dataPerMonth.reduce((s,d)=>s+d.total,0);
    const totalLate = dataPerMonth.reduce((s,d)=>s+d.late,0);

    contracapaHtml = `<section class="page">
      <h2>📊 Panorama executivo</h2>
      ${timelineFullBlock}
      <h3 style="margin-top:24px">📈 Concluídos por mês <span style="font-weight:400;font-size:12px;color:#64748B">(últimos 12 meses)</span></h3>
      <div style="display:flex;gap:20px;align-items:center;margin-bottom:8px">
        <div><b style="font-size:22px;color:#43B997">${totalDone}</b> <span style="font-size:11px;color:#64748B">total concluído</span></div>
        <div><b style="font-size:22px;color:${totalLate?'#854d0e':'#94A3B8'}">${totalLate}</b> <span style="font-size:11px;color:#64748B">com atraso</span></div>
        <div style="margin-left:auto;font-size:11px;color:#64748B">
          <span style="display:inline-block;width:12px;height:12px;background:#43B997;border-radius:2px;vertical-align:middle;margin-right:4px"></span>no prazo
          &nbsp;&nbsp;
          <span style="display:inline-block;width:12px;height:12px;background:#facc15;border-radius:2px;vertical-align:middle;margin-right:4px"></span>com atraso
        </div>
      </div>
      <svg viewBox="0 0 ${chartW} ${chartH}" style="width:100%;height:auto;display:block;border:1px solid #EEEEF1;border-radius:6px;background:#fff">${grid}${bars}</svg>
    </section>`;
  }

  // Obra
  let obraHtml = '';
  if(opts.obra && c.obraHistory && c.obraHistory.length){
    obraHtml = `<section class="page">
      <h2>🏗️ Evolução da obra</h2>
      <table class="tbl">
        <thead><tr><th>Data</th><th>% Obra</th><th>Observação</th></tr></thead>
        <tbody>${c.obraHistory.slice().reverse().map(h=>`<tr><td>${fmt(h.date)}</td><td><b>${h.pct}%</b></td><td>${esc(h.note||'')}</td></tr>`).join('')}</tbody>
      </table>
    </section>`;
  }

  // Sumário executivo (Top atrasos + próximos)
  let summaryHtml = '';
  if(opts.summary){
    const delays = active.filter(a=>actionSituation(a).cls==='danger').map(a=>{
      const b = c.blocks.find(b=>b.actions.includes(a));
      return {a,b,d:daysBetween(a.end,today())};
    }).sort((x,y)=>y.d-x.d).slice(0,10);
    const upcoming = active.filter(a=>{
      if(!a.end || a.status==='CONCLUÍDO') return false;
      const d = daysBetween(today(),a.end); return d>=0 && d<=15;
    }).map(a=>{
      const b = c.blocks.find(b=>b.actions.includes(a));
      return {a,b,d:daysBetween(today(),a.end)};
    }).sort((x,y)=>x.d-y.d).slice(0,10);
    summaryHtml = `<section class="page">
      <h2>📊 Sumário executivo</h2>
      <div class="kpi-strip">
        <div class="kpi-cell"><div class="kpi-l">Ações ativas</div><div class="kpi-v">${active.length}</div></div>
        <div class="kpi-cell"><div class="kpi-l">Conclusão</div><div class="kpi-v ${pct>=70?'ok':pct>=40?'warn':'danger'}">${pct}%</div></div>
        <div class="kpi-cell"><div class="kpi-l">Em atraso</div><div class="kpi-v ${delayed?'danger':'ok'}">${delayed}</div></div>
        <div class="kpi-cell"><div class="kpi-l">≤7 dias</div><div class="kpi-v warn">${soon}</div></div>
        <div class="kpi-cell"><div class="kpi-l">% obra</div><div class="kpi-v">${obraPct!=null?obraPct+'%':'—'}</div></div>
      </div>
      ${delays.length?`<h3>🔥 Top atrasos</h3><table class="tbl"><thead><tr><th>Atividade</th><th>Bloco</th><th>Responsáveis</th><th>Prazo</th><th>Atraso</th></tr></thead><tbody>${delays.map(x=>`<tr><td>${esc(x.a.name)}</td><td>${esc(x.b.name)}</td><td>${actionRespsStr(x.a)}</td><td>${fmt(x.a.end)}</td><td class="cell-danger"><b>${x.d}d</b></td></tr>`).join('')}</tbody></table>`:''}
      ${upcoming.length?`<h3>⏰ Próximos 15 dias</h3><table class="tbl"><thead><tr><th>Atividade</th><th>Bloco</th><th>Responsáveis</th><th>Prazo</th><th>Dias</th></tr></thead><tbody>${upcoming.map(x=>`<tr><td>${esc(x.a.name)}</td><td>${esc(x.b.name)}</td><td>${actionRespsStr(x.a)}</td><td>${fmt(x.a.end)}</td><td class="cell-${x.d<=7?'warn':'primary'}"><b>${x.d}d</b></td></tr>`).join('')}</tbody></table>`:''}
    </section>`;
  }

  // Capa
  const coverHtml = opts.cover ? `<section class="cover">
    <div class="cover-brand">HABITAT · Comitê de Entrega</div>
    <h1 class="cover-title">${esc(c.name)}</h1>
    <div class="cover-sub">Relatório gerencial · ${new Date().toLocaleDateString('pt-BR')}</div>
    <div class="cover-kpis">
      <div><div class="ck-l">Data de entrega</div><div class="ck-v">${fmt(c.delivery)}</div></div>
      <div><div class="ck-l">Dias para entrega</div><div class="ck-v ${dToDelivery<0?'danger':dToDelivery<90?'warn':'ok'}">${dToDelivery!=null?dToDelivery:'—'}</div></div>
      <div><div class="ck-l">Conclusão geral</div><div class="ck-v ${pct>=70?'ok':pct>=40?'warn':'danger'}">${pct}%</div></div>
      <div><div class="ck-l">% Obra</div><div class="ck-v">${obraPct!=null?obraPct+'%':'—'}</div></div>
      <div><div class="ck-l">Ações em atraso</div><div class="ck-v ${delayed?'danger':'ok'}">${delayed}</div></div>
      <div><div class="ck-l">Vencem em ≤7 dias</div><div class="ck-v warn">${soon}</div></div>
    </div>
    <div class="cover-foot">${c.units?c.units+' unidades · ':''}Início ${fmt(c.start)}</div>
  </section>` : '';

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Relatório · ${esc(c.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:16mm}
*{box-sizing:border-box}
body{font:13px/1.55 'Inter',-apple-system,sans-serif;color:#111827;margin:0;background:#f2f4f7}
.toolbar{position:sticky;top:0;background:#111827;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;z-index:10}
.toolbar b{font-size:14px}
.toolbar button{background:#43B997;color:#fff;border:0;padding:8px 16px;border-radius:6px;font:600 13px 'Inter',sans-serif;cursor:pointer;margin-left:6px}
.toolbar button.sec{background:#64748B}
.wrap{max-width:210mm;margin:0 auto;padding:0}
@media print{.toolbar{display:none}.wrap{margin:0;max-width:100%}}

.cover{background:linear-gradient(135deg,#111827 0%,#1F2937 100%);color:#fff;padding:60px 40px;min-height:260mm;page-break-after:always;position:relative;overflow:hidden}
.cover::before{content:'';position:absolute;top:-100px;right:-100px;width:400px;height:400px;background:radial-gradient(circle,rgba(23,178,106,.3),transparent 70%)}
.cover-brand{font-size:12px;letter-spacing:.15em;color:#a6f4c5;font-weight:700;text-transform:uppercase;position:relative}
.cover-title{font-size:52px;font-weight:800;letter-spacing:-.02em;margin:40px 0 8px;position:relative}
.cover-sub{color:#c4c9d4;font-size:15px;position:relative}
.cover-kpis{margin-top:60px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;position:relative}
.cover-kpis>div{background:rgba(255,255,255,.08);padding:20px;border-radius:8px;border:1px solid rgba(255,255,255,.12)}
.ck-l{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#c4c9d4;font-weight:600}
.ck-v{font-size:28px;font-weight:700;margin-top:6px;letter-spacing:-.02em}
.ck-v.ok{color:#43B997}.ck-v.warn{color:#F59E0B}.ck-v.danger{color:#EF4444}
.cover-foot{position:absolute;bottom:40px;left:40px;font-size:12px;color:#c4c9d4}

.page{background:#fff;padding:24px 32px;margin-bottom:16px;border-radius:8px;page-break-inside:avoid}
.page h2{font-size:20px;margin:0 0 16px;letter-spacing:-.015em;color:#111827;border-bottom:2px solid #43B997;padding-bottom:8px}
.page h3{font-size:15px;margin:20px 0 8px;color:#344054}
.kpi-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px}
.kpi-cell{background:#f9fafb;border:1px solid #EEEEF1;padding:12px;border-radius:6px}
.kpi-l{font-size:10px;text-transform:uppercase;color:#64748B;letter-spacing:.05em;font-weight:600}
.kpi-v{font-size:22px;font-weight:700;margin-top:4px;letter-spacing:-.01em}
.kpi-v.ok{color:#43B997}.kpi-v.warn{color:#F59E0B}.kpi-v.danger{color:#EF4444}
.tbl{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:12px}
.tbl th{background:#f2f4f7;text-align:left;padding:8px 10px;font-weight:600;color:#344054;border-bottom:2px solid #d0d5dd}
.tbl td{padding:8px 10px;border-bottom:1px solid #EEEEF1}
.tbl tr:nth-child(even) td{background:#f9fafb}
.cell-danger{color:#b42318;font-weight:700}.cell-warn{color:#93370d;font-weight:700}.cell-ok{color:#1F7A5C;font-weight:700}.cell-primary{color:#1D4ED8;font-weight:700}.cell-late{color:#854d0e;font-weight:700;background:#fefce8!important}
.act-badge.late{background:#fef9c3;color:#854d0e;border:1px solid #fde68a}
.block-hdr{border-bottom:2px solid #EEEEF1;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.block-title-r{font-size:17px;font-weight:700;color:#111827;letter-spacing:-.01em}
.block-meta{font-size:12px;color:#64748B}
.act{padding:12px 14px;border:1px solid #EEEEF1;border-radius:6px;margin-bottom:10px;background:#fff;page-break-inside:avoid}
.act-hdr{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #EEEEF1}
.act-name{font-weight:600;font-size:13.5px;color:#111827}
.act-badge{padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap}
.act-badge.ok{background:#E9F8F2;color:#1F7A5C;border:1px solid #BCE8D8}
.act-badge.warn{background:#fef7ed;color:#93370d;border:1px solid #fcd6a9}
.act-badge.danger{background:#fef3f2;color:#b42318;border:1px solid #fecdca}
.act-badge.neutral{background:#f2f4f7;color:#64748B;border:1px solid #EEEEF1}
.act-badge.primary{background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE}
table.act-meta{width:100%;font-size:12px;margin:6px 0}
table.act-meta th{text-align:left;background:transparent;padding:3px 8px 3px 0;font-weight:600;color:#64748B;width:140px;vertical-align:top}
table.act-meta td{padding:3px 0;border:0;background:transparent}
.hist{margin-top:8px;padding:8px 12px;background:#f9fafb;border-radius:6px;border-left:3px solid #43B997}
.hist b{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748B}
.hist ul{margin:6px 0 0;padding-left:18px;font-size:11.5px;color:#64748B}
.hist-date{font-weight:600;color:#111827}
.hist-ev{font-weight:600;color:#1F7A5C}
</style></head><body>
<div class="toolbar">
  <b>Relatório · ${esc(c.name)}</b>
  <div>
    <button class="sec" onclick="window.close()">Fechar</button>
    <button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  </div>
</div>
<div class="wrap">
${coverHtml}
${contracapaHtml}
${summaryHtml}
${obraHtml}
${analyticHtml}
</div>
</body></html>`;
}

/* ================================================ */
/* ============ CRM: KANBAN + BUSCA GLOBAL ========= */
/* ================================================ */
function setProjectView(v){
  projectView = v;
  document.getElementById('vtList').classList.toggle('active', v==='list');
  document.getElementById('vtKanban').classList.toggle('active', v==='kanban');
  document.getElementById('commBlocksWrap').classList.toggle('hidden', v!=='list');
  document.getElementById('commKanban').classList.toggle('hidden', v!=='kanban');
  if(v==='kanban') renderKanban(); else renderCommittee();
}

function renderKanban(){
  const c = currentCommittee();
  if(!c){ document.getElementById('commKanban').innerHTML=''; return }
  const fResp = document.getElementById('commRespFilter').value;
  const fStatus = document.getElementById('commStatusFilter').value;
  const fPrazo = document.getElementById('commPrazoFilter').value;
  const fSearch = (document.getElementById('commSearch').value||'').toLowerCase();

  const cols = c.blocks.map(b=>{
    const acts = b.actions.filter(a=>{
      if(fResp && !actionHasResp(a,fResp)) return false;
      if(fStatus && a.status!==fStatus) return false;
      if(fPrazo){
        const s = actionSituation(a);
        if(fPrazo==='com' && !a.end) return false;
        if(fPrazo==='sem' && a.end) return false;
        if(fPrazo==='atraso' && s.cls!=='danger') return false;
        if(fPrazo==='7d' && s.cls!=='warn') return false;
      }
      if(fSearch && !a.name.toLowerCase().includes(fSearch) && !(a.obs||'').toLowerCase().includes(fSearch)) return false;
      if(commKpiFilter==='delayed' && actionSituation(a).cls!=='danger') return false;
      if(commKpiFilter==='soon' && actionSituation(a).cls!=='warn') return false;
      return true;
    });
    const p = blockProgress(b);
    const cls = p.delayed?'danger':p.pct===100?'':p.pct>=50?'':'warn';
    return `<div class="kanban-col" data-block-id="${b.id}">
      <div class="kanban-col-head">
        <div class="kanban-col-title-row">
          <span class="kanban-col-title">${esc(b.name)}</span>
          <span class="kanban-col-count">${acts.length}</span>
        </div>
        <div class="kanban-col-progress"><div class="kanban-col-progress-fill ${cls}" style="width:${p.pct}%"></div></div>
      </div>
      <div class="kanban-col-cards">
        ${acts.length ? acts.map(a=>renderKanbanCard(b,a)).join('') : '<div class="kanban-empty-col">Sem atividades neste filtro</div>'}
      </div>
      <button class="kanban-col-add" onclick="openNewAction('${b.id}')">+ Nova atividade</button>
    </div>`;
  }).join('');
  document.getElementById('commKanban').innerHTML = `<div class="kanban-board">${cols}</div>`;
}

function renderKanbanCard(b,a){
  const s = actionSituation(a);
  const done = a.status==='CONCLUÍDO'||a.status==='CONCLUIDO';
  const classes = [
    'kanban-card',
    a.milestone?'milestone':'',
    s.cls==='danger'?'delayed':'',
    done?'done':''
  ].filter(Boolean).join(' ');
  const resps = actionResps(a);
  const attN = (a.attachments||[]).length;
  const hasObs = a.obs && a.obs.trim();
  const histN = (a.history||[]).length;
  return `<div class="${classes}" onclick="editAction('${b.id}','${a.id}')" data-obs="${esc(a.obs)}" data-actname="${esc(a.name)}" data-status="${a.status}" data-end="${a.end||''}">
    <div class="kanban-card-title">${a.milestone?'⭐ ':''}${esc(a.name)}</div>
    <div class="kanban-card-meta">
      <div class="kanban-card-meta-left">
        <span class="due-pill ${s.cls}">${s.label}</span>
        ${a.end?`<span class="muted" style="font-size:10.5px">${fmt(a.end)}</span>`:''}
      </div>
      ${resps.length?avatarsStackHtml(resps,3):''}
    </div>
    ${(attN||hasObs||histN>1)?`<div class="kanban-card-icons" style="margin-top:8px">
      ${attN?`<span class="k-icon" title="${attN} anexo(s)">📎 ${attN}</span>`:''}
      ${hasObs?`<span class="k-icon" title="Tem observação">💬</span>`:''}
      ${histN>1?`<span class="k-icon" title="${histN} eventos no histórico">🕒 ${histN}</span>`:''}
    </div>`:''}
  </div>`;
}

/* ---- Busca global ---- */
function onGlobalSearch(q){
  const el = document.getElementById('gsResults');
  q = (q||'').trim().toLowerCase();
  if(q.length<2){ el.classList.remove('open'); el.innerHTML=''; return }
  const hits = [];
  db.committees.forEach(c=>{
    if(c.name.toLowerCase().includes(q)) hits.push({type:'proj',c,label:c.name,meta:`Projeto · entrega ${fmt(c.delivery)}`});
    c.blocks.forEach(b=>{
      if(b.name.toLowerCase().includes(q)) hits.push({type:'block',c,b,label:b.name,meta:`Bloco · ${c.name}`});
      b.actions.forEach(a=>{
        const inName = a.name.toLowerCase().includes(q);
        const inObs = (a.obs||'').toLowerCase().includes(q);
        const inResp = actionResps(a).some(r=>r.toLowerCase().includes(q));
        if(inName || inObs || inResp){
          hits.push({type:'act',c,b,a,label:a.name,meta:`${c.name} · ${b.name} · ${actionResps(a).join(' + ')||'—'}`});
        }
      });
    });
  });
  if(!hits.length){ el.innerHTML = '<div class="gs-empty">Nenhum resultado para "'+esc(q)+'"</div>'; el.classList.add('open'); return }
  const highlight = (s,q)=>esc(s).replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark>$1</mark>');
  el.innerHTML = hits.slice(0,20).map((h,i)=>{
    const icon = h.type==='proj'?'🏗️':h.type==='block'?'📂':(h.a.milestone?'⭐':'✓');
    const args = h.type==='proj'?`'${h.c.id}',null,null`:h.type==='block'?`'${h.c.id}','${h.b.id}',null`:`'${h.c.id}','${h.b.id}','${h.a.id}'`;
    return `<div class="gs-hit" onclick="gsGo(${args})">
      <span style="font-size:16px">${icon}</span>
      <div class="gs-hit-body">
        <div class="gs-hit-title">${highlight(h.label,q)}</div>
        <div class="gs-hit-meta">${esc(h.meta)}</div>
      </div>
    </div>`;
  }).join('') + (hits.length>20?`<div class="gs-empty">+${hits.length-20} outros resultados</div>`:'');
  el.classList.add('open');
}
function gsGo(cid, bid, aid){
  currentCommitteeId = cid; save();
  document.getElementById('globalSearch').value = '';
  document.getElementById('gsResults').classList.remove('open');
  if(aid){ switchView('project'); editAction(bid, aid); }
  else if(bid){ switchView('project'); }
  else { switchView('project'); }
  renderAll();
}
document.addEventListener('click', e=>{
  const gs = document.querySelector('.global-search');
  if(gs && !gs.contains(e.target)) document.getElementById('gsResults').classList.remove('open');
});

/* ================================================ */
/* ============ IMPORT/EXPORT DE PLANILHA ========== */
/* ================================================ */
function openImportModal(){
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('importFileInput').value = '';
  openModal('modalImport');
}

/* Baixa o modelo em XLSX */
function downloadTemplate(kind){
  if(typeof XLSX==='undefined'){ crcAlert('Biblioteca XLSX ainda carregando. Aguarde 2s e tente novamente.'); return }
  const rows = [['AÇÃO','RESPONSAVEL','INICIO','TERMINO','STATUS','MARCO','OBS']];
  if(kind==='exemplo'){
    MODELO_BASE.blocks.forEach((b,i)=>{
      rows.push([`${i+1}. ${b.name}`,'','','','','','']);
      b.actions.forEach(a=>{
        rows.push([a.name, (a.resps||[]).join(' + '), '', '', '', '', '']);
      });
    });
  } else {
    // Vazio, com só uma linha de exemplo pra guiar
    rows.push(['1. NOME DO BLOCO','','','','','','']);
    rows.push(['Exemplo de atividade','OBRA','01/01/2027','31/01/2027','NÃO INICIADO','S','']);
    rows.push(['Outra atividade','QUALIDADE + CRC','','','EM ANDAMENTO','','']);
    rows.push(['2. OUTRO BLOCO','','','','','','']);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:50},{wch:22},{wch:12},{wch:12},{wch:16},{wch:8},{wch:40}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Atividades');
  XLSX.writeFile(wb, kind==='exemplo'?'modelo-projeto-exemplo.xlsx':'modelo-projeto-vazio.xlsx');
}

let importParsedBlocks = null;

/* Le o arquivo e faz parse */
function onImportFile(ev){
  const file = ev.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{
    try{
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array', cellDates:true});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', raw:false});
      importParsedBlocks = parseImportRows(rows);
      renderImportPreview();
    }catch(err){ crcAlert('Falha ao ler o arquivo: '+err.message) }
  };
  reader.readAsArrayBuffer(file);
}

function parseImportRows(rows){
  if(!rows.length) return [];
  // Encontrar cabeçalho
  const header = rows[0].map(x=>String(x||'').trim().toUpperCase());
  const idx = {
    name: header.findIndex(h=>['AÇÃO','ACAO','ATIVIDADE','NOME'].includes(h)),
    resp: header.findIndex(h=>['RESPONSAVEL','RESPONSÁVEL','RESPONSAVEIS','RESPONSÁVEIS','AREA','ÁREA'].includes(h)),
    inicio: header.findIndex(h=>['INICIO','INÍCIO','START'].includes(h)),
    fim: header.findIndex(h=>['TERMINO','TÉRMINO','FIM','END','PRAZO'].includes(h)),
    status: header.findIndex(h=>['STATUS'].includes(h)),
    marco: header.findIndex(h=>['MARCO','MILESTONE'].includes(h)),
    obs: header.findIndex(h=>['OBS','OBSERVACAO','OBSERVAÇÃO','OBSERVACOES','OBSERVAÇÕES'].includes(h)),
  };
  if(idx.name<0) idx.name=0;
  if(idx.resp<0) idx.resp=1;

  const blocks = [];
  let current = null;
  for(let i=1;i<rows.length;i++){
    const r = rows[i];
    const name = String(r[idx.name]||'').trim();
    const resp = String(r[idx.resp]||'').trim();
    if(!name) continue;
    if(name.toLowerCase().includes('insira novas linhas')) continue;
    // Bloco: "N. NOME" e resp vazio
    const m = name.match(/^(\d+)\.\s*(.+)$/);
    if(m && !resp){
      current = { name: m[2].trim(), actions: [] };
      blocks.push(current);
      continue;
    }
    if(!current){ current = { name:'GERAL', actions:[] }; blocks.push(current); }
    const resps = resp ? resp.split(/\s*[+,]\s*/).filter(Boolean) : [];
    const startVal = idx.inicio>=0 ? parseDate(r[idx.inicio]) : null;
    const endVal   = idx.fim>=0 ? parseDate(r[idx.fim]) : null;
    const statusVal = idx.status>=0 ? normStatus(r[idx.status]) : null;
    const marcoVal = idx.marco>=0 ? parseBool(r[idx.marco]) : false;
    const obsVal = idx.obs>=0 ? String(r[idx.obs]||'').trim() : '';
    current.actions.push({ name, resps, start:startVal, end:endVal, status:statusVal, milestone:marcoVal, obs:obsVal });
  }
  return blocks;
}
function parseDate(v){
  if(!v && v!==0) return null;
  const s = String(v).trim(); if(!s) return null;
  // DD/MM/AAAA
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if(m){ const dd=m[1].padStart(2,'0'), mm=m[2].padStart(2,'0'); let y=m[3]; if(y.length===2) y='20'+y; return `${y}-${mm}-${dd}` }
  // AAAA-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return `${m[1]}-${m[2]}-${m[3]}`;
  // Date object serializado
  const d = new Date(s); if(!isNaN(d)) return d.toISOString().slice(0,10);
  return null;
}
function parseBool(v){
  const s = String(v||'').trim().toUpperCase();
  return ['S','SIM','TRUE','1','X','YES','Y','⭐'].includes(s);
}
function normStatus(v){
  const s = String(v||'').trim().toUpperCase();
  if(!s) return null;
  if(s.includes('CONCL')) return 'CONCLUÍDO';
  if(s.includes('ANDAM')||s.includes('PROGRE')) return 'EM ANDAMENTO';
  if(s.includes('APLIC')||s==='N/A') return 'NÃO SE APLICA';
  return 'NÃO INICIADO';
}

function renderImportPreview(){
  const el = document.getElementById('importPreview');
  if(!importParsedBlocks || !importParsedBlocks.length){
    el.innerHTML = '<div class="empty-state"><p>Nenhum bloco/ação encontrado. Verifique o formato.</p></div>';
    return;
  }
  const total = importParsedBlocks.reduce((s,b)=>s+b.actions.length,0);
  const allResps = new Set();
  importParsedBlocks.forEach(b=>b.actions.forEach(a=>a.resps.forEach(r=>allResps.add(r))));
  const newResps = [...allResps].filter(r=>!db.settings.responsibles.includes(r));

  const existingList = db.committees.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  el.innerHTML = `
    <div class="filter-banner" style="margin-bottom:14px">
      <b>✓ Planilha lida:</b> ${importParsedBlocks.length} bloco(s) · ${total} atividade(s) · ${allResps.size} área(s) responsáveis
      ${newResps.length?`<br><span style="font-size:12px;color:#93370d">⚠ ${newResps.length} área(s) nova(s) serão criadas: ${newResps.join(', ')}</span>`:''}
    </div>
    <div class="field">
      <label>O que fazer com esses dados?</label>
      <select id="importMode" onchange="onImportModeChange()">
        <option value="new">Criar novo projeto</option>
        <option value="update">Atualizar projeto existente</option>
      </select>
    </div>
    <div id="importNewFields">
      <div class="grid-2">
        <div class="field"><label>Nome do novo projeto</label><input id="importNewName" placeholder="Ex: Casa Laguna"></div>
        <div class="field"><label>Data de entrega (opcional)</label><input id="importNewDelivery" type="date"></div>
      </div>
      <div class="field"><label>Empresa (Sienge)</label><select id="importNewEmpresa"></select></div>
    </div>
    <div id="importUpdateFields" class="hidden">
      <div class="field"><label>Projeto a atualizar</label>
        <select id="importUpdateTarget">${existingList}</select>
      </div>
      <div class="hint" style="margin-top:0">
        <b>Estratégia de atualização:</b>
        <ul style="margin:6px 0 0;padding-left:20px">
          <li>Blocos com nome igual são <b>reaproveitados</b> (só adiciona ações que não existem)</li>
          <li>Blocos com nome novo são <b>criados</b></li>
          <li>Atividades com nome idêntico dentro do mesmo bloco <b>não são duplicadas</b> — o sistema pula</li>
          <li>Datas, status e observações da planilha só entram nas atividades novas; as existentes são preservadas</li>
        </ul>
      </div>
    </div>

    <details style="margin-top:14px">
      <summary style="cursor:pointer;font-size:12.5px;color:var(--text-2);font-weight:600">👀 Ver detalhamento</summary>
      <div style="max-height:280px;overflow-y:auto;margin-top:10px;padding:10px;background:var(--surface-2);border-radius:var(--r);font-size:12px">
        ${importParsedBlocks.map((b,i)=>`
          <div style="margin-bottom:10px">
            <b style="color:var(--text)">${i+1}. ${esc(b.name)}</b> <span class="muted">(${b.actions.length} ações)</span>
            <ul style="margin:4px 0;padding-left:18px">
              ${b.actions.slice(0,5).map(a=>`<li>${esc(a.name)}${a.resps.length?' <span class="muted">· '+a.resps.join(' + ')+'</span>':''}${a.milestone?' ⭐':''}</li>`).join('')}
              ${b.actions.length>5?`<li class="muted">... +${b.actions.length-5} outras</li>`:''}
            </ul>
          </div>
        `).join('')}
      </div>
    </details>

    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="btn" onclick="applyImport()">✓ Aplicar importação</button>
      <button class="btn secondary" onclick="importParsedBlocks=null;renderImportPreview();document.getElementById('importFileInput').value=''">Cancelar</button>
    </div>
  `;
  const cur=currentCommittee(); fillEmpresaSelect(document.getElementById('importNewEmpresa'), cur?cur.companyId:null);
}
function onImportModeChange(){
  const mode = document.getElementById('importMode').value;
  document.getElementById('importNewFields').classList.toggle('hidden', mode!=='new');
  document.getElementById('importUpdateFields').classList.toggle('hidden', mode!=='update');
}

function applyImport(){
  if(!importParsedBlocks) return;
  // Adiciona áreas novas
  importParsedBlocks.forEach(b=>b.actions.forEach(a=>a.resps.forEach(r=>{
    if(r && !db.settings.responsibles.includes(r)) db.settings.responsibles.push(r);
  })));
  db.settings.responsibles.sort();

  const mode = document.getElementById('importMode').value;
  if(mode==='new'){
    const name = (document.getElementById('importNewName').value||'').trim();
    if(!name){ crcAlert('Informe o nome do projeto.'); return }
    const delivery = document.getElementById('importNewDelivery').value||null;
    const companyId = +document.getElementById('importNewEmpresa').value||null;
    if(!companyId){ crcAlert('Escolha a empresa do projeto.'); return }
    const nc = {
      id: uid('c'), companyId, name, delivery, start:today(), units:null, obraHistory:[],
      blocks: importParsedBlocks.map(b=>({
        id: uid('b'), name: b.name, _open: false,
        actions: b.actions.map(a=>{
          const act = {
            id: uid('a'), name: a.name, resps: [...a.resps],
            status: a.status || 'NÃO INICIADO',
            start: a.start, end: a.end, actualEnd: null,
            obs: a.obs || '', milestone: !!a.milestone,
            history: [], notes: [],
            attachments: []
          };
          pushHistory(act, 'CRIADO', 'Importada de planilha');
          return act;
        })
      }))
    };
    db.committees.push(nc);
    currentCommitteeId = nc.id;
    save();
    closeModal('modalImport');
    switchView('project');
    renderAll();
    crcAlert(`✓ Projeto "${name}" criado com ${nc.blocks.length} blocos e ${nc.blocks.reduce((s,b)=>s+b.actions.length,0)} atividades.`);
  } else {
    const tgtId = document.getElementById('importUpdateTarget').value;
    const c = db.committees.find(x=>x.id===tgtId); if(!c){ crcAlert('Projeto não encontrado.'); return }
    let addedBlocks = 0, addedActs = 0, skippedActs = 0;
    importParsedBlocks.forEach(nb=>{
      let target = c.blocks.find(b=>b.name.trim().toUpperCase()===nb.name.trim().toUpperCase());
      if(!target){
        target = { id: uid('b'), name: nb.name, _open:false, actions: [] };
        c.blocks.push(target);
        addedBlocks++;
      }
      nb.actions.forEach(na=>{
        const exists = target.actions.find(a=>a.name.trim().toUpperCase()===na.name.trim().toUpperCase());
        if(exists){ skippedActs++; return }
        const act = {
          id: uid('a'), name: na.name, resps:[...na.resps],
          status: na.status||'NÃO INICIADO',
          start: na.start, end: na.end, actualEnd:null,
          obs: na.obs||'', milestone: !!na.milestone,
          history: [], notes: [], attachments: []
        };
        pushHistory(act,'CRIADO',`Importada de planilha para "${c.name}"`);
        target.actions.push(act);
        addedActs++;
      });
    });
    save();
    closeModal('modalImport');
    currentCommitteeId = c.id;
    switchView('project');
    renderAll();
    crcAlert(`✓ Atualização aplicada em "${c.name}":\n· ${addedBlocks} bloco(s) novo(s)\n· ${addedActs} atividade(s) adicionada(s)\n· ${skippedActs} pulada(s) por já existirem`);
  }
  importParsedBlocks = null;
}

/* Drop zone para o arquivo */
(function setupImportDrop(){
  const doBind = ()=>{
    const drop = document.getElementById('importDrop');
    const inp = document.getElementById('importFileInput');
    if(!drop || !inp || inp._bound) return;
    inp._bound = true;
    drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('drag') });
    drop.addEventListener('dragleave', ()=>drop.classList.remove('drag'));
    drop.addEventListener('drop', e=>{
      e.preventDefault(); drop.classList.remove('drag');
      const f = e.dataTransfer.files[0]; if(!f) return;
      const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
      onImportFile({target:inp});
    });
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', doBind);
  else doBind();
})();

/* ================================================ */
/* ============ CALENDÁRIO ========================= */
/* ================================================ */
let calCursor = new Date(); calCursor.setDate(1);
let calView = uiPref('calView') || 'month';

function setCalView(v){
  calView = v;
  uiPref('calView', v);
  ['Month','Week','Agenda'].forEach(k=>{
    const el = document.getElementById('cv'+k);
    if(el) el.classList.toggle('active', calView===k.toLowerCase());
  });
  renderCalendar();
}
function calNav(dir){
  if(calView==='month'){ calCursor.setMonth(calCursor.getMonth()+dir); }
  else if(calView==='week'){ calCursor.setDate(calCursor.getDate()+7*dir); }
  else { calCursor.setMonth(calCursor.getMonth()+dir); }
  renderCalendar();
}
function calToday(){ calCursor = new Date(); calCursor.setDate(1); renderCalendar(); }
function calClearFilters(){
  document.getElementById('calProjectFilter').value='';
  document.getElementById('calRespFilter').value='';
  document.getElementById('calStatusFilter').value='';
  document.getElementById('calSituationFilter').value='';
  document.getElementById('calMilestoneFilter').value='';
  document.getElementById('calSearch').value='';
  renderCalendar();
}

function calCollectEvents(){
  // Popula filtros dinâmicos
  const projSel = document.getElementById('calProjectFilter');
  const curProj = projSel.value;
  const activeProjects = db.committees.filter(c=>!c.completed && !c.paused);
  const projectOptions = ['<option value="">Todos os projetos ativos</option>']
    .concat(activeProjects.map(c=>`<option value="${c.id}" ${c.id===curProj?'selected':''}>${esc(c.name)}</option>`))
    .concat(db.committees.filter(c=>c.completed||c.paused).map(c=>`<option value="${c.id}" ${c.id===curProj?'selected':''}>${esc(c.name)} ${c.completed?'✓':'⏸'}</option>`));
  projSel.innerHTML = projectOptions.join('');

  const respSel = document.getElementById('calRespFilter');
  const curResp = respSel.value;
  const allResps = [...new Set(db.committees.flatMap(c=>c.blocks.flatMap(b=>b.actions.flatMap(a=>actionResps(a)))))].sort();
  respSel.innerHTML = '<option value="">Todas as áreas</option>' + allResps.map(r=>`<option ${r===curResp?'selected':''}>${esc(r)}</option>`).join('');

  const fProj = projSel.value;
  const fResp = respSel.value;
  const fStatus = document.getElementById('calStatusFilter').value;
  const fSit = document.getElementById('calSituationFilter').value;
  const fMile = document.getElementById('calMilestoneFilter').value;
  const fSearch = (document.getElementById('calSearch').value||'').toLowerCase();

  const events = [];
  db.committees.forEach(c=>{
    // Se filtro de projeto está vazio, ignora suspensos/concluídos por default (só ativos)
    if(!fProj && (c.completed||c.paused)) return;
    if(fProj && c.id!==fProj) return;
    c.blocks.forEach(b=>b.actions.forEach(a=>{
      if(!a.end) return;
      if(fResp && !actionHasResp(a,fResp)) return;
      if(fStatus && a.status!==fStatus) return;
      const s = actionSituation(a);
      if(fSit && s.cls!==fSit) return;
      if(fMile==='1' && !a.milestone) return;
      if(fMile==='0' && a.milestone) return;
      if(fSearch && !a.name.toLowerCase().includes(fSearch)) return;
      events.push({ c, b, a, date: a.end, situation: s });
    }));
  });
  return events;
}

function renderCalendar(){
  const container = document.getElementById('calContainer');
  const events = calCollectEvents();
  // Título
  const titleEl = document.getElementById('calTitle');
  if(calView==='month'){
    titleEl.textContent = calCursor.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    container.innerHTML = renderMonthGrid(events);
  } else if(calView==='week'){
    const start = weekStart(calCursor);
    const end = new Date(start); end.setDate(start.getDate()+6);
    titleEl.textContent = `${start.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} — ${end.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}`;
    container.innerHTML = renderWeekGrid(events, start);
  } else {
    titleEl.textContent = calCursor.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    container.innerHTML = renderAgenda(events);
  }
}

function weekStart(d){
  const dt = new Date(d);
  const day = dt.getDay(); // 0=dom, 1=seg...
  const diff = day===0 ? -6 : 1-day; // segunda como primeiro dia
  dt.setDate(dt.getDate()+diff);
  dt.setHours(0,0,0,0);
  return dt;
}

function renderMonthGrid(events){
  const y = calCursor.getFullYear();
  const m = calCursor.getMonth();
  const first = new Date(y,m,1);
  const startDayOfWeek = first.getDay(); // 0=dom
  const startOffset = startDayOfWeek===0 ? 6 : startDayOfWeek-1; // começa segunda
  const gridStart = new Date(y,m,1-startOffset);
  const daysInMonth = new Date(y,m+1,0).getDate();
  const totalCells = Math.ceil((startOffset+daysInMonth)/7)*7;

  // Agrupa eventos por data
  const byDate = {};
  events.forEach(e=>{
    if(!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  const todayStr = today();
  let daysHtml = '';
  for(let i=0;i<totalCells;i++){
    const d = new Date(gridStart); d.setDate(gridStart.getDate()+i);
    const iso = d.toISOString().slice(0,10);
    const otherMonth = d.getMonth()!==m;
    const isToday = iso===todayStr;
    const evs = byDate[iso]||[];
    const shown = evs.slice(0,3);
    const rest = evs.length-shown.length;
    daysHtml += `<div class="cal-day ${otherMonth?'other-month':''} ${isToday?'today':''}" onclick="calDayClick('${iso}')">
      <span class="cal-day-num">${d.getDate()}</span>
      <div class="cal-events">
        ${shown.map(e=>`<div class="cal-event ${e.situation.cls} ${e.a.milestone?'milestone':''}" onclick="event.stopPropagation();gsGo('${e.c.id}','${e.b.id}','${e.a.id}')" title="${esc(e.c.name)} · ${esc(e.a.name)}">${e.a.milestone?'⭐ ':''}${esc(truncateStr(e.a.name,30))}</div>`).join('')}
        ${rest>0?`<div class="cal-more" onclick="event.stopPropagation();calDayClick('${iso}')">+ ${rest} mais</div>`:''}
      </div>
    </div>`;
  }
  const weekdays = ['seg','ter','qua','qui','sex','sáb','dom'];
  return `<div class="cal-grid">
    <div class="cal-weekdays">${weekdays.map(w=>`<div class="cal-weekday">${w}</div>`).join('')}</div>
    <div class="cal-days">${daysHtml}</div>
  </div>`;
}

function renderWeekGrid(events, start){
  const byDate = {};
  events.forEach(e=>{ if(!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e); });
  const todayStr = today();
  let daysHtml = '';
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const iso = d.toISOString().slice(0,10);
    const isToday = iso===todayStr;
    const evs = byDate[iso]||[];
    daysHtml += `<div class="cal-day ${isToday?'today':''}" style="min-height:280px" onclick="calDayClick('${iso}')">
      <span class="cal-day-num">${d.getDate()}</span>
      <div class="cal-events">
        ${evs.map(e=>`<div class="cal-event ${e.situation.cls} ${e.a.milestone?'milestone':''}" onclick="event.stopPropagation();gsGo('${e.c.id}','${e.b.id}','${e.a.id}')" title="${esc(e.c.name)} · ${esc(e.a.name)}">${e.a.milestone?'⭐ ':''}${esc(e.a.name)}</div>`).join('')}
        ${!evs.length?'<div class="muted" style="font-size:11px;text-align:center;padding-top:20px">Sem entregas</div>':''}
      </div>
    </div>`;
  }
  const weekdays = ['seg','ter','qua','qui','sex','sáb','dom'];
  return `<div class="cal-grid">
    <div class="cal-weekdays">${weekdays.map((w,i)=>{
      const d = new Date(start); d.setDate(start.getDate()+i);
      return `<div class="cal-weekday">${w} ${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}</div>`;
    }).join('')}</div>
    <div class="cal-days">${daysHtml}</div>
  </div>`;
}

function renderAgenda(events){
  if(!events.length){
    return '<div class="empty-state"><div class="empty-icon">📅</div><h3>Nenhuma programação nos filtros atuais</h3><p>Ajuste os filtros ou limpe para ver mais entregas.</p></div>';
  }
  // Ordena por data
  events.sort((x,y)=>x.date.localeCompare(y.date));
  // Agrupa por data
  const byDate = {};
  events.forEach(e=>{ if(!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e); });
  const todayStr = today();
  const html = Object.keys(byDate).sort().map(dt=>{
    const isPast = dt<todayStr;
    const isToday = dt===todayStr;
    const d = new Date(dt+'T00:00:00');
    const wname = d.toLocaleDateString('pt-BR',{weekday:'long'});
    const dname = d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
    const cls = isToday?'today':isPast?'past':'';
    const totalDay = byDate[dt].length;
    return `<div class="cal-agenda-day">
      <div class="cal-agenda-day-head ${cls}">
        <span>${wname} · ${dname}${isToday?' · HOJE':''}</span>
        <span>${totalDay} atividade${totalDay>1?'s':''}</span>
      </div>
      ${byDate[dt].map(e=>`<div class="cal-agenda-item" onclick="gsGo('${e.c.id}','${e.b.id}','${e.a.id}')">
        <div>
          <div class="n">${e.a.milestone?'⭐ ':''}${esc(e.a.name)}</div>
          <div class="m">${esc(e.c.name)} · ${esc(e.b.name)}</div>
        </div>
        <div>${avatarsStackHtml(actionResps(e.a),3)}</div>
        <div><span class="badge ${statusBadgeCls(e.a.status)}">${e.a.status}</span></div>
        <div><span class="badge ${e.situation.cls}">${e.situation.label}</span></div>
        <div><button class="btn xs secondary" onclick="event.stopPropagation();gsGo('${e.c.id}','${e.b.id}','${e.a.id}')">✏️ Abrir</button></div>
      </div>`).join('')}
    </div>`;
  }).join('');
  return `<div class="cal-agenda">${html}</div>`;
}

function calDayClick(iso){
  // Muda para agenda focada no mês da data
  const d = new Date(iso+'T00:00:00');
  calCursor = new Date(d.getFullYear(), d.getMonth(), 1);
  setCalView('agenda');
}

/* Exporta em .ics (padrão iCalendar) */
function exportCalendarICS(){
  const events = calCollectEvents();
  if(!events.length){ crcAlert('Nenhuma atividade para exportar com os filtros atuais.'); return }
  const pad = n=>n.toString().padStart(2,'0');
  const fmtICS = d=>{
    const dt = new Date(d+'T09:00:00');
    return dt.getFullYear()+pad(dt.getMonth()+1)+pad(dt.getDate())+'T'+pad(dt.getHours())+pad(dt.getMinutes())+'00';
  };
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Habitat//Gestão de Entrega//PT','CALSCALE:GREGORIAN'
  ];
  events.forEach(e=>{
    const uid = e.a.id+'@habitat';
    const dtstart = fmtICS(e.date);
    const dtend = fmtICS(e.date);
    lines.push('BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${fmtICS(today())}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${(e.a.milestone?'⭐ ':'')+e.a.name.replace(/[,;\\n]/g,' ')}`,
      `DESCRIPTION:Projeto: ${e.c.name} · Bloco: ${e.b.name} · Responsáveis: ${actionResps(e.a).join(', ')} · Status: ${e.a.status}`,
      'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], {type:'text/calendar;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `agenda-entregas-${today()}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
}

/* ================================================ */
/* ============ DASHBOARD — abas & extras ========== */
/* ================================================ */
function setDashTab(t){
  dashTab = t;
  document.getElementById('dtConsolidated').classList.toggle('active', t==='consolidated');
  document.getElementById('dtCompare').classList.toggle('active', t==='compare');
  document.getElementById('dtProduction').classList.toggle('active', t==='production');
  document.getElementById('dashConsolidatedWrap').classList.toggle('hidden', t!=='consolidated');
  document.getElementById('dashCompareWrap').classList.toggle('hidden', t!=='compare');
  document.getElementById('dashProductionWrap').classList.toggle('hidden', t!=='production');
  renderDashboardExtras();
}
function setDashPeriod(days){
  dashPeriod = days;
  document.querySelectorAll('#dashPeriodChips button').forEach(b=>{
    b.classList.toggle('active', parseInt(b.dataset.period)===days);
  });
  renderDashboard();
  renderDashboardExtras();
}
function periodStartDate(){
  if(!dashPeriod) return null;
  const d = new Date();
  d.setDate(d.getDate() - dashPeriod);
  return d.toISOString().slice(0,10);
}

function renderDashboardExtras(){
  if(dashTab==='compare') renderMultiProject();
  if(dashTab==='production') renderProductivityByResp();
}

function renderMultiProject(){
  const active = db.committees.filter(c=>!c.completed && !c.paused);
  const startD = periodStartDate();
  const rows = active.map(c=>{
    let t=0,d=0,dly=0,soon=0,doneLate=0,inprog=0;
    c.blocks.forEach(b=>b.actions.forEach(a=>{
      if(a.status==='NÃO SE APLICA') return;
      // Filtro por período: só considera atividades ativas ou que tiveram atividade no período
      if(startD){
        const hasRecent = (a.history||[]).some(h=>h.when && h.when.slice(0,10)>=startD);
        const withinEnd = a.end && a.end>=startD;
        if(!hasRecent && !withinEnd && a.status!=='EM ANDAMENTO') return;
      }
      t++;
      if(a.status==='CONCLUÍDO'||a.status==='CONCLUIDO') d++;
      if(a.status==='EM ANDAMENTO') inprog++;
      const s = actionSituation(a);
      if(s.cls==='danger') dly++;
      if(s.cls==='warn') soon++;
      if(s.doneLate) doneLate++;
    }));
    const pct = t?Math.round(d/t*100):0;
    const daysToDelivery = daysBetween(today(), c.delivery);
    const obraPct = currentObraPct(c);
    return { c, t, d, inprog, dly, soon, doneLate, pct, daysToDelivery, obraPct };
  });

  const table = document.getElementById('multiProjTable');
  if(!rows.length){
    table.innerHTML = '<tr><td class="empty-state" colspan="9"><div class="empty-icon">🏗️</div><h3>Nenhum projeto ativo</h3></td></tr>';
  } else {
    table.innerHTML = `<thead><tr>
      <th>Projeto</th>
      <th>Entrega</th>
      <th>Dias</th>
      <th>Conclusão</th>
      <th>Em andamento</th>
      <th>Atrasos</th>
      <th>≤7 dias</th>
      <th>C/atraso</th>
      <th>% Obra</th>
    </tr></thead>
    <tbody>${rows.map(r=>`<tr>
      <td class="proj-name" onclick="pickCommittee('${r.c.id}')">${esc(r.c.name)}</td>
      <td style="font-size:12px">${fmt(r.c.delivery)}</td>
      <td class="mp-num ${r.daysToDelivery<0?'danger':r.daysToDelivery<90?'warn':'ok'}">${r.daysToDelivery!=null?r.daysToDelivery+'d':'—'}</td>
      <td><div class="prod-bar" style="min-width:130px"><div class="prod-bar-fill ${r.pct>=70?'':r.pct>=40?'':''}" style="width:${r.pct}%;${r.pct<40?'background:linear-gradient(90deg,#EF4444,#DC2626)':r.pct<70?'background:linear-gradient(90deg,#F59E0B,#d97706)':''}"></div><span class="prod-bar-txt">${r.pct}% · ${r.d}/${r.t}</span></div></td>
      <td class="mp-num neutral">${r.inprog}</td>
      <td class="mp-num ${r.dly?'danger':'neutral'}">${r.dly}</td>
      <td class="mp-num ${r.soon?'warn':'neutral'}">${r.soon}</td>
      <td class="mp-num" style="color:${r.doneLate?'#854d0e':'#94A3B8'}">${r.doneLate}</td>
      <td class="mp-num" style="color:${r.obraPct!=null?'#111827':'#94A3B8'}">${r.obraPct!=null?r.obraPct+'%':'—'}</td>
    </tr>`).join('')}</tbody>`;
  }

  // Gráficos
  const maxPct = 100;
  document.getElementById('multiProjPctChart').innerHTML = rows.length ? rows.map(r=>`
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span style="font-weight:600">${esc(r.c.name)}</span>
        <span style="color:${r.pct>=70?'var(--primary)':r.pct>=40?'var(--warn)':'var(--danger)'};font-weight:700">${r.pct}%</span>
      </div>
      <div class="progress-obra" style="height:10px"><div class="progress-obra-fill" style="width:${r.pct}%;background:${r.pct>=70?'linear-gradient(90deg,#43B997,#35AD88)':r.pct>=40?'linear-gradient(90deg,#F59E0B,#d97706)':'linear-gradient(90deg,#EF4444,#DC2626)'}"></div></div>
    </div>`).join('') : '<div class="muted">Sem dados</div>';

  const maxDly = Math.max(1, ...rows.map(r=>r.dly));
  document.getElementById('multiProjDelaysChart').innerHTML = rows.length ? rows.map(r=>`
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span style="font-weight:600">${esc(r.c.name)}</span>
        <span style="color:${r.dly?'var(--danger)':'var(--primary)'};font-weight:700">${r.dly} atraso(s)</span>
      </div>
      <div class="progress-obra" style="height:10px"><div class="progress-obra-fill" style="width:${(r.dly/maxDly*100)||0}%;background:${r.dly?'linear-gradient(90deg,#EF4444,#DC2626)':'#EEEEF1'}"></div></div>
    </div>`).join('') : '<div class="muted">Sem dados</div>';

  // Lista consolidada de demandas (excluindo timeline)
  const allDemands = [];
  active.forEach(c=>c.blocks.forEach(b=>b.actions.forEach(a=>{
    if(a.status==='NÃO SE APLICA'||a.status==='CONCLUÍDO'||a.status==='CONCLUIDO') return;
    allDemands.push({c,b,a,s:actionSituation(a)});
  })));
  allDemands.sort((x,y)=>{
    // Atrasos primeiro, depois por prazo
    if(x.s.cls==='danger' && y.s.cls!=='danger') return -1;
    if(y.s.cls==='danger' && x.s.cls!=='danger') return 1;
    return (x.a.end||'zzz').localeCompare(y.a.end||'zzz');
  });
  document.getElementById('multiAllCount').textContent = `${allDemands.length} demanda(s) em aberto em ${active.length} projeto(s)`;
  document.getElementById('multiAllList').innerHTML = allDemands.length ? allDemands.slice(0,50).map(x=>`
    <div class="dash-list-item">
      <span class="badge ${x.s.cls}">${x.s.label}</span>
      <div class="d-info">
        <div class="d-name" data-obs="${esc(x.a.obs)}" data-actname="${esc(x.a.name)}" data-status="${x.a.status}" data-end="${x.a.end||''}">${x.a.name}</div>
        <div class="d-meta"><b>${esc(x.c.name)}</b> · ${esc(x.b.name)} · ${actionRespsStr(x.a)} · prazo ${fmt(x.a.end)}</div>
      </div>
      <button class="btn xs" onclick="quickJumpEdit('${x.c.id}','${x.b.id}','${x.a.id}')">✏️</button>
    </div>`).join('') + (allDemands.length>50?`<div class="muted" style="padding:12px;text-align:center">+${allDemands.length-50} outras não listadas</div>`:'') : '<div class="muted" style="padding:20px;text-align:center">Nenhuma demanda aberta 🎉</div>';
}

function renderProductivityByResp(){
  const startD = periodStartDate();
  const respStats = {}; // resp → { total, done, inprog, notStarted, delayed, doneLate }
  db.committees.forEach(c=>{
    if(c.completed||c.paused) return;
    c.blocks.forEach(b=>b.actions.forEach(a=>{
      if(a.status==='NÃO SE APLICA') return;
      const resps = actionResps(a);
      const targets = resps.length ? resps : ['(sem área)'];
      targets.forEach(r=>{
        if(!respStats[r]) respStats[r] = { total:0, done:0, inprog:0, notStarted:0, delayed:0, doneLate:0, concludedInPeriod:0 };
        // Filtro de período
        if(startD){
          const doneInPeriod = a.actualEnd && a.actualEnd>=startD;
          const hasRecent = (a.history||[]).some(h=>h.when && h.when.slice(0,10)>=startD);
          if(!doneInPeriod && !hasRecent && a.status!=='EM ANDAMENTO') return;
          if(doneInPeriod) respStats[r].concludedInPeriod++;
        } else {
          if(a.status==='CONCLUÍDO'||a.status==='CONCLUIDO') respStats[r].concludedInPeriod++;
        }
        respStats[r].total++;
        if(a.status==='CONCLUÍDO'||a.status==='CONCLUIDO') respStats[r].done++;
        else if(a.status==='EM ANDAMENTO') respStats[r].inprog++;
        else if(a.status==='NÃO INICIADO') respStats[r].notStarted++;
        const s = actionSituation(a);
        if(s.cls==='danger') respStats[r].delayed++;
        if(s.doneLate) respStats[r].doneLate++;
      });
    }));
  });
  const rows = Object.entries(respStats).map(([resp,st])=>({
    resp, ...st,
    pct: st.total?Math.round(st.done/st.total*100):0
  }));
  rows.sort((a,b)=>b.total-a.total);

  const table = document.getElementById('prodTable');
  if(!rows.length){
    table.innerHTML = '<tr><td class="empty-state" colspan="7"><div class="empty-icon">👥</div><h3>Sem atividades atribuídas no período</h3></td></tr>';
  } else {
    table.innerHTML = `<thead><tr>
      <th>Responsável</th>
      <th>Total</th>
      <th>Concluídas${dashPeriod?' no período':''}</th>
      <th>Em andamento</th>
      <th>Não iniciadas</th>
      <th>Em atraso</th>
      <th>C/atraso</th>
      <th>% Conclusão</th>
    </tr></thead><tbody>${rows.map(r=>`<tr>
      <td>${r.resp!=='(sem área)'?avatarHtml(r.resp,'sm')+' ':''}<b>${esc(r.resp)}</b></td>
      <td class="mp-num neutral">${r.total}</td>
      <td class="mp-num ok">${r.concludedInPeriod}</td>
      <td class="mp-num" style="color:#3B82F6">${r.inprog}</td>
      <td class="mp-num neutral">${r.notStarted}</td>
      <td class="mp-num ${r.delayed?'danger':'neutral'}">${r.delayed}</td>
      <td class="mp-num" style="color:${r.doneLate?'#854d0e':'#94A3B8'}">${r.doneLate}</td>
      <td><div class="prod-bar"><div class="prod-bar-fill" style="width:${r.pct}%;${r.pct<40?'background:linear-gradient(90deg,#EF4444,#DC2626)':r.pct<70?'background:linear-gradient(90deg,#F59E0B,#d97706)':''}"></div><span class="prod-bar-txt">${r.pct}%</span></div></td>
    </tr>`).join('')}</tbody>`;
  }

  // Ranking chart
  const sorted = [...rows].sort((a,b)=>b.pct-a.pct);
  document.getElementById('prodRankingChart').innerHTML = sorted.length ? sorted.map((r,i)=>`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
      <div style="width:24px;text-align:center;font-weight:700;color:var(--text-2);font-size:13px">${i+1}º</div>
      ${r.resp!=='(sem área)'?avatarHtml(r.resp,'sm'):''}
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:12px">
          <b>${esc(r.resp)}</b><span style="color:${r.pct>=70?'var(--primary)':r.pct>=40?'var(--warn)':'var(--danger)'};font-weight:700">${r.pct}%</span>
        </div>
        <div class="progress-obra" style="height:8px"><div class="progress-obra-fill" style="width:${r.pct}%;background:${r.pct>=70?'linear-gradient(90deg,#43B997,#35AD88)':r.pct>=40?'linear-gradient(90deg,#F59E0B,#d97706)':'linear-gradient(90deg,#EF4444,#DC2626)'}"></div></div>
      </div>
      <div style="font-size:11px;color:var(--text-3);min-width:80px;text-align:right">${r.done}/${r.total} feitas</div>
    </div>`).join('') : '<div class="muted" style="padding:20px;text-align:center">Sem dados no período</div>';
}

/* Exporta o dashboard atual — abre nova aba imprimível */
function exportDashboard(){
  const el = document.getElementById('view-dashboard');
  const w = window.open('','_blank');
  if(!w){ crcAlert('Bloqueado. Permita popups desta página.'); return }
  const styles = Array.from(document.styleSheets).map(s=>{
    try{ return Array.from(s.cssRules).map(r=>r.cssText).join('\n') }catch(e){ return '' }
  }).join('\n');
  const title = 'Dashboard · '+new Date().toLocaleString('pt-BR');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>${styles}
    body{background:#fff;padding:24px;font-family:'Inter',sans-serif}
    .app,.sidebar,.header,.dash-toolbar,.chip-filter-bar,button{display:none!important}
    .main{background:#fff}
    .content{padding:0;max-width:100%}
    .dash-tabs,.dash-period-chips{display:none!important}
    .toolbar-print{position:sticky;top:0;background:#111827;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;z-index:10;margin:-24px -24px 20px}
    .toolbar-print button{display:block!important;background:#4161FF;color:#fff;border:0;padding:8px 16px;border-radius:6px;font:600 13px 'Inter',sans-serif;cursor:pointer;margin-left:6px}
    .toolbar-print button.sec{background:#64748B}
    @media print{.toolbar-print{display:none!important}body{padding:0}}
    </style></head><body>
    <div class="toolbar-print">
      <b>Dashboard executivo · ${new Date().toLocaleDateString('pt-BR')}</b>
      <div><button class="sec" onclick="window.close()">Fechar</button><button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button></div>
    </div>
    <div class="crc-ent" style="display:block;background:#fff">${el.outerHTML}</div>
    </body></html>`);
  w.document.close();
}

/* ================================================ */
/* ============ RELATÓRIO DE EVOLUÇÃO ============== */
/* ================================================ */
function openEvolutionModal(){
  const sel = document.getElementById('evoProject');
  sel.innerHTML = '<option value="">Todos os projetos</option>' + db.committees.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  // Padrão: últimos 7 dias
  evoQuick(7);
  openModal('modalEvolution');
}
function evoQuick(days){
  const to = new Date();
  const from = new Date(); from.setDate(from.getDate()-days);
  document.getElementById('evoFrom').value = from.toISOString().slice(0,10);
  document.getElementById('evoTo').value = to.toISOString().slice(0,10);
}
function evoQuickMonth(){
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  document.getElementById('evoFrom').value = from.toISOString().slice(0,10);
  document.getElementById('evoTo').value = now.toISOString().slice(0,10);
}
function evoQuickPrevMonth(){
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  document.getElementById('evoFrom').value = from.toISOString().slice(0,10);
  document.getElementById('evoTo').value = to.toISOString().slice(0,10);
}
function generateEvolutionReport(){
  const from = document.getElementById('evoFrom').value;
  const to = document.getElementById('evoTo').value;
  if(!from || !to){ crcAlert('Informe as datas de início e fim.'); return }
  if(from>to){ crcAlert('A data de início não pode ser maior que a data de fim.'); return }
  const projId = document.getElementById('evoProject').value;
  const targets = projId ? db.committees.filter(c=>c.id===projId) : db.committees;

  // Coleta eventos do histórico entre as datas
  const events = { conclusoes:[], concAtraso:[], replan:[], criadas:[], comentarios:[], anexos:[], riscos:[], edicoes:[], obraUpdates:[] };
  targets.forEach(c=>{
    c.blocks.forEach(b=>b.actions.forEach(a=>{
      (a.history||[]).forEach(h=>{
        if(!h.when) return;
        const d = h.when.slice(0,10);
        if(d<from || d>to) return;
        const ev = { c, b, a, h };
        const e = (h.event||'').toUpperCase();
        if(e.includes('ATRASO') && e.includes('CONCL')) events.concAtraso.push(ev);
        else if(e.includes('CONCL')) events.conclusoes.push(ev);
        else if(e.includes('REPLAN')) events.replan.push(ev);
        else if(e==='CRIADO') events.criadas.push(ev);
        else if(e.includes('ANEXO')) events.anexos.push(ev);
        else if(e.includes('RISCO')) events.riscos.push(ev);
        else if(e.includes('COMENTÁRIO')||e.includes('COMENTARIO')) events.comentarios.push(ev);
        else if(e.includes('EDIÇÃO')||e.includes('EDICAO')||e.includes('STATUS')) events.edicoes.push(ev);
      });
    }));
    (c.obraHistory||[]).forEach(o=>{
      if(o.date>=from && o.date<=to) events.obraUpdates.push({c, o});
    });
  });

  // Projetos concluídos/paralisados no período
  const projClosed = db.committees.filter(c=>c.completedAt && c.completedAt.slice(0,10)>=from && c.completedAt.slice(0,10)<=to);
  const projPaused = db.committees.filter(c=>c.pausedAt && c.pausedAt.slice(0,10)>=from && c.pausedAt.slice(0,10)<=to);

  const total = Object.values(events).reduce((s,arr)=>s+arr.length,0) + projClosed.length + projPaused.length;
  const fmtDt = (iso)=>{
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  };
  const section = (title, items, rowFn, emptyMsg)=>items.length ? `
    <section class="evo-sec">
      <h3>${title} <span class="cnt">${items.length}</span></h3>
      <table class="evo-tbl">${items.map(rowFn).join('')}</table>
    </section>` : (emptyMsg?`<section class="evo-sec"><h3>${title}</h3><p class="empty">${emptyMsg}</p></section>`:'');

  const w = window.open('','_blank');
  if(!w){ crcAlert('Bloqueado. Permita popups.'); return }
  const projTitle = projId ? db.committees.find(c=>c.id===projId).name : 'Todos os projetos';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Evolução · ${esc(projTitle)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
    @page{size:A4;margin:15mm}
    *{box-sizing:border-box}
    body{font:13px/1.55 'Inter',sans-serif;color:#111827;margin:0;background:#f2f4f7}
    .toolbar{position:sticky;top:0;background:#111827;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;z-index:10}
    .toolbar button{background:#43B997;color:#fff;border:0;padding:8px 16px;border-radius:6px;font:600 13px 'Inter',sans-serif;cursor:pointer;margin-left:6px}
    .toolbar button.sec{background:#64748B}
    .wrap{max-width:210mm;margin:0 auto;padding:20px}
    @media print{.toolbar{display:none}.wrap{padding:0;margin:0;max-width:100%}}
    .hdr{background:linear-gradient(135deg,#111827,#1F2937);color:#fff;padding:32px;border-radius:8px;margin-bottom:20px;position:relative;overflow:hidden}
    .hdr::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(23,178,106,.25),transparent 70%)}
    .hdr h1{margin:0;font-size:28px;letter-spacing:-.02em;position:relative}
    .hdr .sub{color:#c4c9d4;margin-top:6px;font-size:13px;position:relative}
    .hdr .kpis{margin-top:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;position:relative}
    .hdr .k{background:rgba(255,255,255,.08);padding:12px;border-radius:6px}
    .hdr .k-l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#c4c9d4;font-weight:600}
    .hdr .k-v{font-size:22px;font-weight:800;margin-top:4px}
    .evo-sec{background:#fff;padding:18px 22px;border-radius:8px;margin-bottom:14px;page-break-inside:avoid}
    .evo-sec h3{font-size:15px;margin:0 0 12px;color:#111827;border-bottom:2px solid #43B997;padding-bottom:6px;display:flex;justify-content:space-between;align-items:center}
    .evo-sec h3 .cnt{background:#E9F8F2;color:#1F7A5C;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700}
    .evo-tbl{width:100%;border-collapse:collapse;font-size:12px}
    .evo-tbl td{padding:8px 6px;border-bottom:1px solid #EEEEF1;vertical-align:top}
    .evo-tbl td:first-child{color:#64748B;white-space:nowrap;font-weight:600;width:120px;font-size:11px}
    .evo-tbl td.name{font-weight:600;color:#111827}
    .evo-tbl td.meta{color:#64748B;font-size:11px}
    .evo-tbl tr:last-child td{border-bottom:0}
    .empty{color:#94A3B8;font-style:italic;margin:0;font-size:12px}
    </style></head><body>
    <div class="toolbar">
      <b>📈 Relatório de evolução — ${esc(projTitle)}</b>
      <div><button class="sec" onclick="window.close()">Fechar</button><button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button></div>
    </div>
    <div class="wrap">
      <div class="hdr">
        <h1>Evolução: ${new Date(from).toLocaleDateString('pt-BR')} → ${new Date(to).toLocaleDateString('pt-BR')}</h1>
        <div class="sub">${esc(projTitle)} · gerado em ${new Date().toLocaleString('pt-BR')}${db.settings.userName?' por '+esc(db.settings.userName):''}</div>
        <div class="kpis">
          <div class="k"><div class="k-l">Total de eventos</div><div class="k-v">${total}</div></div>
          <div class="k"><div class="k-l">✓ Concluídas</div><div class="k-v" style="color:#43B997">${events.conclusoes.length + events.concAtraso.length}</div></div>
          <div class="k"><div class="k-l">📅 Replanejadas</div><div class="k-v" style="color:#F59E0B">${events.replan.length}</div></div>
          <div class="k"><div class="k-l">🆕 Criadas</div><div class="k-v" style="color:#3B82F6">${events.criadas.length}</div></div>
        </div>
      </div>

      ${section('✅ Concluídas no prazo', events.conclusoes,
        e=>`<tr><td>${fmtDt(e.h.when)}</td><td><div class="name">${esc(e.a.name)}</div><div class="meta">${esc(e.c.name)} · ${esc(e.b.name)} · ${actionRespsStr(e.a)} · assinado por ${esc(e.h.user||'—')}</div></td></tr>`,
        'Nenhuma atividade concluída no prazo neste período.')}

      ${section('⚠️ Concluídas com atraso', events.concAtraso,
        e=>`<tr><td>${fmtDt(e.h.when)}</td><td><div class="name">${esc(e.a.name)}</div><div class="meta">${esc(e.c.name)} · ${esc(e.b.name)} · ${actionRespsStr(e.a)}<br>${esc(e.h.note||'')} · assinado por ${esc(e.h.user||'—')}</div></td></tr>`)}

      ${section('📅 Replanejamentos', events.replan,
        e=>`<tr><td>${fmtDt(e.h.when)}</td><td><div class="name">${esc(e.a.name)}</div><div class="meta">${esc(e.c.name)} · ${esc(e.b.name)}<br>${esc(e.h.note||'')} · assinado por ${esc(e.h.user||'—')}</div></td></tr>`)}

      ${section('🆕 Novas atividades criadas', events.criadas,
        e=>`<tr><td>${fmtDt(e.h.when)}</td><td><div class="name">${esc(e.a.name)}</div><div class="meta">${esc(e.c.name)} · ${esc(e.b.name)} · ${actionRespsStr(e.a)} · assinado por ${esc(e.h.user||'—')}</div></td></tr>`)}

      ${section('💬 Comentários / observações', events.comentarios,
        e=>`<tr><td>${fmtDt(e.h.when)}</td><td><div class="name">${esc(e.a.name)}</div><div class="meta">${esc(e.c.name)} · ${esc(e.b.name)}<br>"${esc(e.h.note||'')}" · ${esc(e.h.user||'—')}</div></td></tr>`)}

      ${section('⚠️ Riscos identificados', events.riscos,
        e=>`<tr><td>${fmtDt(e.h.when)}</td><td><div class="name">${esc(e.a.name)}</div><div class="meta">${esc(e.c.name)} · ${esc(e.b.name)}<br>"${esc(e.h.note||'')}" · ${esc(e.h.user||'—')}</div></td></tr>`)}

      ${section('📎 Anexos', events.anexos,
        e=>`<tr><td>${fmtDt(e.h.when)}</td><td><div class="name">${esc(e.a.name)}</div><div class="meta">${esc(e.c.name)} · ${esc(e.b.name)}<br>${esc(e.h.note||'')} · ${esc(e.h.user||'—')}</div></td></tr>`)}

      ${section('✏️ Outras edições', events.edicoes,
        e=>`<tr><td>${fmtDt(e.h.when)}</td><td><div class="name">${esc(e.a.name)}</div><div class="meta">${esc(e.c.name)} · ${esc(e.h.event)}: ${esc(e.h.note||'')} · ${esc(e.h.user||'—')}</div></td></tr>`)}

      ${section('🏗️ Atualizações de % de obra', events.obraUpdates,
        e=>`<tr><td>${fmt(e.o.date)}</td><td><div class="name">${esc(e.c.name)} — ${e.o.pct}%</div><div class="meta">${esc(e.o.note||'')}</div></td></tr>`)}

      ${projClosed.length?section('🏁 Projetos concluídos no período', projClosed,
        c=>`<tr><td>${fmtDt(c.completedAt)}</td><td class="name">${esc(c.name)}</td></tr>`):''}

      ${projPaused.length?section('⏸️ Projetos suspensos no período', projPaused,
        c=>`<tr><td>${fmtDt(c.pausedAt)}</td><td><div class="name">${esc(c.name)}</div><div class="meta">${esc(c.pausedReason||'sem motivo informado')}</div></td></tr>`):''}

      ${total===0?'<div class="evo-sec"><p class="empty">Nenhum evento registrado neste período. Verifique se as datas estão corretas ou se há atividade no período.</p></div>':''}
    </div>
    </body></html>`;
  w.document.write(html); w.document.close();
  closeModal('modalEvolution');
}

/* ========= MASTER ========= */
function renderAll(){
  renderCommitteeSelect();
  // Sem projetos (sistema novo ou nenhum liberado para as empresas do usuário): telas que
  // dependem de um projeto mostram o estado vazio em vez de quebrar.
  const semProjeto = !db.committees.length && ['project','responsible','meeting','ai'].includes(currentView);
  document.getElementById('crcEmpty').classList.toggle('hidden', !semProjeto);
  document.getElementById('view-'+currentView).classList.toggle('hidden', semProjeto);
  if(semProjeto) return;
  if(currentView==='dashboard'){ renderDashboard(); renderDashboardExtras(); }
  if(currentView==='project'){ renderCommittee(); if(projectView==='kanban') renderKanban(); }
  if(currentView==='calendar') renderCalendar();
  if(currentView==='responsible') renderResponsible();
  if(currentView==='meeting') renderMeeting();
  if(currentView==='ai') { /* mantém estado; nada a fazer aqui */ }
  if(currentView==='templates') renderTemplates();
  if(currentView==='settings'){ renderResps(); loadApiSettings(); }
}
renderAll();
