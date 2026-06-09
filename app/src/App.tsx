import { useTranslation } from 'react-i18next';
import { GalaxyScene } from './scene/GalaxyScene';
import { isWebGL2Available } from './lib/webgl';

const webgl2Available = isWebGL2Available();

export default function App() {
  const { t } = useTranslation();

  if (!webgl2Available) {
    return (
      <main role="alert" className="flex h-full items-center justify-center bg-black p-8">
        <p className="max-w-prose text-center text-lg text-white">{t('errors.webgl2Required')}</p>
      </main>
    );
  }

  return (
    <div className="h-full w-full bg-black">
      <GalaxyScene />
    </div>
  );
}
