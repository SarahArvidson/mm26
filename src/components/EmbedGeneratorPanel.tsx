import { useState } from 'react';
import type { UUID } from '../utils/bracketLogic';

interface EmbedGeneratorPanelProps {
  seasonId: UUID;
}

const SIZE_PRESETS = {
  small: { width: 600, height: 800 },
  medium: { width: 800, height: 1000 },
  large: { width: 1000, height: 1200 },
};

export default function EmbedGeneratorPanel({ seasonId }: EmbedGeneratorPanelProps) {
  const [sizePreset, setSizePreset] = useState<keyof typeof SIZE_PRESETS>('medium');
  const [hideNav, setHideNav] = useState(false);
  const [copied, setCopied] = useState(false);

  const baseUrl = window.location.origin;
  const embedUrl = `${baseUrl}/embed/${seasonId}${hideNav ? '?nav=0' : ''}`;
  const { width, height } = SIZE_PRESETS[sizePreset];

  const iframeCode = `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0"></iframe>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div style={{ border: '1px solid #ccc', padding: '20px', margin: '20px 0' }}>
      <h3>Intégrer le tableau</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label>
          Taille :
          <select
            value={sizePreset}
            onChange={(e) => setSizePreset(e.target.value as keyof typeof SIZE_PRESETS)}
          >
            <option value="small">Petit (600×800)</option>
            <option value="medium">Moyen (800×1000)</option>
            <option value="large">Grand (1000×1200)</option>
          </select>
        </label>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>
          <input
            type="checkbox"
            checked={hideNav}
            onChange={(e) => setHideNav(e.target.checked)}
          />
          Masquer la navigation (nav=0)
        </label>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>
          Code iframe :
          <textarea
            readOnly
            value={iframeCode}
            style={{ width: '100%', minHeight: '80px', fontFamily: 'monospace' }}
          />
        </label>
      </div>

      <button onClick={handleCopy}>
        {copied ? 'Copié !' : 'Copier'}
      </button>
    </div>
  );
}
