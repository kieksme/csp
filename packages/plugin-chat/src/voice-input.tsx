import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { BrowserContext } from '@kieksme/csp-sdk';
interface Props {
  ctx: BrowserContext;
  value: string;
  setValue: Dispatch<SetStateAction<string>>;
  disabled: boolean;
  token?: () => Promise<string | undefined>;
  onBusy: (busy: boolean) => void;
}
export function VoiceInput({
  ctx,
  value,
  setValue,
  disabled,
  token,
  onBusy,
}: Props) {
  const [enabled, setEnabled] = useState(false),
    [state, setState] = useState<
      'idle' | 'starting' | 'recording' | 'transcribing'
    >('idle'),
    [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    request = useRef<AbortController | null>(null);
  const alive = useRef(true),
    cancelled = useRef(false),
    draft = useRef(value);
  const operation = useRef(0);
  draft.current = value;
  const release = () => {
    if (timer.current) clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  const idle = () => {
    if (alive.current) {
      setState('idle');
      onBusy(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    if (
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function'
    ) {
      void (ctx.request ?? fetch)(
        ctx.config.apiUrl + '/api/v1/chat/capabilities',
        { signal: controller.signal },
      )
        .then((response) => (response.ok ? response.json() : null))
        .then((result) => {
          if (alive.current) setEnabled(result?.transcription === true);
        })
        .catch(() => {});
    }
    return () => {
      operation.current++;
      alive.current = false;
      cancelled.current = true;
      controller.abort();
      request.current?.abort();
      if (recorder.current?.state === 'recording') recorder.current.stop();
      release();
    };
  }, [ctx.config.apiUrl]);
  useEffect(() => {
    if (disabled && state !== 'idle') {
      operation.current++;
      cancelled.current = true;
      request.current?.abort();
      if (recorder.current?.state === 'recording') recorder.current.stop();
      release();
      idle();
    }
  }, [disabled]);
  async function start() {
    if (state !== 'idle' || disabled) return;
    const attempt = ++operation.current;
    setState('starting');
    onBusy(true);
    setError('');
    cancelled.current = false;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (
        !alive.current ||
        cancelled.current ||
        operation.current !== attempt
      ) {
        media.getTracks().forEach((track) => track.stop());
        if (operation.current === attempt) idle();
        return;
      }
      stream.current = media;
      const mime = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mime)
        throw new Error(
          'Dieser Browser unterstützt keine passende Audioaufnahme.',
        );
      const capture = new MediaRecorder(media, { mimeType: mime });
      recorder.current = capture;
      const chunks: Blob[] = [];
      let bytes = 0;
      capture.ondataavailable = (event) => {
        if (event.data.size) {
          bytes += event.data.size;
          chunks.push(event.data);
          if (bytes > 10 * 1024 * 1024) {
            cancelled.current = true;
            if (capture.state === 'recording') capture.stop();
            release();
            if (alive.current)
              setError('Die Aufnahme ist zu groß. Bitte kürzer diktieren.');
          }
        }
      };
      capture.onerror = () => {
        if (operation.current !== attempt) return;
        cancelled.current = true;
        release();
        if (alive.current)
          setError('Aufnahme fehlgeschlagen. Ihr Entwurf bleibt erhalten.');
        idle();
      };
      capture.onstop = () => {
        if (operation.current !== attempt) return;
        release();
        if (cancelled.current || !alive.current) {
          idle();
          return;
        }
        void transcribe(new Blob(chunks, { type: mime }));
      };
      capture.start(1000);
      setState('recording');
      timer.current = setTimeout(() => {
        if (capture.state === 'recording') capture.stop();
      }, 60000);
    } catch (failure) {
      if (operation.current !== attempt) return;
      release();
      if (alive.current)
        setError(
          failure instanceof DOMException && failure.name === 'NotAllowedError'
            ? 'Bitte erlauben Sie den Mikrofonzugriff für die Spracheingabe.'
            : failure instanceof Error
              ? failure.message
              : 'Mikrofon nicht verfügbar.',
        );
      idle();
    }
  }
  async function transcribe(audio: Blob) {
    const attempt = operation.current;
    setState('transcribing');
    const controller = new AbortController();
    request.current = controller;
    try {
      const bearer = await token?.();
      if (controller.signal.aborted) return;
      const response = await (ctx.request ?? fetch)(
        ctx.config.apiUrl + '/api/v1/chat/transcriptions',
        {
          method: 'POST',
          body: audio,
          credentials: 'same-origin',
          signal: controller.signal,
          headers: {
            'Content-Type': audio.type,
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          },
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? 'Spracheingabe derzeit nicht verfügbar.',
        );
      if (typeof result.text !== 'string' || !result.text.trim())
        throw new Error('Keine Sprache erkannt.');
      if (
        draft.current.length + result.text.length + (draft.current ? 1 : 0) >
        4000
      )
        throw new Error(
          'Der Entwurf wäre zu lang. Bitte kürzer diktieren. Ihr Text bleibt erhalten.',
        );
      if (
        alive.current &&
        !controller.signal.aborted &&
        operation.current === attempt
      )
        setValue((previous) => previous + (previous ? '\n' : '') + result.text);
    } catch (failure) {
      if (alive.current && !controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Spracheingabe fehlgeschlagen. Ihr Entwurf bleibt erhalten.',
        );
    } finally {
      if (operation.current === attempt) {
        request.current = null;
        idle();
      }
    }
  }
  if (!enabled) return null;
  return (
    <div className="chat-voice" data-recording={state === 'recording'}>
      {state === 'idle' ? (
        <button
          type="button"
          className="chat-voice-button"
          disabled={disabled}
          onClick={() => void start()}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            className="inline mr-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
          </svg>
          Nachricht diktieren
        </button>
      ) : (
        <>
          <span role="status" className="chat-voice-status">
            {state === 'recording'
              ? '● Aufnahme läuft · maximal 60 Sekunden'
              : state === 'starting'
                ? 'Mikrofon wird gestartet …'
                : 'Sprache wird in Text umgewandelt …'}
          </span>
          {state === 'recording' && (
            <button
              type="button"
              className="chat-voice-button"
              onClick={() => recorder.current?.stop()}
            >
              Aufnahme stoppen
            </button>
          )}
          <button
            type="button"
            className="chat-voice-cancel"
            onClick={() => {
              operation.current++;
              cancelled.current = true;
              request.current?.abort();
              if (recorder.current?.state === 'recording')
                recorder.current.stop();
              release();
              idle();
            }}
          >
            Abbrechen
          </button>
        </>
      )}
      <p className="chat-voice-notice">
        Die Aufnahme wird zur Texterkennung an OpenAI gesendet. Prüfen Sie den
        Text vor dem Senden.
      </p>
      {error && (
        <p role="alert" className="text-danger dark:text-warning mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
