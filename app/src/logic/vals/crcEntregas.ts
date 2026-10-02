import type { AppLogic } from '../AppLogic';
import { empresaLabel } from '../../lib/api';

const PERM = 'crc.entregas';

/** CRC › Entregas: menu, navegação e o contexto que a tela (screens/crc) usa. */
export function crcEntregasVals(this: AppLogic, subItemStyle: string) {
  const s: any = this.state;
  const activeItem = ';color:#F5F5F7;font-weight:600;background:rgba(67,185,151,.14);border-color:#43B997';
  const ident = this.identityVals();
  return {
    crcGroupStyle: '',
    toggleCrc: () => this.setState(st => ({ crcOpen: !st.crcOpen })),
    crcChevron: (!s.collapsed && s.crcOpen) ? 'rotate(180deg)' : 'rotate(0deg)',
    crcContentStyle: `display:grid;grid-template-rows:${(!s.collapsed && s.crcOpen) ? '1fr' : '0fr'};transition:grid-template-rows .16s ease`,
    crcEntregasItemStyle: s.page === 'crcEntregas' ? subItemStyle + activeItem : subItemStyle,
    goCrcEntregas: (e?: any) => {
      if (e && e.preventDefault) e.preventDefault();
      if (this.semAcesso(this.pode(PERM))) return;
      this.setState({ view: 'app', page: 'crcEntregas', module: 'CRC', crcOpen: true, collapsed: true, userMenuOpen: false });
    },
    isCrcEntregas: s.view === 'app' && s.page === 'crcEntregas',
    crc: {
      toast: (m: string) => this.toast(m),
      empresas: () => (s.dbEmpresas || []).map((e: any) => ({ id: e.id, label: empresaLabel(e) })),
      userName: () => ident.userName,
      podeEditar: () => this.pode(PERM, true),
    },
  };
}
