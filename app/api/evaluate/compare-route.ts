import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

type ChoicePayload = {
  type: 'choice';
  state: string;
  instructions: string;
  criteria: Record<string, string>;
  model: string;
};

type ScorePayload = {
  type: 'score';
  state: string;
  instructions: string;
  criteria: string[];
  model: string;
};

type BooleanPayload = {
  type: 'boolean';
  state: string;
  instructions: string;
  criteria?: { true?: string; false?: string };
  model: string;
};

type Payload = ChoicePayload | ScorePayload | BooleanPayload;

export async function POST(request: Request) {
  let body: Payload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 });
  }

  const { type, state, instructions, model } = body;

  if (!type || !state || !instructions || !model) {
    return NextResponse.json(
      { error: 'A comparison needs a type, a state, instructions, and a model id.' },
      { status: 400 },
    );
  }

  let schema: z.ZodTypeAny;
  let prompt: string;

  if (type === 'choice') {
    const options = body.criteria ?? {};
    const keys = Object.keys(options);
    if (keys.length < 2) {
      return NextResponse.json({ error: 'Choice needs at least two options.' }, { status: 400 });
    }
    schema = z.object({
      choice: z.enum(keys as [string, ...string[]]),
      probabilities: z.object(Object.fromEntries(keys.map((k) => [k, z.number().min(0).max(1)]))),
    });
    prompt = [
      `Text to evaluate:\n"""${state}"""`,
      `Question: ${instructions}`,
      `Options:\n${keys.map((k) => `- ${k}: ${options[k]}`).join('\n')}`,
      `Pick exactly one option as "choice". Also estimate your own probability for every option in "probabilities" (they should roughly sum to 1).`,
    ].join('\n\n');
  } else if (type === 'score') {
    const levels = body.criteria ?? [];
    if (levels.length < 2) {
      return NextResponse.json({ error: 'Score needs at least two levels.' }, { status: 400 });
    }
    const idx = levels.map((_, i) => String(i));
    schema = z.object({
      score: z.number().min(0).max(levels.length - 1),
      probabilities: z.object(Object.fromEntries(idx.map((i) => [i, z.number().min(0).max(1)]))),
    });
    prompt = [
      `Text to evaluate:\n"""${state}"""`,
      `Question: ${instructions}`,
      `Levels, low (0) to high (${levels.length - 1}):\n${levels.map((l, i) => `${i}. ${l}`).join('\n')}`,
      `Estimate your own probability for each level in "probabilities", and report the probability-weighted average as "score".`,
    ].join('\n\n');
  } else if (type === 'boolean') {
    const criteria = body.criteria;
    schema = z.object({ probability: z.number().min(0).max(1) });
    prompt = [
      `Text to evaluate:\n"""${state}"""`,
      `Question: ${instructions}`,
      criteria?.true || criteria?.false
        ? `True means: ${criteria?.true ?? '(unspecified)'}\nFalse means: ${criteria?.false ?? '(unspecified)'}`
        : '',
      `Estimate the probability that the answer is yes, from 0 to 1, as "probability".`,
    ]
      .filter(Boolean)
      .join('\n\n');
  } else {
    return NextResponse.json({ error: 'Unknown question type.' }, { status: 400 });
  }

  try {
    const result = await generateObject({ model, schema, prompt });

    const inputTokens = result.usage?.inputTokens ?? null;
    const costUsd = (result.providerMetadata?.gateway as { cost?: number } | undefined)?.cost ?? null;

    const answer =
      type === 'choice'
        ? { type: 'choice' as const, ...(result.object as { choice: string; probabilities: Record<string, number> }) }
        : type === 'score'
          ? { type: 'score' as const, ...(result.object as { score: number; probabilities: Record<string, number> }) }
          : { type: 'boolean' as const, ...(result.object as { probability: number }) };

    return NextResponse.json({ answer, inputTokens, costUsd });
  } catch (err) {
    console.error('Comparison model call failed:', err);
    const message = err instanceof Error ? err.message : 'Comparison failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
