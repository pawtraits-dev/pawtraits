/**
 * Sports team outfit definitions (Collections › Sports). One entry per team: name, nicknames for
 * search, colours (name + hex) and the home kit in a sentence. `teamOutfit()` turns an entry into
 * the prompt text used by the outfit-variation step (lib/gemini-variation-service.ts):
 *   - clothing: the league's full outfit (football kit, NFL jersey, NBA vest, NHL sweater,
 *     college varsity jacket) in the team's colours — for making a new design for that team
 *   - recolour: garment-agnostic ("recolour the sports outfit to …") — for switching an existing
 *     sports design to another team, so any team works in any sports design
 * Kits are described by colour and pattern only: no crests, logos, wordmarks or sponsors (they
 * render badly and are the owners' trademarks).
 * Leagues as of the 2026–27 season. College = the school, not a particular sport.
 */

export type League = 'premier-league' | 'nfl' | 'nba' | 'nhl' | 'college';
export interface TeamColour { name: string; hex: string }
export interface SportsTeam {
  league: League;
  slug: string;
  name: string;          // shown to customers
  short: string;         // "Arsenal", "Chiefs", "Michigan"
  nicknames: string[];   // search: "gunners", "the toon"
  colours: TeamColour[]; // primary first
  kit: string;           // home kit / school look, colours and pattern only
}

export const LEAGUES: Record<League, { name: string; sport: string; garment: string }> = {
  'premier-league': { name: 'Premier League', sport: 'football', garment: 'football (soccer) kit: short-sleeved jersey, shorts and long socks' },
  nfl: { name: 'NFL', sport: 'American football', garment: 'American football uniform: jersey with large shoulder numbers over shoulder pads' },
  nba: { name: 'NBA', sport: 'basketball', garment: 'basketball uniform: sleeveless vest jersey with a large front number and matching shorts' },
  nhl: { name: 'NHL', sport: 'ice hockey', garment: 'ice hockey sweater: loose long-sleeved jersey with hem and sleeve stripes' },
  college: { name: 'College', sport: 'school spirit', garment: 'college varsity letterman jacket with ribbed striped cuffs, collar and waistband' },
};

const c = (name: string, hex: string): TeamColour => ({ name, hex });
const T = (league: League, slug: string, name: string, short: string, nicknames: string[], colours: TeamColour[], kit: string): SportsTeam =>
  ({ league, slug, name, short, nicknames, colours, kit });

const WHITE = c('white', '#FFFFFF'), BLACK = c('black', '#101820');

export const SPORTS_TEAMS: SportsTeam[] = [
  // ───────── Premier League 2026–27 ─────────
  T('premier-league', 'arsenal', 'Arsenal', 'Arsenal', ['gunners', 'the arsenal', 'afc'], [c('red', '#EF0107'), WHITE], 'red jersey with white sleeves and white collar, white shorts, red socks with white tops'),
  T('premier-league', 'aston-villa', 'Aston Villa', 'Villa', ['villans', 'villa', 'avfc'], [c('claret', '#670E36'), c('sky blue', '#95BFE5'), WHITE], 'claret jersey with sky-blue sleeves, white shorts, sky-blue socks'),
  T('premier-league', 'bournemouth', 'AFC Bournemouth', 'Bournemouth', ['cherries', 'afcb'], [c('red', '#DA291C'), BLACK], 'red and black vertical-striped jersey, black shorts, black socks'),
  T('premier-league', 'brentford', 'Brentford', 'Brentford', ['bees'], [c('red', '#E30613'), WHITE, BLACK], 'red and white vertical-striped jersey, black shorts, red socks'),
  T('premier-league', 'brighton', 'Brighton & Hove Albion', 'Brighton', ['seagulls', 'albion', 'bhafc'], [c('blue', '#0057B8'), WHITE], 'blue and white vertical-striped jersey, blue shorts, blue socks'),
  T('premier-league', 'chelsea', 'Chelsea', 'Chelsea', ['blues', 'cfc', 'pensioners'], [c('royal blue', '#034694'), WHITE], 'royal-blue jersey with white trim, royal-blue shorts, white socks'),
  T('premier-league', 'coventry-city', 'Coventry City', 'Coventry', ['sky blues', 'ccfc'], [c('sky blue', '#6CABDD'), WHITE], 'sky-blue jersey with white trim, sky-blue shorts, sky-blue socks'),
  T('premier-league', 'crystal-palace', 'Crystal Palace', 'Palace', ['eagles', 'cpfc'], [c('red', '#C4122E'), c('blue', '#1B458F')], 'red and blue vertical-striped jersey, blue shorts, blue socks'),
  T('premier-league', 'everton', 'Everton', 'Everton', ['toffees', 'efc', 'blues'], [c('royal blue', '#003399'), WHITE], 'royal-blue jersey with white trim, white shorts, white socks'),
  T('premier-league', 'fulham', 'Fulham', 'Fulham', ['cottagers', 'ffc'], [WHITE, BLACK], 'white jersey with black trim, black shorts, white socks'),
  T('premier-league', 'hull-city', 'Hull City', 'Hull', ['tigers', 'hcafc'], [c('amber', '#F5A12D'), BLACK], 'amber jersey with black trim and thin black stripes, black shorts, amber socks'),
  T('premier-league', 'ipswich-town', 'Ipswich Town', 'Ipswich', ['tractor boys', 'itfc', 'town'], [c('blue', '#0044A9'), WHITE], 'blue jersey with white collar and trim, white shorts, blue socks'),
  T('premier-league', 'leeds-united', 'Leeds United', 'Leeds', ['whites', 'lufc', 'peacocks'], [WHITE, c('blue', '#1D428A'), c('yellow', '#FFCD00')], 'all-white kit with blue and yellow trim'),
  T('premier-league', 'liverpool', 'Liverpool', 'Liverpool', ['reds', 'lfc', 'the kop'], [c('red', '#C8102E'), WHITE], 'all-red kit: red jersey, red shorts, red socks, white trim'),
  T('premier-league', 'manchester-city', 'Manchester City', 'Man City', ['city', 'citizens', 'cityzens', 'mcfc', 'sky blues'], [c('sky blue', '#6CABDD'), WHITE, c('navy', '#1C2C5B')], 'sky-blue jersey with navy trim, white shorts, sky-blue socks'),
  T('premier-league', 'manchester-united', 'Manchester United', 'Man United', ['man utd', 'red devils', 'united', 'mufc'], [c('red', '#DA291C'), WHITE, BLACK], 'red jersey with white and black trim, white shorts, black socks'),
  T('premier-league', 'newcastle-united', 'Newcastle United', 'Newcastle', ['magpies', 'toon', 'nufc'], [BLACK, WHITE], 'black and white vertical-striped jersey, black shorts, black socks'),
  T('premier-league', 'nottingham-forest', 'Nottingham Forest', 'Forest', ['forest', 'tricky trees', 'nffc'], [c('Garibaldi red', '#DD0000'), WHITE], 'bright red jersey, white shorts, red socks'),
  T('premier-league', 'sunderland', 'Sunderland', 'Sunderland', ['black cats', 'safc', 'mackems'], [c('red', '#EB172B'), WHITE, BLACK], 'red and white vertical-striped jersey, black shorts, red socks'),
  T('premier-league', 'tottenham-hotspur', 'Tottenham Hotspur', 'Spurs', ['spurs', 'thfc', 'lilywhites'], [WHITE, c('navy', '#132257')], 'white jersey with navy trim, navy shorts, white socks'),

  // ───────── NFL ─────────
  T('nfl', 'buffalo-bills', 'Buffalo Bills', 'Bills', ['bills mafia'], [c('royal blue', '#00338D'), c('red', '#C60C30'), WHITE], 'royal-blue jersey with white numbers and red-white-blue sleeve stripes, white pants'),
  T('nfl', 'miami-dolphins', 'Miami Dolphins', 'Dolphins', ['fins', 'phins'], [c('aqua', '#008E97'), c('orange', '#FC4C02'), WHITE], 'aqua jersey with white numbers outlined in orange, white pants'),
  T('nfl', 'new-england-patriots', 'New England Patriots', 'Patriots', ['pats'], [c('navy', '#002244'), c('red', '#C60C30'), c('silver', '#B0B7BC')], 'navy jersey with white numbers and red trim, silver pants'),
  T('nfl', 'new-york-jets', 'New York Jets', 'Jets', ['gang green'], [c('green', '#125740'), WHITE], 'green jersey with white numbers and white shoulder stripes, white pants'),
  T('nfl', 'baltimore-ravens', 'Baltimore Ravens', 'Ravens', [], [c('purple', '#241773'), BLACK, c('gold', '#9E7C0C')], 'purple jersey with white numbers trimmed in black and gold, white pants'),
  T('nfl', 'cincinnati-bengals', 'Cincinnati Bengals', 'Bengals', ['who dey'], [c('orange', '#FB4F14'), BLACK], 'black jersey with orange tiger-stripe shoulders and orange numbers, white pants'),
  T('nfl', 'cleveland-browns', 'Cleveland Browns', 'Browns', ['dawg pound'], [c('brown', '#311D00'), c('orange', '#FF3C00'), WHITE], 'brown jersey with orange and white sleeve stripes and white numbers, white pants'),
  T('nfl', 'pittsburgh-steelers', 'Pittsburgh Steelers', 'Steelers', ['steel curtain'], [BLACK, c('gold', '#FFB612')], 'black jersey with gold numbers and gold sleeve stripes, gold pants'),
  T('nfl', 'houston-texans', 'Houston Texans', 'Texans', [], [c('deep steel blue', '#03202F'), c('battle red', '#A71930'), WHITE], 'deep navy jersey with white numbers outlined in red, white pants'),
  T('nfl', 'indianapolis-colts', 'Indianapolis Colts', 'Colts', [], [c('royal blue', '#002C5F'), WHITE], 'royal-blue jersey with white numbers and white shoulder stripes, white pants'),
  T('nfl', 'jacksonville-jaguars', 'Jacksonville Jaguars', 'Jaguars', ['jags', 'duval'], [c('teal', '#006778'), BLACK, c('gold', '#D7A22A')], 'teal jersey with white numbers trimmed in gold and black, white pants'),
  T('nfl', 'tennessee-titans', 'Tennessee Titans', 'Titans', [], [c('navy', '#0C2340'), c('Titans blue', '#4B92DB'), c('red', '#C8102E')], 'navy jersey with light-blue shoulders and white numbers, white pants'),
  T('nfl', 'denver-broncos', 'Denver Broncos', 'Broncos', [], [c('orange', '#FB4F14'), c('navy', '#002244'), WHITE], 'orange jersey with navy numbers trimmed in white, white pants with orange stripe'),
  T('nfl', 'kansas-city-chiefs', 'Kansas City Chiefs', 'Chiefs', ['chiefs kingdom'], [c('red', '#E31837'), c('gold', '#FFB81C'), WHITE], 'red jersey with white numbers and gold-trimmed sleeve stripes, white pants'),
  T('nfl', 'las-vegas-raiders', 'Las Vegas Raiders', 'Raiders', ['raider nation'], [BLACK, c('silver', '#A5ACAF')], 'black jersey with silver-outlined white numbers, silver pants'),
  T('nfl', 'los-angeles-chargers', 'Los Angeles Chargers', 'Chargers', ['bolts'], [c('powder blue', '#0080C6'), c('sunshine gold', '#FFC20E'), WHITE], 'powder-blue jersey with white numbers and gold lightning-bolt shoulder stripes, white pants'),
  T('nfl', 'dallas-cowboys', 'Dallas Cowboys', 'Cowboys', ["america's team"], [c('navy', '#003594'), c('silver', '#869397'), WHITE], 'white jersey with navy numbers and navy-and-grey sleeve stripes, metallic silver-blue pants'),
  T('nfl', 'new-york-giants', 'New York Giants', 'Giants', ['big blue', 'g-men'], [c('blue', '#0B2265'), c('red', '#A71930'), WHITE], 'dark-blue jersey with white numbers trimmed in red, grey pants'),
  T('nfl', 'philadelphia-eagles', 'Philadelphia Eagles', 'Eagles', ['birds', 'go birds'], [c('midnight green', '#004C54'), c('silver', '#A5ACAF'), WHITE], 'midnight-green jersey with white numbers and silver trim, white pants'),
  T('nfl', 'washington-commanders', 'Washington Commanders', 'Commanders', [], [c('burgundy', '#5A1414'), c('gold', '#FFB612'), WHITE], 'burgundy jersey with gold numbers, gold pants'),
  T('nfl', 'chicago-bears', 'Chicago Bears', 'Bears', ['da bears', 'monsters of the midway'], [c('navy', '#0B162A'), c('orange', '#C83803'), WHITE], 'navy jersey with white numbers and orange-white sleeve stripes, white pants'),
  T('nfl', 'detroit-lions', 'Detroit Lions', 'Lions', [], [c('Honolulu blue', '#0076B6'), c('silver', '#B0B7BC'), WHITE], 'Honolulu-blue jersey with white numbers, silver pants'),
  T('nfl', 'green-bay-packers', 'Green Bay Packers', 'Packers', ['pack', 'cheeseheads'], [c('green', '#203731'), c('gold', '#FFB612'), WHITE], 'dark-green jersey with white numbers and gold-white sleeve stripes, gold pants'),
  T('nfl', 'minnesota-vikings', 'Minnesota Vikings', 'Vikings', ['vikes', 'skol'], [c('purple', '#4F2683'), c('gold', '#FFC62F'), WHITE], 'purple jersey with white numbers trimmed in gold, white pants'),
  T('nfl', 'atlanta-falcons', 'Atlanta Falcons', 'Falcons', ['dirty birds'], [c('red', '#A71930'), BLACK, WHITE], 'black jersey with red trim and white numbers, white pants'),
  T('nfl', 'carolina-panthers', 'Carolina Panthers', 'Panthers', [], [BLACK, c('Panther blue', '#0085CA'), c('silver', '#BFC0BF')], 'black jersey with blue-outlined white numbers, silver pants'),
  T('nfl', 'new-orleans-saints', 'New Orleans Saints', 'Saints', ['who dat'], [BLACK, c('old gold', '#D3BC8D'), WHITE], 'black jersey with old-gold-outlined white numbers, old-gold pants'),
  T('nfl', 'tampa-bay-buccaneers', 'Tampa Bay Buccaneers', 'Buccaneers', ['bucs'], [c('red', '#D50A0A'), c('pewter', '#34302B'), c('orange', '#FF7900')], 'red jersey with pewter numbers trimmed in orange, pewter pants'),
  T('nfl', 'arizona-cardinals', 'Arizona Cardinals', 'Cardinals', ['cards', 'birdgang'], [c('cardinal red', '#97233F'), BLACK, WHITE], 'cardinal-red jersey with white numbers and black trim, white pants'),
  T('nfl', 'los-angeles-rams', 'Los Angeles Rams', 'Rams', [], [c('royal blue', '#003594'), c('sol yellow', '#FFA300'), WHITE], 'royal-blue jersey with yellow numbers and yellow horn-curl shoulder stripes, yellow pants'),
  T('nfl', 'san-francisco-49ers', 'San Francisco 49ers', '49ers', ['niners', 'faithful'], [c('scarlet', '#AA0000'), c('gold', '#B3995D'), WHITE], 'scarlet jersey with white numbers outlined in black, gold pants'),
  T('nfl', 'seattle-seahawks', 'Seattle Seahawks', 'Seahawks', ['hawks', '12s'], [c('college navy', '#002244'), c('action green', '#69BE28'), c('wolf grey', '#A5ACAF')], 'navy jersey with white numbers outlined in action green, navy pants'),

  // ───────── NBA ─────────
  T('nba', 'atlanta-hawks', 'Atlanta Hawks', 'Hawks', [], [c('torch red', '#E03A3E'), c('volt green', '#C1D32F'), WHITE], 'red vest with white numbers and volt-green trim, red shorts'),
  T('nba', 'boston-celtics', 'Boston Celtics', 'Celtics', ['cs', 'celts'], [c('green', '#007A33'), WHITE, c('gold', '#BA9653')], 'green vest with white numbers trimmed in gold, green shorts'),
  T('nba', 'brooklyn-nets', 'Brooklyn Nets', 'Nets', [], [BLACK, WHITE], 'black vest with white numbers and white trim, black shorts'),
  T('nba', 'charlotte-hornets', 'Charlotte Hornets', 'Hornets', ['buzz city'], [c('teal', '#00788C'), c('purple', '#1D1160'), WHITE], 'teal vest with purple-outlined white numbers and pinstripes, teal shorts'),
  T('nba', 'chicago-bulls', 'Chicago Bulls', 'Bulls', [], [c('red', '#CE1141'), BLACK, WHITE], 'red vest with white numbers outlined in black, red shorts'),
  T('nba', 'cleveland-cavaliers', 'Cleveland Cavaliers', 'Cavaliers', ['cavs'], [c('wine', '#860038'), c('gold', '#FDBB30'), c('navy', '#041E42')], 'wine-red vest with gold numbers and navy trim, wine shorts'),
  T('nba', 'detroit-pistons', 'Detroit Pistons', 'Pistons', ['bad boys'], [c('red', '#C8102E'), c('royal blue', '#1D42BA'), WHITE], 'royal-blue vest with red numbers outlined in white, blue shorts'),
  T('nba', 'indiana-pacers', 'Indiana Pacers', 'Pacers', [], [c('navy', '#002D62'), c('gold', '#FDBB30'), WHITE], 'navy vest with gold numbers, navy shorts with gold stripe'),
  T('nba', 'miami-heat', 'Miami Heat', 'Heat', [], [c('red', '#98002E'), BLACK, c('yellow', '#F9A01B')], 'black vest with red numbers and red-yellow trim, black shorts'),
  T('nba', 'milwaukee-bucks', 'Milwaukee Bucks', 'Bucks', ['fear the deer'], [c('Good Land green', '#00471B'), c('Cream City cream', '#EEE1C6'), c('blue', '#0077C0')], 'dark-green vest with cream numbers, green shorts'),
  T('nba', 'new-york-knicks', 'New York Knicks', 'Knicks', ['knickerbockers'], [c('blue', '#006BB6'), c('orange', '#F58426'), WHITE], 'blue vest with orange numbers outlined in white, blue shorts'),
  T('nba', 'orlando-magic', 'Orlando Magic', 'Magic', [], [c('blue', '#0077C0'), BLACK, c('silver', '#C4CED4')], 'black vest with blue numbers and blue pinstripes, black shorts'),
  T('nba', 'philadelphia-76ers', 'Philadelphia 76ers', '76ers', ['sixers'], [c('blue', '#006BB6'), c('red', '#ED174C'), WHITE], 'blue vest with white numbers trimmed in red, blue shorts'),
  T('nba', 'toronto-raptors', 'Toronto Raptors', 'Raptors', ['raps', 'we the north'], [c('red', '#CE1141'), BLACK, c('silver', '#A1A1A4')], 'red vest with white numbers trimmed in black, red shorts'),
  T('nba', 'washington-wizards', 'Washington Wizards', 'Wizards', ['wiz'], [c('navy', '#002B5C'), c('red', '#E31837'), WHITE], 'navy vest with white numbers and red trim, navy shorts'),
  T('nba', 'dallas-mavericks', 'Dallas Mavericks', 'Mavericks', ['mavs'], [c('royal blue', '#00538C'), c('navy', '#002B5E'), c('silver', '#B8C4CA')], 'royal-blue vest with white numbers trimmed in silver, blue shorts'),
  T('nba', 'denver-nuggets', 'Denver Nuggets', 'Nuggets', ['nugs'], [c('midnight blue', '#0E2240'), c('sunshine yellow', '#FEC524'), c('flatirons red', '#8B2131')], 'midnight-blue vest with sunshine-yellow numbers and red trim, blue shorts'),
  T('nba', 'golden-state-warriors', 'Golden State Warriors', 'Warriors', ['dubs', 'gsw'], [c('royal blue', '#1D428A'), c('gold', '#FFC72C'), WHITE], 'royal-blue vest with gold numbers and gold trim, blue shorts'),
  T('nba', 'houston-rockets', 'Houston Rockets', 'Rockets', [], [c('red', '#CE1141'), BLACK, c('silver', '#C4CED4')], 'red vest with white numbers trimmed in black, red shorts'),
  T('nba', 'los-angeles-clippers', 'Los Angeles Clippers', 'Clippers', ['clips'], [c('blue', '#1D428A'), c('red', '#C8102E'), BLACK], 'blue vest with white numbers trimmed in red, blue shorts'),
  T('nba', 'los-angeles-lakers', 'Los Angeles Lakers', 'Lakers', ['lake show'], [c('purple', '#552583'), c('gold', '#FDB927'), WHITE], 'gold vest with purple numbers outlined in white, gold shorts with purple stripe'),
  T('nba', 'memphis-grizzlies', 'Memphis Grizzlies', 'Grizzlies', ['grizz'], [c('Beale Street blue', '#5D76A9'), c('navy', '#12173F'), c('gold', '#F5B112')], 'navy vest with Beale Street blue numbers and gold trim, navy shorts'),
  T('nba', 'minnesota-timberwolves', 'Minnesota Timberwolves', 'Timberwolves', ['wolves', 't-wolves'], [c('midnight blue', '#0C2340'), c('lake blue', '#236192'), c('aurora green', '#78BE20')], 'midnight-blue vest with white numbers and green trim, blue shorts'),
  T('nba', 'new-orleans-pelicans', 'New Orleans Pelicans', 'Pelicans', ['pels'], [c('navy', '#0C2340'), c('red', '#C8102E'), c('gold', '#85714D')], 'navy vest with white numbers trimmed in red and gold, navy shorts'),
  T('nba', 'oklahoma-city-thunder', 'Oklahoma City Thunder', 'Thunder', ['okc'], [c('blue', '#007AC1'), c('sunset orange', '#EF3B24'), c('navy', '#002D62')], 'blue vest with white numbers and orange trim, blue shorts'),
  T('nba', 'phoenix-suns', 'Phoenix Suns', 'Suns', [], [c('purple', '#1D1160'), c('orange', '#E56020'), c('yellow', '#F9AD1B')], 'purple vest with orange numbers outlined in white, purple shorts'),
  T('nba', 'portland-trail-blazers', 'Portland Trail Blazers', 'Trail Blazers', ['blazers', 'rip city'], [c('red', '#E03A3E'), BLACK, WHITE], 'black vest with white numbers and a red diagonal stripe, black shorts'),
  T('nba', 'sacramento-kings', 'Sacramento Kings', 'Kings', [], [c('purple', '#5A2D81'), c('silver', '#63727A'), BLACK], 'purple vest with white numbers trimmed in silver, purple shorts'),
  T('nba', 'san-antonio-spurs', 'San Antonio Spurs', 'Spurs', [], [BLACK, c('silver', '#C4CED4'), WHITE], 'black vest with silver-outlined white numbers, black shorts'),
  T('nba', 'utah-jazz', 'Utah Jazz', 'Jazz', [], [c('purple', '#753BBD'), BLACK, WHITE], 'purple vest with white numbers and black trim, purple shorts'),

  // ───────── NHL ─────────
  T('nhl', 'boston-bruins', 'Boston Bruins', 'Bruins', ['bs'], [BLACK, c('gold', '#FFB81C'), WHITE], 'black sweater with gold and white hem and sleeve stripes'),
  T('nhl', 'buffalo-sabres', 'Buffalo Sabres', 'Sabres', [], [c('royal blue', '#003087'), c('gold', '#FFB81C'), WHITE], 'royal-blue sweater with gold and white stripes'),
  T('nhl', 'detroit-red-wings', 'Detroit Red Wings', 'Red Wings', ['wings'], [c('red', '#CE1126'), WHITE], 'red sweater with a white hem stripe and white sleeve band'),
  T('nhl', 'florida-panthers', 'Florida Panthers', 'Panthers', ['cats'], [c('red', '#C8102E'), c('navy', '#041E42'), c('gold', '#B9975B')], 'red sweater with navy and gold stripes'),
  T('nhl', 'montreal-canadiens', 'Montreal Canadiens', 'Canadiens', ['habs', 'le bleu-blanc-rouge'], [c('red', '#AF1E2D'), c('blue', '#192168'), WHITE], 'red sweater with a broad blue-and-white chest band and sleeve stripes'),
  T('nhl', 'ottawa-senators', 'Ottawa Senators', 'Senators', ['sens'], [c('red', '#C52032'), BLACK, c('gold', '#C2912C')], 'red sweater with black and gold stripes'),
  T('nhl', 'tampa-bay-lightning', 'Tampa Bay Lightning', 'Lightning', ['bolts'], [c('blue', '#002868'), WHITE], 'blue sweater with white hem and sleeve stripes'),
  T('nhl', 'toronto-maple-leafs', 'Toronto Maple Leafs', 'Maple Leafs', ['leafs', 'buds'], [c('blue', '#00205B'), WHITE], 'blue sweater with white hem and sleeve stripes'),
  T('nhl', 'carolina-hurricanes', 'Carolina Hurricanes', 'Hurricanes', ['canes'], [c('red', '#CE1126'), BLACK, WHITE], 'red sweater with black and white stripes'),
  T('nhl', 'columbus-blue-jackets', 'Columbus Blue Jackets', 'Blue Jackets', ['jackets', 'cbj'], [c('union blue', '#002654'), c('goal red', '#CE1126'), WHITE], 'navy sweater with red and white trim'),
  T('nhl', 'new-jersey-devils', 'New Jersey Devils', 'Devils', [], [c('red', '#CE1126'), BLACK, WHITE], 'red sweater with black and white hem and sleeve stripes'),
  T('nhl', 'new-york-islanders', 'New York Islanders', 'Islanders', ['isles'], [c('royal blue', '#00539B'), c('orange', '#F47D30'), WHITE], 'royal-blue sweater with orange and white stripes'),
  T('nhl', 'new-york-rangers', 'New York Rangers', 'Rangers', ['blueshirts', 'nyr'], [c('blue', '#0038A8'), c('red', '#CE1126'), WHITE], 'blue sweater with red and white stripes'),
  T('nhl', 'philadelphia-flyers', 'Philadelphia Flyers', 'Flyers', ['broad street bullies'], [c('orange', '#F74902'), BLACK, WHITE], 'orange sweater with black and white stripes'),
  T('nhl', 'pittsburgh-penguins', 'Pittsburgh Penguins', 'Penguins', ['pens'], [BLACK, c('gold', '#FCB514'), WHITE], 'black sweater with gold and white stripes'),
  T('nhl', 'washington-capitals', 'Washington Capitals', 'Capitals', ['caps'], [c('red', '#C8102E'), c('navy', '#041E42'), WHITE], 'red sweater with navy and white stripes and white stars on the hem'),
  T('nhl', 'utah-mammoth', 'Utah Mammoth', 'Mammoth', [], [c('rock black', '#090909'), c('mountain blue', '#6CACE4'), c('salt white', '#FFFFFF')], 'black sweater with mountain-blue and white stripes'),
  T('nhl', 'chicago-blackhawks', 'Chicago Blackhawks', 'Blackhawks', ['hawks'], [c('red', '#CF0A2C'), BLACK, WHITE], 'red sweater with black and white hem stripes'),
  T('nhl', 'colorado-avalanche', 'Colorado Avalanche', 'Avalanche', ['avs'], [c('burgundy', '#6F263D'), c('steel blue', '#236192'), WHITE], 'burgundy sweater with steel-blue and white stripes'),
  T('nhl', 'dallas-stars', 'Dallas Stars', 'Stars', [], [c('victory green', '#006847'), c('silver', '#8F8F8C'), BLACK], 'victory-green sweater with silver and black stripes'),
  T('nhl', 'minnesota-wild', 'Minnesota Wild', 'Wild', [], [c('forest green', '#154734'), c('iron range red', '#A6192E'), c('wheat', '#EAAA00')], 'forest-green sweater with red and wheat stripes'),
  T('nhl', 'nashville-predators', 'Nashville Predators', 'Predators', ['preds', 'smashville'], [c('gold', '#FFB81C'), c('navy', '#041E42'), WHITE], 'gold sweater with navy and white stripes'),
  T('nhl', 'st-louis-blues', 'St. Louis Blues', 'Blues', ['bluenotes'], [c('blue', '#002F87'), c('gold', '#FCB514'), c('navy', '#041E42')], 'blue sweater with gold and navy stripes'),
  T('nhl', 'winnipeg-jets', 'Winnipeg Jets', 'Jets', [], [c('navy', '#041E42'), c('blue', '#004C97'), c('silver', '#8E9090')], 'navy sweater with blue and silver stripes'),
  T('nhl', 'anaheim-ducks', 'Anaheim Ducks', 'Ducks', [], [c('orange', '#FC4C02'), BLACK, c('gold', '#B9975B')], 'black sweater with orange and gold stripes'),
  T('nhl', 'calgary-flames', 'Calgary Flames', 'Flames', [], [c('red', '#C8102E'), c('gold', '#F1BE48'), BLACK], 'red sweater with gold and black stripes'),
  T('nhl', 'edmonton-oilers', 'Edmonton Oilers', 'Oilers', ['oil'], [c('royal blue', '#041E42'), c('orange', '#FF4C00'), WHITE], 'royal-blue sweater with orange and white stripes'),
  T('nhl', 'los-angeles-kings', 'Los Angeles Kings', 'Kings', [], [BLACK, c('silver', '#A2AAAD'), WHITE], 'black sweater with silver and white stripes'),
  T('nhl', 'san-jose-sharks', 'San Jose Sharks', 'Sharks', [], [c('Pacific teal', '#006D75'), BLACK, c('orange', '#EA7200')], 'teal sweater with black and orange stripes'),
  T('nhl', 'seattle-kraken', 'Seattle Kraken', 'Kraken', [], [c('deep sea blue', '#001628'), c('ice blue', '#99D9D9'), c('red', '#E9072B')], 'deep-sea-blue sweater with ice-blue and red stripes'),
  T('nhl', 'vegas-golden-knights', 'Vegas Golden Knights', 'Golden Knights', ['knights', 'vgk'], [c('steel grey', '#333F42'), c('gold', '#B4975A'), c('red', '#C8102E')], 'steel-grey sweater with gold and black stripes'),
  T('nhl', 'vancouver-canucks', 'Vancouver Canucks', 'Canucks', ['nucks'], [c('blue', '#00205B'), c('green', '#00843D'), WHITE], 'blue sweater with green and white stripes'),

  // ───────── College (the school, any sport) ─────────
  T('college', 'texas', 'University of Texas', 'Texas', ['longhorns', 'ut', 'ut austin', 'hook em'], [c('burnt orange', '#BF5700'), WHITE], 'burnt-orange varsity jacket with white sleeves and burnt-orange-and-white striped cuffs'),
  T('college', 'alabama', 'University of Alabama', 'Alabama', ['crimson tide', 'bama', 'roll tide'], [c('crimson', '#9E1B32'), WHITE], 'crimson varsity jacket with white sleeves and crimson-and-white striped cuffs'),
  T('college', 'georgia', 'University of Georgia', 'Georgia', ['bulldogs', 'dawgs', 'uga'], [c('red', '#BA0C2F'), BLACK], 'red varsity jacket with black sleeves and red-and-black striped cuffs'),
  T('college', 'michigan', 'University of Michigan', 'Michigan', ['wolverines', 'go blue', 'umich'], [c('blue', '#00274C'), c('maize', '#FFCB05')], 'navy-blue varsity jacket with maize-yellow sleeves and blue-and-maize striped cuffs'),
  T('college', 'ohio-state', 'Ohio State University', 'Ohio State', ['buckeyes', 'osu', 'tosu'], [c('scarlet', '#BB0000'), c('grey', '#666666'), WHITE], 'scarlet varsity jacket with grey sleeves and scarlet-and-grey striped cuffs'),
  T('college', 'notre-dame', 'University of Notre Dame', 'Notre Dame', ['fighting irish', 'irish', 'nd'], [c('navy', '#0C2340'), c('gold', '#C99700'), c('green', '#00843D')], 'navy varsity jacket with gold sleeves and navy-and-gold striped cuffs'),
  T('college', 'lsu', 'Louisiana State University', 'LSU', ['tigers', 'geaux tigers'], [c('purple', '#461D7C'), c('gold', '#FDD023')], 'purple varsity jacket with gold sleeves and purple-and-gold striped cuffs'),
  T('college', 'texas-am', 'Texas A&M University', 'Texas A&M', ['aggies', 'tamu', 'gig em'], [c('maroon', '#500000'), WHITE], 'maroon varsity jacket with white sleeves and maroon-and-white striped cuffs'),
  T('college', 'oklahoma', 'University of Oklahoma', 'Oklahoma', ['sooners', 'ou', 'boomer sooner'], [c('crimson', '#841617'), c('cream', '#FDF9D8')], 'crimson varsity jacket with cream sleeves and crimson-and-cream striped cuffs'),
  T('college', 'florida', 'University of Florida', 'Florida', ['gators', 'uf'], [c('orange', '#FA4616'), c('blue', '#0021A5')], 'royal-blue varsity jacket with orange sleeves and blue-and-orange striped cuffs'),
  T('college', 'tennessee', 'University of Tennessee', 'Tennessee', ['volunteers', 'vols', 'rocky top'], [c('orange', '#FF8200'), WHITE, c('smokey grey', '#58595B')], 'bright-orange varsity jacket with white sleeves and orange-and-white striped cuffs'),
  T('college', 'auburn', 'Auburn University', 'Auburn', ['tigers', 'war eagle'], [c('navy', '#0C2340'), c('orange', '#E87722')], 'navy varsity jacket with orange sleeves and navy-and-orange striped cuffs'),
  T('college', 'clemson', 'Clemson University', 'Clemson', ['tigers'], [c('orange', '#F56600'), c('regalia purple', '#522D80')], 'orange varsity jacket with purple sleeves and orange-and-purple striped cuffs'),
  T('college', 'usc', 'University of Southern California', 'USC', ['trojans', 'fight on'], [c('cardinal', '#990000'), c('gold', '#FFC72C')], 'cardinal-red varsity jacket with gold sleeves and cardinal-and-gold striped cuffs'),
  T('college', 'penn-state', 'Penn State University', 'Penn State', ['nittany lions', 'psu', 'we are'], [c('navy', '#041E42'), WHITE], 'navy varsity jacket with white sleeves and navy-and-white striped cuffs'),
  T('college', 'florida-state', 'Florida State University', 'Florida State', ['seminoles', 'noles', 'fsu'], [c('garnet', '#782F40'), c('gold', '#CEB888')], 'garnet varsity jacket with gold sleeves and garnet-and-gold striped cuffs'),
  T('college', 'oregon', 'University of Oregon', 'Oregon', ['ducks', 'uo'], [c('green', '#154733'), c('yellow', '#FEE123')], 'green varsity jacket with yellow sleeves and green-and-yellow striped cuffs'),
  T('college', 'washington', 'University of Washington', 'Washington', ['huskies', 'uw', 'udub'], [c('purple', '#4B2E83'), c('gold', '#B7A57A')], 'purple varsity jacket with gold sleeves and purple-and-gold striped cuffs'),
  T('college', 'cincinnati', 'University of Cincinnati', 'Cincinnati', ['bearcats', 'uc'], [c('red', '#E00122'), BLACK], 'red varsity jacket with black sleeves and red-and-black striped cuffs'),
  T('college', 'missouri', 'University of Missouri', 'Missouri', ['tigers', 'mizzou'], [c('gold', '#F1B82D'), BLACK], 'black varsity jacket with old-gold sleeves and black-and-gold striped cuffs'),
  T('college', 'miami', 'University of Miami', 'Miami', ['hurricanes', 'canes', 'the u'], [c('orange', '#F47321'), c('green', '#005030'), WHITE], 'green varsity jacket with orange sleeves and green-orange-white striped cuffs'),
];

const colourList = (t: SportsTeam) => {
  const names = t.colours.map(x => x.name);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/** The kit sentence with garment words made generic, so it fits any sports outfit */
function genericKit(kit: string): string {
  return kit
    .replace(/\bvarsity jacket\b/g, 'top').replace(/\b(jersey|vest|sweater)\b/g, 'top')
    .replace(/\b(shorts|pants)\b/g, 'bottoms');
}

/** Prompt text for one team (see file header) */
export function teamOutfit(t: SportsTeam): { clothing: string; recolour: string } {
  const league = LEAGUES[t.league];
  const noMarks = 'Plain fabric with no logos, crests, badges, lettering or sponsor marks.';
  return {
    clothing: `a ${league.garment}, in ${t.short} colours (${colourList(t)}): ${t.kit}. ${noMarks}`,
    recolour: `Recolour the pet's sports outfit to ${t.short} colours (${colourList(t)}): ${genericKit(t.kit)}. Keep the same type of garment, cut, folds, pose, background and lighting; change only the colours and stripes. ${noMarks}`,
  };
}

export function teamsInLeague(league: League): SportsTeam[] {
  return SPORTS_TEAMS.filter(t => t.league === league);
}

/** Find a team by name, short name, nickname or slug ("toon", "Man Utd", "the u") */
export function findTeam(query: string): SportsTeam[] {
  const q = query.trim().toLowerCase().replace(/[^a-z0-9& ]/g, '');
  if (!q) return [];
  return SPORTS_TEAMS.filter(t =>
    [t.name, t.short, t.slug.replace(/-/g, ' '), ...t.nicknames].some(s => s.toLowerCase().replace(/[^a-z0-9& ]/g, '').includes(q)));
}
