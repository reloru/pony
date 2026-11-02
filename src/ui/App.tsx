import { useEffect } from 'preact/hooks';
import { useRoute } from '../app/router';
import { useStore } from '../app/store';
import { applyUpdateIfWaiting } from '../app/offline';
import { BeadDefs } from './Bead';
import { ToastHost } from './common';
import { Home } from './screens/Home';
import { KindGallery, MyDesigns } from './screens/Gallery';
import { ContactSheet } from './screens/ContactSheet';
import { Editor } from './screens/Editor';
import { Make } from './screens/Make';
import { MyBeads } from './screens/MyBeads';
import { Grownups } from './screens/Grownups';

export function App() {
  const route = useRoute();
  const s = useStore();
  useEffect(() => {
    if (route.name === 'home') applyUpdateIfWaiting();
  }, [route.name]);

  let screen;
  if (!s.ready) screen = <div class="screen" />;
  else
    switch (route.name) {
      case 'home':
        screen = <Home />;
        break;
      case 'kind':
        screen = <KindGallery kind={route.kind} />;
        break;
      case 'mine':
        screen = <MyDesigns />;
        break;
      case 'edit':
        screen = <Editor key={route.id} id={route.id} />;
        break;
      case 'make':
        screen = <Make key={route.id} id={route.id} />;
        break;
      case 'beads':
        screen = <MyBeads />;
        break;
      case 'grownups':
        screen = <Grownups />;
        break;
      case 'sheet':
        screen = <ContactSheet />;
        break;
    }
  return (
    <>
      <BeadDefs />
      {screen}
      <ToastHost />
    </>
  );
}
