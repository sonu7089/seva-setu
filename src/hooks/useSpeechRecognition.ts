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

interface UseSpeechRecognitionOptions {
  /** BCP-47 tag, e.g. `hi-IN` or `en-IN`. */
  lang: string;
  /** Called with each finalized phrase. */
  onFinalTranscript: (text: string) => void;
}

export function useSpeechRecognition({
  lang,
  onFinalTranscript,
}: UseSpeechRecognitionOptions) {
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = React.useRef(onFinalTranscript);
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  React.useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
    return () => recognitionRef.current?.abort();
  }, []);

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = React.useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          onFinalRef.current(text.trim());
        } else {
          interimText += text;
        }
      }
      setInterim(interimText);
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access was blocked. Allow it in the browser and try again.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(`Voice input error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;
    setError(null);
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [lang]);

  // Stop an active session if the language changes so the next one uses the new locale.
  React.useEffect(() => {
    recognitionRef.current?.abort();
  }, [lang]);

  return { supported, listening, interim, error, start, stop };
}
