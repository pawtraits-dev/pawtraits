// Run: npx tsx scripts/test-title-hygiene.ts
import { cleanTitle, titleIssues, findDuplicateTitles, cleanDescriptionTitle, titleFromDescription } from '../lib/catalogue/title-hygiene';

let failed = 0;
let count = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  count++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log(`ok   ${name}`);
  else { failed++; console.log(`FAIL ${name}\n     expected ${e}\n     got      ${a}`); }
}

const breeds = ['Golden Retriever', 'Spaniel', 'Shih Tzu', 'Yorkshire Terrier', 'Cockerpoo', 'Pug', 'Cat'];

// cleanTitle
eq('heading marker', cleanTitle('# The Intellectual Void'), 'The Intellectual Void');
eq('double heading marker', cleanTitle('## The Intellectual Void'), 'The Intellectual Void');
eq('bold wrapper', cleanTitle('**Bold Title**'), 'Bold Title');
eq('heading + bold', cleanTitle('# **Bold Title**'), 'Bold Title');
eq('double quotes', cleanTitle('"Quoted Title"'), 'Quoted Title');
eq('backticks', cleanTitle('`Code Title`'), 'Code Title');
eq('blockquote', cleanTitle('> Quoted'), 'Quoted');
eq('list dash', cleanTitle('- Item Title'), 'Item Title');
eq('whitespace collapse', cleanTitle('  The   Cream \t of the   Crop  '), 'The Cream of the Crop');
eq('trailing full stop', cleanTitle('A Quiet Day.'), 'A Quiet Day');
eq('normal title unchanged', cleanTitle("The Cream of the Crop"), "The Cream of the Crop");
eq('apostrophe unchanged', cleanTitle("The Labrador's Professional Food Quality Assessment"), "The Labrador's Professional Food Quality Assessment");
eq('colon and brackets unchanged', cleanTitle('Chelsea: Blue Is the Colour (Away Kit)'), 'Chelsea: Blue Is the Colour (Away Kit)');
eq('ellipsis kept', cleanTitle('Wait for it...'), 'Wait for it...');
eq('idempotent', cleanTitle(cleanTitle('# **Hi there.**')), 'Hi there');

// titleIssues
const t1 = "The Golden Retriever's Contemplative Moment";
eq('mismatch: golden title on spaniel', titleIssues({ title: t1, breedName: 'Spaniel', allBreedNames: breeds }), ['breed_mismatch']);
eq('no issue when breed matches', titleIssues({ title: t1, breedName: 'Golden Retriever', allBreedNames: breeds }), []);
eq('mismatch: shih tzu on yorkie', titleIssues({ title: "The Shih Tzu's Reluctant Glamour Shot", breedName: 'Yorkshire Terrier', allBreedNames: breeds }), ['breed_mismatch']);
eq('cockapoo vs cockerpoo: no mismatch', titleIssues({ title: 'The Cockapoo Who Knew Too Much', breedName: 'Cockerpoo', allBreedNames: breeds }), []);
eq('cockapoo flagged if it is a breed', titleIssues({ title: 'The Cockapoo Who Knew Too Much', breedName: 'Cockerpoo', allBreedNames: [...breeds, 'Cockapoo'] }), ['breed_mismatch']);
eq('plural form matches', titleIssues({ title: 'Three Spaniels at Dawn', breedName: 'Pug', allBreedNames: breeds }), ['breed_mismatch']);
eq('whole word only', titleIssues({ title: 'Pugnacious Pose', breedName: 'Spaniel', allBreedNames: breeds }), []);
eq('short breed names ignored', titleIssues({ title: 'Cat Burglar Nights', breedName: 'Spaniel', allBreedNames: breeds }), []);
eq('title naming own and other breed is fine', titleIssues({ title: 'Spaniel Meets Shih Tzu', breedName: 'Spaniel', allBreedNames: breeds }), []);
eq('case insensitive', titleIssues({ title: 'THE SHIH TZU STRIKES', breedName: 'Spaniel', allBreedNames: breeds }), ['breed_mismatch']);
eq('markdown flagged', titleIssues({ title: '# The Intellectual Void', breedName: 'Pug', allBreedNames: breeds }), ['markdown']);
eq('empty flagged', titleIssues({ title: '   ', breedName: 'Pug', allBreedNames: breeds }), ['empty']);
eq('no breed name: no mismatch', titleIssues({ title: t1, breedName: null, allBreedNames: breeds }), []);

// findDuplicateTitles
const dupes = findDuplicateTitles([
  { id: 'a', title: 'The Cream of the Crop' },
  { id: 'b', title: '# the cream of the crop' },
  { id: 'c', title: '**The Cream of the Crop**' },
  { id: 'd', title: 'Unique' },
  { id: 'e', title: '' },
  { id: 'f', title: '' },
]);
eq('duplicate groups', Array.from(dupes.entries()), [['the cream of the crop', ['a', 'b', 'c']]]);

// description helpers
eq('description: heading removed, bold kept', cleanDescriptionTitle('# **The Void**\nBody text.'), '**The Void**\nBody text.');
eq('description: normal untouched', cleanDescriptionTitle('**The Void**\nBody text.'), '**The Void**\nBody text.');
eq('description: body untouched', cleanDescriptionTitle('# The Void\nBody has a full stop.'), 'The Void\nBody has a full stop.');
eq('titleFromDescription strips bold only', titleFromDescription('**The Void**\nBody'), 'The Void');
eq('titleFromDescription keeps heading marker', titleFromDescription('# **The Void**\nBody'), '# **The Void**');

console.log(`\n${count - failed}/${count} passed`);
if (failed) process.exit(1);
