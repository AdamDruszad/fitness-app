import test from 'node:test';
import assert from 'node:assert/strict';
import { exerciseArtworkRegistry, getExerciseArtwork, normalizeExerciseName } from './exerciseArtwork.js';

test('every registered alias has one unambiguous artwork mapping', () => {
  const seen = new Map();
  for (const entry of exerciseArtworkRegistry) {
    for (const alias of entry.aliases) {
      const normalized = normalizeExerciseName(alias);
      const previous = seen.get(normalized);
      assert.ok(!previous || previous === entry, `Conflicting alias: ${alias}`);
      seen.set(normalized, entry);
      assert.equal(getExerciseArtwork(alias), entry);
    }
  }
});

test('the complete three-day gym plan has specific illustrations', () => {
  const expected = {
    'Barbell Bench Press': ['bench-press', 'barbell'],
    'Incline Dumbbell Press': ['incline-press', 'dumbbells'],
    'Barbell Overhead Press': ['overhead-press', 'barbell'],
    'Cable Flyes': ['cable-fly', 'cables'],
    'Rope Tricep Pushdowns': ['triceps-pushdown', 'cable-rope'],
    'Lateral Raises': ['lateral-raise', 'dumbbells'],
    'Barbell Back Squat': ['back-squat', 'barbell'],
    'Romanian Deadlift': ['romanian-deadlift', 'barbell'],
    'Leg Press': ['leg-press', 'machine'],
    'Leg Curls': ['leg-curl', 'machine'],
    'Walking Lunges': ['lunge', undefined],
    'Calf Raises': ['calf-raise', undefined],
    'Barbell Deadlift': ['deadlift', 'barbell'],
    'Weighted Pull-ups': ['pull-up', 'weight-belt'],
    'Barbell Rows': ['row', 'barbell'],
    'Barbell Curls': ['curl', 'barbell'],
    'Cable Rows': ['cable-row', 'cable'],
    'Ab Wheel Rollouts': ['ab-wheel', 'ab-wheel'],
  };
  for (const [name, [id, equipment]] of Object.entries(expected)) {
    const artwork = getExerciseArtwork(name);
    assert.equal(artwork.id, id, name);
    assert.equal(artwork.equipment, equipment, name);
    assert.ok(!artwork.isFallback, name);
  }
});

test('punctuation, casing, whitespace and Hungarian accents normalize safely', () => {
  assert.equal(getExerciseArtwork('  WEIGHTED   PULL-UPS! ').id, 'pull-up');
  assert.equal(getExerciseArtwork('Fekvőtámasz').id, 'push-up');
  assert.equal(getExerciseArtwork('húzódzkodás').id, 'pull-up');
});

test('unknown and meaningfully different movements keep the neutral fallback', () => {
  for (const name of [undefined, null, {}, '', 'Side Plank', 'Seated Leg Curl', 'Front Squat', 'Incline Barbell Press', 'Lat Pulldown', 'Standing Ab Wheel Rollout', 'Cable Lateral Raise', 'Diamond Push-ups']) {
    const artwork = getExerciseArtwork(name);
    assert.equal(artwork.id, 'equipment', String(name));
    assert.equal(artwork.isFallback, true, String(name));
  }
});
