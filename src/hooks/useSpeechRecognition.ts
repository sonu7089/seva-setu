"use client";

import * as React from "react";

/** Minimal typings for the (webkit-prefixed) Web Speech API. */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Chrome ends a session after a few seconds of silence; we transparently restart it. */
const RESTART_DELAY_MS = 250;
/** Give up after this many back-to-back sessions that heard nothing. */
const MAX_SILENT_SESSIONS = 3;
/** Sessions that die faster than this count as a failure to start (e.g. blocked mic). */
const MIN_HEALTHY_SESSION_MS = 800;
const MAX_QUICK_FAILURES = 3;

interface UseSpeechRecognitionOptions {
  /** BCP-47 tag, e.g. `hi-IN` or `en-IN`. Changing it mid-session restarts listening in the new language. */
  lang: string;
  /** Called with each finalized phrase. */
  onFinalTranscript: (text: string) => void;
}

export interface UseSpeechRecognitionResult {
  /** `null` until the browser has been checked (avoids a flash of "unsupported" on first paint). */
  supported: boolean | null;
  listening: boolean;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  clearError: () => void;
}

export function useSpeechRecognition({
  lang,
  onFinalTranscript,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const restartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  /** True while the user wants the mic on; drives auto-restart after Chrome's silent timeouts. */
  const wantListeningRef = React.useRef(false);
  const langRef = React.useRef(lang);
  const onFinalRef = React.useRef(onFinalTranscript);
  const silentSessionsRef = React.useRef(0);
  const quickFailuresRef = React.useRef(0);
  const heardSpeechRef = React.useRef(false);
  const sessionStartedAtRef = React.useRef(0);

  const [supported, setSupported] = React.useState<boolean | null>(null);
  const [listening, setListening] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  React.useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const clearRestartTimer = React.useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  /** Fully stops everything and surfaces `message` (if any). */
  const halt = React.useCallback(
    (message?: string) => {
      wantListeningRef.current = false;
      clearRestartTimer();
      setListening(false);
      setInterim("");
      if (message) setError(message);
    },
    [clearRestartTimer]
  );

  const beginSession = React.useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      halt("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = langRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Events from a replaced/aborted session must never touch current state.
    const isCurrent = () => recognitionRef.current === recognition;

    recognition.onstart = () => {
      if (!isCurrent()) return;
      sessionStartedAtRef.current = Date.now();
      setListening(true);
    };

    recognition.onresult = (event) => {
      if (!isCurrent()) return;
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const finalText = text.trim();
          if (finalText) {
            heardSpeechRef.current = true;
            onFinalRef.current(finalText);
          }
        } else {
          interimText += text;
          if (text.trim()) heardSpeechRef.current = true;
        }
      }
      setInterim(interimText);
    };

    recognition.onerror = (event) => {
      if (!isCurrent()) return;
      switch (event.error) {
        case "not-allowed":
        case "service-not-allowed":
          halt(
            "Microphone access is blocked. Click the lock icon in the address bar, allow the microphone, then tap the mic again."
          );
          break;
        case "audio-capture":
          halt(
            "No microphone was found. Connect one (or check system sound settings) and try again."
          );
          break;
        case "network":
          halt(
            "Voice input needs an internet connection — Chrome and Edge send audio to an online speech service. Check your connection and try again."
          );
          break;
        case "language-not-supported":
          halt(
            `This browser can't recognise ${langRef.current}. Switch language or type instead.`
          );
          break;
        case "no-speech":
        case "aborted":
          // Handled in onend (silence) or intentional (abort).
          break;
        default:
          halt(`Voice input error (${event.error}). Please try again.`);
      }
    };

    recognition.onend = () => {
      if (!isCurrent()) return;
      recognitionRef.current = null;
      setInterim("");

      if (!wantListeningRef.current) {
        setListening(false);
        return;
      }

      // Chrome closed the session by itself (silence / time limit). Decide whether to restart.
      const lived = Date.now() - sessionStartedAtRef.current;
      quickFailuresRef.current =
        lived < MIN_HEALTHY_SESSION_MS ? quickFailuresRef.current + 1 : 0;
      silentSessionsRef.current = heardSpeechRef.current
        ? 0
        : silentSessionsRef.current + 1;
      heardSpeechRef.current = false;

      if (quickFailuresRef.current >= MAX_QUICK_FAILURES) {
        halt("Couldn't keep the microphone running. Please tap the mic to retry.");
        return;
      }
      if (silentSessionsRef.current >= MAX_SILENT_SESSIONS) {
        halt(
          "We didn't hear anything. Check that the right microphone is selected, then tap the mic and speak."
        );
        return;
      }

      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (wantListeningRef.current) beginSession();
      }, RESTART_DELAY_MS);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      halt("Couldn't start the microphone. Please tap the mic to try again.");
    }
  }, [halt]);

  const start = React.useCallback(() => {
    if (wantListeningRef.current) return;
    setError(null);
    setInterim("");
    wantListeningRef.current = true;
    silentSessionsRef.current = 0;
    quickFailuresRef.current = 0;
    heardSpeechRef.current = false;
    sessionStartedAtRef.current = Date.now();
    setListening(true);
    beginSession();
  }, [beginSession]);

  const stop = React.useCallback(() => {
    wantListeningRef.current = false;
    clearRestartTimer();
    setListening(false);
    setInterim("");
    // `stop()` (not abort) lets the browser flush the last words as a final result.
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
  }, [clearRestartTimer]);

  const clearError = React.useCallback(() => setError(null), []);

  // Language switch mid-session: restart in the new locale without losing the transcript.
  React.useEffect(() => {
    if (langRef.current === lang) return;
    langRef.current = lang;
    if (!wantListeningRef.current) return;

    clearRestartTimer();
    const previous = recognitionRef.current;
    recognitionRef.current = null; // detach so the old session's events are ignored
    try {
      previous?.abort();
    } catch {
      /* noop */
    }
    setInterim("");
    silentSessionsRef.current = 0;
    quickFailuresRef.current = 0;
    beginSession();
  }, [lang, beginSession, clearRestartTimer]);

  React.useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      clearRestartTimer();
      const current = recognitionRef.current;
      recognitionRef.current = null;
      try {
        current?.abort();
      } catch {
        /* noop */
      }
    };
  }, [clearRestartTimer]);

  return { supported, listening, interim, error, start, stop, clearError };
}
