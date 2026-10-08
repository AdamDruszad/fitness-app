import { getExerciseArtwork } from '../data/exerciseArtwork';
import './exercise-artwork.css';

// One character, drawn in small reusable parts. Points describe a static visual
// identifier for each movement, not a frame-by-frame form tutorial.
const poses = {
  'push-up': { head: [44, 59], body: [[63, 69], [111, 86]], arms: [[[65, 72], [69, 93], [53, 108]], [[60, 73], [52, 90], [43, 108]]], legs: [[[109, 85], [133, 97], [152, 109]], [[111, 88], [136, 100], [158, 110]]] },
  'pike-push-up': { head: [51, 81], body: [[68, 70], [104, 34]], arms: [[[69, 71], [70, 94], [64, 109]], [[64, 73], [58, 94], [47, 109]]], legs: [[[105, 35], [128, 71], [140, 110]], [[108, 37], [137, 76], [154, 110]]] },
  'bench-dip': { head: [95, 35], body: [[95, 53], [108, 86]], arms: [[[97, 54], [95, 78], [79, 76]], [[91, 56], [84, 78], [69, 76]]], legs: [[[107, 85], [133, 86], [153, 110]], [[110, 89], [127, 94], [145, 110]]] },
  plank: { head: [44, 61], body: [[62, 70], [108, 84]], arms: [[[65, 73], [64, 104], [44, 106]], [[59, 74], [55, 105], [32, 107]]], legs: [[[109, 84], [133, 98], [153, 110]], [[107, 87], [133, 102], [158, 111]]] },
  squat: { head: [87, 29], body: [[83, 47], [71, 78]], arms: [[[81, 49], [103, 58], [120, 63]], [[88, 49], [108, 66], [125, 67]]], legs: [[[71, 77], [98, 84], [79, 111]], [[75, 81], [108, 87], [92, 111]]] },
  lunge: { head: [87, 26], body: [[85, 44], [83, 76]], arms: [[[80, 47], [69, 65], [76, 79]], [[90, 47], [105, 64], [111, 48]]], legs: [[[82, 77], [65, 103], [44, 103]], [[87, 77], [115, 82], [115, 111]]] },
  'bench-press': { head: [45, 68], body: [[66, 76], [108, 79]], arms: [[[66, 73], [65, 49], [73, 31]], [[76, 75], [100, 54], [105, 31]]], legs: [[[108, 79], [126, 95], [127, 112]], [[104, 83], [116, 98], [115, 112]]] },
  'incline-press': { head: [62, 47], body: [[77, 63], [105, 88]], arms: [[[77, 62], [60, 43], [66, 21]], [[85, 68], [109, 54], [109, 32]]], legs: [[[104, 88], [129, 93], [137, 113]], [[107, 91], [120, 101], [123, 113]]] },
  'cable-fly': { head: [90, 27], body: [[90, 45], [90, 78]], arms: [[[83, 47], [57, 57], [74, 68]], [[97, 47], [123, 57], [106, 68]]], legs: [[[86, 78], [77, 94], [72, 112]], [[95, 79], [105, 95], [109, 112]]] },
  'triceps-pushdown': { head: [88, 26], body: [[89, 44], [93, 78]], arms: [[[83, 46], [76, 63], [77, 84]], [[96, 47], [105, 63], [108, 84]]], legs: [[[89, 78], [82, 96], [77, 112]], [[98, 79], [104, 96], [110, 112]]] },
  'lateral-raise': { head: [90, 27], body: [[90, 45], [90, 78]], arms: [[[83, 47], [61, 51], [36, 52]], [[97, 47], [120, 51], [145, 52]]], legs: [[[86, 78], [80, 95], [76, 112]], [[95, 78], [101, 95], [105, 112]]] },
  'back-squat': { head: [88, 28], body: [[84, 46], [74, 78]], arms: [[[82, 47], [67, 60], [63, 43]], [[91, 47], [112, 60], [118, 43]]], legs: [[[73, 77], [98, 85], [83, 111]], [[78, 81], [109, 88], [96, 111]]] },
  'leg-press': { head: [61, 48], body: [[76, 64], [103, 92]], arms: [[[75, 65], [76, 90], [94, 100]], [[82, 69], [89, 91], [108, 101]]], legs: [[[103, 89], [106, 57], [135, 38]], [[109, 92], [123, 73], [149, 57]]] },
  'leg-curl': { head: [39, 62], body: [[57, 70], [111, 77]], arms: [[[56, 72], [46, 86], [45, 99]], [[64, 73], [61, 88], [66, 99]]], legs: [[[110, 76], [134, 80], [138, 45]], [[115, 79], [145, 84], [150, 50]]] },
  'cable-row': { head: [111, 36], body: [[110, 54], [104, 90]], arms: [[[103, 55], [83, 66], [60, 69]], [[116, 58], [85, 74], [64, 75]]], legs: [[[104, 89], [76, 91], [48, 108]], [[108, 94], [81, 100], [57, 110]]] },
  'ab-wheel': { head: [58, 61], body: [[76, 68], [111, 78]], arms: [[[74, 69], [56, 81], [40, 99]], [[81, 71], [63, 86], [46, 100]]], legs: [[[109, 78], [114, 105], [140, 107]], [[114, 81], [122, 108], [150, 110]]] },
  'overhead-press': { head: [91, 30], body: [[91, 47], [91, 80]], arms: [[[85, 48], [65, 46], [65, 19]], [[98, 48], [116, 46], [116, 19]]], legs: [[[87, 79], [81, 96], [78, 112]], [[96, 80], [102, 96], [105, 112]]] },
  row: { head: [64, 44], body: [[80, 62], [111, 78]], arms: [[[79, 64], [77, 83], [61, 87]], [[85, 66], [108, 82], [94, 87]]], legs: [[[109, 79], [96, 97], [86, 112]], [[114, 81], [120, 98], [122, 112]]] },
  deadlift: { head: [67, 36], body: [[83, 54], [110, 78]], arms: [[[82, 56], [77, 76], [76, 96]], [[91, 60], [102, 77], [103, 96]]], legs: [[[108, 77], [91, 91], [85, 112]], [[115, 80], [125, 95], [124, 112]]] },
  'romanian-deadlift': { head: [54, 37], body: [[72, 54], [110, 77]], arms: [[[73, 56], [70, 76], [70, 97]], [[83, 61], [93, 78], [95, 97]]], legs: [[[108, 77], [98, 96], [99, 112]], [[116, 81], [116, 98], [120, 112]]] },
  curl: { head: [91, 26], body: [[91, 44], [91, 79]], arms: [[[84, 46], [74, 67], [57, 51]], [[98, 46], [109, 67], [124, 51]]], legs: [[[87, 78], [82, 95], [78, 112]], [[95, 78], [102, 95], [106, 112]]] },
  'pull-up': { head: [91, 44], body: [[91, 61], [91, 88]], arms: [[[84, 61], [65, 49], [58, 19]], [[98, 61], [116, 49], [125, 19]]], legs: [[[86, 88], [84, 108], [63, 105]], [[96, 89], [102, 110], [82, 109]]] },
  'calf-raise': { head: [89, 25], body: [[89, 44], [90, 76]], arms: [[[83, 46], [76, 64], [76, 81]], [[95, 47], [102, 65], [104, 81]]], legs: [[[86, 76], [85, 94], [85, 104]], [[95, 76], [99, 94], [99, 104]]], tiptoe: true },
  crunch: { head: [81, 65], body: [[74, 83], [104, 105]], arms: [[[73, 84], [55, 73], [71, 61]], [[77, 86], [62, 79], [79, 65]]], legs: [[[105, 103], [129, 79], [144, 110]], [[109, 106], [139, 84], [158, 110]]] },
  run: { head: [93, 27], body: [[89, 46], [85, 77]], arms: [[[84, 48], [63, 55], [74, 37]], [[94, 49], [110, 65], [126, 49]]], legs: [[[83, 76], [61, 93], [49, 77]], [[89, 78], [116, 86], [105, 112]]] },
};

function line(points) {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ');
}

function Limb({ points, leg = false, far = false, tiptoe = false }) {
  const [start, joint, end] = points;
  return (
    <g className={far ? 'exercise-art__far-limb' : undefined}>
      <path d={line(points)} className="exercise-art__skin" strokeWidth={leg ? 9 : 7} />
      <path d={line([start, joint])} className={leg ? 'exercise-art__shorts' : 'exercise-art__shirt'} strokeWidth={leg ? 13 : 9} />
      {!leg && <circle cx={end[0]} cy={end[1]} r="3.7" className="exercise-art__skin-fill" />}
      {leg && <path d={line([end, [end[0] + 8, end[1] + (tiptoe ? 7 : 0)]])} className="exercise-art__shoe" strokeWidth="7" />}
    </g>
  );
}

function Character({ pose }) {
  const [headX, headY] = pose.head;
  const [shoulder] = pose.body;
  const neck = [headX + (shoulder[0] - headX) * 0.65, headY + (shoulder[1] - headY) * 0.65];
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <Limb points={pose.legs[0]} leg far tiptoe={pose.tiptoe} />
      <Limb points={pose.arms[0]} far />
      <path d={line([neck, shoulder])} className="exercise-art__skin" strokeWidth="9" />
      <path d={line(pose.body)} className="exercise-art__shirt" strokeWidth="21" />
      <Limb points={pose.legs[1]} leg tiptoe={pose.tiptoe} />
      <path d={line([pose.body[0], [pose.body[0][0] + (pose.body[1][0] - pose.body[0][0]) * 0.75, pose.body[0][1] + (pose.body[1][1] - pose.body[0][1]) * 0.75]])} className="exercise-art__shirt" strokeWidth="20" />
      <Limb points={pose.arms[1]} />
      <circle cx={headX} cy={headY} r="10" className="exercise-art__skin-fill" />
      <path d={`M${headX - 9} ${headY - 1} Q${headX - 12} ${headY - 13} ${headX + 1} ${headY - 12} Q${headX + 10} ${headY - 12} ${headX + 10} ${headY - 5} Q${headX + 2} ${headY - 7} ${headX - 2} ${headY - 3} L${headX - 5} ${headY + 1} Z`} className="exercise-art__hair" />
    </g>
  );
}

function Dumbbell({ x, y }) {
  return <g className="exercise-art__equipment" transform={`translate(${x} ${y})`}><rect x="-12" y="-2" width="24" height="4" rx="2" /><rect x="-13" y="-7" width="6" height="14" rx="2" /><rect x="7" y="-7" width="6" height="14" rx="2" /></g>;
}

function Barbell({ x1, x2, y }) {
  return <g className="exercise-art__equipment"><rect x={x1} y={y - 2} width={x2 - x1} height="4" rx="2" /><rect x={x1 + 4} y={y - 10} width="7" height="20" rx="2" /><rect x={x2 - 11} y={y - 10} width="7" height="20" rx="2" /></g>;
}

function Equipment({ artwork, foreground = false }) {
  const { id, equipment } = artwork;
  if (!foreground) {
    if (id === 'incline-press') return <g className="exercise-art__equipment"><path d="M52 59l42 40h28" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" /><path d="M84 93v23m31-16v16M71 115h56" fill="none" stroke="currentColor" strokeWidth="4" /></g>;
    if (id === 'cable-fly') return <g className="exercise-art__equipment"><path d="M22 115V22h14m122 93V22h-14" fill="none" stroke="currentColor" strokeWidth="4" opacity=".65" /><path d="M30 25l44 43m76-43l-44 43" className="exercise-art__cable" /><circle cx="30" cy="25" r="4" /><circle cx="150" cy="25" r="4" /></g>;
    if (id === 'triceps-pushdown') return <g className="exercise-art__equipment"><path d="M134 115V14H94" fill="none" stroke="currentColor" strokeWidth="4" opacity=".65" /><circle cx="94" cy="17" r="5" /><path d="M94 17v48" className="exercise-art__cable" /></g>;
    if (id === 'leg-press') return <g className="exercise-art__equipment"><path d="M47 64l39 38h30m-50 12h89m-36-6l47-86" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /><path d="M83 101v13m65-8v8" fill="none" stroke="currentColor" strokeWidth="4" /><path d="M130 27l31 40" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" /></g>;
    if (id === 'leg-curl') return <g className="exercise-art__equipment"><rect x="45" y="86" width="102" height="8" rx="3" /><path d="M59 94v22m70-22v22m15-24l12-39" fill="none" stroke="currentColor" strokeWidth="5" /></g>;
    if (id === 'cable-row') return <g className="exercise-art__equipment"><path d="M23 115V38h13m-5 7v46" fill="none" stroke="currentColor" strokeWidth="5" opacity=".65" /><rect x="88" y="101" width="40" height="7" rx="3" /><path d="M101 107v8m-62-14l9 13" fill="none" stroke="currentColor" strokeWidth="5" /><path d="M31 78l31-6" className="exercise-art__cable" /><circle cx="31" cy="78" r="5" /></g>;
    if (id === 'bench-dip' || id === 'bench-press') {
      const x = id === 'bench-dip' ? 22 : 38;
      const y = id === 'bench-dip' ? 72 : 87;
      const width = id === 'bench-dip' ? 62 : 87;
      return <g className="exercise-art__equipment"><rect x={x} y={y} width={width} height="8" rx="3" /><path d={`M${x + 10} ${y + 8}v30m${width - 20} -30v30`} fill="none" stroke="currentColor" strokeWidth="5" /></g>;
    }
    if (id === 'pull-up') return <g className="exercise-art__equipment"><rect x="39" y="14" width="104" height="6" rx="3" /><path d="M43 17v95m96-95v95" fill="none" stroke="currentColor" strokeWidth="4" opacity=".5" /></g>;
    if (id === 'calf-raise') return <rect x="76" y="113" width="44" height="7" rx="2" className="exercise-art__equipment" />;
    return null;
  }
  if (id === 'triceps-pushdown') return <g className="exercise-art__equipment"><path d="M94 64L77 84m17-20l14 20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /><circle cx="77" cy="86" r="4" /><circle cx="108" cy="86" r="4" /></g>;
  if (id === 'cable-row') return <path d="M60 66l7 6-3 7" className="exercise-art__handle" />;
  if (id === 'leg-curl') return <g className="exercise-art__equipment"><rect x="128" y="43" width="32" height="9" rx="4" /></g>;
  if (id === 'ab-wheel') return <g className="exercise-art__equipment"><circle cx="42" cy="106" r="9" fill="none" stroke="currentColor" strokeWidth="4" /><path d="M32 103h19" fill="none" stroke="currentColor" strokeWidth="4" /><circle cx="42" cy="106" r="2" /></g>;
  if (id === 'pull-up' && equipment === 'weight-belt') return <g className="exercise-art__equipment"><path d="M83 85q8 18 17 0m-9 10v6" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="91" cy="106" r="7" /><circle cx="91" cy="106" r="2" className="exercise-art__skin-fill" /></g>;
  const weights = {
    'bench-press': [[73, 31], [105, 31]],
    'incline-press': [[66, 21], [109, 32]],
    'lateral-raise': [[36, 52], [145, 52]],
    'back-squat': [[63, 43], [118, 43]],
    'overhead-press': [[65, 19], [116, 19]],
    row: [[61, 87], [94, 87]],
    deadlift: [[76, 96], [103, 96]],
    'romanian-deadlift': [[70, 97], [95, 97]],
    curl: [[57, 51], [124, 51]],
  }[id];
  if (!weights) return null;
  return equipment === 'barbell'
    ? <Barbell x1={weights[0][0] - 23} x2={weights[1][0] + 23} y={weights[0][1]} />
    : weights.map(([x, y]) => <Dumbbell key={x} x={x} y={y} />);
}

/** Decorative beside a visible exercise title; provide label for standalone use. */
export default function ExerciseArtwork({ name, className = '', label, ...props }) {
  const artwork = getExerciseArtwork(name);
  const pose = poses[artwork.id];
  return (
    <svg {...props} className={`exercise-art ${className}`.trim()} viewBox="0 0 180 132" width="180" height="132" role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} focusable="false" data-exercise-art={artwork.id}>
      <circle cx="92" cy="68" r="51" className="exercise-art__backdrop" />
      <path d="M24 117H162" className="exercise-art__floor" />
      {pose ? <><Equipment artwork={artwork} /><Character pose={pose} /><Equipment artwork={artwork} foreground /></> : <g transform="translate(90 68) rotate(-24)"><Dumbbell x={0} y={0} /><path d="M-29 0h-5m63 0h5" className="exercise-art__floor" /><circle cx="0" cy="0" r="34" className="exercise-art__fallback-ring" /></g>}
    </svg>
  );
}
