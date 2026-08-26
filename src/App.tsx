import { Route, Switch } from 'wouter';
import { useAppChrome } from './hooks/useAppChrome.js';
import { Home } from './pages/Home.js';
import { Reader } from './pages/Reader.js';
import { Settings } from './pages/Settings.js';
import { About } from './pages/About.js';

export function App(): React.JSX.Element {
  useAppChrome();

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/p/:slug">{(params) => <Reader slug={params.slug ?? ''} />}</Route>
      <Route path="/settings" component={Settings} />
      <Route path="/about" component={About} />
      <Route>
        <Home />
      </Route>
    </Switch>
  );
}
