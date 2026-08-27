type BaseCard = {
  id: string;
  title: string;
  prompt: string;
  explanation: string;
};
export type CuriosityCard =
  | (BaseCard & { kind: "riddle"; answer: string })
  | (BaseCard & {
      kind: "quiz";
      options: readonly string[];
      answerIndex: number;
    })
  | (BaseCard & { kind: "fact"; source: { label: string; url: string } });

// Editorial content, never generated at request time. Facts link to primary sources.
export const cards: readonly CuriosityCard[] = [
  {
    id: "riddle-map",
    kind: "riddle",
    title: "A world without water",
    prompt:
      "I have cities but no houses, forests but no trees, and rivers but no water. What am I?",
    answer: "A map.",
    explanation:
      "A map represents those places without containing the physical things themselves.",
  },
  {
    id: "riddle-footsteps",
    kind: "riddle",
    title: "Leave a little behind",
    prompt:
      "The more steps you take, the more of these you leave behind. What are they?",
    answer: "Footprints.",
    explanation: "Each step can leave a new impression, even as you move away.",
  },
  {
    id: "riddle-piano",
    kind: "riddle",
    title: "The wrong kind of keys",
    prompt:
      "I have many keys, but none of them opens a lock. Play me instead. What am I?",
    answer: "A piano.",
    explanation:
      "A piano’s keys operate its musical mechanism rather than a lock.",
  },
  {
    id: "riddle-towel",
    kind: "riddle",
    title: "A drying paradox",
    prompt: "What gets wetter as it dries you?",
    answer: "A towel.",
    explanation:
      "It dries your skin by absorbing the water, becoming wetter itself.",
  },
  {
    id: "riddle-hole",
    kind: "riddle",
    title: "Less is more",
    prompt: "What gets bigger the more material you take away from it?",
    answer: "A hole.",
    explanation:
      "Removing more of the surrounding material enlarges the empty space.",
  },
  {
    id: "riddle-name",
    kind: "riddle",
    title: "Yours, but shared",
    prompt:
      "What belongs to you, but other people usually say it more often than you do?",
    answer: "Your name.",
    explanation: "Other people use your name to address or talk about you.",
  },
  {
    id: "riddle-silence",
    kind: "riddle",
    title: "Don’t say it",
    prompt: "What do you break simply by speaking?",
    answer: "Silence.",
    explanation: "Speaking introduces sound into a silent moment.",
  },
  {
    id: "riddle-stamp",
    kind: "riddle",
    title: "A corner of the world",
    prompt:
      "What can travel around the world while stuck in the corner of an envelope?",
    answer: "A postage stamp.",
    explanation: "The envelope travels, taking the stamp along for the ride.",
  },
  {
    id: "riddle-needle",
    kind: "riddle",
    title: "An eye that can’t see",
    prompt:
      "I have one eye, cannot see, and help mend your clothes. What am I?",
    answer: "A sewing needle.",
    explanation:
      "The needle’s eye is the opening through which you pass the thread.",
  },
  {
    id: "riddle-echo",
    kind: "riddle",
    title: "The second voice",
    prompt:
      "Shout in the right place and I answer, though I have no mouth. What am I?",
    answer: "An echo.",
    explanation: "Your sound reflects off a surface and returns to you.",
  },
  {
    id: "quiz-race",
    kind: "quiz",
    title: "An unexpected overtake",
    prompt: "You pass the runner in second place. What place are you in now?",
    options: ["First", "Second", "Third"],
    answerIndex: 1,
    explanation:
      "You take the second-place runner’s position. The leader is still ahead.",
  },
  {
    id: "quiz-machines",
    kind: "quiz",
    title: "Small factory, big question",
    prompt:
      "Five identical machines make five parts in five minutes. How long do 100 machines take to make 100 parts at the same rate?",
    options: ["5 minutes", "20 minutes", "100 minutes"],
    answerIndex: 0,
    explanation:
      "Each machine makes one part in five minutes. Working together, 100 machines make 100 parts in five minutes.",
  },
  {
    id: "quiz-socks",
    kind: "quiz",
    title: "A drawer in the dark",
    prompt:
      "A drawer contains only black socks and white socks, many of each. How many must you take to guarantee a same-color pair?",
    options: ["2", "3", "4"],
    answerIndex: 1,
    explanation:
      "The first two could differ. The third must match one of those two colors.",
  },
  {
    id: "quiz-months",
    kind: "quiz",
    title: "Check your calendar",
    prompt: "How many months have at least 28 days?",
    options: ["1", "11", "12"],
    answerIndex: 2,
    explanation:
      "Every month has 28 days or more. February is simply the shortest.",
  },
  {
    id: "quiz-bat",
    kind: "quiz",
    title: "The ten-cent trap",
    prompt:
      "A bat and a ball cost $1.10 together. The bat costs $1 more than the ball. What does the ball cost?",
    options: ["5 cents", "10 cents", "15 cents"],
    answerIndex: 0,
    explanation:
      "A 5-cent ball plus a $1.05 bat totals $1.10, with exactly $1 between the prices.",
  },
  {
    id: "quiz-lilies",
    kind: "quiz",
    title: "One day makes a difference",
    prompt:
      "A patch of lilies doubles in area every day and covers a pond on day 48. On which day was the pond half covered?",
    options: ["Day 24", "Day 47", "Day 46"],
    answerIndex: 1,
    explanation:
      "One doubling takes the patch from half-covered to fully covered, so it was half covered the day before.",
  },
  {
    id: "quiz-weight",
    kind: "quiz",
    title: "Heavy thinking",
    prompt:
      "Which has more mass: one kilogram of feathers or one kilogram of steel?",
    options: ["Feathers", "Steel", "They have the same mass"],
    answerIndex: 2,
    explanation:
      "Both have a mass of one kilogram. The feathers occupy much more space.",
  },
  {
    id: "quiz-coin",
    kind: "quiz",
    title: "Is the coin due?",
    prompt:
      "A fair coin lands heads five times in a row. What is the chance of heads on the next independent toss?",
    options: ["Less than 50%", "Exactly 50%", "More than 50%"],
    answerIndex: 1,
    explanation:
      "Independent tosses do not remember earlier results. A fair coin still has a 50% chance of heads.",
  },
  {
    id: "quiz-corners",
    kind: "quiz",
    title: "Cutting corners",
    prompt:
      "Cut one corner off a square with a straight cut crossing the two adjacent sides, away from the other corners. How many corners remain?",
    options: ["3", "4", "5"],
    answerIndex: 2,
    explanation:
      "You remove one original corner but create two new ones: 4 − 1 + 2 = 5.",
  },
  {
    id: "quiz-handshakes",
    kind: "quiz",
    title: "A very small party",
    prompt:
      "Four people each shake hands with every other person exactly once. How many handshakes happen?",
    options: ["4", "6", "12"],
    answerIndex: 1,
    explanation:
      "There are six distinct pairs. Counting three handshakes per person counts each pair twice, so 4 × 3 ÷ 2 = 6.",
  },
  {
    id: "fact-venus",
    kind: "fact",
    title: "A very slow spin",
    prompt: "Venus takes longer to rotate once than to orbit the Sun.",
    explanation:
      "One rotation takes about 243 Earth days; one orbit takes about 225. This compares its rotation period, not the time between sunrises.",
    source: {
      label: "NASA · Venus facts",
      url: "https://science.nasa.gov/venus/facts/",
    },
  },
  {
    id: "fact-octopus",
    kind: "fact",
    title: "Three hearts, one octopus",
    prompt: "An octopus has three hearts.",
    explanation:
      "Two pump blood through the gills. The third sends it around the rest of the body.",
    source: {
      label: "Smithsonian Ocean · Octopuses",
      url: "https://ocean.si.edu/ocean-life/invertebrates/octopuses",
    },
  },
  {
    id: "fact-sunlight",
    kind: "fact",
    title: "You’re looking into the past",
    prompt: "Sunlight takes about eight minutes to reach Earth.",
    explanation:
      "Light travels at a finite speed. At Earth’s average distance, the journey from the Sun takes about 8 minutes and 20 seconds.",
    source: {
      label: "NASA · Sun facts",
      url: "https://science.nasa.gov/sun/facts/",
    },
  },
  {
    id: "fact-moon",
    kind: "fact",
    title: "A slow goodbye",
    prompt:
      "The Moon is moving away from Earth by about 3.8 centimeters per year.",
    explanation:
      "Laser measurements using lunar reflectors track this gradual change, driven by tidal interactions.",
    source: {
      label: "NASA · Moon facts",
      url: "https://science.nasa.gov/moon/facts/",
    },
  },
  {
    id: "fact-sharks",
    kind: "fact",
    title: "Older than the forest",
    prompt: "The shark lineage is older than the first trees.",
    explanation:
      "Shark ancestors date back more than 400 million years. The first tree-like forests appeared later; today’s shark species are not that old.",
    source: {
      label: "Natural History Museum · Shark evolution",
      url: "https://www.nhm.ac.uk/discover/shark-evolution-a-450-million-year-timeline.html",
    },
  },
  {
    id: "fact-antarctica",
    kind: "fact",
    title: "The desert with an ice sheet",
    prompt:
      "Antarctica is a desert—even though it holds enormous amounts of ice.",
    explanation:
      "Deserts are defined by very low precipitation, not by heat or sand. Much of Antarctica receives very little precipitation each year.",
    source: {
      label: "British Antarctic Survey · Weather",
      url: "https://www.bas.ac.uk/about/antarctica/geography/weather/",
    },
  },
  {
    id: "fact-saturn",
    kind: "fact",
    title: "A surprisingly light giant",
    prompt: "Saturn’s average density is lower than water’s.",
    explanation:
      "It is mostly hydrogen and helium. The familiar ‘floating planet’ comparison describes density, not a physically realistic experiment.",
    source: {
      label: "NASA · Saturn facts",
      url: "https://science.nasa.gov/saturn/facts/",
    },
  },
  {
    id: "fact-day",
    kind: "fact",
    title: "Earth’s sneaky extra turn",
    prompt:
      "Earth rotates once relative to distant stars in about 23 hours and 56 minutes.",
    explanation:
      "A solar day is about 24 hours because Earth also moves along its orbit and must turn a little farther for the Sun to return to the same position.",
    source: {
      label: "NASA · Earth facts",
      url: "https://science.nasa.gov/earth/facts/",
    },
  },
  {
    id: "fact-iss",
    kind: "fact",
    title: "Sixteen sunrises",
    prompt:
      "Astronauts on the International Space Station can see about 16 sunrises a day.",
    explanation:
      "The station circles Earth roughly every 90 minutes, repeatedly moving between daylight and darkness.",
    source: {
      label: "NASA · Station facts",
      url: "https://www.nasa.gov/international-space-station/space-station-facts-and-figures/",
    },
  },
  {
    id: "fact-mars",
    kind: "fact",
    title: "A mountain on another scale",
    prompt: "Mars has a volcano about three times the height of Mount Everest.",
    explanation:
      "Olympus Mons is a vast shield volcano. Its measured height depends on the reference level, so the comparison is approximate.",
    source: {
      label: "NASA · Mars facts",
      url: "https://science.nasa.gov/mars/facts/",
    },
  },
];

export const getCard = (id: string | null | undefined) =>
  cards.find((card) => card.id === id);
export function dailyCard(date = new Date()): CuriosityCard {
  return cards[Math.floor(date.getTime() / 86_400_000) % cards.length];
}
export function nextCard(seen: readonly string[], random = Math.random) {
  const remaining = cards.filter((card) => !seen.includes(card.id));
  const pool = remaining.length
    ? remaining
    : cards.filter((card) => card.id !== seen[seen.length - 1]);
  const card =
    pool[
      Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))
    ];
  return { card, seen: [...(remaining.length ? seen : []), card.id] };
}
export const cardUrl = (origin: string, id: string) =>
  `${origin}/?card=${encodeURIComponent(id)}`;
