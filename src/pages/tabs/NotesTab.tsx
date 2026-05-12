import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, FileText, AlertCircle, Loader, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { C } from '../../theme';

interface NotesTabProps {
  opportunityName: string;
  opportunityAddress?: string;
  dropboxAuthRequired: boolean;
}

type RecordStatus = 'idle' | 'recording' | 'confirming' | 'formatting' | 'saving' | 'done' | 'error';

// ─── SpeechRecognition shim ───────────────────────────────────────────────────

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ─── Note parsing ─────────────────────────────────────────────────────────────

function parseSiteNotes(content: string): string[] {
  return content
    .split(/\n(?=## Site Visit)/)
    .map((e) => e.trim())
    .filter((e) => e.startsWith('## Site Visit'));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NoteCard({ markdown }: { markdown: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = markdown.split('\n');
  const header = lines[0] ?? '';
  const body = lines.slice(1).join('\n').trim();
  const preview = body.split('\n').filter(Boolean).slice(0, 3).join('\n');

  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: C.navy, flex: 1 }}>
          {header.replace(/^##\s*/, '')}
        </span>
        {expanded ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
      </button>

      {!expanded && preview && (
        <div
          style={{
            padding: '0 14px 12px',
            fontSize: 12,
            color: C.muted,
            whiteSpace: 'pre-wrap',
            borderTop: `1px solid ${C.border}`,
            paddingTop: 8,
          }}
        >
          {preview}
          {body.split('\n').filter(Boolean).length > 3 && (
            <span style={{ color: C.navy, fontWeight: 600 }}> …</span>
          )}
        </div>
      )}

      {expanded && body && (
        <div
          style={{
            padding: '8px 14px 14px',
            fontSize: 13,
            color: C.text,
            whiteSpace: 'pre-wrap',
            borderTop: `1px solid ${C.border}`,
            lineHeight: 1.6,
          }}
        >
          {body}
        </div>
      )}
    </div>
  );
}

function EmptyNotes() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
      <FileText size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
      <div style={{ fontSize: 13 }}>No site notes yet</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotesTab({ opportunityName, opportunityAddress, dropboxAuthRequired }: NotesTabProps) {
  const speechAvailable = useMemo(() => getSpeechRecognition() !== null, []);

  const [status, setStatus] = useState<RecordStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [typedNote, setTypedNote] = useState('');

  const [notes, setNotes] = useState<string[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const filePath = useMemo(() => {
    const root = (import.meta.env.VITE_DROPBOX_ROOT_FOLDER ?? 'Current Opportunities')
      .replace(/^\//, '').replace(/\/$/, '');
    return `/${root}/${opportunityName}/site-notes.md`;
  }, [opportunityName]);

  // ── Fetch notes on mount ──────────────────────────────────────────────────

  const fetchNotes = useCallback(async () => {
    setNotesLoading(true);
    setNotesError(null);
    try {
      const res = await fetch(`/api/dropbox/file?path=${encodeURIComponent(filePath)}`);
      if (res.status === 404) { setNotes([]); return; }
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { content: string };
      setNotes(parseSiteNotes(data.content));
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : String(err));
    } finally {
      setNotesLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    if (!dropboxAuthRequired) fetchNotes();
    else setNotesLoading(false);
  }, [fetchNotes, dropboxAuthRequired]);

  // ── Speech recording ──────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let accumulated = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          accumulated += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      setFinalTranscript(accumulated);
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted') return;
      setStatus('error');
      setErrorMsg(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      setInterimTranscript('');
      setStatus((prev) => (prev === 'recording' ? 'confirming' : prev));
    };

    recognition.start();
    recognitionRef.current = recognition;
    setStatus('recording');
    setFinalTranscript('');
    setInterimTranscript('');
    setErrorMsg(null);
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  // ── Format + save ─────────────────────────────────────────────────────────

  const formatAndSave = useCallback(async (transcript: string) => {
    setStatus('formatting');
    setErrorMsg(null);

    try {
      const fmtRes = await fetch('/api/format-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, opportunityName, opportunityAddress }),
      });
      if (!fmtRes.ok) {
        const body = await fmtRes.json() as { error?: string; detail?: string };
        throw new Error(body.detail ?? body.error ?? `HTTP ${fmtRes.status}`);
      }
      const { markdown } = await fmtRes.json() as { markdown: string };

      setStatus('saving');
      const appendRes = await fetch('/api/dropbox/append-md', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, text: '\n\n' + markdown }),
      });
      if (!appendRes.ok) {
        const body = await appendRes.json() as { error?: string; detail?: string };
        throw new Error(body.detail ?? body.error ?? `HTTP ${appendRes.status}`);
      }

      setStatus('done');
      setFinalTranscript('');
      setTypedNote('');
      await fetchNotes();
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }, [opportunityName, opportunityAddress, filePath, fetchNotes]);

  const handleConfirm = useCallback(() => {
    const text = speechAvailable ? finalTranscript.trim() : typedNote.trim();
    if (!text) return;
    void formatAndSave(text);
  }, [speechAvailable, finalTranscript, typedNote, formatAndSave]);

  const handleCancel = useCallback(() => {
    setFinalTranscript('');
    setInterimTranscript('');
    setStatus('idle');
    setErrorMsg(null);
  }, []);

  // ── Auth gate ─────────────────────────────────────────────────────────────

  if (dropboxAuthRequired) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.muted }}>
        <p style={{ fontSize: 14, marginBottom: 16 }}>
          Connect Dropbox to save site notes.
        </p>
        <a
          href="/api/auth/dropbox/login"
          style={{
            display: 'inline-block',
            background: C.red,
            color: C.white,
            padding: '10px 20px',
            borderRadius: 4,
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
            letterSpacing: 0.5,
          }}
        >
          Connect Dropbox
        </a>
      </div>
    );
  }

  const isProcessing = status === 'formatting' || status === 'saving';
  const transcript = speechAvailable ? finalTranscript : typedNote;
  const hasTranscript = transcript.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 16 }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      {/* Capture card */}
      <div
        style={{
          background: C.white,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: 16,
          marginBottom: 16,
        }}
      >
        {speechAvailable ? (
          <>
            {/* Mic button */}
            {(status === 'idle' || status === 'done' || status === 'error') && (
              <button
                onClick={startRecording}
                style={{
                  width: '100%',
                  background: C.red,
                  color: C.white,
                  padding: '16px',
                  borderRadius: 4,
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: 0.5,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Mic size={20} />
                {status === 'done' ? 'RECORD ANOTHER NOTE' : 'START RECORDING'}
              </button>
            )}

            {/* Recording state */}
            {status === 'recording' && (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                    color: C.red,
                    fontSize: 13,
                    fontWeight: 700,
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                >
                  <Mic size={16} />
                  RECORDING…
                </div>
                {(finalTranscript || interimTranscript) && (
                  <div
                    style={{
                      background: C.offwhite,
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      padding: '10px 12px',
                      fontSize: 13,
                      color: C.text,
                      minHeight: 80,
                      marginBottom: 12,
                      lineHeight: 1.6,
                    }}
                  >
                    {finalTranscript}
                    {interimTranscript && (
                      <span style={{ color: C.muted }}>{interimTranscript}</span>
                    )}
                  </div>
                )}
                <button
                  onClick={stopRecording}
                  style={{
                    width: '100%',
                    background: C.navy,
                    color: C.white,
                    padding: '12px 16px',
                    borderRadius: 4,
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: 0.5,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <MicOff size={16} />
                  STOP RECORDING
                </button>
              </>
            )}

            {/* Confirmation state */}
            {status === 'confirming' && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.muted,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Transcript
                </div>
                <div
                  style={{
                    background: C.offwhite,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    padding: '10px 12px',
                    fontSize: 13,
                    color: C.text,
                    minHeight: 80,
                    marginBottom: 12,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {finalTranscript || <span style={{ color: C.muted }}>No speech detected.</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleCancel}
                    style={{
                      flex: 1,
                      background: C.navy,
                      color: C.white,
                      padding: '12px',
                      borderRadius: 4,
                      fontWeight: 700,
                      fontSize: 13,
                      letterSpacing: 0.5,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    DISCARD
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!hasTranscript}
                    style={{
                      flex: 2,
                      background: hasTranscript ? C.red : C.border,
                      color: C.white,
                      padding: '12px',
                      borderRadius: 4,
                      fontWeight: 700,
                      fontSize: 13,
                      letterSpacing: 0.5,
                      border: 'none',
                      cursor: hasTranscript ? 'pointer' : 'not-allowed',
                    }}
                  >
                    FORMAT &amp; SAVE
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          /* Textarea fallback for browsers without Web Speech API */
          <>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.muted,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Type Site Note
            </div>
            <div
              style={{
                fontSize: 11,
                color: C.muted,
                marginBottom: 10,
              }}
            >
              Voice recording is not available in this browser.
            </div>
            <textarea
              value={typedNote}
              onChange={(e) => setTypedNote(e.target.value)}
              placeholder="Describe site conditions, access, utilities, scope observations, concerns, next steps…"
              rows={6}
              style={{
                width: '100%',
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: '10px 12px',
                fontSize: 14,
                color: C.text,
                background: C.offwhite,
                resize: 'vertical',
                marginBottom: 12,
              }}
            />
            <button
              onClick={handleConfirm}
              disabled={!hasTranscript || isProcessing}
              style={{
                width: '100%',
                background: hasTranscript && !isProcessing ? C.red : C.border,
                color: C.white,
                padding: '12px 16px',
                borderRadius: 4,
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: 0.5,
                border: 'none',
                cursor: hasTranscript && !isProcessing ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              FORMAT &amp; SAVE
            </button>
          </>
        )}

        {/* Processing states */}
        {isProcessing && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '16px 0',
              color: C.navy,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
            {status === 'formatting' ? 'Formatting with AI…' : 'Saving to Dropbox…'}
          </div>
        )}

        {/* Success */}
        {status === 'done' && (
          <div style={{ fontSize: 13, color: C.navy, fontWeight: 700, textAlign: 'center', padding: '8px 0' }}>
            Note saved ✓
          </div>
        )}

        {/* Error */}
        {status === 'error' && errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              color: C.red,
              fontSize: 12,
              marginTop: 12,
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            {errorMsg}
          </div>
        )}
      </div>

      {/* Notes list */}
      {notesLoading && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
          Loading notes…
        </div>
      )}

      {notesError && !notesLoading && (
        <div
          style={{
            background: C.cream,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: 12,
            marginBottom: 12,
            fontSize: 13,
            color: C.red,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Could not load notes: {notesError}</span>
          <button
            onClick={fetchNotes}
            style={{
              background: C.navy,
              color: C.white,
              padding: '6px 12px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {!notesLoading && !notesError && notes.length === 0 && <EmptyNotes />}

      {!notesLoading && notes.length > 0 && (
        <div>
          {notes.map((note, i) => (
            <NoteCard key={i} markdown={note} />
          ))}
        </div>
      )}
    </div>
  );
}
