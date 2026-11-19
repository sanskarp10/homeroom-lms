/**
 * Demo catalog. Lesson shorthand:
 *   ['v', title, notes]            video lesson (uses a generated sample clip)
 *   ['a', title, markdown]         article lesson
 *   ['q', title, [questions]]      quiz; question = [prompt, options, correct, explanation]
 *                                  correct is an index, or an array of indexes for multiple-answer questions
 */
export const PASSWORD = 'homeroom123';

export const USERS = [
  { key: 'admin', name: 'Priya Raman', email: 'admin@homeroom.test', role: 'admin', headline: 'Homeroom administrator' },
  { key: 'maya', name: 'Maya Okafor', email: 'maya@homeroom.test', role: 'instructor', headline: 'Full-stack engineer, ten years of shipping web apps',
    bio: 'Maya has built checkout flows, dashboards and developer tools for teams of three and teams of three hundred. She teaches the way she wishes she had been taught: small working examples first, theory once it has something to attach to.' },
  { key: 'daniel', name: 'Daniel Reyes', email: 'daniel@homeroom.test', role: 'instructor', headline: 'Data analyst who used to teach high-school maths',
    bio: 'Daniel spent six years in a classroom before moving into analytics. He still believes any idea can be explained with a good picture and one honest example.' },
  { key: 'ingrid', name: 'Ingrid Solberg', email: 'ingrid@homeroom.test', role: 'instructor', headline: 'Product designer and portrait photographer',
    bio: 'Ingrid designs interfaces during the week and photographs people at the weekend. Both, she says, are mostly about deciding what to leave out.' },
  { key: 'kenji', name: 'Kenji Watanabe', email: 'kenji@homeroom.test', role: 'instructor', headline: 'Session guitarist, raised between Osaka and Leeds',
    bio: 'Kenji has played on other people’s records for fifteen years and taught beginners for nearly as long.' },
  { key: 'sam', name: 'Sam Carter', email: 'sam@homeroom.test', role: 'student', headline: 'Learning to build for the web' },
];

const tf = ['True', 'False'];

export const COURSES = [
  {
    key: 'react', instructor: 'maya', title: 'React from first principles', category: 'Web Development', level: 'beginner', price: 4900, popularity: 26,
    subtitle: 'Components, state and effects, explained by building a real interface one piece at a time.',
    description: 'Most React tutorials hand you a finished app and ask you to type along. This course goes the other way. You start with a single function that returns markup and add one idea at a time: props, state, lists, effects, then data from a server. Each idea arrives when the app you are building needs it, so you always know why it exists.\n\nBy the end you will have built a small course catalog with search, filters and saved favourites, and you will be able to read the React documentation without getting lost.',
    outcomes: ['Explain what a component is and when it re-renders', 'Manage state with useState and derive the rest', 'Fetch data and handle loading and failure', 'Split an interface into components that are easy to change'],
    sections: [
      { title: 'Thinking in components', lessons: [
        ['v', 'What React actually does', 'A component is a function from data to markup. React calls it again when the data changes.', true],
        ['a', 'JSX is just function calls', '## JSX is shorthand\n\nWhen you write `<Card title="Hello" />`, the compiler turns it into a plain function call that returns an object describing the element. Nothing touches the page yet.\n\nThat is why JSX has a few rules that look odd at first:\n\n- **One parent element.** A function returns one value, so a component returns one root element (or a fragment).\n- **`className`, not `class`.** JSX is JavaScript, and `class` is a reserved word.\n- **Curly braces mean "JavaScript goes here".** Anything inside `{}` is an expression that produces a value.\n\nOnce you see JSX as data, conditional rendering stops being special syntax. It is an ordinary expression: `{isOpen && <Menu />}`.'],
        ['v', 'Props: passing data down', 'Props are the arguments of a component. They flow one way: from parent to child.'],
        ['q', 'Check your understanding: components', [
          ['What does a React component return?', ['A description of what the UI should look like', 'A DOM node it created itself', 'An HTML string', 'Nothing; it draws directly to the screen'], 0, 'Components return elements, which are plain objects describing the UI. React turns them into DOM updates.'],
          ['Props can be changed by the component that receives them.', tf, 1, 'Props are read-only. To change what is shown, the parent passes new props or the component uses state.'],
          ['Which of these are valid in JSX?', ['{user.name}', 'class="title"', '{items.length > 0 && <List />}', 'Two sibling elements with no parent'], [0, 2], 'Expressions in braces are fine. Use className instead of class, and wrap siblings in one parent or a fragment.'],
        ]],
      ] },
      { title: 'State and events', lessons: [
        ['v', 'useState and the render cycle', 'Setting state asks React to call your component again with the new value.'],
        ['a', 'Derive, do not duplicate', '## Keep one source of truth\n\nA common early mistake is storing something in state that could be calculated. If you hold `items` and also `itemCount`, you now have two values that must be kept in step, and one day they will not be.\n\nAsk of every piece of state:\n\n1. Does it change over time?\n2. Can it be worked out from props or other state?\n\nIf the answer to the second question is yes, **calculate it during render** instead:\n\n```\nconst visible = items.filter(matchesSearch);\n```\n\nThe component is shorter and the bug cannot happen.'],
        ['v', 'Lists, keys and controlled inputs', 'Keys tell React which item is which between renders. Use a stable id, not the array index.'],
      ] },
      { title: 'Talking to a server', lessons: [
        ['v', 'Effects and fetching data', 'An effect synchronises your component with something outside React, such as a network request.'],
        ['a', 'Three states every request has', '## Loading, failed, done\n\nEvery request is in one of three states, and your interface should have an answer for each:\n\n- **Loading** - show the shape of what is coming (a skeleton), not a spinner in the middle of nowhere.\n- **Failed** - say what went wrong and offer a way to try again.\n- **Done** - including the case where the answer is an empty list.\n\nModel these explicitly. A single `status` value is easier to reason about than three separate booleans that can contradict each other.'],
        ['q', 'Final quiz: state and effects', [
          ['When does React re-render a component?', ['When its state or props change', 'Every 16 milliseconds', 'Only when you call render()', 'When any variable in the file changes'], 0, 'A state update or new props from the parent triggers a re-render.'],
          ['You have a list of products and a search box. What should be in state?', ['The search text only; the filtered list is derived', 'Both the search text and the filtered list', 'Only the filtered list', 'Neither'], 0, 'The filtered list can be calculated from the products and the search text, so it does not belong in state.'],
          ['Why should list keys be stable ids rather than array indexes?', ['Indexes change when items are added, removed or reordered', 'Indexes are slower to compare', 'React does not accept numbers as keys', 'Keys must be strings'], 0, 'If the key follows the position instead of the item, React can attach state to the wrong row.'],
          ['An effect with an empty dependency array runs after every render.', tf, 1, 'It runs once after the first render (and its cleanup runs when the component is removed).'],
        ]],
      ] },
    ],
  },
  {
    key: 'node', instructor: 'maya', title: 'Node.js APIs that survive production', category: 'Web Development', level: 'intermediate', price: 6900, popularity: 17,
    subtitle: 'Validation, errors, queues and the boring details that keep an API up at three in the morning.',
    description: 'Getting an Express route to return JSON takes five minutes. Keeping that route healthy for a year takes a different set of habits. This course is about those habits: validating input at the edge, failing loudly and usefully, moving slow work to a queue, and knowing what your service is doing without attaching a debugger.\n\nYou will harden a small API step by step and finish with a checklist you can apply to any service you inherit.',
    outcomes: ['Validate every request at the boundary', 'Design error responses clients can act on', 'Move slow work into background jobs', 'Add health checks and structured logs'],
    sections: [
      { title: 'The edge of your service', lessons: [
        ['v', 'Never trust the request body', 'Validate once, at the boundary, and work with typed data everywhere else.', true],
        ['a', 'Errors are part of the API', '## Design the failure, too\n\nClients read your error responses more carefully than your success responses, because that is when they are stuck.\n\nA useful error has:\n\n- the **right status code** (400 for the caller’s mistake, 500 for yours),\n- a **message a person can act on**, and\n- for validation, **which field** was wrong.\n\nRoute every failure through one error handler so the shape never varies.'],
        ['q', 'Quiz: boundaries', [
          ['Which status code fits a request with a missing required field?', ['400', '401', '404', '500'], 0, '400 says the request itself was wrong. 401 is about identity, 404 about a missing resource.'],
          ['Validation belongs deep in the database layer so no route can skip it.', tf, 1, 'Validate at the edge so the rest of the code can trust its input. Database constraints are a second line of defence, not the first.'],
        ]],
      ] },
      { title: 'Work that takes a while', lessons: [
        ['v', 'Why queues exist', 'A request should finish in milliseconds. Anything slower becomes a job.'],
        ['v', 'Retries, backoff and idempotency', 'A job may run twice. Write it so the second run does no harm.'],
        ['a', 'A production readiness checklist', '## Before you ship\n\n1. Every route validates its input.\n2. Every failure goes through one error handler.\n3. Slow work runs in a queue with retries.\n4. A health endpoint reports each dependency.\n5. Logs say what happened, to which request, and how long it took.\n6. Secrets come from the environment, never from the repository.\n\nNone of this is glamorous. All of it is what you will be glad of later.'],
      ] },
    ],
  },
  {
    key: 'git', instructor: 'maya', title: 'Git without fear', category: 'Web Development', level: 'beginner', price: 0, popularity: 40,
    subtitle: 'A short, free course on the handful of Git ideas that make everything else make sense.',
    description: 'Git feels dangerous when you treat it as a set of incantations. It becomes calm once you know three things: what a commit is, what a branch is, and where your work lives at each moment. This free course teaches exactly those three things, with plenty of pictures.',
    outcomes: ['Describe what a commit and a branch really are', 'Undo mistakes without losing work', 'Resolve a merge conflict calmly'],
    sections: [
      { title: 'The mental model', lessons: [
        ['v', 'Commits are snapshots', 'Each commit stores the whole project as it was, plus a pointer to the commit before it.', true],
        ['a', 'A branch is a sticky note', '## Branches are cheap\n\nA branch is not a copy of your project. It is a **label that points at one commit**. Making a commit moves the label forward.\n\nThat is why creating a branch is instant, and why deleting a merged branch loses nothing: the commits are still there, reachable from wherever they were merged.'],
        ['v', 'Undoing things safely', 'Restore, revert and reset each undo a different thing. Pick by asking what you want to keep.'],
        ['q', 'Quiz: do you trust Git yet?', [
          ['What is a branch?', ['A movable pointer to a commit', 'A full copy of the repository', 'A folder on disk', 'A list of changed files'], 0, 'A branch is a named pointer. That is all.'],
          ['Deleting a branch that has been merged deletes its commits.', tf, 1, 'The commits remain reachable from the branch they were merged into.'],
          ['Which command undoes a commit that is already shared, without rewriting history?', ['git revert', 'git reset --hard', 'git checkout', 'git clean'], 0, 'Revert adds a new commit that reverses the old one, so nobody’s history is rewritten.'],
        ]],
      ] },
    ],
  },
  {
    key: 'stats', instructor: 'daniel', title: 'Statistics you will actually use', category: 'Data Science', level: 'beginner', price: 3900, popularity: 22,
    subtitle: 'Averages, spread, sampling and uncertainty, taught with pictures before formulas.',
    description: 'You do not need a mathematics degree to read a chart honestly. You need a few sturdy ideas: what an average hides, how much results wobble by chance, and what a confidence interval is really claiming. This course builds those ideas from everyday examples and only then shows the formula, so the formula reads like a summary of something you already understand.',
    outcomes: ['Choose between mean and median and say why', 'Read and explain a confidence interval', 'Spot the most common ways a chart misleads'],
    sections: [
      { title: 'Describing data', lessons: [
        ['v', 'What an average hides', 'Two very different groups can share the same mean. Always look at the spread.', true],
        ['a', 'Mean, median and when each lies', '## Pick the centre that matches the question\n\nThe **mean** uses every value, so one extreme value drags it. The **median** is the middle value and ignores how far the extremes sit.\n\n- Incomes, house prices, response times: usually skewed, so report the **median**.\n- Heights, test scores, measurement error: usually symmetric, so the **mean** is fine.\n\nWhen the two differ a lot, that difference is itself the story: the data is lopsided.'],
        ['q', 'Quiz: centre and spread', [
          ['Nine people earn 30,000 and one earns 1,000,000. Which describes a typical person best?', ['The median', 'The mean', 'The maximum', 'The range'], 0, 'The mean is 127,000, which describes nobody. The median is 30,000.'],
          ['Standard deviation measures how spread out values are around the mean.', tf, 0, 'It is, roughly, the typical distance of a value from the mean.'],
        ]],
      ] },
      { title: 'Uncertainty', lessons: [
        ['v', 'Samples wobble', 'Ask the same question of a different sample and you get a slightly different answer. That wobble is measurable.'],
        ['v', 'Reading a confidence interval', 'An interval is a range of plausible values for the truth, given the wobble.'],
        ['q', 'Final quiz: uncertainty', [
          ['A poll reports 52% with a margin of error of 3 points. Which statement is fair?', ['Support is plausibly anywhere from 49% to 55%', 'Support is exactly 52%', 'Support is certainly above 50%', 'The poll is wrong by 3%'], 0, 'The interval includes values below 50%, so the lead is not established.'],
          ['What happens to the margin of error when the sample gets four times larger?', ['It roughly halves', 'It becomes four times smaller', 'It does not change', 'It doubles'], 0, 'Uncertainty shrinks with the square root of the sample size.'],
          ['Which of these make a chart misleading?', ['A y-axis that does not start at zero on a bar chart', 'Cherry-picked date ranges', 'Clear axis labels', 'Showing the sample size'], [0, 1], 'Truncated axes exaggerate differences and selective ranges hide the trend.'],
        ]],
      ] },
    ],
  },
  {
    key: 'sql', instructor: 'daniel', title: 'SQL for analysts', category: 'Data Science', level: 'intermediate', price: 5900, popularity: 14,
    subtitle: 'Joins, grouping and window functions for people who answer questions with data.',
    description: 'This course assumes you can write a SELECT and want to go further. It is organised around questions analysts are asked every week, such as “which customers came back?” and “how does this month compare with the same month last year?”, and introduces each SQL feature as the tool that answers one of them.',
    outcomes: ['Join tables without duplicating rows by accident', 'Summarise with GROUP BY and HAVING', 'Rank and compare rows with window functions'],
    sections: [
      { title: 'Combining tables', lessons: [
        ['v', 'Joins and the row-count check', 'Before and after every join, count the rows. A surprise means a duplicate key.', true],
        ['a', 'GROUP BY in one picture', '## Split, apply, combine\n\n`GROUP BY` does three things in order:\n\n1. **Split** the rows into piles that share a value.\n2. **Apply** an aggregate (count, sum, average) to each pile.\n3. **Combine** the results into one row per pile.\n\n`WHERE` filters rows *before* the piles are made. `HAVING` filters the piles *after*.'],
      ] },
      { title: 'Window functions', lessons: [
        ['v', 'Running totals and rankings', 'A window function looks at neighbouring rows without collapsing them.'],
        ['q', 'Quiz: grouping and windows', [
          ['Which clause filters groups after aggregation?', ['HAVING', 'WHERE', 'ORDER BY', 'LIMIT'], 0, 'WHERE runs before grouping; HAVING runs after.'],
          ['A window function reduces the number of rows returned.', tf, 1, 'Unlike GROUP BY, a window function keeps every row and adds a calculated column.'],
          ['After joining orders to customers your row count doubled. What is the likeliest cause?', ['The join key is not unique in one table', 'The database is slow', 'You used an INNER JOIN', 'A missing ORDER BY'], 0, 'Duplicate keys multiply rows. Check uniqueness before joining.'],
        ]],
      ] },
    ],
  },
  {
    key: 'pricing', instructor: 'daniel', title: 'Pricing your freelance work', category: 'Business', level: 'beginner', price: 2900, popularity: 9,
    subtitle: 'Work out a rate you can live on and learn to say it out loud.',
    description: 'Most freelancers set their first rate by guessing, then spend a year resenting it. This short course replaces the guess with arithmetic: what you need to earn, how many hours you can really bill, and what that implies. Then it covers the harder part, which is quoting the number without apologising.',
    outcomes: ['Calculate a minimum viable day rate', 'Quote by project instead of by hour', 'Handle “can you do it cheaper?”'],
    sections: [
      { title: 'The arithmetic', lessons: [
        ['v', 'Your real billable hours', 'Holidays, admin, sales and sick days come out first. What remains is smaller than you think.', true],
        ['a', 'From salary target to day rate', '## A rate in four lines\n\n1. Start with the take-home pay you need for the year.\n2. Add tax, pension, insurance, equipment and software.\n3. Divide by the days you can actually bill (often 140 to 180, not 260).\n4. Add a margin for the months that go quiet.\n\nThe result is your floor. Anything below it means working at a loss.'],
        ['q', 'Quiz: your floor', [
          ['Why is 260 working days a poor basis for a day rate?', ['Much of the year goes on unbilled work and time off', 'Clients only pay for 200 days', 'It is illegal to bill more than 220 days', 'Weekends are included'], 0, 'Sales, admin, holidays and gaps between projects are real and unpaid.'],
          ['Quoting per project ties your income to the value delivered rather than hours spent.', tf, 0, 'It also rewards you, not the client, for getting faster.'],
        ]],
      ] },
    ],
  },
  {
    key: 'ui', instructor: 'ingrid', title: 'Interface design fundamentals', category: 'Design', level: 'beginner', price: 4500, popularity: 19,
    subtitle: 'Hierarchy, spacing, type and colour: the decisions behind screens that feel obvious.',
    description: 'Good interfaces are rarely clever. They are clear about what matters most, consistent about how things are spaced, and sparing with colour. This course teaches those decisions as a repeatable process, using before-and-after examples of real screens, so you can improve a layout even if you do not think of yourself as a designer.',
    outcomes: ['Establish visual hierarchy with size, weight and space', 'Build and apply a spacing scale', 'Choose a restrained colour palette that still has character'],
    sections: [
      { title: 'Hierarchy', lessons: [
        ['v', 'One thing must win', 'If everything is emphasised, nothing is. Decide the single most important element on each screen.', true],
        ['a', 'Space before lines', '## Group with distance, not borders\n\nThings that are close together read as related. Use that before you reach for a box or a divider.\n\n- Put **less** space inside a group than between groups.\n- Pick spacing values from a **scale** (4, 8, 12, 16, 24, 32, 48) so gaps are deliberate.\n- Remove a border and see whether the layout still holds. If it does, it never needed one.'],
        ['v', 'Type that does the work', 'Two sizes and two weights cover most interfaces. Add more only when you can say what each one means.'],
      ] },
      { title: 'Colour', lessons: [
        ['v', 'A palette with a job for every colour', 'Neutral for most things, one accent for actions, and reserved colours for success and danger.'],
        ['q', 'Final quiz: design decisions', [
          ['What is the most reliable way to show two items belong together?', ['Place them closer to each other than to anything else', 'Give them the same colour', 'Put a border around each', 'Make them the same size'], 0, 'Proximity is the strongest grouping signal.'],
          ['Using an accent colour on many elements makes each of them stand out more.', tf, 1, 'An accent works because it is rare. Spread it everywhere and it becomes background.'],
          ['Which of these help establish hierarchy?', ['Size', 'Weight', 'Surrounding space', 'Using five typefaces'], [0, 1, 2], 'Size, weight and space all signal importance. More typefaces only add noise.'],
        ]],
      ] },
    ],
  },
  {
    key: 'portraits', instructor: 'ingrid', title: 'Natural light portraits', category: 'Photography', level: 'intermediate', price: 3500, popularity: 8,
    subtitle: 'Find good light in ordinary rooms and place people in it.',
    description: 'You do not need flashes or a studio to make a flattering portrait. You need a window, a wall, and the habit of noticing where the light falls. This course is a set of practical exercises you can do at home with any camera, including a phone.',
    outcomes: ['Read the direction and softness of light', 'Position a subject relative to a window', 'Use a wall or a sheet as a reflector'],
    sections: [
      { title: 'Seeing light', lessons: [
        ['v', 'The window is your softbox', 'The bigger and closer the light source, the softer the shadows.', true],
        ['a', 'Three positions to try first', '## Start here\n\n- **Side on to the window.** Light from one side gives shape to a face. Turn the subject until the far cheek has a small triangle of light.\n- **Facing the window.** Flat, even and forgiving. Good for a first frame.\n- **Back to the window.** A bright rim around the hair. Expose for the face and let the background go bright.\n\nMove your feet before you touch a setting.'],
        ['q', 'Quiz: light', [
          ['What makes light softer?', ['A larger light source, closer to the subject', 'A smaller, more distant source', 'A faster shutter speed', 'A higher ISO'], 0, 'Relative size is what softens the edge of a shadow.'],
          ['A white wall opposite the window can act as a reflector.', tf, 0, 'It bounces light back into the shadows and lowers contrast.'],
        ]],
      ] },
    ],
  },
  {
    key: 'guitar', instructor: 'kenji', title: 'Fingerstyle guitar for beginners', category: 'Music', level: 'beginner', price: 2500, popularity: 12,
    subtitle: 'Your thumb keeps time, your fingers carry the tune. Start with one pattern and build.',
    description: 'Fingerstyle sounds like two guitars because your hand is doing two jobs. This course separates the jobs, trains each slowly, and then puts them back together. You will need an acoustic guitar and ten minutes a day.',
    outcomes: ['Keep a steady alternating bass with the thumb', 'Add a melody on top without losing time', 'Play three complete arrangements'],
    sections: [
      { title: 'The steady thumb', lessons: [
        ['v', 'Hand position and the alternating bass', 'Rest the wrist lightly. The thumb moves from the joint nearest the palm.', true],
        ['v', 'Adding the fingers', 'Index, middle and ring each own one string. Keep them close.'],
        ['a', 'A ten-minute practice plan', '## Short and daily beats long and rare\n\n- **Minutes 1 to 3:** thumb alone, with a metronome, slower than feels necessary.\n- **Minutes 4 to 7:** add one finger on the beat.\n- **Minutes 8 to 10:** play the piece you are learning, start to finish, without stopping for mistakes.\n\nSpeed is a result of accuracy. It is never a goal.'],
        ['q', 'Quiz: technique', [
          ['In fingerstyle, what is the thumb mainly responsible for?', ['The bass notes that keep time', 'The melody', 'Muting the strings', 'Bending notes'], 0, 'The thumb plays a steady bass while the fingers handle the melody.'],
          ['Practising slowly with a metronome builds speed faster than practising fast.', tf, 0, 'Accuracy first. Speed follows.'],
        ]],
      ] },
    ],
  },
  {
    key: 'japanese', instructor: 'kenji', title: 'Japanese for travellers', category: 'Languages', level: 'beginner', price: 0, popularity: 30,
    subtitle: 'Enough Japanese to order, ask the way and be polite. Free.',
    description: 'A week before your trip is enough time to learn the sentences that matter: greetings, ordering food, asking where something is, and thanking people properly. This free course teaches set phrases you can use straight away and the small pieces of grammar that let you adapt them.',
    outcomes: ['Greet people and thank them appropriately', 'Order food and ask for the bill', 'Ask for directions and understand the answer'],
    sections: [
      { title: 'Survival phrases', lessons: [
        ['v', 'Greetings through the day', 'Ohayou gozaimasu, konnichiwa, konbanwa: morning, daytime, evening.', true],
        ['a', 'The one word that fixes everything', '## Sumimasen\n\n**Sumimasen** means “excuse me”, “sorry” and “thank you for the trouble”, depending on the moment. Use it to:\n\n- get a waiter’s attention,\n- squeeze past someone on a train,\n- apologise for a small mistake.\n\nPair it with **onegaishimasu** (“please”) and you can ask for almost anything by pointing: *Kore, onegaishimasu.* “This one, please.”'],
        ['q', 'Quiz: phrases', [
          ['Which greeting is used in the morning?', ['Ohayou gozaimasu', 'Konbanwa', 'Oyasuminasai', 'Sayounara'], 0, 'Konbanwa is for the evening; oyasuminasai is “good night”.'],
          ['“Sumimasen” can be used both to apologise and to get someone’s attention.', tf, 0, 'It is the most useful single word you can learn.'],
        ]],
      ] },
    ],
  },
  {
    key: 'focus', instructor: 'ingrid', title: 'Protect your attention', category: 'Personal Growth', level: 'beginner', price: 1900, popularity: 6,
    subtitle: 'A practical two-week reset for people whose day is eaten by notifications.',
    description: 'This is not a course about willpower. It is about arranging your tools and your day so that concentrating is the easy option. Each lesson ends with one small change to make before the next.',
    outcomes: ['Audit where your attention goes', 'Design a default day with protected blocks', 'Set up devices so they interrupt you less'],
    sections: [
      { title: 'Week one', lessons: [
        ['v', 'Where the day actually goes', 'Track one ordinary day before changing anything.', true],
        ['a', 'Make the right thing the easy thing', '## Change the room, not yourself\n\nEvery habit has a trigger. Remove the trigger and the habit weakens without a fight.\n\n- Phone charges **outside** the room you work in.\n- Notifications **off by default**, on only for people.\n- The first hour of the day has **no inbox**.\n\nNone of these need discipline once they are set up.'],
        ['q', 'Quiz: attention', [
          ['What is the first step before changing your habits?', ['Observe how you currently spend a day', 'Delete every app', 'Buy a planner', 'Wake up at 5am'], 0, 'You cannot improve what you have not measured.'],
        ]],
      ] },
    ],
  },
  {
    key: 'ts', instructor: 'maya', title: 'TypeScript for React developers', category: 'Web Development', level: 'intermediate', price: 5500, popularity: 0, draft: true,
    subtitle: 'Types for props, hooks and API data without fighting the compiler.',
    description: 'A draft in progress. Lessons are being recorded.',
    outcomes: ['Type component props and events'],
    sections: [
      { title: 'Getting started', lessons: [
        ['a', 'Why bother with types?', '## Catch it before the browser does\n\nTypes turn a class of runtime errors into red squiggles in your editor.'],
      ] },
    ],
  },
];

export const LIVE = [
  { course: 'react', title: 'Office hours: your hooks questions', description: 'Bring a component that confuses you and we will take it apart together.', inHours: 2, duration: 45 },
  { course: 'node', title: 'Live code review', description: 'Maya reviews two student APIs line by line.', inHours: 26, duration: 60 },
  { course: 'stats', title: 'Reading confidence intervals, live', description: 'We work through this week’s news charts.', inHours: 49, duration: 50 },
  { course: 'ui', title: 'Critique session: your landing pages', description: 'Submit a screen beforehand to have it reviewed.', inHours: 74, duration: 60 },
  { course: 'sql', title: 'Window functions workshop', description: 'Hands-on: rankings and running totals.', inHours: 121, duration: 75 },
  { course: 'guitar', title: 'Play-along: the alternating bass', description: 'Guitars tuned, metronome at 60.', inHours: 146, duration: 40 },
  { course: 'react', title: 'Kickoff call', description: 'Introductions and how the course works.', inHours: -70, duration: 30, ended: true,
    chat: [['maya', 'Welcome, everyone. Say hello and tell us what you want to build.'], ['sam', 'Hi! I want to rebuild my portfolio in React.'], ['maya', 'Good goal. We will get there by section three.']] },
];

export const FIRST_NAMES = ['Aisha', 'Ben', 'Chloe', 'Dmitri', 'Elena', 'Farid', 'Grace', 'Hugo', 'Imani', 'Jonas', 'Keiko', 'Liam', 'Mina', 'Noah', 'Olu', 'Paula', 'Quinn', 'Rosa', 'Sven', 'Tara', 'Uma', 'Victor', 'Wren', 'Xavier', 'Yara', 'Zoe', 'Arjun', 'Bianca', 'Callum', 'Dalia', 'Emre', 'Freya', 'Gabriel', 'Hana', 'Idris', 'Jade'];
export const LAST_NAMES = ['Adeyemi', 'Baker', 'Costa', 'Dubois', 'Eriksen', 'Fischer', 'Garcia', 'Hussain', 'Ito', 'Jensen', 'Kowalski', 'Lopez', 'Mbeki', 'Nguyen', 'Oyelaran', 'Patel', 'Quigley', 'Rossi', 'Singh', 'Tanaka'];
