---
name: skill-creator
description: Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.
---

# Skill Creator

A skill for creating new skills and iteratively improving them.

At a high level, the process of creating a skill goes like this:

- Decide what you want the skill to do and roughly how it should do it
- Write a draft of the skill
- Create a few test prompts and run claude-with-access-to-the-skill on them
- Help the user evaluate the results both qualitatively and quantitatively
  - While the runs happen in the background, draft some quantitative evals if there aren't any (if there are some, you can either use as is or modify if you feel something needs to change about them). Then explain them to the user (or if they already existed, explain the ones that already exist)
  - Use the `eval-viewer/generate_review.py` script to show the user the results for them to look at, and also let them look at the quantitative metrics
- Rewrite the skill based on feedback from the user's evaluation of the results (and also if there are any glaring flaws that become apparent from the quantitative benchmarks)
- Repeat until you're satisfied
- Expand the test set and try again at larger scale

Your job when using this skill is to figure out where the user is in this process and then jump in and help them progress through these stages. So for instance, maybe they're like "I want to make a skill for X". You can help narrow down what they mean, write a draft, write the test cases, figure out how they want to evaluate, run all the prompts, and repeat.

On the other hand, maybe they already have a draft of the skill. In this case you can go straight to the eval/iterate part of the loop.

Of course, you should always be flexible and if the user is like "I don't need to run a bunch of evaluations, just vibe with me", you can do that instead.

Then after the skill is done (but again, the order is flexible), you can also run the skill description improver, which we have a whole separate script for, to optimize the triggering of the skill.

Cool? Cool.

## Creating a skill (single-turn draft)

When the user gives a short description of what skill they want (e.g. in one message), produce a complete draft SKILL.md:

- **name**: Skill identifier in kebab-case (e.g. `commit-messages`, `pdf-rotate`).
- **description**: When to trigger and what it does. This is the primary triggering mechanism. Include both what the skill does AND specific contexts for when to use it. Make descriptions a little "pushy" so the skill gets used when relevant — e.g. "Use this skill whenever the user mentions X, Y, or Z, even if they don't explicitly ask for it."
- **body**: Markdown instructions — clear steps, examples, and optional troubleshooting. Prefer imperative form. Keep under ~500 lines; use references/ for long docs.

### Anatomy of a Skill

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/    - Executable code for deterministic/repetitive tasks
    ├── references/ - Docs loaded into context as needed
    └── assets/     - Files used in output (templates, icons, fonts)
```

### Writing patterns

- Prefer imperative form in instructions.
- Explain why things are important; avoid ALL CAPS MUSTs when possible.
- Include examples where helpful (Input/Output style or step-by-step).
- No malware, exploit code, or misleading intent. "Roleplay as X" is OK.

Output only the raw SKILL.md content: YAML frontmatter between --- delimiters, then a blank line, then the markdown body. No surrounding commentary or code fences.
