import { useState } from 'preact/hooks';
import { Download, Share, Upload } from 'lucide-preact';
import { makeBackup, parseBackup } from '../../app/backup';
import { useOffline } from '../../app/offline';
import { applyBackup, getState, useStore } from '../../app/store';
import { TopBar, toast } from '../common';
import { installPrompt, promptInstall } from '../../app/install';

const LAST_KEY = 'bead-studio:last-backup';
function readLast(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}
function writeLast() {
  try {
    localStorage.setItem(LAST_KEY, new Date().toISOString());
  } catch {
    /* private mode */
  }
}

function backupFile(): File {
  const s = getState();
  const json = JSON.stringify(makeBackup(s.designs, s.owned, s.settings));
  const day = new Date().toISOString().slice(0, 10);
  return new File([json], `bead-studio-backup-${day}.json`, { type: 'application/json' });
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function Grownups() {
  const s = useStore();
  const off = useOffline();
  const [last, setLast] = useState(readLast);
  const [busy, setBusy] = useState(false);
  const canShareFiles = (() => {
    try {
      return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] });
    } catch {
      return false;
    }
  })();
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

  async function share() {
    const file = backupFile();
    try {
      await navigator.share({ files: [file], title: 'Bead Studio backup' });
      writeLast();
      setLast(readLast());
      toast('Backup saved');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        download(file);
        writeLast();
        setLast(readLast());
      }
    }
  }

  async function restore(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const parsed = parseBackup(await f.text());
      const r = await applyBackup(parsed);
      toast(`Restored: ${r.added} new, ${r.updated} updated${parsed.skipped ? `, ${parsed.skipped} skipped` : ''}`);
    } catch (err) {
      toast((err as Error).message || 'Could not read that file');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="screen">
      <TopBar title="Grown-ups" backTo={{ name: 'home' }} />

      <div class="panel">
        <h2>Backup</h2>
        <p>
          Everything is saved only on this device: {s.designs.length} designs and {s.owned.size} owned bead colors. Save a backup file now and
          then (for example to Files or iCloud Drive) so nothing is lost if the app is deleted or the device is reset.
        </p>
        <p>Last backup: {last ? new Date(last).toLocaleString() : 'never'}</p>
        <div class="row">
          {canShareFiles && (
            <button class="btn violet" onClick={share} data-testid="share-backup">
              <Share size={22} /> Save backup…
            </button>
          )}
          <button
            class="btn"
            data-testid="download-backup"
            onClick={() => {
              download(backupFile());
              writeLast();
              setLast(readLast());
            }}
          >
            <Download size={22} /> Download file
          </button>
          <label class="btn" aria-disabled={busy}>
            <Upload size={22} /> Restore from file
            <input type="file" data-testid="restore-input" style={{ display: 'none' }} onChange={restore} />
          </label>
        </div>
        <p style={{ fontSize: '15px', color: '#7b6688' }}>
          Restoring adds designs from the file. Nothing on the device is deleted; if both have the same design, the newer one is kept.
        </p>
        {!s.persistent && <p class="warn-text">This browser refused to save data ({s.storageError}). Designs will be lost when the app closes.</p>}
      </div>

      <div class="panel">
        <h2>Offline</h2>
        {!off.supported ? (
          <p class="warn-text">Offline mode needs the installed app over https.</p>
        ) : off.ready ? (
          <p class="ok">✓ Everything is stored on this device. The app works with no internet.</p>
        ) : (
          <p>
            Downloading for offline use… {off.cached}/{off.total || '?'}
          </p>
        )}
        <p style={{ fontSize: '15px', color: '#7b6688' }}>
          No accounts, ads or tracking. After the first load the app makes no requests of its own; when the device is online the browser
          checks for a newer version of the app file, which is how updates arrive.{off.version ? ` Version ${off.version}.` : ''}
        </p>
      </div>

      <div class="panel">
        <h2>Install on the home screen</h2>
        {standalone ? (
          <p class="ok">✓ Running as an installed app.</p>
        ) : (
          <>
            {installPrompt.value && (
              <div class="row" style={{ marginBottom: '8px' }}>
                <button class="btn pink" onClick={() => void promptInstall()}>
                  Install app
                </button>
              </div>
            )}
            <p>
              <b>iPhone / iPad:</b> open this page in Safari, tap the Share button, then <b>Add to Home Screen</b>. Open it once from the new icon while
              online and wait for “Ready to use offline” on the home screen.
            </p>
            <p>
              <b>Fire tablet (Chrome):</b> open this page in Chrome, tap the <b>⋮</b> menu, then <b>Add to Home screen</b> (or <b>Install app</b>), then
              <b> Install</b>.
            </p>
            <p style={{ fontSize: '15px', color: '#7b6688' }}>
              The installed app keeps its own saved designs, separate from the browser tab, so install first and use it from the icon.
            </p>
          </>
        )}
      </div>

      <div class="panel">
        <h2>Supplies</h2>
        <ul>
          <li>Pony beads, 9 × 6 mm with a 4 mm hole.</li>
          <li>
            <b>Stretchy cord</b>, about 1 mm (0.8–1 mm elastic bead cord) for bracelets and cuffs.
          </li>
          <li>
            <b>Plastic lace</b> (also sold as gimp, boondoggle, lanyard or Rexlace) for shapes and critters. It is stiff, which helps 3D critters hold
            their shape. Stretchy cord also works for shapes.
          </li>
          <li>Key rings (optional), scissors, and tape for the cord end.</li>
        </ul>
        <p style={{ fontSize: '15px', color: '#7b6688' }}>
          Cord lengths in the steps are generous estimates, rounded up. Star beads are only offered where the cord passes through a bead once
          (bracelets and leg tips), because star bead sizes and holes vary.
        </p>
      </div>
    </div>
  );
}
