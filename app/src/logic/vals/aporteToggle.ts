/** Estilo e textos do toggle "Aportes ?" das telas Programação diária e Fluxo de caixa. */
export function aporteToggleVals(prefix: 'pg' | 'fx', on: boolean, toggle: () => void) {
  return {
    [`${prefix}AporteOn`]: on,
    [`${prefix}AporteToggle`]: toggle,
    [`${prefix}AporteTip`]: 'Aportes: quando ativo, mostra apenas as empresas que precisam de aporte (saldo insuficiente para cobrir os pagamentos). Os cards passam a considerar somente essas empresas.',
    [`${prefix}AporteBtnStyle`]: `display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:8px;border:1px solid ${on ? '#DDD6FE' : '#E7E7EA'};background:${on ? '#F5F0FF' : '#FFFFFF'};color:${on ? '#7C3AED' : '#374151'};font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .15s;white-space:nowrap`,
    [`${prefix}AporteTrackStyle`]: `position:relative;display:inline-block;width:30px;height:17px;border-radius:20px;flex:none;background:${on ? '#7C3AED' : '#D8D8E0'};transition:background .18s`,
    [`${prefix}AporteKnobStyle`]: `position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;background:#FFFFFF;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .18s;transform:translateX(${on ? 13 : 0}px)`,
  };
}

export function emptyStateVals(prefix: 'pg' | 'fx', soAportes: boolean) {
  return {
    [`${prefix}EmptyTitle`]: soAportes ? 'Nenhuma empresa precisa de aporte' : 'Nenhuma empresa selecionada',
    [`${prefix}EmptySub`]: soAportes ? 'Desative o filtro Aportes para ver todas as empresas.' : 'Marque ao menos uma empresa no filtro.',
  };
}
