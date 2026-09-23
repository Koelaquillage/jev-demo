import { experimental_evaluate as evaluate } from 'ai';
import { NextResponse } from 'next/server';

type ChoicePayload = {
  type: 'choice';
  state: string;
  instructions: string;
  criteria: Record<string, string>;
};

type ScorePayload = {
  type: 'score';
  state: string;
  instructions: string;
  criteria: string[];
};

type BooleanPayload = {
  type: 'boolean';
  state: string;
  instructions: string;
  criteria?: { true?: string; false?: string };
};

type Payload = ChoicePayload | ScorePayload | BooleanPayload;

export async function POST(request: Request) {
  let body: Payload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 });
  }

  const { type, state, instructions } = body;

  if (!type || !state || !instructions) {
    return NextResponse.json(
      { error: 'A question needs a type, a state, and instructions.' },
      { status: 400 },
    );
  }

  let question: Record<string, unknown>;

  if (type === 'choice') {
    const options = body.criteria ?? {};
    if (Object.keys(options).length < 2) {
      return NextResponse.json({ error: 'Choice needs at least two options.' }, { status: 400 });
    }
    question = { type: 'choice', instructions, criteria: options };
  } else if (type === 'score') {
    const levels = body.criteria ?? [];
    if (levels.length < 2) {
      return NextResponse.json({ error: 'Score needs at least two levels.' }, { status: 400 });
    }
    question = { type: 'score', instructions, criteria: levels };
  } else if (type === 'boolean') {
    const criteria = body.criteria;
    const hasCriteria = criteria && (criteria.true || criteria.false);
    question = { type: 'boolean', instructions, ...(hasCriteria ? { criteria } : {}) };
  } else {
    return NextResponse.json({ error: 'Unknown question type.' }, { status: 400 });
  }

  try {
        const result = await evaluate({
      model: 'typesafe-ai/jev',
      state,
      questions: { result: question as never },
    });

    const confidence = (
      result.providerMetadata?.typesafe as { confidence?: Record<string, number> } | undefined
    )?.confidence?.result;

    return NextResponse.json({ answer: result.answers.result, confidence: confidence ?? null });
  } catch (err) {
    console.error('Jev evaluation failed:', err);
    const message = err instanceof Error ? err.message : 'Evaluation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
