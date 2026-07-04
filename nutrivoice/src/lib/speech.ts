import { Platform } from 'react-native';

/**
 * Cross-platform speech-to-text.
 * - Web: Web Speech API (Chrome/Edge/Safari).
 * - iOS/Android: expo-speech-recognition (requires a dev build; unavailable in
 *   Expo Go — callers must fall back to typed input when isSpeechAvailable()
 *   is false).
 */

export interface SpeechCallbacks {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

export interface SpeechSession {
  stop: () => void;
}

const LANG = 'en-IN';

type NativeModule = typeof import('expo-speech-recognition');

let nativeMod: NativeModule | null | undefined;

function getNativeModule(): NativeModule | null {
  if (nativeMod !== undefined) return nativeMod;
  try {
    // Throws in Expo Go where the native module is absent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition') as NativeModule;
    // touch the module to make sure the native side is linked
    nativeMod = mod?.ExpoSpeechRecognitionModule ? mod : null;
  } catch {
    nativeMod = null;
  }
  return nativeMod;
}

function getWebRecognition(): (new () => any) | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechAvailable(): boolean {
  if (Platform.OS === 'web') return getWebRecognition() != null;
  return getNativeModule() != null;
}

async function startWeb(cb: SpeechCallbacks): Promise<SpeechSession | null> {
  const Ctor = getWebRecognition();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = LANG;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText = '';
  rec.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) cb.onPartial((finalText + ' ' + interim).trim());
    if (finalText) cb.onPartial(finalText.trim());
  };
  rec.onerror = (event: any) => {
    if (event.error === 'no-speech') cb.onError('No speech detected. Try again.');
    else if (event.error === 'not-allowed') cb.onError('Microphone permission denied.');
    else cb.onError(`Speech recognition error: ${event.error ?? 'unknown'}`);
  };
  rec.onend = () => {
    if (finalText.trim()) cb.onFinal(finalText.trim());
    cb.onEnd();
  };
  try {
    rec.start();
  } catch {
    cb.onError('Could not start the microphone.');
    return null;
  }
  return { stop: () => rec.stop() };
}

async function startNative(cb: SpeechCallbacks): Promise<SpeechSession | null> {
  const mod = getNativeModule();
  if (!mod) return null;
  const { ExpoSpeechRecognitionModule } = mod;

  try {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      cb.onError('Microphone permission denied.');
      return null;
    }
  } catch {
    cb.onError('Could not request microphone permission.');
    return null;
  }

  let finalText = '';
  const subs = [
    ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
      const transcript = event?.results?.[0]?.transcript ?? '';
      if (!transcript) return;
      if (event.isFinal) finalText = transcript;
      cb.onPartial(transcript);
    }),
    ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
      cb.onError(`Speech recognition error: ${event?.message ?? event?.error ?? 'unknown'}`);
    }),
    ExpoSpeechRecognitionModule.addListener('end', () => {
      subs.forEach((s) => s.remove());
      if (finalText.trim()) cb.onFinal(finalText.trim());
      cb.onEnd();
    }),
  ];

  try {
    ExpoSpeechRecognitionModule.start({
      lang: LANG,
      interimResults: true,
      continuous: false,
    });
  } catch {
    subs.forEach((s) => s.remove());
    cb.onError('Could not start speech recognition.');
    return null;
  }

  return {
    stop: () => {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // ignored — session is ending anyway
      }
    },
  };
}

export async function startListening(cb: SpeechCallbacks): Promise<SpeechSession | null> {
  return Platform.OS === 'web' ? startWeb(cb) : startNative(cb);
}
