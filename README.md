# Jev Demo

A small internal demo showing what [Jev](https://typesafe.ai), TypeSafe AI's decision model, can do — built to show the team, not to ship.

The page walks through Jev's three question types live: **Choice**, **Score**, and **Noul**. Each panel has an editable form and calls Jev directly through the Vercel AI Gateway, so what you see is a real request and a real answer, not a canned example.

## Stack

- [Next.js](https://nextjs.org) (App Router)
- [Vercel AI SDK](https://ai-sdk.dev)'s `experimental_evaluate`, via [AI Gateway](https://vercel.com/ai-gateway) (`typesafe-ai/jev`)
- Plain CSS Modules — no UI framework

## Running locally

```bash
pnpm install
vercel link
vercel env pull
pnpm dev
```

Then open [localhost:3000/demo](http://localhost:3000/demo).

`vercel env pull` writes the AI Gateway credentials to `.env.local`. That token expires after about 12 hours locally, so re-run it if requests start failing with a 401.

## Project structure

```
app/
  demo/
    page.tsx          the three panels: state, question, form, live result
    page.module.css    styling
  api/
    evaluate/
      route.ts         calls Jev via experimental_evaluate, one route for all three types
```

## About Jev

Jev is TypeSafe AI's first "System One" model — the name borrowed from Kahneman's split between fast, intuitive judgment (System 1) and slow, deliberate reasoning (System 2). Where a chat model sits at the center of a product and generates the reply itself, Jev is built to disappear inside one: it's a component you drop into existing code, wherever a plain `if` statement isn't smart enough to make the call on its own.

The pitch is that most software needs a lot of small judgments buried in its logic — is this ticket urgent, which team should own it, does this comment need moderating — and today those get handled by brittle rules, a purpose-trained classifier, or by asking a general-purpose LLM to return structured JSON. Jev is a fourth option: define the possible answers up front in code, get back a full probability distribution over them, and let your application decide what happens next. It never writes prose, calls a tool, or loops on a task — it answers the question and stops, which is what keeps it fast and cheap.

Concretely, that's always one of three shapes:

- **Choice** — picks one labeled option from a set you define (up to 255), returning a probability for every option and a separate confidence score for the winner.
- **Score** — places the input on an ordered rubric you describe in your own words, anywhere from two levels to ten, and can land between two levels rather than being forced onto one.
- **Noul** — a single yes/no question, answered as one probability instead of a hard boolean.

Every question runs independently against the same input, so you can ask several at once — department, urgency, and refund intent off one support ticket, say — for barely more than the cost of asking one. That, plus response times in the tens to low hundreds of milliseconds and a price of $0.042 per million input tokens with no output charge, is the basis for pitching Jev as something to call constantly rather than ration.

### Where it could fit

A few shapes of problem people are already pointing it at:

- **Triage and routing** — sorting support tickets, emails, or form submissions by department, urgency, or intent before anything expensive happens to them.
- **Guardrails in front of agents** — classifying a shell command or tool call as read-only, reversible, or destructive before a coding agent is allowed to run it.
- **Verification, not generation** — checking whether an LLM-written summary actually matches its source, with the LLM doing the writing and Jev doing the checking.
- **Bulk labeling** — running a classification or scoring rubric across thousands of rows of text for a fraction of the cost of a general-purpose model.
- **Real-time interfaces** — anything fast enough to run per keystroke or per game tick, from live tone-and-quality scoring while someone types to a simple game agent choosing its next move from structured state.
- **Feature engineering** — turning free text into a handful of numeric scores that feed a traditional ML model downstream.

The common thread: Jev isn't meant to replace the parts of a product that write, reason at length, or produce something new. It's built for the far more common case where the answer only ever needed to be one of a few things, and the code just needed to know which one — which is exactly the case this demo is meant to make live for the team.

- **Official site:** [typesafe.ai](https://typesafe.ai)
- **Further reading:** [A deep dive into Jev, TypeSafe's System One model](https://flaviocopes.com/jev/) by Flavio Copes — a thorough walkthrough of the model, the three question types, the SDKs, where it breaks, and real early use cases.

## Notes

- Pricing is $0.042 per 1M input tokens, no output token charge.
- The `zeroDataRetention` Gateway option requires a Pro or Enterprise Vercel plan, so it's deliberately left off here.
- Each result panel shows the actual input token count and cost for that call.
