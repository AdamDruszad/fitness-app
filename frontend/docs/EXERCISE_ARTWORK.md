# FitAI exercise artwork

Original inline SVG character artwork, drawn for this repository. No image service,
external image downloads, API keys, new packages, or runtime network calls are used.
The orange shirt follows FitAI's terracotta identity; dark/light mode retain the
same character. The illustration has a 180 × 132 view box and scales with its card.

## Use

```jsx
<ExerciseArtwork name={exercise.name} />
```

Artwork is decorative by default when an exercise heading is already visible.
For standalone use, supply a descriptive `label` for the SVG's accessible name.
`getExerciseArtwork(name)` returns the matched movement `id`, `label`, and optional
equipment. An unknown name returns `id: 'equipment'` and `isFallback: true`.

## Coverage

Twenty-five poses cover push-ups, pike push-ups, bench/triceps dips, forearm planks,
bodyweight and barbell back squats, lunges, flat bench presses, incline dumbbell
presses, standing overhead presses, cable flyes, rope triceps pushdowns, dumbbell
lateral raises, bent-over and seated cable rows, conventional and Romanian
deadlifts, curls, pull-ups, leg presses, lying leg curls, standing calf raises,
crunches, kneeling ab wheel rollouts, and running. Weight variants distinguish
barbells, dumbbells, and a weighted pull-up belt. The three-day gym plan's eighteen
movements are all covered. The exact accepted names are in
`src/data/exerciseArtwork.js`.

Names are case-, accent-, whitespace-, and punctuation-insensitive. Matching is
otherwise exact: side planks, incline barbell presses, lat pulldowns, seated leg
curls, front squats, and other uncovered variations receive the neutral equipment art
rather than an unrelated pose. The backend generates free-form names, so this is
coverage of common movements, not a promise that every possible generated exercise
has a bespoke image. Only aliases describing the same visible movement should be
added. These small illustrations identify movements; they are not animated
technique instructions.

Check alias collisions, all eighteen gym-plan movements, normalization, and safe
fallback behavior with `node --test src/data/exerciseArtwork.test.js`.

## Future artist handoff

The registry is separate from the rendering. Replace individual pose renderers or
use local art assets keyed by the same `id`; preserve the fallback, decorative
accessibility behavior, aspect ratio, and light/dark legibility. Custom character
art can be introduced one movement at a time without changing exercise data or
workout logging. For visually different exercise variations, add a new pose and
an explicit registry entry instead of a broad substring matcher.
