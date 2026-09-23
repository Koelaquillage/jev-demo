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

async function runEvaluate<T>(payload: object): Promise<{ answer: T; confidence: number | null }> {
  const res = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed.');
  return json;
}

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
          scale, or the odds of a single yes. Three shapes, tried below.
        </p>

        <ChoiceSection />
        <ScoreSection />
        <BooleanSection />

        <p className={styles.footer}>
          Every run below calls Jev live through the AI Gateway. Nothing is cached or scripted.
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
  const [result, setResult] = useState<{ answer: ChoiceAnswer; confidence: number | null } | null>(
    null,
  );
  const [error, setError] = useState('');

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

  const run = async () => {
    setStatus('loading');
    setError('');
    try {
      const criteria = Object.fromEntries(options.map((o) => [o.key, o.description]));
      const data = await runEvaluate<ChoiceAnswer>({ type: 'choice', state, instructions, criteria });
      setResult(data as { answer: ChoiceAnswer; confidence: number | null });
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStatus('error');
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

      {status === 'error' && <p className={styles.errorText}>{error}</p>}

      {status === 'done' && result && (
        <div className={styles.result}>
          <div className={styles.resultHeadline}>{result.answer.choice}</div>
          {result.confidence !== null && (
            <div className={styles.confidence}>confidence {result.confidence.toFixed(2)}</div>
          )}
          {Object.entries(result.answer.probabilities)
            .sort((a, b) => b[1] - a[1])
            .map(([key, value]) => (
              <div className={styles.bar} key={key}>
                <div className={styles.barTop}>
                  <span
                    className={`${styles.barKey} ${key === result.answer.choice ? styles.winner : ''}`}
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
  const [result, setResult] = useState<{ answer: ScoreAnswer; confidence: number | null } | null>(
    null,
  );
  const [error, setError] = useState('');

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
      const data = await runEvaluate<ScoreAnswer>({
        type: 'score',
        state,
        instructions,
        criteria: levels,
      });
      setResult(data as { answer: ScoreAnswer; confidence: number | null });
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStatus('error');
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
              <input className={styles.input} value={l} onChange={(e) => updateLevel(i, e.target.value)} />
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

      {status === 'error' && <p className={styles.errorText}>{error}</p>}

      {status === 'done' && result && (
        <div className={styles.result}>
          <div className={styles.resultHeadline}>
            {result.answer.score.toFixed(2)}{' '}
            <span style={{ color: 'var(--ink-dim)', fontSize: '1rem' }}>
              / {levels.length - 1}
            </span>
          </div>
          {result.confidence !== null && (
            <div className={styles.confidence}>confidence {result.confidence.toFixed(2)}</div>
          )}
          {Object.entries(result.answer.probabilities)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([idx, value]) => (
              <div className={styles.bar} key={idx}>
                <div className={styles.barTop}>
                  <span className={styles.barKey}>{levels[Number(idx)] ?? idx}</span>
                  <span className={styles.barValue}>{value.toFixed(2)}</span>
                </div>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${value * 100}%` }} />
                </div>
              </div>
            ))}
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
  const [result, setResult] = useState<{ answer: BooleanAnswer; confidence: number | null } | null>(
    null,
  );
  const [error, setError] = useState('');

  const run = async () => {
    setStatus('loading');
    setError('');
    try {
      const criteria =
        trueDesc || falseDesc
          ? { true: trueDesc || undefined, false: falseDesc || undefined }
          : undefined;
      const data = await runEvaluate<BooleanAnswer>({
        type: 'boolean',
        state,
        instructions,
        criteria,
      });
      setResult(data as { answer: BooleanAnswer; confidence: number | null });
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStatus('error');
    }
  };

  const label = (p: number) => {
    if (p >= 0.8) return 'likely true';
    if (p <= 0.2) return 'likely false';
    return 'uncertain';
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

      {status === 'error' && <p className={styles.errorText}>{error}</p>}

      {status === 'done' && result && (
        <div className={styles.result}>
          <div className={styles.resultHeadline}>
            {result.answer.probability.toFixed(2)}{' '}
            <span style={{ color: 'var(--ink-dim)', fontSize: '1rem' }}>
              — {label(result.answer.probability)}
            </span>
          </div>
          <div className={styles.gauge}>
            <div
              className={styles.gaugeMarker}
              style={{ left: `${result.answer.probability * 100}%` }}
            />
          </div>
          <div className={styles.gaugeLabels}>
            <span>false</span>
            <span>true</span>
          </div>
        </div>
      )}
    </section>
  );
}
