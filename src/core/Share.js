import { Platform } from './Platform.js';

/**
 * Sharing a win to social media: a picture card plus a caption with the game's name,
 * a link and hashtags.
 * - Android app: the system share sheet (WhatsApp, Facebook, Instagram, Messenger, X…).
 * - Web: the browser's share sheet where there is one (phones), otherwise the card is
 *   downloaded and the caption copied, ready to paste.
 * - CrazyGames: off, since games there may not link to other sites.
 * Many apps (Instagram, Facebook) drop shared text, so the caption is also copied to the clipboard.
 */

export const STORE_URL = 'https://play.google.com/store/apps/details?id=com.sahadat.bloomora';
export const WEB_URL = 'https://itsahadat.github.io/bloomora/';
const HASHTAGS = '#Bloomora #Match3 #PuzzleGame #GardenGame #MobileGames #IndieGame';

export function winCaption({ levelNumber, levelName, stars, score }) {
  const url = Platform.target === 'android' ? STORE_URL : WEB_URL;
  const starText = '⭐'.repeat(Math.max(1, stars));
  return `🌸 I just bloomed Level ${levelNumber} "${levelName}" in Bloomora ${starText} with ${score.toLocaleString()} points! Can you beat my score? 🌻\n\nPlay free: ${url}\n\n${HASHTAGS}`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function dataUrlToFile(dataUrl, name) {
  const [head, b64] = dataUrl.split(',');
  const mime = head.match(/data:(.*?);/)?.[1] ?? 'image/png';
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: mime });
}

async function shareAndroid(image, caption) {
  const [{ Share: CapShare }, { Filesystem, Directory }] = await Promise.all([
    import('@capacitor/share'),
    import('@capacitor/filesystem'),
  ]);
  const { uri } = await Filesystem.writeFile({
    path: 'bloomora-win.png',
    data: image.split(',')[1],
    directory: Directory.Cache,
  });
  await CapShare.share({ title: 'Bloomora', text: caption, files: [uri], dialogTitle: 'Share your win' });
}

async function shareWeb(image, caption) {
  const file = dataUrlToFile(image, 'bloomora-win.png');
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: caption, title: 'Bloomora' });
    return 'shared';
  }
  // Desktop: save the card and copy the caption.
  const a = document.createElement('a');
  a.href = image;
  a.download = 'bloomora-win.png';
  a.click();
  return 'downloaded';
}

export const Share = {
  get available() {
    return Platform.target !== 'crazygames';
  },

  /**
   * Share an image (data URL) with its caption.
   * Resolves 'shared', 'downloaded' (desktop fallback) or 'cancelled'.
   */
  async share(image, caption) {
    const copied = await copyText(caption);
    try {
      if (Platform.target === 'android') {
        await shareAndroid(image, caption);
        return { result: 'shared', copied };
      }
      return { result: await shareWeb(image, caption), copied };
    } catch (err) {
      console.warn('[Share] cancelled or failed', err);
      return { result: 'cancelled', copied };
    }
  },
};
