'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import {
  ArrowUp,
  Check,
  LoaderCircle,
  Settings2,
  Sparkle,
  Square,
  X,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import AutoTextarea from './auto-textarea';
import { compositionUnits, type Composition } from '@/lib/tabla';
import {
  DEFAULT_MODEL,
  composerSystemPrompt,
  openRouterError,
  proposalComposition,
  requestComposition,
  parseComposerReply,
  type ChatMessage,
  type ComposerReply,
  type ComposerTarget,
} from '@/lib/composer-ai';

type Turn = { question: string; reply: ComposerReply };
type ModelOption = {
  id: string;
  name: string;
  supported_parameters?: string[];
};

async function loadModels(signal: AbortSignal): Promise<ModelOption[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    signal,
  });
  if (!response.ok) throw new Error('Could not load OpenRouter models.');
  const catalog = (await response.json()) as { data?: ModelOption[] };
  return (catalog.data ?? [])
    .filter((item) => item.supported_parameters?.includes('response_format'))
    .sort((a, b) => {
      const aGemini = a.id.startsWith('google/gemini') ? 0 : 1;
      const bGemini = b.id.startsWith('google/gemini') ? 0 : 1;
      return aGemini - bGemini || a.name.localeCompare(b.name);
    });
}

export default function ComposerAssistant({
  composition,
  script,
  bpm,
  onUseText,
  onApply,
}: {
  composition: Composition;
  script: string;
  bpm: number;
  onUseText: (text: string) => void;
  onApply: (composition: Composition, bpm: number, script: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [envAvailable, setEnvAvailable] = useState(false);
  const [useEnv, setUseEnv] = useState(false);
  const [envModel, setEnvModel] = useState(DEFAULT_MODEL);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [keyInput, setKeyInput] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [modelInput, setModelInput] = useState(DEFAULT_MODEL);
  const connected = useEnv || !!apiKey;
  useEffect(() => {
    const request = new AbortController();
    fetch('/api/composer', { signal: request.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => {
        const data = value as { configured?: boolean; model?: string } | null;
        if (!request.signal.aborted && data?.configured === true) {
          setEnvAvailable(true);
          setUseEnv(true);
          if (typeof data.model === 'string') {
            setEnvModel(data.model);
            setModelInput(data.model);
          }
        }
      })
      .catch(() => {
        /* Manual connection remains available. */
      });
    void loadModels(request.signal)
      .then(setModels)
      .catch(() => {
        /* The default and manually entered model IDs still work. */
      });
    return () => request.abort();
  }, []);
  const [target, setTarget] = useState<ComposerTarget>('text');
  const searchWeb = true;
  const [prompt, setPrompt] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState<'connecting' | 'composing' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [proposalSnapshot, setProposalSnapshot] = useState('');
  const controller = useRef<AbortController | null>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const snapshot = useMemo(
    () => JSON.stringify({ composition, script, bpm }),
    [composition, script, bpm],
  );
  const proposal = turns.at(-1)?.reply.composition;
  const totals = useMemo(
    () =>
      turns.map((turn) =>
        turn.reply.composition
          ? compositionUnits(
              proposalComposition(turn.reply.composition).steps,
            ) / 4
          : 0,
      ),
    [turns],
  );
  const stale = !!proposal && proposalSnapshot !== snapshot;
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const element = conversation.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [turns, busy, open]);

  async function connect(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (controller.current) return;
    const key = keyInput.trim() || apiKey;
    const selectedModel = modelInput.trim();
    if (!key || !selectedModel) return;
    const request = new AbortController();
    controller.current = request;
    const timeout = setTimeout(() => request.abort(), 20000);
    setBusy('connecting');
    setError('');
    setNotice('');
    try {
      const response = await fetch('https://openrouter.ai/api/v1/key', {
        headers: { Authorization: `Bearer ${key}` },
        signal: request.signal,
      });
      if (!response.ok) throw new Error(openRouterError(response.status));
      const available = models.length
        ? models
        : await loadModels(request.signal);
      const entry = available.find((item) => item.id === selectedModel);
      if (!entry)
        throw new Error(
          'That model ID is not in OpenRouter’s catalog. Check the ID and try again.',
        );
      if (request.signal.aborted) return;
      setApiKey(key);
      setKeyInput('');
      setModel(selectedModel);
      setSettings(false);
      setNotice(
        'Connected. Your key stays in memory until you disconnect or reload.',
      );
    } catch (err) {
      setError(
        request.signal.aborted
          ? 'Connection timed out. Try again.'
          : err instanceof TypeError
            ? 'Could not reach OpenRouter. Check your connection and try again.'
            : err instanceof Error
              ? err.message
              : 'Could not connect.',
      );
    } finally {
      clearTimeout(timeout);
      controller.current = null;
      setBusy(null);
    }
  }

  async function send(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connected || !prompt.trim() || controller.current) return;
    if (script.length > 100000) {
      setError(
        'The text draft is too large. Shorten it before asking the assistant.',
      );
      return;
    }
    const question = prompt.trim();
    const captured = snapshot;
    const request = new AbortController();
    controller.current = request;
    const timeout = setTimeout(
      () => request.abort(new Error('timeout')),
      90000,
    );
    setBusy('composing');
    setError('');
    setNotice('');
    try {
      const messages: ChatMessage[] = turns.slice(-4).flatMap((turn) => [
        { role: 'user' as const, content: turn.question },
        { role: 'assistant' as const, content: JSON.stringify(turn.reply) },
      ]);
      messages.push({ role: 'user', content: question });
      let reply: ComposerReply;
      if (useEnv) {
        const response = await fetch('/api/composer', {
          method: 'POST',
          signal: request.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            composition,
            script,
            bpm,
            target,
            messages,
          }),
        });
        if (!response.ok) {
          const failure = (await response.json()) as { error?: string };
          throw new Error(
            failure.error || 'The hosted AI connection failed. Try again.',
          );
        }
        reply = parseComposerReply(await response.text());
      } else {
        reply = await requestComposition({
          apiKey,
          model,
          system: composerSystemPrompt(
            composition,
            script,
            bpm,
            target,
            searchWeb,
          ),
          messages,
          signal: request.signal,
          searchWeb,
        });
      }
      if (request.signal.aborted) return;
      setTurns((old) => [...old.slice(-7), { question, reply }]);
      setProposalSnapshot(captured);
      setPrompt('');
    } catch (err) {
      setError(
        request.signal.aborted
          ? request.signal.reason?.message === 'timeout'
            ? 'The model took too long. Try a shorter request.'
            : 'Request canceled. Your composition is unchanged.'
          : err instanceof TypeError
            ? 'Could not reach OpenRouter. Check your connection and try again.'
            : err instanceof Error
              ? err.message
              : 'Could not create a proposal. Try again.',
      );
    } finally {
      clearTimeout(timeout);
      controller.current = null;
      setBusy(null);
    }
  }

  function applyProposal(destination: 'text' | 'timeline') {
    if (!proposal || stale) return;
    try {
      if (destination === 'text') onUseText(proposal.script);
      else
        onApply(proposalComposition(proposal), proposal.bpm, proposal.script);
      setNotice(
        destination === 'text'
          ? 'Proposal sent to the text box. Your timeline is unchanged.'
          : 'Composition applied. Use Undo in the composer to restore your previous composition and tempo.',
      );
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not apply this proposal.',
      );
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="ai-launcher"
        aria-label="Open AI composition assistant"
        title="AI composition assistant"
      >
        <Sparkle size={28} strokeWidth={1.6} aria-hidden="true" />
        <span>Ask AI</span>
      </PopoverTrigger>
      <PopoverContent
        className="composer-ai"
        side="top"
        align="end"
        sideOffset={12}
      >
        <header className="ai-header">
          <div>
            <PopoverTitle>Taal assistant</PopoverTitle>
            <PopoverDescription>
              {connected
                ? (useEnv ? envModel : model).replace('google/', '')
                : 'Compose with Gemini · OpenRouter'}
            </PopoverDescription>
          </div>
          <button
            className="ai-icon-button"
            onClick={() => {
              if (!settings) setModelInput(useEnv ? envModel : model);
              setSettings(!settings);
            }}
            aria-label="Connection settings"
            aria-expanded={settings || !connected}
          >
            <Settings2 size={19} />
          </button>
          <button
            className="ai-icon-button"
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
          >
            <X size={20} />
          </button>
        </header>
        <div className="ai-scroll" ref={conversation}>
          {useEnv && settings && (
            <div className="ai-connection">
              <h3>Hosted AI connection</h3>
              <p>
                Claude Sonnet 5 with web search is provided by this site.
              </p>
              <p className="ai-fine-print">
                Your request, current text, timeline, and recent chat are sent
                to OpenRouter when you send a message.
              </p>
              <button
                type="button"
                className="primary-button"
                disabled={!!busy}
                onClick={() => setSettings(false)}
              >
                Done
              </button>
            </div>
          )}
          {!useEnv && (!apiKey || settings) && (
            <form className="ai-connection" onSubmit={connect}>
              {envAvailable && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!!busy}
                  onClick={() => {
                    setUseEnv(true);
                    setModelInput(envModel);
                    setSettings(false);
                    setError('');
                  }}
                >
                  Use .env connection
                </button>
              )}
              <h3>{apiKey ? 'Connection' : 'Connect your model'}</h3>
              <p>
                Use your OpenRouter account to work on your bols. Requests use
                your OpenRouter credits.
              </p>
              <label htmlFor="ai-key">OpenRouter API key</label>
              <input
                id="ai-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={
                  apiKey
                    ? 'Leave blank to keep connected key'
                    : 'Paste your API key'
                }
                required={!apiKey}
                disabled={!!busy}
              />
              <label htmlFor="ai-model">Model ID</label>
              <input
                id="ai-model"
                list="openrouter-models"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                required
                disabled={!!busy}
                spellCheck={false}
              />
              <p className="ai-fine-print">
                Your key is kept only in this page’s memory and sent directly to
                OpenRouter. Your request, current text, timeline, and recent
                chat are shared when you send a message.
              </p>
              <div className="ai-actions">
                <button
                  className="primary-button"
                  disabled={!!busy || !(keyInput.trim() || apiKey)}
                  type="submit"
                >
                  {busy === 'connecting' ? (
                    <>
                      <LoaderCircle
                        size={16}
                        className="audio-loading-spinner"
                      />
                      Connecting…
                    </>
                  ) : apiKey ? (
                    'Update connection'
                  ) : (
                    'Connect'
                  )}
                </button>
                {apiKey ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!!busy}
                    onClick={() => {
                      setApiKey('');
                      setKeyInput('');
                      setTurns([]);
                      setError('');
                      setNotice('Disconnected.');
                    }}
                  >
                    Disconnect
                  </button>
                ) : (
                  <a
                    href="https://openrouter.ai/settings/keys"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Get an API key
                  </a>
                )}
              </div>
            </form>
          )}
          <datalist id="openrouter-models">
            {models.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </datalist>
          {!turns.length && connected && !settings && (
            <div className="ai-empty">
              <Sparkle size={30} aria-hidden="true" />
              <h3>What shall we play?</h3>
              <p>
                Refine the bols you wrote, reshape your timeline, or start
                fresh.
              </p>
              <button
                onClick={() => {
                  setTarget('text');
                  setPrompt(
                    'Keep my phrase, but add a contrasting second cycle with varied emphasis.',
                  );
                }}
              >
                Develop my phrase
              </button>
              <button
                onClick={() => {
                  setTarget('new');
                  setPrompt(
                    'Create two cycles of Keharwa with a simple first cycle and a lively variation in the second.',
                  );
                }}
              >
                Create a Keharwa variation
              </button>
            </div>
          )}
          {turns.map((turn, index) => (
            <div className="ai-turn" key={index}>
              <p className="ai-question">{turn.question}</p>
              <div className="ai-answer">
                <p>{turn.reply.explanation}</p>
                {!!turn.reply.sources?.length && (
                  <div className="ai-sources">
                    <strong>Sources</strong>
                    <ul>
                      {turn.reply.sources.map((source) => (
                        <li key={source.url}>
                          <a href={source.url} target="_blank" rel="noreferrer">
                            {source.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {turn.reply.composition && (
                  <>
                    <h3>{turn.reply.composition.name}</h3>
                    <p className="ai-proposal-meta">
                      Tempo:{' '}
                      {turn.reply.composition.bpm === bpm
                        ? `${bpm} BPM`
                        : `${bpm} → ${turn.reply.composition.bpm} BPM`}{' '}
                      · Cycle:{' '}
                      {turn.reply.composition.beatsPerCycle ===
                      composition.beatsPerCycle
                        ? `${composition.beatsPerCycle} beats`
                        : `${composition.beatsPerCycle} → ${turn.reply.composition.beatsPerCycle} beats`}{' '}
                      · {totals[index]} beats total
                    </p>
                    <AutoTextarea
                      aria-label={`Proposed bols: ${turn.reply.composition.name}`}
                      readOnly
                      rows={2}
                      value={turn.reply.composition.script}
                    />
                    {index === turns.length - 1 && (
                      <>
                        {stale && (
                          <p className="ai-fine-print">
                            Your draft changed since this proposal. Ask for an
                            update before applying, or copy the bols above.
                          </p>
                        )}
                        <div className="ai-actions">
                          <button
                            className="primary-button"
                            disabled={!!busy || stale}
                            onClick={() => applyProposal('timeline')}
                          >
                            <Check size={16} />
                            Apply bols, cycle &amp; tempo
                          </button>
                          <button
                            className="secondary-button"
                            disabled={!!busy || stale}
                            onClick={() => applyProposal('text')}
                          >
                            Use in text box
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {busy === 'composing' && (
            <output className="ai-thinking" aria-live="polite">
              <LoaderCircle size={16} className="audio-loading-spinner" />
              Working on your composition…
            </output>
          )}
        </div>
        {error && (
          <p className="ai-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <output className="ai-notice" aria-live="polite">
            {notice}
          </output>
        )}
        {connected && (
          <form className="ai-prompt" onSubmit={send}>
            <div className="ai-target-row">
              <label htmlFor="ai-target">Work on</label>
              <select
                id="ai-target"
                value={target}
                onChange={(e) => setTarget(e.target.value as ComposerTarget)}
                disabled={!!busy}
              >
                <option value="text">
                  Typed bols{script.trim() ? '' : ' (empty)'}
                </option>
                <option value="timeline">Current timeline</option>
                <option value="new">Something new</option>
              </select>
              {!!turns.length && (
                <button
                  type="button"
                  className="ai-clear"
                  disabled={!!busy}
                  onClick={() => {
                    setTurns([]);
                    setError('');
                    setNotice('');
                  }}
                >
                  Clear chat
                </button>
              )}
            </div>
            <label className="ai-web-search" htmlFor="ai-web-search">
              <Switch
                id="ai-web-search"
                checked={searchWeb}
                disabled
              />
              <span>
                Search the web
                <small>Always enabled; sources are included when available</small>
              </span>
            </label>
            <label className="sr-only" htmlFor="ai-prompt">
              Ask the composition assistant
            </label>
            <AutoTextarea
              id="ai-prompt"
              rows={2}
              value={prompt}
              maxLength={4000}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe a rhythm, or ask for a change…"
              disabled={!!busy}
            />
            <div className="ai-send-row">
              <span>Suggestions stay drafts until you apply them.</span>
              {busy === 'composing' ? (
                <button
                  type="button"
                  className="ai-send"
                  aria-label="Cancel generation"
                  onClick={() => controller.current?.abort()}
                >
                  <Square size={17} />
                </button>
              ) : (
                <button
                  type="submit"
                  className="ai-send"
                  aria-label="Send message"
                  disabled={!!busy || !prompt.trim()}
                >
                  <ArrowUp size={22} />
                </button>
              )}
            </div>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
