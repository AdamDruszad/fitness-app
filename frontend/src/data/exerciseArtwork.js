/**
 * Small, intentionally explicit registry for the original FitAI character art.
 * Free-form plan names must not accidentally match a different movement.
 * Add exact aliases here when adding/replacing an illustration.
 */
export function normalizeExerciseName(name) {
  return typeof name === 'string'
    ? name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim()
    : '';
}

export const exerciseArtworkRegistry = [
  {
    id: 'push-up', label: 'Push-up',
    aliases: ['push-up', 'push-ups', 'pushup', 'pushups', 'standard push-ups', 'bodyweight push-ups', 'fekvőtámasz'],
  },
  {
    id: 'pike-push-up', label: 'Pike push-up',
    aliases: ['pike push-up', 'pike push-ups', 'pike pushup', 'pike pushups'],
  },
  {
    id: 'bench-dip', label: 'Bench dip',
    aliases: ['bench dip', 'bench dips', 'tricep dip', 'tricep dips', 'triceps dip', 'triceps dips', 'triceps bench dips', 'chair dips'],
  },
  {
    id: 'plank', label: 'Forearm plank',
    aliases: ['plank', 'planks', 'forearm plank', 'elbow plank', 'front plank', 'plank hold'],
  },
  {
    id: 'squat', label: 'Bodyweight squat',
    aliases: ['squat', 'squats', 'bodyweight squat', 'bodyweight squats', 'air squat', 'air squats', 'guggolás'],
  },
  {
    id: 'back-squat', label: 'Barbell back squat', equipment: 'barbell',
    aliases: ['back squat', 'back squats', 'barbell squat', 'barbell squats', 'barbell back squat', 'barbell back squats'],
  },
  {
    id: 'lunge', label: 'Lunge',
    aliases: ['lunge', 'lunges', 'bodyweight lunges', 'forward lunge', 'forward lunges', 'walking lunges', 'reverse lunge', 'reverse lunges', 'kitörés'],
  },
  {
    id: 'bench-press', label: 'Bench press', equipment: 'barbell',
    aliases: ['bench press', 'barbell bench press', 'flat bench press', 'flat barbell bench press', 'fekvenyomás'],
  },
  {
    id: 'bench-press', label: 'Dumbbell bench press', equipment: 'dumbbells',
    aliases: ['dumbbell bench press', 'flat dumbbell bench press', 'dumbbell chest press'],
  },
  {
    id: 'incline-press', label: 'Incline dumbbell press', equipment: 'dumbbells',
    aliases: ['incline dumbbell press', 'incline dumbbell bench press', 'incline dumbbell chest press'],
  },
  {
    id: 'cable-fly', label: 'Standing cable fly', equipment: 'cables',
    aliases: ['cable fly', 'cable flys', 'cable flies', 'cable flyes', 'standing cable fly', 'standing cable flyes', 'standing cable chest fly', 'cable chest fly', 'cable chest flyes'],
  },
  {
    id: 'triceps-pushdown', label: 'Rope triceps pushdown', equipment: 'cable-rope',
    aliases: ['rope tricep pushdown', 'rope tricep pushdowns', 'rope triceps pushdown', 'rope triceps pushdowns', 'tricep rope pushdown', 'triceps rope pushdown', 'rope pushdown', 'rope pushdowns', 'cable rope triceps pushdown', 'cable rope tricep pushdown'],
  },
  {
    id: 'lateral-raise', label: 'Dumbbell lateral raise', equipment: 'dumbbells',
    aliases: ['lateral raise', 'lateral raises', 'dumbbell lateral raise', 'dumbbell lateral raises', 'standing lateral raise', 'standing lateral raises', 'side lateral raises'],
  },
  {
    id: 'leg-press', label: 'Leg press', equipment: 'machine',
    aliases: ['leg press', 'leg presses', 'machine leg press', '45 degree leg press', 'incline leg press'],
  },
  {
    id: 'leg-curl', label: 'Lying leg curl', equipment: 'machine',
    aliases: ['leg curl', 'leg curls', 'lying leg curl', 'lying leg curls', 'prone leg curl', 'prone leg curls', 'lying hamstring curl', 'lying hamstring curls'],
  },
  {
    id: 'overhead-press', label: 'Standing overhead press', equipment: 'barbell',
    aliases: ['overhead press', 'standing overhead press', 'barbell overhead press', 'barbell shoulder press', 'military press'],
  },
  {
    id: 'overhead-press', label: 'Standing dumbbell press', equipment: 'dumbbells',
    aliases: ['dumbbell shoulder press', 'standing dumbbell shoulder press', 'dumbbell overhead press', 'standing dumbbell press'],
  },
  {
    id: 'row', label: 'Bent-over row', equipment: 'barbell',
    aliases: ['bent-over row', 'bent-over rows', 'barbell row', 'barbell rows', 'bent-over barbell row', 'bent-over barbell rows'],
  },
  {
    id: 'row', label: 'Bent-over dumbbell row', equipment: 'dumbbells',
    aliases: ['dumbbell row', 'dumbbell rows', 'bent-over dumbbell row', 'bent-over dumbbell rows', 'dumbbell bent-over row'],
  },
  {
    id: 'cable-row', label: 'Seated cable row', equipment: 'cable',
    aliases: ['cable row', 'cable rows', 'seated cable row', 'seated cable rows', 'seated row', 'seated rows', 'seated low cable row', 'low cable row'],
  },
  {
    id: 'deadlift', label: 'Deadlift', equipment: 'barbell',
    aliases: ['deadlift', 'deadlifts', 'barbell deadlift', 'conventional deadlift', 'conventional barbell deadlift', 'felhúzás'],
  },
  {
    id: 'romanian-deadlift', label: 'Romanian deadlift', equipment: 'barbell',
    aliases: ['romanian deadlift', 'romanian deadlifts', 'barbell romanian deadlift', 'barbell romanian deadlifts', 'rdl', 'barbell rdl'],
  },
  {
    id: 'romanian-deadlift', label: 'Dumbbell Romanian deadlift', equipment: 'dumbbells',
    aliases: ['dumbbell romanian deadlift', 'dumbbell romanian deadlifts', 'dumbbell rdl'],
  },
  {
    id: 'curl', label: 'Dumbbell curl', equipment: 'dumbbells',
    aliases: ['bicep curl', 'biceps curl', 'bicep curls', 'biceps curls', 'dumbbell curl', 'dumbbell curls', 'dumbbell bicep curl', 'dumbbell biceps curl', 'standing dumbbell curls'],
  },
  {
    id: 'curl', label: 'Barbell curl', equipment: 'barbell',
    aliases: ['barbell curl', 'barbell curls', 'barbell bicep curl', 'barbell biceps curl', 'standing barbell curl', 'standing barbell curls'],
  },
  {
    id: 'pull-up', label: 'Pull-up',
    aliases: ['pull-up', 'pull-ups', 'pullup', 'pullups', 'bodyweight pull-ups', 'húzódzkodás'],
  },
  {
    id: 'pull-up', label: 'Weighted pull-up', equipment: 'weight-belt',
    aliases: ['weighted pull-up', 'weighted pull-ups', 'weighted pullup', 'weighted pullups'],
  },
  {
    id: 'calf-raise', label: 'Standing calf raise',
    aliases: ['calf raise', 'calf raises', 'standing calf raise', 'standing calf raises', 'bodyweight calf raises'],
  },
  {
    id: 'crunch', label: 'Crunch',
    aliases: ['crunch', 'crunches', 'abdominal crunch', 'abdominal crunches', 'ab crunch', 'ab crunches', 'hasprés'],
  },
  {
    id: 'ab-wheel', label: 'Kneeling ab wheel rollout', equipment: 'ab-wheel',
    aliases: ['ab wheel rollout', 'ab wheel rollouts', 'ab wheel roll out', 'ab wheel roll outs', 'kneeling ab wheel rollout', 'kneeling ab wheel rollouts', 'ab roller', 'ab roller rollout', 'ab roller rollouts'],
  },
  {
    id: 'run', label: 'Running',
    aliases: ['run', 'running', 'jog', 'jogging', 'easy run', 'easy jogging', 'futás', 'kocogás'],
  },
];

const byName = new Map(exerciseArtworkRegistry.flatMap((entry) =>
  entry.aliases.map((alias) => [normalizeExerciseName(alias), entry])
));

const fallbackArtwork = Object.freeze({ id: 'equipment', label: 'Exercise equipment', isFallback: true });

export function getExerciseArtwork(name) {
  return byName.get(normalizeExerciseName(name)) ?? fallbackArtwork;
}
