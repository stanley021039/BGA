import { onScopeDispose, ref, shallowRef } from 'vue';

// The browser's own speech recognizer (Chrome/Edge send audio to Google, Safari
// to Apple). Nothing is recorded until the speaker presses the talk button, and
// only text leaves this page.
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

function recognizer(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

export interface SpeechLine {
  utteranceId: string;
  text: string;
  final: boolean;
}

const INTERIM_MS = 700;
const ERRORS: Record<string, string> = {
  'not-allowed': '麥克風權限被拒絕，請在瀏覽器網址列允許麥克風後再試。',
  'service-not-allowed': '這個瀏覽器不允許語音辨識，請改用 Chrome、Edge 或 Safari。',
  'audio-capture': '找不到麥克風，請確認裝置已連接。',
  network: '語音辨識需要網路連線，請稍後再試。',
  'language-not-supported': '這個瀏覽器不支援中文語音辨識。',
};

// Turns speech into subtitle lines. `send` receives an interim line at most
// every 0.7 s and every final line; the caller decides where they go.
export function useSpeechCaptions(send: (line: SpeechLine) => Promise<unknown> | void) {
  const Constructor = recognizer(),
    supported = !!Constructor,
    listening = ref(false),
    interim = ref(''),
    error = ref(''),
    last = shallowRef<SpeechLine | null>(null);
  let recognition: Recognition | null = null,
    utteranceId = crypto.randomUUID(),
    lastInterimAt = 0,
    pending: ReturnType<typeof setTimeout> | null = null,
    wanted = false;

  function deliver(line: SpeechLine) {
    last.value = line;
    void Promise.resolve(send(line)).catch(() => {});
  }
  function flushInterim() {
    if (pending) clearTimeout(pending);
    pending = null;
    lastInterimAt = Date.now();
    deliver({ utteranceId, text: interim.value, final: false });
  }
  function heard(event: RecognitionEvent) {
    let partial = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i],
        text = result[0]?.transcript.trim() || '';
      if (!text) continue;
      if (result.isFinal) {
        if (pending) clearTimeout(pending);
        pending = null;
        deliver({ utteranceId, text, final: true });
        utteranceId = crypto.randomUUID();
        interim.value = '';
      } else partial += text;
    }
    if (!partial || partial === interim.value) return;
    interim.value = partial;
    const wait = INTERIM_MS - (Date.now() - lastInterimAt);
    if (wait <= 0) flushInterim();
    else if (!pending) pending = setTimeout(flushInterim, wait);
  }
  function start() {
    if (!Constructor || listening.value) return;
    error.value = '';
    wanted = true;
    const next = new Constructor();
    next.lang = 'zh-TW';
    next.continuous = true;
    next.interimResults = true;
    next.maxAlternatives = 1;
    next.onresult = heard;
    next.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      error.value = ERRORS[event.error] || '語音辨識發生錯誤，請再按一次講話。';
      wanted = false;
    };
    // Browsers end recognition after a pause; keep listening until stopped.
    next.onend = () => {
      if (recognition !== next) return;
      if (wanted)
        try {
          next.start();
          return;
        } catch {
          // Restarting too quickly throws; fall through and stop cleanly.
        }
      finish();
    };
    recognition = next;
    try {
      next.start();
      listening.value = true;
    } catch {
      recognition = null;
      wanted = false;
      error.value = '無法啟動語音辨識，請再試一次。';
    }
  }
  function finish() {
    if (pending) clearTimeout(pending);
    pending = null;
    // Clear an unfinished subtitle so others do not see a dangling half line.
    if (interim.value) deliver({ utteranceId, text: '', final: false });
    interim.value = '';
    utteranceId = crypto.randomUUID();
    listening.value = false;
    recognition = null;
  }
  // Stop keeps whatever was already recognised; abort discards it (round over).
  function stop(discard = false) {
    wanted = false;
    const current = recognition;
    if (!current) return;
    if (discard) {
      recognition = null;
      current.abort();
      interim.value = '';
      listening.value = false;
      if (pending) clearTimeout(pending);
      pending = null;
      return;
    }
    current.stop();
  }
  onScopeDispose(() => stop(true));
  return { supported, listening, interim, error, last, start, stop };
}
