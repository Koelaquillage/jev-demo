'use client';

import { useState } from 'react';
import { Fraunces, Inter, IBM_Plex_Mono } from 'next/font/google';
import styles from './page.module.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['italic', 'normal'],
  weight: ['400', '500'],
  variable: '--font-serif',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-sans',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

type Status = 'idle' | 'loading' | 'done' | 'error';

type ChoiceAnswer = { type: 'choice'; choice: string; probabilities: Record<string, number> };
type ScoreAnswer = { type: 'score'; score: number; probabilities: Record<string, number> };
type BooleanAnswer = { type: 'boolean'; probability: number };
type Answer = ChoiceAnswer | ScoreAnswer | BooleanAnswer;

type EvalMeta = {
  confidence: number | null;
  inputTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
};

const DEFAULT_COMPARE_MODEL = 'openai/gpt-4o-mini';

async function callDecision<T>(
  payload: object,
  endpoint: '/api/evaluate' | '/api/compare' = '/api/evaluate',
): Promise<{ answer: T } & EvalMeta> {
  const start = performance.now();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const latencyMs = Math.round(performance.now() - start);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed.');
  return { confidence: null, inputTokens: null, costUsd: null, ...json, latencyMs };
}

function formatCost(costUsd: number | null, inputTokens: number | null) {
  const value = typeof costUsd === 'number' ? costUsd : Number(costUsd);
  if (costUsd === null || Number.isNaN(value)) return '';
  const amount = value < 0.01 ? value.toFixed(6) : value.toFixed(4);
  return inputTokens !== null ? `$${amount} · ${inputTokens} tok` : `$${amount}`;
}

function formatDelta(jevCost: number, otherCost: number, otherLabel: string) {
  if (jevCost <= 0 || otherCost <= 0) return null;
  const ratio = otherCost / jevCost;
  if (ratio >= 1) {
    return `Jev cost ${ratio < 10 ? ratio.toFixed(1) : Math.round(ratio).toLocaleString()}\u00d7 less than ${otherLabel} for this call.`;
  }
  return `${otherLabel} cost ${(1 / ratio).toFixed(1)}\u00d7 less than Jev for this call.`;
}

/* ------------------------------- Shared result view ------------------------------- */

function ResultBlock({
  answer,
  confidence,
  costUsd,
  inputTokens,
  latencyMs,
  levels,
}: {
  answer: Answer;
  confidence: number | null;
  costUsd: number | null;
  inputTokens: number | null;
  latencyMs: number | null;
  levels?: string[];
}) {
  const metaLeft = confidence !== null ? `confidence ${confidence.toFixed(2)}` : '';
  const metaRight = [formatCost(costUsd, inputTokens), latencyMs !== null ? `${latencyMs}ms` : '']
    .filter(Boolean)
    .join(' · ');

  if (answer.type === 'choice') {
    return (
      <div>
        <div className={styles.resultHeadline}>{answer.choice}</div>
        {(metaLeft || metaRight) && (
          <div className={styles.confidence}>
            <span>{metaLeft}</span>
            <span>{metaRight}</span>
          </div>
        )}
        {Object.entries(answer.probabilities)
          .sort((a, b) => b[1] - a[1])
          .map(([key, value]) => (
            <div className={styles.bar} key={key}>
              <div className={styles.barTop}>
                <span
                  className={`${styles.barKey} ${key === answer.choice ? styles.winner : ''}`}
                >
                  {key}
                </span>
                <span className={styles.barValue}>{value.toFixed(2)}</span>
              </div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${value * 100}%` }} />
              </div>
            </div>
          ))}
      </div>
    );
  }

  if (answer.type === 'score') {
    const max = levels ? levels.length - 1 : undefined;
    return (
      <div>
        <div className={styles.resultHeadline}>
          {answer.score.toFixed(2)}{' '}
          {max !== undefined && (
            <span style={{ color: 'var(--ink-dim)', fontSize: '1rem' }}>/ {max}</span>
          )}
        </div>
        {(metaLeft || metaRight) && (
          <div className={styles.confidence}>
            <span>{metaLeft}</span>
            <span>{metaRight}</span>
          </div>
        )}
        {Object.entries(answer.probabilities)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([idx, value]) => (
            <div className={styles.bar} key={idx}>
              <div className={styles.barTop}>
                <span className={styles.barKey}>{levels?.[Number(idx)] ?? idx}</span>
                <span className={styles.barValue}>{value.toFixed(2)}</span>
              </div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${value * 100}%` }} />
              </div>
            </div>
          ))}
      </div>
    );
  }

  const p = answer.probability;
  const label = p >= 0.8 ? 'likely true' : p <= 0.2 ? 'likely false' : 'uncertain';
  return (
    <div>
      <div className={styles.resultHeadline}>
        {p.toFixed(2)} <span style={{ color: 'var(--ink-dim)', fontSize: '1rem' }}>— {label}</span>
      </div>
      {metaRight && (
        <div className={styles.confidence}>
          <span />
          <span>{metaRight}</span>
        </div>
      )}
      <div className={styles.gauge}>
        <div className={styles.gaugeMarker} style={{ left: `${p * 100}%` }} />
      </div>
      <div className={styles.gaugeLabels}>
        <span>false</span>
        <span>true</span>
      </div>
    </div>
  );
}

/* ------------------------------- Compare-with-an-LLM row ------------------------------- */

function CompareRow({
  compareModel,
  setCompareModel,
  onCompare,
  loading,
}: {
  compareModel: string;
  setCompareModel: (v: string) => void;
  onCompare: () => void;
  loading: boolean;
}) {
  return (
    <div className={styles.compareRow}>
      <input
        className={styles.input}
        value={compareModel}
        onChange={(e) => setCompareModel(e.target.value)}
        placeholder={DEFAULT_COMPARE_MODEL}
      />
      <button type="button" className={styles.smallButton} onClick={onCompare} disabled={loading}>
        {loading ? 'Asking the LLM…' : 'Compare with this model'}
      </button>
    </div>
  );
}

/* ---------------------------------------- Page ---------------------------------------- */

export default function JevDemoPage() {
  return (
    <main className={`${styles.page} ${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <div className={styles.container}>
        <h1 className={styles.title}>Jev</h1>

        <p className={styles.lede}>
          Give it a sentence and a fixed set of answers, and it settles on one — instantly,
          silently, without a syllable of explanation.
        </p>
        <p className={styles.leadFollow}>
          Jev never argues its case. It doesn&apos;t write, reason aloud, or hedge in prose. It
          reads the state you give it and returns a typed answer: a chosen option, a place on a
          scale, or the odds of a single yes. Three shapes, tried below — each with the option to
          run the identical question through an ordinary LLM, so you can see the cost side by
          side.
        </p>

        <ChoiceSection />
        <ScoreSection />
        <BooleanSection />

        <p className={styles.footer}>
          Every run below calls Jev — and, where you ask for one, a comparison model — live
          through the AI Gateway. Nothing is cached or scripted. The comparison model reports its
          own probabilities; unlike Jev&apos;s, they are not calibrated.
        </p>
      </div>
    </main>
  );
}

/* ---------------------------------- Choice ---------------------------------- */

function ChoiceSection() {
  const [state, setState] = useState(
    'The dashboard freezes whenever I export more than 10,000 rows, and no error shows.',
  );
  const [instructions, setInstructions] = useState('Which team should own this?');
  const [options, setOptions] = useState([
    { id: 1, key: 'frontend', description: 'UI rendering, layout, and interaction bugs' },
    { id: 2, key: 'backend', description: 'Data processing, exports, and API failures' },
    { id: 3, key: 'support', description: 'Account access and billing questions' },
  ]);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<({ answer: ChoiceAnswer } & EvalMeta) | null>(null);
  const [error, setError] = useState('');

  const [compareModel, setCompareModel] = useState(DEFAULT_COMPARE_MODEL);
  const [compareStatus, setCompareStatus] = useState<Status>('idle');
  const [compareResult, setCompareResult] = useState<({ answer: ChoiceAnswer } & EvalMeta) | null>(
    null,
  );
  const [compareError, setCompareError] = useState('');

  const updateOption = (id: number, field: 'key' | 'description', value: string) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
  };

  const addOption = () => {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, { id: Date.now(), key: '', description: '' }]);
  };

  const removeOption = (id: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const criteria = () => Object.fromEntries(options.map((o) => [o.key, o.description]));

  const run = async () => {
    setStatus('loading');
    setError('');
    try {
      const data = await callDecision<ChoiceAnswer>({
        type: 'choice',
        state,
        instructions,
        criteria: criteria(),
      });
      setResult(data);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStatus('error');
    }
  };

  const runCompare = async () => {
    setCompareStatus('loading');
    setCompareError('');
    try {
      const data = await callDecision<ChoiceAnswer>(
        { type: 'choice', state, instructions, criteria: criteria(), model: compareModel },
        '/api/compare',
      );
      setCompareResult(data);
      setCompareStatus('done');
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : 'Something went wrong.');
      setCompareStatus('error');
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionName}>Choice</span>
        <span className={styles.sectionType}>type: choice</span>
      </div>
      <p className={styles.sectionDesc}>
        Picks exactly one option from a named set of up to 255, and returns a probability for
        every option it didn&apos;t pick, along with a confidence score for the one it did.
      </p>

      <div className={styles.field}>
        <label className={styles.label}>State</label>
        <textarea
          className={styles.textarea}
          value={state}
          onChange={(e) => setState(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Question</label>
        <input
          className={styles.input}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Options</label>
        {options.map((o) => (
          <div className={styles.row} key={o.id}>
            <div className={styles.rowKey}>
              <input
                className={styles.input}
                placeholder="key"
                value={o.key}
                onChange={(e) => updateOption(o.id, 'key', e.target.value)}
              />
            </div>
            <div className={styles.rowDesc}>
              <input
                className={styles.input}
                placeholder="description"
                value={o.description}
                onChange={(e) => updateOption(o.id, 'description', e.target.value)}
              />
            </div>
            <button
              type="button"
              className={styles.removeButton}
              onClick={() => removeOption(o.id)}
              aria-label="Remove option"
            >
              &times;
            </button>
          </div>
        ))}
        {options.length < 6 && (
          <button type="button" className={styles.smallButton} onClick={addOption}>
            Add option
          </button>
        )}
      </div>

      <button
        type="button"
        className={styles.runButton}
        onClick={run}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Deciding…' : 'Run choice'}
      </button>

      <div className={styles.field}>
        <label className={styles.label}>Compare against (any AI Gateway model id)</label>
        <CompareRow
          compareModel={compareModel}
          setCompareModel={setCompareModel}
          onCompare={runCompare}
          loading={compareStatus === 'loading'}
        />
      </div>

      {status === 'error' && <p className={styles.errorText}>{error}</p>}
      {compareStatus === 'error' && <p className={styles.errorText}>{compareError}</p>}

      {status === 'done' && result && (
        <div className={styles.result}>
          <div className={styles.compareGrid}>
            <div>
              <div className={styles.resultLabel}>Jev</div>
              <ResultBlock
                answer={result.answer}
                confidence={result.confidence}
                costUsd={result.costUsd}
                inputTokens={result.inputTokens}
                latencyMs={result.latencyMs}
              />
            </div>
            {compareStatus === 'done' && compareResult && (
              <div>
                <div className={styles.resultLabel}>{compareModel}</div>
                <ResultBlock
                  answer={compareResult.answer}
                  confidence={null}
                  costUsd={compareResult.costUsd}
                  inputTokens={compareResult.inputTokens}
                  latencyMs={compareResult.latencyMs}
                />
              </div>
            )}
          </div>
          {compareStatus === 'done' &&
            compareResult &&
            result.costUsd !== null &&
            compareResult.costUsd !== null && (
              <p className={styles.deltaLine}>
                {formatDelta(result.costUsd, compareResult.costUsd, compareModel)}
              </p>
            )}
        </div>
      )}
    </section>
  );
}

/* ----------------------------------- Score ----------------------------------- */

function ScoreSection() {
  const [state, setState] = useState(
    'The homepage took 11 seconds to load and then showed a blank white screen.',
  );
  const [instructions, setInstructions] = useState('How severe is this for the user?');
  const [levels, setLevels] = useState([
    'Minor annoyance',
    'Noticeable but tolerable',
    'Blocks the core task',
    'Makes the product unusable',
  ]);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<({ answer: ScoreAnswer } & EvalMeta) | null>(null);
  const [error, setError] = useState('');

  const [compareModel, setCompareModel] = useState(DEFAULT_COMPARE_MODEL);
  const [compareStatus, setCompareStatus] = useState<Status>('idle');
  const [compareResult, setCompareResult] = useState<({ answer: ScoreAnswer } & EvalMeta) | null>(
    null,
  );
  const [compareError, setCompareError] = useState('');

  const updateLevel = (i: number, value: string) => {
    setLevels((prev) => prev.map((l, idx) => (idx === i ? value : l)));
  };

  const addLevel = () => {
    if (levels.length >= 6) return;
    setLevels((prev) => [...prev, '']);
  };

  const removeLevel = (i: number) => {
    if (levels.length <= 2) return;
    setLevels((prev) => prev.filter((_, idx) => idx !== i));
  };

  const run = async () => {
    setStatus('loading');
    setError('');
    try {
      const data = await callDecision<ScoreAnswer>({
        type: 'score',
        state,
        instructions,
        criteria: levels,
      });
      setResult(data);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStatus('error');
    }
  };

  const runCompare = async () => {
    setCompareStatus('loading');
    setCompareError('');
    try {
      const data = await callDecision<ScoreAnswer>(
        { type: 'score', state, instructions, criteria: levels, model: compareModel },
        '/api/compare',
      );
      setCompareResult(data);
      setCompareStatus('done');
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : 'Something went wrong.');
      setCompareStatus('error');
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionName}>Score</span>
        <span className={styles.sectionType}>type: score</span>
      </div>
      <p className={styles.sectionDesc}>
        Places the state on an ordered rubric you describe in words, from two levels up to ten.
        The result can land between two levels rather than being forced onto one.
      </p>

      <div className={styles.field}>
        <label className={styles.label}>State</label>
        <textarea
          className={styles.textarea}
          value={state}
          onChange={(e) => setState(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Question</label>
        <input
          className={styles.input}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Levels, low to high</label>
        {levels.map((l, i) => (
          <div className={styles.row} key={i}>
            <div className={styles.rowDesc}>
              <input
                className={styles.input}
                value={l}
                onChange={(e) => updateLevel(i, e.target.value)}
              />
            </div>
            <button
              type="button"
              className={styles.removeButton}
              onClick={() => removeLevel(i)}
              aria-label="Remove level"
            >
              &times;
            </button>
          </div>
        ))}
        {levels.length < 6 && (
          <button type="button" className={styles.smallButton} onClick={addLevel}>
            Add level
          </button>
        )}
      </div>

      <button
        type="button"
        className={styles.runButton}
        onClick={run}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Grading…' : 'Run score'}
      </button>

      <div className={styles.field}>
        <label className={styles.label}>Compare against (any AI Gateway model id)</label>
        <CompareRow
          compareModel={compareModel}
          setCompareModel={setCompareModel}
          onCompare={runCompare}
          loading={compareStatus === 'loading'}
        />
      </div>

      {status === 'error' && <p className={styles.errorText}>{error}</p>}
      {compareStatus === 'error' && <p className={styles.errorText}>{compareError}</p>}

      {status === 'done' && result && (
        <div className={styles.result}>
          <div className={styles.compareGrid}>
            <div>
              <div className={styles.resultLabel}>Jev</div>
              <ResultBlock
                answer={result.answer}
                confidence={result.confidence}
                costUsd={result.costUsd}
                inputTokens={result.inputTokens}
                latencyMs={result.latencyMs}
                levels={levels}
              />
            </div>
            {compareStatus === 'done' && compareResult && (
              <div>
                <div className={styles.resultLabel}>{compareModel}</div>
                <ResultBlock
                  answer={compareResult.answer}
                  confidence={null}
                  costUsd={compareResult.costUsd}
                  inputTokens={compareResult.inputTokens}
                  latencyMs={compareResult.latencyMs}
                  levels={levels}
                />
              </div>
            )}
          </div>
          {compareStatus === 'done' &&
            compareResult &&
            result.costUsd !== null &&
            compareResult.costUsd !== null && (
              <p className={styles.deltaLine}>
                {formatDelta(result.costUsd, compareResult.costUsd, compareModel)}
              </p>
            )}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------- Boolean ---------------------------------- */

function BooleanSection() {
  const [state, setState] = useState(
    "I already paid for this order but it says pending — please just charge me again if needed, I don't care about the refund.",
  );
  const [instructions, setInstructions] = useState('Is the customer asking for a refund?');
  const [trueDesc, setTrueDesc] = useState('Customer explicitly wants money back');
  const [falseDesc, setFalseDesc] = useState('Customer is not requesting a refund');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<({ answer: BooleanAnswer } & EvalMeta) | null>(null);
  const [error, setError] = useState('');

  const [compareModel, setCompareModel] = useState(DEFAULT_COMPARE_MODEL);
  const [compareStatus, setCompareStatus] = useState<Status>('idle');
  const [compareResult, setCompareResult] = useState<({ answer: BooleanAnswer } & EvalMeta) | null>(
    null,
  );
  const [compareError, setCompareError] = useState('');

  const criteria = () =>
    trueDesc || falseDesc ? { true: trueDesc || undefined, false: falseDesc || undefined } : undefined;

  const run = async () => {
    setStatus('loading');
    setError('');
    try {
      const data = await callDecision<BooleanAnswer>({
        type: 'boolean',
        state,
        instructions,
        criteria: criteria(),
      });
      setResult(data);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStatus('error');
    }
  };

  const runCompare = async () => {
    setCompareStatus('loading');
    setCompareError('');
    try {
      const data = await callDecision<BooleanAnswer>(
        { type: 'boolean', state, instructions, criteria: criteria(), model: compareModel },
        '/api/compare',
      );
      setCompareResult(data);
      setCompareStatus('done');
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : 'Something went wrong.');
      setCompareStatus('error');
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionName}>Noul</span>
        <span className={styles.sectionType}>type: boolean</span>
      </div>
      <p className={styles.sectionDesc}>
        A single yes-or-no question. Returns one probability that the statement is true — no
        forced verdict, just how likely.
      </p>

      <div className={styles.field}>
        <label className={styles.label}>State</label>
        <textarea
          className={styles.textarea}
          value={state}
          onChange={(e) => setState(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Question</label>
        <input
          className={styles.input}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.rowDesc}>
          <label className={styles.label}>True means (optional)</label>
          <input
            className={styles.input}
            value={trueDesc}
            onChange={(e) => setTrueDesc(e.target.value)}
          />
        </div>
        <div className={styles.rowDesc}>
          <label className={styles.label}>False means (optional)</label>
          <input
            className={styles.input}
            value={falseDesc}
            onChange={(e) => setFalseDesc(e.target.value)}
          />
        </div>
      </div>

      <button
        type="button"
        className={styles.runButton}
        onClick={run}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Asking…' : 'Run noul'}
      </button>

      <div className={styles.field}>
        <label className={styles.label}>Compare against (any AI Gateway model id)</label>
        <CompareRow
          compareModel={compareModel}
          setCompareModel={setCompareModel}
          onCompare={runCompare}
          loading={compareStatus === 'loading'}
        />
      </div>

      {status === 'error' && <p className={styles.errorText}>{error}</p>}
      {compareStatus === 'error' && <p className={styles.errorText}>{compareError}</p>}

      {status === 'done' && result && (
        <div className={styles.result}>
          <div className={styles.compareGrid}>
            <div>
              <div className={styles.resultLabel}>Jev</div>
              <ResultBlock
                answer={result.answer}
                confidence={result.confidence}
                costUsd={result.costUsd}
                inputTokens={result.inputTokens}
                latencyMs={result.latencyMs}
              />
            </div>
            {compareStatus === 'done' && compareResult && (
              <div>
                <div className={styles.resultLabel}>{compareModel}</div>
                <ResultBlock
                  answer={compareResult.answer}
                  confidence={null}
                  costUsd={compareResult.costUsd}
                  inputTokens={compareResult.inputTokens}
                  latencyMs={compareResult.latencyMs}
                />
              </div>
            )}
          </div>
          {compareStatus === 'done' &&
            compareResult &&
            result.costUsd !== null &&
            compareResult.costUsd !== null && (
              <p className={styles.deltaLine}>
                {formatDelta(result.costUsd, compareResult.costUsd, compareModel)}
              </p>
            )}
        </div>
      )}
    </section>
  );
}
