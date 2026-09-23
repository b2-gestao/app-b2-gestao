import { AppLogic } from './logic/AppLogic';
import AppRoot from './screens/generated/AppRoot';

/** The whole back-office: home launcher + app shell with all screens. */
export default class App extends AppLogic {
  render() {
    return <AppRoot v={this.renderVals()} />;
  }
}
