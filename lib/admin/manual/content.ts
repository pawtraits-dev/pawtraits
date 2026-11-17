/**
 * Operating manual for the admin: what to do each day, on market days, each week and each month,
 * and how to do each job with the pages that exist. Plain data, no JSX, so it is easy to edit.
 *
 * Rules for editing (scripts/test-admin-manual.ts checks most of them):
 *  - Describe only what the admin really does. Use exact page names (as in the sidebar) and exact
 *    button labels, wrapped in **double stars**; the page shows them in bold.
 *  - Never write a price. Say "see Pricing Management".
 *  - Never promise a delivery time or a refund.
 *  - Every link points at a page that exists, using a name from PAGES below.
 */

export type Role = 'owner' | 'anyone';
export type TickPeriod = 'day' | 'week' | 'month';
export type Venue = 'covent-garden' | 'spitalfields';

export interface ManualLink { label: string; href: string }

export interface Task {
  /** Stable slug. Ticks are stored against it, so do not rename one once it is in use. */
  key: string;
  title: string;
  why: string;
  steps: string[];
  link: ManualLink;
  /** Rough minutes. */
  minutes: number;
  role: Role;
  /** Weekly tasks only: the day it is due, 1 = Monday ... 7 = Sunday. */
  dueDay?: number;
  /** Market-day tasks that only apply at one stall. */
  venues?: Venue[];
}

export type RoutineId =
  | 'daily'
  | 'market-before'
  | 'market-at'
  | 'market-after'
  | 'weekly'
  | 'monthly'
  | 'wrong';

export interface Routine {
  id: RoutineId;
  title: string;
  summary: string;
  /** Which tick period its tasks use; null for the reference list that is not ticked. */
  period: TickPeriod | null;
  /** When it applies, in words. */
  when: string;
  tasks: Task[];
}

export interface GuideSection { heading: string; body: string[]; links?: ManualLink[] }
export interface Guide { slug: string; title: string; summary: string; sections: GuideSection[] }
export interface GlossaryEntry { term: string; meaning: string }
export interface TroubleEntry { problem: string; fix: string[]; who: string; link?: ManualLink }

export const SUPPORT_EMAIL = 'support@pawtraits.pics';

/** Every admin page the manual points at. Names are the sidebar names in app/admin/layout.tsx. */
export const PAGES = {
  manual: { label: 'Operating manual', href: '/admin/manual' },
  overview: { label: 'Overview', href: '/admin' },
  orders: { label: 'Orders', href: '/admin/orders' },
  imageCatalog: { label: 'Image Catalog', href: '/admin/catalog' },
  generate: { label: 'Generate Images', href: '/admin/generate' },
  variationBatches: { label: 'Variation Batches', href: '/admin/variation-batches' },
  collections: { label: 'Collections', href: '/admin/collections' },
  captions: { label: 'Captions', href: '/admin/collections/captions' },
  quizzes: { label: 'Quizzes', href: '/admin/quizzes' },
  catalogueChecks: { label: 'Catalogue checks', href: '/admin/catalogue-checks' },
  mugCatalog: { label: 'Mug Catalog', href: '/admin/mugs/catalog' },
  mugGenerations: { label: 'Mug Generations', href: '/admin/mugs/generations' },
  customisations: { label: 'Customisations', href: '/admin/customisations' },
  customerPaintings: { label: 'Customer Paintings', href: '/admin/custom-paintings' },
  phoneCases: { label: 'Phone Cases', href: '/admin/phone-cases' },
  pricing: { label: 'Pricing Management', href: '/admin/pricing-management' },
  tradeOrders: { label: 'Trade Print Orders', href: '/admin/stock/trade-orders' },
  dividers: { label: 'Divider Cards', href: '/admin/stock/dividers' },
  locations: { label: 'Locations', href: '/admin/stock/locations' },
  stickers: { label: 'Sticker Sheets', href: '/admin/stock/stickers' },
  qrReport: { label: 'Sticker QR Report', href: '/admin/stock/qr-report' },
  guestStall: { label: 'Guest & Stall Settings', href: '/admin/settings/guest-and-stall' },
  customers: { label: 'Customers', href: '/admin/customers' },
  audiences: { label: 'Audiences', href: '/admin/audiences' },
  popularity: { label: 'Popularity', href: '/admin/popularity' },
  customerReferrals: { label: 'Customer Referrals', href: '/admin/customer-referrals' },
  offers: { label: 'Offers', href: '/admin/offers' },
  social: { label: 'Social', href: '/admin/social' },
  templates: { label: 'Message Templates', href: '/admin/messaging' },
  queue: { label: 'Message Queue', href: '/admin/messaging/queue' },
  testEmail: { label: 'Test Email', href: '/admin/messaging/test' },
  revenue: { label: 'Revenue', href: '/admin/financial/revenue' },
  sales: { label: 'Sales', href: '/admin/financial/sales' },
  costs: { label: 'Costs', href: '/admin/financial/costs' },
  aiCosts: { label: 'AI Costs', href: '/admin/ai-costs' },
  profit: { label: 'Profit', href: '/admin/financial/profit' },
  csp: { label: 'CSP Reports', href: '/admin/security/csp-reports' },
} as const satisfies Record<string, ManualLink>;

/** The page names the manual refers to, for the test that checks them against the sidebar. */
export const REFERENCED_PAGES: ManualLink[] = Object.values(PAGES);

const P = PAGES;

// ---------------------------------------------------------------------------------------------
// ROUTINES
// ---------------------------------------------------------------------------------------------

export const ROUTINES: Routine[] = [
  {
    id: 'daily',
    title: 'Daily (weekdays)',
    summary: 'The jobs that keep orders moving and customers happy. About an hour on a normal day.',
    period: 'day',
    when: 'Every weekday',
    tasks: [
      {
        key: 'daily-overview',
        title: 'Check Overview for anything flagged',
        why: 'The Needs attention list is the quickest way to spot a problem before a customer does.',
        steps: [
          'Open **Overview**.',
          'Read the **Needs attention** list. Each line shows how many items are waiting.',
          'Click a line to go straight to the page that deals with it.',
          'If you see "All clear: nothing waiting on you.", you are done.',
          'Anything urgent that you cannot fix with this manual: tell the owner.',
        ],
        link: P.overview,
        minutes: 5,
        role: 'anyone',
      },
      {
        key: 'daily-print-orders',
        title: 'Print what is waiting',
        why: 'Paid orders sit in To print until someone makes the print and marks it done.',
        steps: [
          'Open **Orders**. The **Fulfilment** card is at the top.',
          'Open the **To print** tab. The oldest orders come first.',
          'For each order, open the **Print file** link and check the line under it. Red text means a problem (see "A print file will not open or looks wrong" in Troubleshooting).',
          'Send the file to the trade printer for foam prints. Mugs, phone cases, art paper, framed and acrylic orders go through Gelato and are not printed by you.',
          'When the print is done, press **Printed** on the order, or tick several and press **Mark printed**.',
        ],
        link: P.orders,
        minutes: 20,
        role: 'anyone',
      },
      {
        key: 'daily-pack-orders',
        title: 'Pack printed orders',
        why: 'Each parcel needs its packing slip, which carries the address label and the list of what goes inside.',
        steps: [
          'Open **Orders** and the **Printed** tab.',
          'Tick the orders you are packing now (or **Select all**).',
          'Press **Packing slips**. A PDF opens in a new tab. With several orders it starts with a pick list.',
          'Print the PDF, pack each order with its slip, and read any amber "Note:" on the order.',
          'Press **Mark packed** (or **Packed** on a single order).',
        ],
        link: P.orders,
        minutes: 20,
        role: 'anyone',
      },
      {
        key: 'daily-post-orders',
        title: 'Make Royal Mail labels and post',
        why: 'Marking an order posted emails the customer, so do it when the parcel really goes.',
        steps: [
          'Open **Orders** and the **Packed** tab.',
          'Tick the orders going out in this post.',
          'Press **Royal Mail labels**. Check the parcel size and weight shown for each order.',
          'Leave "Mark them posted and email each customer their tracking number" ticked if the parcels go today.',
          'Press the purple button that says how many labels to make. The label PDF opens in a new tab.',
          'Print the labels at 100% (Actual size), stick them on and post the parcels.',
        ],
        link: P.orders,
        minutes: 15,
        role: 'anyone',
      },
      {
        key: 'daily-held-orders',
        title: 'Look at held and unrouted orders',
        why: 'An order is held when the amount paid looked wrong. Releasing it spends time and money, so the owner decides.',
        steps: [
          'Open **Orders**. The **On hold** and **Not routed** tabs only appear when something is in them.',
          'If neither tab is there, tick this off.',
          'If one is there, do not press anything. Tell the owner the order numbers.',
          'The owner checks the payment in Stripe, then presses **Release to print** (on hold) or chooses how to fulfil it (not routed).',
        ],
        link: P.orders,
        minutes: 5,
        role: 'owner',
      },
      {
        key: 'daily-customer-emails',
        title: 'Answer customer emails',
        why: `Customers write to ${SUPPORT_EMAIL}. A quick, kind answer saves a lot of worry.`,
        steps: [
          `Open the ${SUPPORT_EMAIL} inbox (this is outside the admin).`,
          'Find the order in **Orders**: type the email, name or order number into the search box.',
          'Open the order to see what was bought and where it is.',
          'Reply in plain, friendly words. Do not promise a delivery time or a refund.',
          'Anything about a refund, a price or a complaint: pass it to the owner before replying.',
        ],
        link: P.orders,
        minutes: 15,
        role: 'anyone',
      },
      {
        key: 'daily-message-queue',
        title: 'Check the Message Queue is empty',
        why: 'Order, posted and download emails wait in the queue until they are sent.',
        steps: [
          'Open **Message Queue**.',
          'Look at **Pending** and **Failed**.',
          'If **Pending** is above zero and does not clear after a few minutes, press **Process Queue Now**.',
          'If **Failed** keeps growing, tell the owner.',
        ],
        link: P.queue,
        minutes: 3,
        role: 'anyone',
      },
      {
        key: 'daily-approve-offers',
        title: 'Approve the offers waiting',
        why: 'Offers are new pictures painted from a photo a customer kept. Each one waits for a person to look at it before it is emailed. Skip this task while Offers is switched off.',
        steps: [
          'Open **Offers**. If the **Offers on** switch is off, nothing is being painted or sent: tick this off.',
          'Open the **Waiting for approval** tab. If it says "Nothing is waiting for approval.", tick this off.',
          'For each card, look at every picture. The Offers guide lists what to check ("What to look for before you approve").',
          'Press **Drop this picture** or **Paint a different one** on any picture that looks wrong. At least two good pictures must stay.',
          'When the pictures are right, press **Approve and send** and confirm. The customer is emailed straight away.',
          'Not sure about one? Leave it waiting, or press **Skip this person**. Never approve a picture you doubt.',
        ],
        link: P.offers,
        minutes: 10,
        role: 'owner',
      },
    ],
  },

  {
    id: 'market-before',
    title: 'Market day: before',
    summary: 'Get the stock, stickers and settings ready the day before or on the morning.',
    period: 'day',
    when: 'The day before, or early on the day',
    tasks: [
      {
        key: 'market-before-trade-received',
        title: 'Mark delivered trade print orders as received',
        why: 'It keeps the list honest, so you know which orders are still on their way.',
        steps: [
          'Open **Trade Print Orders**.',
          'Open any order whose status is **Ordered** and whose prints have arrived.',
          'Check the prints against the order (the size totals sit above the list).',
          'Press **Mark as received**.',
        ],
        link: P.tradeOrders,
        minutes: 10,
        role: 'anyone',
      },
      {
        key: 'market-before-stickers',
        title: 'Check every print has its QR sticker',
        why: 'The sticker is how a shopper at the stall puts their own pet in the picture, and how scans are counted.',
        steps: [
          'Turn a few prints over and check each has a sticker on the back.',
          'For a trade print order, open it and use **Download labels PDF** in the **Labels** box.',
          'For single designs, open **Sticker Sheets**, add each design by its ref and press **Download PDF**.',
          'Choose the stall in the location box so scans are credited to it.',
          'Print on label sheets at 100% (Actual size), not "Fit to page".',
        ],
        link: P.stickers,
        minutes: 15,
        role: 'anyone',
      },
      {
        key: 'market-before-dividers',
        title: 'Check the divider cards',
        why: 'Divider cards let shoppers flip through prints by breed.',
        steps: [
          'Open **Divider Cards**.',
          'Check you have a card for each breed you are taking. Missing or new breeds: choose the **Print size** and tick the breeds.',
          'Press **Preview** to look at one card first.',
          'Press the **Download** button to get the PDF, then print and cut the cards.',
        ],
        link: P.dividers,
        minutes: 10,
        role: 'anyone',
      },
      {
        key: 'market-before-stall-settings',
        title: 'Check the stall settings',
        why: "These settings control what a shopper sees when they pay on their phone. A wrong one costs money.",
        steps: [
          'Open **Guest & Stall Settings**.',
          'Check **Previews per device per 24 hours** is not set so low that shoppers get stuck.',
          'Check the **Ready-made print prices** are the ones you want today. For the real prices see Pricing Management.',
          'Check **Free digital download with every print bought on the website** is ticked, if you want it.',
          'Change nothing you are unsure about. Press the **Save** button next to any setting you change.',
        ],
        link: P.guestStall,
        minutes: 5,
        role: 'owner',
      },
      {
        key: 'market-before-test-scan',
        title: 'Scan one sticker with your phone',
        why: 'It proves the stickers and the website work before the first shopper arrives.',
        steps: [
          'Scan a sticker on one print with your phone camera.',
          'Check it opens that design on pawtraits.pics. A test scan is recorded like any other.',
          'At Spitalfields the phone signal is poor, so also join the trader Wi-Fi and check the page loads.',
          'If the sticker opens the wrong page or nothing, check the design and location in **Sticker Sheets** and print a new sticker.',
        ],
        link: P.qrReport,
        minutes: 5,
        role: 'anyone',
      },
    ],
  },

  {
    id: 'market-at',
    title: 'Market day: at the stall',
    summary: 'Quick checks while you trade. The admin works on a phone.',
    period: 'day',
    when: 'While the stall is open',
    tasks: [
      {
        key: 'market-stall-wifi',
        title: 'Get online with the trader Wi-Fi',
        why: 'Phone reception at Spitalfields is poor, and shoppers need a connection to see their preview.',
        steps: [
          'Join the trader Wi-Fi on your phone.',
          'Open **Overview** and check it loads.',
          'If the Wi-Fi drops, ask shoppers to scan again once you are back online. Nothing is lost.',
        ],
        link: P.overview,
        minutes: 5,
        role: 'anyone',
        venues: ['spitalfields'],
      },
      {
        key: 'market-stall-midday-check',
        title: 'Midday check: scans and previews',
        why: 'If stickers are not being scanned, or previews are failing, you want to know while you are still at the stall.',
        steps: [
          'Open **Overview** and choose **Today**.',
          'Look at **Stall QR scans** and **Free previews**. The previews tile shows how many failed.',
          'If previews are failing, open **Customisations**, then **All customisations**, and look for the red **Failed** badge.',
          'Tell the owner if more than a few have failed.',
        ],
        link: P.overview,
        minutes: 3,
        role: 'anyone',
      },
    ],
  },

  {
    id: 'market-after',
    title: 'Market day: after',
    summary: 'Check the day landed in the admin and note what to reprint.',
    period: 'day',
    when: 'Once you are home',
    tasks: [
      {
        key: 'market-after-sales',
        title: "Check today's stall sales",
        why: 'The Stalls table shows what was sold through the site at each stall.',
        steps: [
          'Open **Overview** and choose **Today**.',
          'Look at the **Stalls** table: scans, sales and revenue for each stall.',
          'Look at **Latest orders**. Stall orders carry a "stall" badge.',
          'The admin shows sales paid through the website, including pay on your phone. Keep your own note of anything else you took, and tell the owner.',
        ],
        link: P.overview,
        minutes: 5,
        role: 'anyone',
      },
      {
        key: 'market-after-scans',
        title: "Look at today's QR scans",
        why: 'Scans show which designs caught shoppers\' eyes, even when nobody bought.',
        steps: [
          'Open **Sticker QR Report**.',
          'Set **From** and **To** to today.',
          'Read the **By location** table, then **Most scanned images**.',
          'Make a note of designs with many scans and no orders. Mention them to the owner.',
        ],
        link: P.qrReport,
        minutes: 5,
        role: 'anyone',
      },
    ],
  },

  {
    id: 'weekly',
    title: 'Weekly',
    summary: 'The jobs that keep stock, designs, posts and numbers in good order. Each has a day it is due.',
    period: 'week',
    when: 'Each week, on the day shown',
    tasks: [
      {
        key: 'weekly-trade-order',
        title: 'Plan the trade print order for stall stock',
        why: 'Stall stock is foam prints from the trade printer. Ordering weekly replaces what sold and adds new designs.',
        steps: [
          'Open **Trade Print Orders** and press **New order**.',
          'In **Replace stall sales**, set **From** and **To**, then press **Find sales**. Adjust the quantities and add them.',
          'Or search **Add from the catalogue**, tick designs, set the quantity for each size, and press the **Add** button.',
          'Press **Save and check print quality**. Fix any line marked low.',
          'In **Print files for the printer** choose **PDF (exact page size)**, then **Save into a folder…** or **Download ZIP**. Upload the files to the printer.',
          'Press **Mark as ordered** and type the printer\'s order number.',
          'Download the labels with **Download labels PDF** when you are ready to stick them.',
        ],
        link: P.tradeOrders,
        minutes: 30,
        role: 'owner',
        dueDay: 1,
      },
      {
        key: 'weekly-qr-report',
        title: "Review last week's scans by stall",
        why: 'It shows which stall and which designs bring in interest.',
        steps: [
          'Open **Sticker QR Report**.',
          'Set **From** to last Monday and **To** to yesterday.',
          'Compare the stalls in **By location**.',
          'Write down the top three designs in **Most scanned images**.',
        ],
        link: P.qrReport,
        minutes: 10,
        role: 'anyone',
        dueDay: 1,
      },
      {
        key: 'weekly-money',
        title: "Check the week's money",
        why: 'Money questions are for the owner. A weekly look spots surprises early.',
        steps: [
          'Open **Overview**, choose **7 days**, and read the Revenue, Orders and AI spend tiles.',
          'Open **Sales** and choose **Last 7 Days**.',
          'Open **AI Costs** and check the spend per day is steady.',
          'Open **Customer Referrals** and look at the note about referred sales with no credit.',
          "The referral percentages are set at the top of **Customer Referrals**, in **Friend's discount (%)** and **Referrer's bonus (%)**. A new rate applies to orders from then on, credit already earned keeps its old rate, and the wording customers see changes with it. Only change them on purpose.",
          'Write down anything that looks odd and decide whether it needs action.',
        ],
        link: P.sales,
        minutes: 15,
        role: 'owner',
        dueDay: 1,
      },
      {
        key: 'weekly-detect-breeds',
        title: 'Detect breeds and coats for new customisations',
        why: 'It fills in the breed for pets whose owners did not say, so Popularity and Audiences are accurate. It costs a little in AI.',
        steps: [
          'Open **Customisations** and the **All customisations** tab.',
          'If a button called **Detect breeds and coats** shows, check the cost it states.',
          'Press it and wait until the line under it stops changing.',
          'If the button is not there, nothing is left to detect.',
        ],
        link: P.customisations,
        minutes: 5,
        role: 'owner',
        dueDay: 1,
      },
      {
        key: 'weekly-variations',
        title: 'Review new variation pictures',
        why: 'Variations are made in batches. They only go on the site when someone approves them.',
        steps: [
          'Open **Variation Batches** and press **Check now**.',
          'Open a run from the list on the **Runs** tab.',
          'Choose the **To review** filter. Click pictures to tick them, or **Select page**.',
          'Under **Save as**, pick public (customers can see them) or hidden.',
          'Press **Approve** for the ticked ones, or **Reject** the ones that look wrong. If every picture is good, press **Approve all**.',
          'Not sure about a picture? Reject it or leave it for the owner.',
        ],
        link: P.variationBatches,
        minutes: 20,
        role: 'anyone',
        dueDay: 3,
      },
      {
        key: 'weekly-catalogue-checks',
        title: 'Run the Catalogue checks',
        why: 'It finds design titles with stray symbols, the wrong breed, or the same title twice.',
        steps: [
          'Open **Catalogue checks**.',
          'Look at **Markdown in title**, **Title names a different breed** and **Duplicate titles**.',
          'To fix a title, open the design in **Image Catalog**, press **Edit**, change the description and save.',
          'If a list says "None found.", you are done.',
        ],
        link: P.catalogueChecks,
        minutes: 10,
        role: 'anyone',
        dueDay: 3,
      },
      {
        key: 'weekly-social',
        title: 'Review Social',
        why: 'Customer pets can appear on the website feed and Instagram. Each photo is checked first, and some need a person to look.',
        steps: [
          'Open **Social**.',
          'If a red box says **Take these Instagram posts down**, tell the owner at once.',
          'Open the **Checking** tab. If anything is waiting, press **Run waiting checks**.',
          'Open **Left out** and look at the reasons. Press **Feature anyway** only if the photo is clearly fine.',
          'Press **Hide** on anything you would not want customers to see.',
          'Do not change the channel switches at the top. Those are for the owner.',
        ],
        link: P.social,
        minutes: 10,
        role: 'anyone',
        dueDay: 4,
      },
      {
        key: 'weekly-posted-parcels',
        title: 'Check parcels that have not arrived',
        why: 'A parcel that is stuck is easier to sort early.',
        steps: [
          'Open **Orders** and the **Posted** tab. It shows the last 14 days.',
          'Look at the tracking line. Amber means attempted, awaiting collection, returned or a problem.',
          'Press **Check now** on an order to refresh its tracking.',
          'For a stuck parcel, reply to the customer from support@pawtraits.pics. Do not promise a refund. Tell the owner.',
        ],
        link: P.orders,
        minutes: 10,
        role: 'anyone',
        dueDay: 5,
      },
      {
        key: 'weekly-popularity',
        title: 'Read Popularity',
        why: 'It tells you which designs and breeds to make and print more of.',
        steps: [
          'Open **Popularity**.',
          'Set **Period** to the last 7 days (or 30 days).',
          'On the **Prints** tab, read **Most popular original designs**: scans, previews and orders. Change **Sort by** to see the top designs by prints sold, scans, previews made or revenue.',
          'On the **Breeds** tab, read **Breeds and coats of pets customers uploaded** and note breeds we have no designs for.',
        ],
        link: P.popularity,
        minutes: 10,
        role: 'anyone',
        dueDay: 5,
      },
      {
        key: 'weekly-review-offers',
        title: 'Review offers: sent, clicked, bought, failed',
        why: 'It shows whether offers are reaching people and being clicked, and catches failed ones before they pile up. Skip it while Offers is switched off.',
        steps: [
          'Open **Offers** and read the line under **Run now**: **Painted in the last 24 hours** and the counts of each kind of offer.',
          'Open the **Sent** tab. Read **Clicked** and **Bought since** for the week.',
          'Open **Skipped and failed**. Read the **Why** column. For a failed one, press **Try again** if the reason looks like a one-off (see "An offer shows as failed" in Troubleshooting).',
          'Open **AI Costs** and check the spend on "Offer previews" is steady.',
          'In **Automatic campaigns**, read "Due in the next 30 days" on each card, and decide whether the caps (**People painted per run** and **People painted per day**) still suit.',
          'Write down anything odd for yourself. Switching offers on or off, and sending automatically, are your decisions.',
        ],
        link: P.offers,
        minutes: 15,
        role: 'owner',
        dueDay: 5,
      },
    ],
  },

  {
    id: 'monthly',
    title: 'Monthly',
    summary: 'Money, prices, security reports and marketing. Do these on the first working day of the month.',
    period: 'month',
    when: 'First working day of the month',
    tasks: [
      {
        key: 'monthly-money',
        title: 'Review last month: revenue, costs and profit',
        why: 'A monthly look at the whole picture shows whether the business is working.',
        steps: [
          'Open **Revenue**, then **Costs**, then **Profit**.',
          'Choose **Monthly** on each page and look at last month.',
          'On **Costs**, press **Add Cost** for any bills that are not yet recorded.',
          'Open **AI Costs** and compare the month with the one before.',
        ],
        link: P.revenue,
        minutes: 30,
        role: 'owner',
      },
      {
        key: 'monthly-pricing',
        title: 'Review pricing',
        why: 'Prices must come from Pricing Management so the shop, the stall and the emails agree.',
        steps: [
          'Open **Pricing Management**.',
          'Look for pricing marked **Scheduled** or **Expired**.',
          'Press **Add Pricing** only to set a new price or a promotion. Change nothing you are unsure about.',
        ],
        link: P.pricing,
        minutes: 15,
        role: 'owner',
      },
      {
        key: 'monthly-csp',
        title: 'Read the CSP Reports',
        why: 'The content security policy is on trial, in report-only mode. Reports show what it would block, so the owner can decide when to turn it on.',
        steps: [
          'Open **CSP Reports**.',
          'Read the list by **Directive**, **Blocked** and **Count**.',
          'Note anything new since last time. Do not press **Clear all** unless the owner says so.',
          'If the page says to run the csp-reports migration, tell the owner.',
        ],
        link: P.csp,
        minutes: 10,
        role: 'owner',
      },
      {
        key: 'monthly-audiences',
        title: 'Update the Meta audience list',
        why: 'Marketing goes only to people who agreed to hear from us. Sending anything to them is for the owner.',
        steps: [
          'Open **Audiences**.',
          'Choose the group (for example **Buyers**).',
          'On **Preview emails**, the **Breed**, **Coat** and **Design** filters narrow the list, and the download follows them. Check the count on the button before you press it.',
          'Press **Download list for Meta** and upload it to Meta Ads Manager.',
          'The list only includes people who agreed to hear from us.',
        ],
        link: P.audiences,
        minutes: 15,
        role: 'owner',
      },
      {
        key: 'monthly-collections-seasons',
        title: 'Check the seasons ahead',
        why: 'Occasion collections such as Christmas and Valentine\'s need designs ready before the season starts.',
        steps: [
          'Open **Collections**.',
          'Read the line "Promoted right now".',
          'Find the next occasion that starts within the month and check it has designs.',
          'Tell the owner if an occasion has few or no designs.',
        ],
        link: P.collections,
        minutes: 10,
        role: 'anyone',
      },
      {
        key: 'monthly-offer-campaigns',
        title: 'Plan campaigns for the season ahead',
        why: 'An offer campaign paints a pet into designs for an occasion such as Christmas or Mother\'s Day. It needs designs ready, so do it after "Check the seasons ahead" has shown which occasions are ready.',
        steps: [
          'Start from the occasions found in "Check the seasons ahead". Only plan one that has designs.',
          'Open **Offers** and the **Campaigns** tab. If a draft for that occasion is already there, use it.',
          'Under **New campaign**, type a **Name** such as "Christmas 2026".',
          'Choose the designs: pick a collection under **and/or a collection**, or paste design ids or customise links. The campaign needs at least three designs.',
          'Choose **Who gets it**, then press **Save campaign**. It is saved as a draft and nothing happens yet.',
          'Press **Count who is eligible** on the draft to see how many people it would reach.',
          'Press **Start** only when you are ready to approve the pictures that follow, so they can be emailed in time for the occasion. See the Offers guide ("Campaigns you start by hand").',
          'While you are here, glance at the **Birthday** and star-sign switches in **Automatic campaigns**. Change them only if you mean to.',
        ],
        link: P.offers,
        minutes: 20,
        role: 'owner',
      },
      {
        key: 'monthly-test-emails',
        title: 'Send yourself a test email',
        why: 'It checks customer emails still look right and arrive.',
        steps: [
          'Open **Test Email**.',
          'Choose a template, such as the order confirmation.',
          'Type your own email address.',
          'Press **Send Test Email** and check it arrives. Look in spam if it does not.',
        ],
        link: P.testEmail,
        minutes: 10,
        role: 'anyone',
      },
    ],
  },

  {
    id: 'wrong',
    title: 'When something goes wrong',
    summary: 'First aid. These are not ticked off. The Troubleshooting section has more.',
    period: null,
    when: 'Whenever it happens',
    tasks: [
      {
        key: 'wrong-print-file',
        title: 'A print file will not open or looks wrong',
        why: 'The order must not be printed from a bad file.',
        steps: [
          'Open **Orders** and find the order.',
          'Click the three dots (**More actions**) and choose **Rebuild print files**.',
          'Open **Print file** again. If it is still wrong, tell the owner and do not print.',
        ],
        link: P.orders,
        minutes: 5,
        role: 'anyone',
      },
      {
        key: 'wrong-held-order',
        title: 'An order is on hold',
        why: 'Held orders look underpaid or odd.',
        steps: [
          'Tell the owner the order number.',
          'The owner checks the payment in Stripe, then presses **Release to print**.',
        ],
        link: P.orders,
        minutes: 5,
        role: 'owner',
      },
      {
        key: 'wrong-gelato-error',
        title: 'An order shows a printing error',
        why: 'The order did not reach Gelato, or Gelato refused it.',
        steps: [
          'Open **Overview** and the line **Orders with a printing error**.',
          'Open the order and read the red message.',
          'Tell the owner. Sending an order to Gelato is the owner\'s job because Gelato charges for it.',
        ],
        link: P.orders,
        minutes: 5,
        role: 'owner',
      },
      {
        key: 'wrong-email-stuck',
        title: 'A customer says an email never arrived',
        why: 'Most emails go out through the queue.',
        steps: [
          'Open **Message Queue** and look at **Pending** and **Failed**.',
          'Press **Process Queue Now**.',
          'For a posted email, open the order in **Orders**, click **More actions**, and choose **Resend “posted” email**.',
          `Ask the customer to look in spam. Tell them to write to ${SUPPORT_EMAIL} if it still does not arrive.`,
        ],
        link: P.queue,
        minutes: 5,
        role: 'anyone',
      },
      {
        key: 'wrong-takedown',
        title: 'Instagram posts need taking down',
        why: 'A customer opted out, or a pet was hidden after the post went live.',
        steps: [
          'Open **Social**.',
          'The red box **Take these Instagram posts down** lists each post.',
          'Tell the owner. Deleting or editing a post is done in the Instagram app by the owner.',
        ],
        link: P.social,
        minutes: 5,
        role: 'owner',
      },
    ],
  },
];

// ---------------------------------------------------------------------------------------------
// GUIDES
// ---------------------------------------------------------------------------------------------

export const GUIDES: Guide[] = [
  {
    slug: 'orders-and-posting',
    title: 'Orders and posting',
    summary: 'From a paid order to a posted parcel: print, pack, label, post, and what to do when it goes wrong.',
    sections: [
      {
        heading: 'How an order moves',
        body: [
          'Open **Orders**. The **Fulfilment** card at the top is your working list.',
          'Orders with prints to post move through four steps: **To print**, **Printed**, **Packed** and **Posted**. The number beside each tab shows how many orders are in it.',
          'Three more tabs only appear when something is in them: **On hold**, **Not routed** and **Gelato**.',
          'Downloads and prints handed over at the stall do not appear here, because there is nothing to post.',
          'Every paid print order also includes a free digital copy. You do not have to do anything for it.',
        ],
        links: [P.orders],
      },
      {
        heading: 'Which orders you print and which go to Gelato',
        body: [
          'Foam prints are made through the UK trade printer and you post them. Mugs, phone cases, art paper, framed and acrylic orders go through Gelato, who print and post them.',
          'The **Gelato** tab lists orders sent to Gelato in the last 30 days. You do not print or post those. You only watch for errors.',
          'The selector **New orders go to** at the top of the card sets where new print orders go: **Self print (default)** or **Gelato (automatic)**. Leave it alone. It is the owner\'s setting.',
          'If an order is in To print but should go to Gelato, ask the owner. They can use **Send to Gelato instead** in the order\'s **More actions** menu. Gelato charges for it and it cannot be undone from here.',
        ],
      },
      {
        heading: 'Step 1: print',
        body: [
          'Open the **To print** tab. Oldest orders come first.',
          'Each order shows the customer\'s name and postcode, a picture of each item, its size, and a reference such as PW-1234-1.',
          'Open **Print file** next to each item. The small text under it shows the quality. Red text such as "too low", "4K master failed" or "No print file" is a problem. Use **Rebuild print files** (see below) before printing.',
          'An amber **Note:** line is a message for whoever packs the order. It also appears on the packing slip.',
          'Send the print file to the trade printer. When the print is done, press **Printed**. To do many at once, tick them and press **Mark printed**.',
        ],
      },
      {
        heading: 'Step 2: pack',
        body: [
          'Open the **Printed** tab and tick the orders you are packing.',
          'Press **Packing slips**. A PDF opens with one A4 page per order: a cut-out address label, the items with their references, and any packing note. With several orders ticked, a pick list comes first.',
          'Pack each print with its slip. When finished, press **Mark packed**. For one order, press **Packed**.',
          'On the order\'s own page you can type a **Packing note** and press **Save note**.',
        ],
      },
      {
        heading: 'Step 3: labels and posting with Royal Mail',
        body: [
          'Open the **Packed** tab, tick the orders going out, and press **Royal Mail labels**.',
          'The window lists each order with a suggested parcel (Large letter, Small parcel or Medium parcel), a weight, and a service code. Check them against the real parcel. Change the parcel or weight if it is wrong. Leave the service code empty to let Click & Drop\'s own rules choose.',
          'Keep "Mark them posted and email each customer their tracking number" ticked if the parcels leave today. If you will not post today, untick it. The order is then marked posted automatically at Royal Mail\'s first scan.',
          'Press the purple button (it says how many labels). A label PDF opens in a new tab. If nothing opens, allow pop-ups. Print at 100% (Actual size) or the labels will not fit.',
          'If the window says Royal Mail is not connected, tell the owner. Do not open **Royal Mail settings**.',
          'Made a label by mistake or lost it? Open the **Posted** tab, tick the order and press **Labels again**.',
        ],
      },
      {
        heading: 'Posting without Royal Mail labels',
        body: [
          'Use this for another courier, or if you posted a parcel yourself.',
          'On the order, press **Posted…**. In the window choose the **Postage service**.',
          'Tracked services need the **Tracking number** from the label. For **Other**, type the courier name.',
          'Leave **Email the customer now** ticked to send the "on its way" email, then press **Mark posted**.',
          'You can also tick the orders and press **Click & Drop CSV** to import them into Royal Mail Click & Drop yourself.',
        ],
      },
      {
        heading: 'After posting',
        body: [
          'The **Posted** tab shows the last 14 days with the latest tracking, checked automatically. Press **Check now** to refresh one order.',
          'To send the customer\'s posted email again, click **More actions** on the order and choose **Resend “posted” email**.',
          'Posted by mistake? **More actions** then **Move back a step** goes back one stage. The posted email is not sent again if you post it again.',
        ],
      },
      {
        heading: 'Fixing a bad print file',
        body: [
          'Click **More actions** on the order and choose **Rebuild print files**. It makes the files again from the customer\'s picture.',
          'Open **Print file** again to check. If it is still wrong, do not print. Tell the owner.',
          'Every print file should be a full-size file for that size. If it says "not cropped to size", ask the owner before printing.',
        ],
      },
      {
        heading: 'Orders on hold, not routed, or with errors',
        body: [
          '**On hold** means the amount paid looked wrong. The owner checks the payment in Stripe and then presses **Release to print**.',
          '**Not routed** means the order was paid before fulfilment was set up, or automatic routing failed. The owner chooses **Self print** or Gelato.',
          'A printing error on a Gelato order shows on **Overview** under **Orders with a printing error**. Tell the owner.',
        ],
        links: [P.overview],
      },
      {
        heading: 'Finding an order',
        body: [
          'On **Orders**, scroll below the Fulfilment card to **Search & Filter Orders**.',
          'Type an email, a name or an order number into the search box.',
          'Press **Filters** to narrow by status, date range or order type.',
          'Click an order number to open the order page. It shows the customer, the address, the items, the payment and the fulfilment card.',
        ],
      },
      {
        heading: 'Replying to customers',
        body: [
          `Customers write to ${SUPPORT_EMAIL}. Answer in plain, friendly words.`,
          'Do not promise a delivery time or a refund. The site makes no such promises.',
          'Refunds, price changes and complaints go to the owner first.',
          'For "where is my order?", open the order, look at its stage and tracking, and tell the customer what you see.',
        ],
        links: [P.orders, P.customers],
      },
    ],
  },

  {
    slug: 'trade-print-orders-and-stock',
    title: 'Trade print orders and stock',
    summary: 'How to order foam prints from the trade printer for the stalls.',
    sections: [
      {
        heading: 'What a trade print order is',
        body: [
          'A trade print order is a list of designs and sizes you send to the UK trade printer. It makes the foam prints you keep as stall stock.',
          'Sizes are Small, Medium, Large and XL, shown as S, M, L and XL. Prices are not set here. See **Pricing Management**.',
          'An order moves through **Draft**, **Files downloaded**, **Ordered**, **Received** (or **Cancelled**).',
        ],
        links: [P.tradeOrders, P.pricing],
      },
      {
        heading: 'Making an order',
        body: [
          'Open **Trade Print Orders** and press **New order**.',
          'To replace what you sold: in **Replace stall sales** choose **From** and **To**, tick the stalls, and press **Find sales**. The start date follows on from the last order. Adjust the quantities and add the lines.',
          'To add designs: in **Add from the catalogue** search, filter by layout, collection, dog or cat, breed, or "Not on a trade order yet". Tick the designs, set a quantity for each size, and press the **Add** button.',
          'Press **Save and check print quality**. Each line shows the print size and the quality. Fix or remove lines that are marked low.',
        ],
      },
      {
        heading: 'Sending the files and placing the order',
        body: [
          'In **Print files for the printer** choose **PDF (exact page size)** or **JPG**.',
          'Press **Save into a folder…** (where your browser allows it) or **Download ZIP**. The files are one per line at the exact finished size, with the size and quantity in each name, plus an order-sheet.csv.',
          'Upload them to the printer and place the order with them.',
          'Back in the admin, press **Mark as ordered** and type the printer\'s order number. The order is now **Ordered**.',
          'When the prints arrive, press **Mark as received**.',
          'To abandon an order, press **Cancel order**. **Delete** is only for drafts. Both are for the owner.',
        ],
      },
      {
        heading: 'Labels for the new stock',
        body: [
          'In the **Labels** box choose the stall the QR should credit (or **No stall**), whether to print a label for the front and back, and the **Start at label** number for a part-used sheet.',
          'Press **Download labels PDF**. Print at 100% (Actual size). Tick **Outlines** to do a test on plain paper first.',
        ],
      },
      {
        heading: 'When an order is late',
        body: [
          '**Overview** warns about trade print orders that were ordered over 10 days ago and have not been marked received, and orders whose files were downloaded but never marked as ordered.',
          'Open the order. If the prints have arrived, press **Mark as received**. If not, contact the printer. Do not place the same order twice.',
        ],
        links: [P.overview],
      },
    ],
  },

  {
    slug: 'stall-kit-stickers-and-scans',
    title: 'Stall kit, stickers and scans',
    summary: 'Stickers, divider cards, locations and the scan report for market days.',
    sections: [
      {
        heading: 'How the stall works',
        body: [
          'Every print has a QR sticker on the back. A shopper scans it with their phone and lands on that design with their size chosen.',
          'They can put their own pet in the picture (a free preview) or buy the print. At a stall they can pay on their phone and show a green PAID screen.',
          'Scans and orders from a sticker are credited to the stall named on it, even if the shopper buys a different design.',
          'The stalls are at Covent Garden and Spitalfields. Phone reception is poor at Spitalfields, so use the trader Wi-Fi.',
        ],
      },
      {
        heading: 'Locations',
        body: [
          'Open **Locations**. Each stall has a short code (2 to 8 letters or numbers).',
          'To add one, press **Add location** and fill in the **Code**, **Name**, **Type** and **Address / notes**.',
          'Only add or edit locations if the owner asks. A wrong code means scans are not credited properly.',
        ],
        links: [P.locations],
      },
      {
        heading: 'Making sticker sheets',
        body: [
          'Open **Sticker Sheets**.',
          'Choose the **Location (printed into every QR)**. Leave **Start at label position** at 1 for a fresh sheet. Use a higher number to carry on a part-used sheet. The **Call to action (optional)** is the line printed on each label.',
          'Add designs by their ref number in the box. Type refs such as 1123 or 1124 1130, press **Add**, and pick a size for each.',
          'Press **Download PDF**. Print at 100% (Actual size), not "Fit to page", or the labels will not line up.',
          'You can also open any design in **Image Catalog**, find its QR panel, and press **Sticker sheet**.',
        ],
        links: [P.stickers, P.imageCatalog],
      },
      {
        heading: 'Divider cards',
        body: [
          'Open **Divider Cards**. They are cards for the flip-through bins, one per breed, as wide as the prints.',
          'Choose the **Print size** and tick the breeds, or press **Select all**. Press **Preview** on one breed to see its card.',
          'To change which three designs show on a card, press the button on the card that lets you choose them.',
          'Press the **Download** button for the PDF. One card per page, at exact size.',
        ],
        links: [P.dividers],
      },
      {
        heading: 'Reading the scan report',
        body: [
          'Open **Sticker QR Report** and set **From** and **To**.',
          '**By location** shows scans, visitors, orders, conversion and revenue for each stall.',
          '**Most scanned images** shows which designs people look at most.',
          'Someone scanning a sticker in the pub, long after the sale, still counts for the stall that sold it.',
        ],
        links: [P.qrReport],
      },
      {
        heading: 'Helping a shopper who is stuck',
        body: [
          'Check they have signal. At Spitalfields, help them onto the trader Wi-Fi.',
          'Ask them to scan again. If the sticker is damaged, find the design in **Image Catalog**, open its QR panel and press **Test link**. Show them the page on your phone.',
          'If their preview fails, open **Customisations** and look for the **Failed** badge. They can try again. If many fail, tell the owner.',
          'Do not promise anything about delivery times.',
        ],
        links: [P.customisations],
      },
    ],
  },

  {
    slug: 'catalogue-designs-and-versions',
    title: 'Catalogue: adding designs and versions',
    summary: 'Finding, adding and reviewing designs, and how versions work.',
    sections: [
      {
        heading: 'Originals and versions',
        body: [
          'An original is a design someone made and uploaded. A version is a copy of it in another breed, coat or outfit.',
          'In **Image Catalog**, versions carry a **Variation** badge. Filter with **Uploads only** or **Variations only**.',
        ],
        links: [P.imageCatalog],
      },
      {
        heading: 'Adding a design',
        body: [
          'Use **Generate Images** to build the prompt: choose the breed, theme, style and format and press **Generate Prompt**. **Copy Prompt** puts it on your clipboard.',
          'Make the picture with your usual tool, then upload it. In **Image Catalog**, press **Upload** for one picture or **Bulk upload** for many.',
          'On the upload page, fill in the details. Tick **Public (visible to customers)** only when it is ready.',
          'After saving, the design is filed into collections and tagged automatically.',
        ],
        links: [P.generate, P.imageCatalog],
      },
      {
        heading: 'Looking after a design',
        body: [
          'Click a design in **Image Catalog** to open **Image Details**. You can edit the description and tags and see the AI prompt.',
          'The eye on a card hides a design from the public (**Hide from public**) or shows it (**Make public**).',
          'Deleting a design cannot be undone. Only the owner deletes.',
        ],
      },
      {
        heading: 'Making many versions at once',
        body: [
          'Open **Variation Batches**. A saved batch is a set of breed, coat and outfit combinations.',
          'Press **New saved batch** to make one. Press **Run a batch** to run one on chosen designs. Results come back from Gemini Batch (half price) usually within a few hours and at most 24.',
          'Open a run and choose **To review**. Approve or reject the pictures, as in the weekly task. **Check now** looks for new results.',
          'If some failed, open the run and press the button that reads "Try", then a number, then "failed again". To stop a run, press **Cancel run**.',
        ],
        links: [P.variationBatches],
      },
      {
        heading: 'Keeping titles tidy',
        body: [
          'Open **Catalogue checks** weekly. It lists titles with stray markdown, titles naming a different breed, and repeated titles.',
          'Fix a title in **Image Catalog** by opening the design and pressing **Edit**.',
        ],
        links: [P.catalogueChecks],
      },
      {
        heading: 'Mugs and phone cases',
        body: [
          'Mugs: **Mug Catalog** holds the zodiac and breed mugs; **Mug Generations** shows what customers have made. Leave the setup to the owner.',
          'Phone cases are not on sale yet. **Phone Cases** shows the models and the case art. Leave it to the owner.',
        ],
        links: [P.mugCatalog, P.mugGenerations, P.phoneCases],
      },
    ],
  },

  {
    slug: 'collections-zodiac-and-tarot',
    title: 'Collections, zodiac and tarot frames',
    summary: 'How designs are filed, how captions and frames work, and how to put them on.',
    sections: [
      {
        heading: 'What collections are',
        body: [
          'Besides breed, customers browse collections: Occasions, Sports, 16 Pawsonalities, Zodiac signs and Tarot cards.',
          'Open **Collections**. It has four tabs: **Collections**, **Themes → collections**, **Tagging** and **Team versions**.',
          'The line "Promoted right now" lists the occasions currently in season.',
          'New designs are filed automatically by theme and tagged by AI. A design you take out of a collection stays out.',
        ],
        links: [P.collections],
      },
      {
        heading: 'Tagging',
        body: [
          'On the **Tagging** tab you can press **Tag the catalogue** to tag designs that have none. Press **Try failed ones again** for ones that failed.',
          'The review grid lets you check designs the tagger was unsure about and press **Re-tag**.',
        ],
      },
      {
        heading: 'Plates and frames',
        body: [
          'A plate is a translucent gold name plate with the Pawsonality title and tagline. A frame is the ornate border with title and tagline used for zodiac signs and tarot cards.',
          'Open **Captions**. Choose **16 Pawsonalities**, **Zodiac signs** or **Tarot cards**. Edit the wording for dogs and cats and press **Save wording**.',
          'For a Pawsonality, press **Put on all** to draw the plate on every design in it, or **Take off all** to remove it.',
          'For zodiac signs and tarot cards, press **Put the frame on every design** to catch up the older designs. Designs filed in a sign or card later are framed automatically. If it says some are still to do, press it again.',
          '**Redraw frames** redraws them after you change the wording. **Take the frame off all** removes them.',
        ],
        links: [P.captions],
      },
      {
        heading: 'One design at a time',
        body: [
          'Open a design in **Image Catalog**. For a Pawsonality design the **Caption plate** panel puts the plate on or takes it off. **Take it off** removes it.',
          'For a zodiac or tarot design, the **Framed card** panel draws the frame. **Remove the frame** takes it away. A framed design is sold as a print or a digital download, and is left out of the mug and phone case ranges.',
          '**Words on the picture** is a separate panel for adding words to a design.',
        ],
        links: [P.imageCatalog],
      },
      {
        heading: 'A design shows without its frame',
        body: [
          'Open the design in **Image Catalog** and check it is in the right zodiac sign or tarot card.',
          'Open **Captions**, choose the type, and press **Put the frame on every design**.',
        ],
      },
    ],
  },

  {
    slug: 'customisations-and-customer-photos',
    title: 'Customisations and customer photos',
    summary: 'What customers make, how to find a failed one, and how photos are handled.',
    sections: [
      {
        heading: 'What a customisation is',
        body: [
          'A customisation is a customer\'s pet painted into a design. A free preview is the first one they make. Pawcasso paints them.',
          'Open **Customisations**. **Analytics** shows totals, a daily chart and tables by design, breed and source. **All customisations** lists each one.',
          'You can search by email or pet name.',
        ],
        links: [P.customisations],
      },
      {
        heading: 'Failed customisations',
        body: [
          'A failed one shows a red **Failed** badge in **All customisations**. The customer sees an error and can try again.',
          'Press **Prompt, timings and AI cost →** to see what went wrong on the **Customer Paintings** page.',
          'There is no retry button here. If many fail, tell the owner.',
        ],
        links: [P.customerPaintings],
      },
      {
        heading: 'Detecting breeds',
        body: [
          'When breed is not known for some customisations, a **Detect breeds and coats** button appears. It uses the AI to guess the breed from the photo and costs a small amount per one.',
          'This is the owner\'s call. See the weekly task.',
        ],
      },
      {
        heading: 'Customer photos',
        body: [
          'Customer photos are private. Do not share them or save them anywhere except where the admin shows them.',
          'A photo may be shown on the website feed or Instagram, after an automatic check, unless the customer opts out. See the Social guide.',
        ],
      },
    ],
  },

  {
    slug: 'customers-audiences-and-marketing',
    title: 'Customers, audiences and marketing',
    summary: 'Finding a customer, who has agreed to marketing, and sending nothing without the owner.',
    sections: [
      {
        heading: 'Customers',
        body: [
          'Open **Customers** to search by name, email or phone. Click a customer to see their pets, orders and activity.',
          'The **Marketing emails** line shows whether they are subscribed. Do not press **Unsubscribe** unless the customer asks you to. Change nothing else.',
        ],
        links: [P.customers],
      },
      {
        heading: 'Who has agreed to hear from us',
        body: [
          'People are subscribed in one of two ways. They tick a box saying yes, or they buy and do not choose "No thanks, just my order emails" (a soft opt-in).',
          'Someone who unsubscribes is never subscribed again by a purchase.',
          'Marketing goes only to **Subscribed** people. **Unsubscribed** and **not asked** people get none.',
        ],
      },
      {
        heading: 'Audiences',
        body: [
          'Open **Audiences**. The tabs show **Buyers**, people who asked for a preview by email, and stall QR scanners.',
          'Filter by stall, date range, breed, coat or design. Tick **Include people who have bought** if you want them too.',
          'Press **Download list for Meta** for a file of subscribed people. Uploading it to Meta is the owner\'s job.',
          'The download follows the filters you have set. On **Preview emails**, the **Breed**, **Coat** and **Design** filters narrow the file as well as the table, and the button shows how many people will be in it. **Buyers** has the stall and date filters only.',
        ],
        links: [P.audiences],
      },
      {
        heading: 'Popularity',
        body: [
          'Open **Popularity** to see which designs get scans, previews and sales, and which breeds and coats customers upload.',
          'The **Prints** tab ranks original designs. Every breed and coat version counts towards its original, and **Sort by** changes the ranking. The **Breeds** tab shows the breeds and coats of the pets customers uploaded. **Download CSV** saves the tab you are on.',
          'Use it to decide what to make and print next.',
        ],
        links: [P.popularity],
      },
      {
        heading: 'Sending marketing',
        body: [
          'Only the owner sends marketing. If a customer asks to stop hearing from us, tell the owner.',
        ],
      },
    ],
  },

  {
    slug: 'offers',
    title: 'Offers: painting from a kept photo',
    summary: 'New pictures painted from a photo a customer already gave us, approved by you and then emailed.',
    sections: [
      {
        heading: 'What Offers is and who gets one',
        body: [
          'When someone asks for a preview by email, we keep their pet\'s photo. Offers lets Pawcasso paint that pet into a few more designs (three, and at least two good ones are needed) and email them. Every picture waits on **Offers** until you approve it, unless **Send automatically** is switched on.',
          'Previewers are people who asked for a preview by email after the site began saying that we keep the photo. They must also have opened the link in the preview email. Requests made before that wording was added are never used.',
          'Buyers are people with a paid order that was not cancelled or refunded. A buyer is only offered something after they have been shown the same photo wording. That happens on the preview card, at checkout, or through the one-off "Tell past buyers" email. Then a grace period has to pass first (the **Buyers: days after they are shown the photo wording** setting).',
          'Everyone must also be subscribed to offers. Nobody gets more than one offer email a week, of any kind.',
          'Round 1 goes to a previewer a set number of days after they opened the preview email. Round 2 goes a set number of days after round 1 was sent. A previewer who buys after asking for the preview gets no more offers. Birthday, star-sign and hand-started campaigns are covered below.',
        ],
        links: [P.offers],
      },
      {
        heading: 'The switches and numbers',
        body: [
          'Open **Offers**. The **Settings** box at the top holds everything. Press the **Save** button next to a number to keep it.',
          '**Offers on** is the master switch. While it is off, nothing is queued, painted or sent, and **Run now**, **Start** and the buttons in **Tell past buyers** are greyed out. It starts off.',
          '**Send automatically** is off by default. Off means every offer waits for your approval. On means finished offers are emailed without anyone looking. Leave it off unless the owner has decided otherwise.',
          '**Round 1: days after they open the preview email** and **Round 2: days after round 1 is sent** set the timings.',
          '**People painted per run** and **People painted per day** are the caps. The line under them, **Painted in the last 24 hours**, shows how close you are. The caps count one for each person painted, plus one for each picture you replace by hand, and they limit what is spent (see "Costs").',
          '**Birthday: days before their birthday** and **Zodiac: days before their sign starts** set how early those campaigns begin. Both must be at least 5. **Buyers: days after they are shown the photo wording** is the grace period for buyers.',
          'Pictures are painted and sent once an hour on their own. **Run now** does one pass straight away: it queues anyone who is due, paints up to the caps, and sends offers you have already approved. A message tells you how many were queued, painted and sent.',
        ],
      },
      {
        heading: 'Birthday and star-sign campaigns',
        body: [
          'The **Automatic campaigns** box has a card for birthdays and one for star signs. Each has its own switch, off until you turn it on, and asks you to confirm with **Switch on**. **Offers on** must be on too, and every offer still waits for approval unless **Send automatically** is on.',
          'Each card has **Who gets it** (**Previewers**, **Buyers** or **Both**), a days-before number, **Email subject (optional)**, **One line of email copy (optional)** and **Save wording**. The days-before number is the same setting as in the **Settings** box.',
          'A birthday offer is made from that many days before the birthday, up to five days before it. A pet whose birthday we learn later than that waits until next year. A star-sign offer is made from that many days before their sign starts. The sign comes from the birthday, or from the zodiac quiz if there is no birthday. If both are due in the same week, the birthday goes first.',
          'The star-sign offer puts a framed card for their sign first, with two other designs. A star-sign offer is only made when the pet is known to be a dog or a cat, and a birthday offer only when there are at least two birthday designs to paint into.',
          'The birthday comes from the saved pet, from what the visitor told us on the preview card, or from a small "When\'s their birthday?" link in an offer email. Each card shows how many people have a known birthday or sign, and how many are due in the next 30 days. Fewer known means fewer offers.',
          'An offer is not emailed once the day it is for has passed.',
          'Both cards need the second migration (see "First time switching it on").',
        ],
      },
      {
        heading: 'The approval queue',
        body: [
          'Open the **Waiting for approval** tab. Each card shows their photo, their email with part hidden, the pet\'s name and breed, and one line: Previewer or Buyer, what the offer is (Round 1, Round 2, Birthday, a star sign, or the campaign\'s name) and when it was made. A previewer shows the design they first previewed. A buyer shows when and where they were shown the photo wording. A birthday or star-sign offer shows the day it is for.',
          'Under each picture are its design name and a short line saying why it was chosen.',
          '**Drop this picture** leaves one out of the email. You cannot drop one when only two remain.',
          '**Paint a different one** paints another design in its place. It costs AI money and counts towards the daily cap.',
          '**Approve and send** asks you to confirm, then emails the customer straight away with the pictures that are left. The checks are made again at that moment. If the person has since unsubscribed, bought, or said no, nothing is sent, the offer moves to **Skipped and failed**, and the message says why.',
          '**Skip this person** sends nothing for this round.',
          '**Stop offers for this person** gives them no more offers at all, and their photo is no longer used for them. Use it when you know they do not want them.',
        ],
      },
      {
        heading: 'What to look for before you approve',
        body: [
          'The pet looks like the photo: the same colouring, markings and shape. If you would not know it was them, do not send it.',
          'Nothing odd in the picture: no extra legs or heads, no strange objects, no people, no stray words, no smudged or broken areas.',
          'It is the right animal. A cat must not be painted as a dog, or the other way round.',
          'For a star-sign offer, the framed card shows the right sign for this pet and the pet\'s name is spelled correctly. The offer\'s label and date show which sign it is for.',
          'At least two good pictures remain. Drop or repaint the bad ones. If none are good, or you are unsure, press **Skip this person** or leave it waiting.',
        ],
      },
      {
        heading: 'Queued, sent, skipped and failed',
        body: [
          'The **Queued** tab lists offers waiting to be painted or being painted, with when each is due. There is nothing to press there.',
          'The **Sent** tab lists what has been emailed, when it was sent, whether they clicked, and whether they have bought since.',
          'The **Skipped and failed** tab lists offers that did not go out, with the reason under **Why**. A skipped offer is final: the reason is one of the safety checks, such as "No longer subscribed to offers" or "They have bought since asking for the preview". Do not try to get round it.',
          'A failed offer shows **Try again**. It puts the offer back in the queue and the pictures are painted again from scratch on the next run (or press **Run now**), which costs AI money again.',
          'If an offer was approved but the send failed, the message says it will be tried again on the next run. Until then it appears in no tab, only in the counts beside **Run now**.',
        ],
      },
      {
        heading: 'Campaigns you start by hand',
        body: [
          'Use these for Christmas, Valentine\'s, Mother\'s Day and the like. Open the **Campaigns** tab.',
          'Under **New campaign**, type a **Name**. **Email subject (optional)** and **One line of email copy (optional)** replace the standard wording.',
          'Choose the designs: paste design ids or customise links into **Designs: paste design ids or customise links, one per line**, or pick a collection under **and/or a collection**, or both. The campaign needs at least three designs to draw from.',
          'Choose **Who gets it**: **Previewers**, **Buyers** or **Both**. Buyers need the second migration; until it is run, campaigns go to previewers only.',
          'Press **Save campaign**. It is saved as a draft and nothing is sent.',
          'Press **Count who is eligible** on the draft. It shows how many people could be offered it now, split into previewers and buyers, and how many designs it can draw from.',
          'Press **Start** and confirm. One offer is queued for everyone eligible at that moment. The pictures are painted within the daily cap, then wait for your approval before anything is emailed. A campaign can only be started once. **Start** is greyed out while **Offers on** is off.',
          'Each person is offered a given campaign once, and not within a week of any other offer email.',
        ],
      },
      {
        heading: 'Tell past buyers',
        body: [
          '**Tell past buyers** is a one-off email to people who have bought. It says we have kept the photo they sent, that from time to time Pawcasso will paint their pet into something new (a birthday surprise, their star sign, the odd seasonal treat) and email it to them, and that they need do nothing if that sounds fun. It carries one-click links to unsubscribe, to change their preferences and to say "Please don\'t reuse my photo".',
          'It goes only to subscribed buyers with a photo we can use who have not yet been shown the photo wording. The box shows how many that is. It needs **Offers on** and the second migration.',
          'It is never sent automatically. It goes only when someone presses the button.',
          'Press **Send me a test** first. It sends the notice to your own sign-in address and nobody else, and records nothing. Check it looks right.',
          'Then press the button that says **Send to** and a number, and confirm. It cannot be undone and nobody is emailed twice. One press sends to at most 500 people. If the count is still above zero afterwards, press again.',
          'Once a buyer has been told, and the grace period has passed, they can be offered things.',
        ],
      },
      {
        heading: 'How people say no',
        body: [
          'Every offer email has the usual unsubscribe link, which stops all marketing email.',
          'Every offer email, and the notice to past buyers, also has a "Please don\'t reuse my photo" link. One click and it is done. It stops photo offers and leaves their other emails alone.',
          'The email preferences page, which opens from the link in any marketing email, has a switch called "Paint my pet into new designs from the photo I sent". It shows for people who are subscribed. They can turn it off, and back on.',
          'On a waiting card you can press **Stop offers for this person**. That stops every future offer and records the same photo opt-out.',
        ],
      },
      {
        heading: 'What stops offers automatically',
        body: [
          'An offer is not painted or sent if the person has unsubscribed from offers, has said "Please don\'t reuse my photo", or has had offers stopped by you.',
          'A previewer who has bought since asking for the preview gets nothing. A buyer needs to have been shown the photo wording first.',
          'Nothing is made if the preview or the photo is no longer there, or after the birthday or star-sign day the offer was for.',
          'These checks are made when the offer is queued, again before it is painted, and again at the moment of sending. A person who is stopped moves to **Skipped and failed** with the reason.',
        ],
      },
      {
        heading: 'Costs',
        body: [
          'Each picture is an AI painting that costs money, even if it is dropped or the offer is never sent. They show on **AI Costs** under "Offer previews".',
          '**Paint a different one** and **Try again** cost more. **People painted per run** and **People painted per day** limit the spend, and **Run now** respects them.',
          'The emails show the same watermarked pictures as a normal preview. Prices come from Pricing Management and are never typed into offers.',
        ],
        links: [P.aiCosts],
      },
      {
        heading: 'First time switching it on',
        body: [
          'The owner runs db/migrations/2026-11-16-preview-offers.sql in the Supabase SQL editor. Until then **Offers** only says to run it. Never run SQL yourself.',
          'The owner also runs db/migrations/2026-11-16-offers-campaigns.sql. This is needed for buyers, birthdays, star signs and **Tell past buyers**. Reload **Offers** afterwards.',
          'Check **Send automatically** is off, and that **People painted per run** and **People painted per day** are small.',
          'Switch **Offers on** and press **Run now**. Offers only appear once people are due, so there may be nothing to see at first.',
          'Open **Waiting for approval** and approve the first few by hand, checking each one carefully.',
          'The page cannot send an offer to an address you choose, so there is no way to test one on yourself. Approving emails the real customer. Check the first sent ones on the **Sent** tab, and use **Send me a test** to see what the past-buyers email looks like.',
          'Leave the birthday and star-sign switches off until you are happy. Then switch one on at a time and watch what arrives in the queue.',
          'Press **Send to** in **Tell past buyers** only when the owner says so, after the test.',
        ],
        links: [P.offers],
      },
    ],
  },

  {
    slug: 'social',
    title: 'Social',
    summary: 'The website feed and Instagram, and the photo check.',
    sections: [
      {
        heading: 'What Social does',
        body: [
          'Paid customised Pawtraits become before-and-after pictures for the "Recent custom creations around the world" feed on the home page and for Instagram carousels. Only the pet\'s first name and town are shown.',
          'Customers can opt out from their order email.',
          'Every photo is checked automatically first. It leaves out people, children, personal details and broken portraits.',
        ],
        links: [P.social],
      },
      {
        heading: 'Pets tab',
        body: [
          'Open **Social**. The tabs **All**, **Featured**, **Left out**, **Checking**, **Opted out** and **Hidden** show where each pet stands.',
          '**Run waiting checks** runs the photo check for ones still waiting.',
          '**Feature anyway** overrides a "Left out" decision. **Re-check** runs the check again. **Hide** and **Show again** take a pet off or put it back.',
          '**Use as home hero** puts a pet at the top of the home page. Leave that to the owner.',
        ],
      },
      {
        heading: 'Instagram carousels',
        body: [
          'The **Instagram carousels** tab shows the groups of five pets. A group shows as **Filling**, **Ready to post**, **Posting…**, **Posted** or **Posting failed**.',
          'You can edit the caption with **Save caption**, copy it with **Copy caption**, or press **Remove** on a pet.',
          'If you post one by hand, enter the post link and press **Mark as posted**.',
        ],
      },
      {
        heading: 'Settings and takedowns',
        body: [
          'The switches at the top turn the website feed, Instagram posting, the photo check and free previews on or off. They are the owner\'s.',
          'If a red box says **Take these Instagram posts down**, tell the owner. They remove each post in the Instagram app.',
          '**Stall towns** is the place name shown for orders taken at each stall.',
        ],
      },
    ],
  },

  {
    slug: 'emails',
    title: 'Emails',
    summary: 'How customer emails are sent, checked and fixed.',
    sections: [
      {
        heading: 'How emails are sent',
        body: [
          'Order, posted and download emails are put in a queue and sent from there.',
          'Open **Message Queue** to see **Pending**, **Processing** and **Failed**. Press **Process Queue Now** to send what is waiting.',
          'Failed messages are retried automatically.',
        ],
        links: [P.queue],
      },
      {
        heading: 'Templates',
        body: [
          'Open **Message Templates** to see each email, its type and whether it is active.',
          'Change wording only if the owner asks. Customers see these emails.',
        ],
        links: [P.templates],
      },
      {
        heading: 'Test emails',
        body: [
          'Open **Test Email**, choose a template, enter your own address, fill in any values it asks for, and press **Send Test Email**.',
          'It arrives like a real one. Check spam if it does not.',
        ],
        links: [P.testEmail],
      },
      {
        heading: 'Wording rules',
        body: [
          'Customer emails say the print comes with a free digital copy.',
          'They make no promises about delivery times or refunds. Do not add any.',
          `Customers reply to ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },

  {
    slug: 'money-and-costs',
    title: 'Money and costs',
    summary: 'Where the numbers are. These pages are for the owner.',
    sections: [
      {
        heading: 'Pricing',
        body: [
          'All prices live in **Pricing Management**. The shop, the stall and emails read from there. This manual never states a price.',
          'Press **Add Pricing** to add a price, a promotion or a seasonal price. Only the owner changes pricing.',
        ],
        links: [P.pricing],
      },
      {
        heading: 'Revenue, sales, costs and profit',
        body: [
          '**Overview** shows revenue for today, 7 days and 30 days, split into online and stalls.',
          '**Revenue**, **Sales**, **Costs** and **Profit** show more detail. On **Costs**, **Add Cost** records a bill. Choose its category, frequency and amount.',
        ],
        links: [P.revenue, P.sales, P.costs, P.profit],
      },
      {
        heading: 'AI Costs',
        body: [
          '**AI Costs** shows what every Gemini and Claude call costs.',
          'Each free preview is an AI painting that costs money. **Guest & Stall Settings** limits previews per device so costs stay in check.',
        ],
        links: [P.aiCosts, P.guestStall],
      },
      {
        heading: 'Refunds',
        body: [
          'Refunds are decided and made by the owner. Never promise one.',
        ],
      },
    ],
  },

  {
    slug: 'site-health-and-security',
    title: 'Site health and security',
    summary: 'The content security policy trial and what to do with the reports.',
    sections: [
      {
        heading: 'CSP Reports',
        body: [
          'The site has a content security policy. It is on trial in report-only mode, so it blocks nothing but records what it would block.',
          'Open **CSP Reports**. Reviewing happens after a week or two of collecting. The owner decides what to allow and when to turn it on.',
          'Press **Refresh** to reload. **Clear all** deletes every report, so it is for the owner.',
        ],
        links: [P.csp],
      },
      {
        heading: 'Database changes',
        body: [
          'Some new features need a database change. These are SQL files in db/migrations. The owner runs them by hand in Supabase.',
          'If a page says to run a migration, tell the owner. Never run SQL yourself.',
        ],
      },
      {
        heading: 'Signing in',
        body: [
          'Everyone signs in with their own account so the manual can show who ticked a task. Never share a login.',
          'Sign out when you finish on a shared computer.',
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------------------------
// GLOSSARY
// ---------------------------------------------------------------------------------------------

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'Pawtrait', meaning: 'A pet portrait made by Pawtraits: an AI-painted, dressed-up picture of a pet.' },
  { term: 'Pawcasso', meaning: 'The name the site gives to the AI painter. "Pawcasso paints your pet in."' },
  { term: 'Design', meaning: 'A catalogue picture a customer can buy as it is, or put their own pet into.' },
  { term: 'Preview', meaning: 'The free picture a customer gets when they add their pet\'s photo to a design. Each one costs a little in AI.' },
  { term: 'Customisation', meaning: 'A customer\'s pet painted into a design. Previews and bought ones are both customisations.' },
  { term: 'Original and version', meaning: 'An original is a design that was uploaded. A version is a copy of it in another breed, coat or outfit.' },
  { term: 'Variation batch', meaning: 'A saved set of breed, coat and outfit combinations that is run on chosen designs through Gemini Batch. The results wait for review.' },
  { term: 'Collection', meaning: 'A way customers browse besides breed: Occasions, Sports, 16 Pawsonalities, Zodiac signs and Tarot cards.' },
  { term: 'Pawsonality', meaning: 'One of 16 pet personality types from the quiz. Each has its own designs.' },
  { term: 'Framed card', meaning: 'A zodiac or tarot design with an ornate frame, title and tagline drawn on it. Customers can buy it as a print (with a bonus digital copy) or as a digital download, but not as a mug or phone case.' },
  { term: 'Plate (caption)', meaning: 'The translucent gold name plate on a Pawsonality design, with its title and tagline.' },
  { term: 'Stock ref', meaning: 'A number such as 1123 given to every design. It is printed on stickers and can be typed in to find a design.' },
  { term: 'Sticker QR', meaning: 'The QR code on the back of a stall print. It opens that design on the website.' },
  { term: 'Scan', meaning: 'Someone opening a sticker QR with their phone. Each scan is recorded against a stall.' },
  { term: 'Attribution', meaning: 'Crediting a scan and any order that follows it to a stall. The last scan wins for 30 days.' },
  { term: 'Location', meaning: 'A stall or other place, with a short code. It is printed into the QR so scans are credited to it.' },
  { term: 'Trade print order', meaning: 'A list of foam prints in set sizes that you send to the UK trade printer to make stall stock.' },
  { term: 'Foam print', meaning: 'A print on foam board. Sizes are Small, Medium, Large and XL. You get these made by the trade printer.' },
  { term: 'Batch', meaning: 'A group of items done together: a variation batch (many pictures made at once), or a set of orders you print or label together.' },
  { term: 'Print file', meaning: 'The full-size file for one item on an order. Open it from the order, and send it to the printer.' },
  { term: 'Fulfilment', meaning: 'Getting an order to the customer: printing, packing and posting it, or sending it to Gelato.' },
  { term: 'Gelato', meaning: 'The print-on-demand company that makes and posts mugs, phone cases, art paper, framed and acrylic orders.' },
  { term: 'Click & Drop', meaning: 'Royal Mail\'s online posting tool. The admin sends orders to it to make labels.' },
  { term: 'Guest', meaning: 'A customer who has not made an account. They can still make a preview and buy.' },
  { term: 'Pay on your phone', meaning: 'At a stall, a shopper scans a sticker, pays on their own phone, and shows a green PAID screen.' },
  { term: 'Bonus digital copy', meaning: 'The free digital download that comes with every physical print bought on the site.' },
  { term: 'Subscribed / soft opt-in', meaning: 'Subscribed means agreed to hear from us. A buyer is subscribed unless they choose "No thanks"; that is the soft opt-in. Unsubscribed people are never re-subscribed by buying.' },
  { term: 'On hold', meaning: 'An order paused because the amount paid looked wrong. The owner checks it in Stripe first.' },
  { term: 'Message queue', meaning: 'The waiting list of emails to send. Messages leave it as they are processed.' },
  { term: 'Offer', meaning: 'A few new pictures of a customer\'s pet, painted by Pawcasso from a photo we kept and emailed to them after the owner approves them.' },
  { term: 'Round 1 / Round 2', meaning: 'The two standard offers to a previewer. Round 1 comes a set number of days after they open the preview email. Round 2 comes a set number of days after round 1 was sent.' },
  { term: 'Campaign', meaning: 'An offer built around an occasion or a date. Christmas or Mother\'s Day are started by hand. Birthday and star-sign campaigns run by themselves once switched on.' },
  { term: 'Previewer', meaning: 'Someone who asked for a preview to be emailed to them, after the site began saying that we keep the photo.' },
  { term: 'Buyer (for offers)', meaning: 'Someone with a paid order that was not cancelled or refunded. They can be offered things only after they have been shown the photo wording and the grace period has passed.' },
  { term: 'Shown the wording', meaning: 'The person has seen the words that say we keep their pet\'s photo and may paint it again. It happens on the preview card, at checkout, or through the "Tell past buyers" email.' },
  { term: 'Auto-send', meaning: 'The Send automatically switch on Offers. Off, every offer waits for approval. On, finished offers are emailed without anyone looking.' },
  { term: 'CSP', meaning: 'Content security policy: a set of rules the browser follows about what a page may load. It is on trial in report-only mode.' },
];

// ---------------------------------------------------------------------------------------------
// TROUBLESHOOTING
// ---------------------------------------------------------------------------------------------

export const TROUBLESHOOTING: TroubleEntry[] = [
  {
    problem: 'A print file will not open or looks wrong',
    fix: [
      'Open **Orders** and find the order.',
      'Click **More actions** and choose **Rebuild print files**.',
      'Open **Print file** again. If it is still wrong, do not print it.',
    ],
    who: 'Ask the owner if the rebuilt file is still wrong.',
    link: P.orders,
  },
  {
    problem: 'An order is not in any tab',
    fix: [
      'Prints handed over at the stall and downloads-only orders do not appear in **Fulfilment**. Search for it in **Search & Filter Orders** below.',
      'Open the order and read its fulfilment card.',
    ],
    who: 'Ask the owner if you cannot find a paid order.',
    link: P.orders,
  },
  {
    problem: 'An order is stuck, or the Overview says paid orders have not been sent for printing',
    fix: [
      'Open **Orders** and check the **To print**, **On hold** and **Not routed** tabs.',
      'If it is under **Not routed**, do not choose a route. The owner decides.',
    ],
    who: 'The owner fixes held and unrouted orders.',
    link: P.orders,
  },
  {
    problem: 'An order shows a printing error',
    fix: [
      'Open **Overview**, then the line **Orders with a printing error**.',
      'Open the order and read the message.',
      'Do not press **Send to Gelato instead** yourself.',
    ],
    who: 'The owner. Gelato charges for orders sent to it.',
    link: P.orders,
  },
  {
    problem: 'The Royal Mail window says Royal Mail is not connected',
    fix: [
      'Post using **Posted…** and the **Click & Drop CSV** instead.',
      'Do not open **Royal Mail settings** in the window.',
    ],
    who: 'The owner fixes the Royal Mail connection.',
    link: P.orders,
  },
  {
    problem: 'A customer says their posted email never arrived',
    fix: [
      'Open **Message Queue** and press **Process Queue Now** if **Pending** is above zero.',
      'On the order, click **More actions** and choose **Resend “posted” email**.',
      `Tell the customer to check spam, or write to ${SUPPORT_EMAIL}.`,
    ],
    who: 'You can do this. Tell the owner if emails keep failing.',
    link: P.queue,
  },
  {
    problem: 'An email is stuck in the Message Queue',
    fix: [
      'Open **Message Queue**. If **Pending** does not clear, press **Process Queue Now**.',
      'If **Failed** is high, note how many and what the error says.',
    ],
    who: 'The owner fixes anything that stays failed.',
    link: P.queue,
  },
  {
    problem: 'A customisation failed',
    fix: [
      'Open **Customisations** and the **All customisations** tab. Failed ones have a red **Failed** badge.',
      'Press **Prompt, timings and AI cost →** to see the detail.',
      'The customer can try again. You cannot rerun it from the admin.',
    ],
    who: 'Tell the owner if several fail in a row.',
    link: P.customisations,
  },
  {
    problem: 'A design shows without its frame or plate',
    fix: [
      'Zodiac and tarot: open **Captions**, choose the type, and press **Put the frame on every design**.',
      'Pawsonality: open **Captions** and press **Put on all** for that type.',
      'One design: open it in **Image Catalog** and use **Framed card** or **Caption plate**.',
    ],
    who: 'You can do this.',
    link: P.captions,
  },
  {
    problem: 'A sticker opens the wrong design, or nothing',
    fix: [
      'Open the design in **Image Catalog** and press **Test link** in the QR panel.',
      'Check its ref against the sticker.',
      'Make a new sticker in **Sticker Sheets**.',
    ],
    who: 'Tell the owner if a whole sheet is wrong.',
    link: P.stickers,
  },
  {
    problem: 'Scans are not showing for a stall',
    fix: [
      'Open **Sticker QR Report** and check the dates in **From** and **To**.',
      'Check the sticker had the stall chosen when it was made (see **Sticker Sheets**).',
      'Stickers made without a stall appear as no location.',
    ],
    who: 'The owner if scans are missing for a stall that had stickers.',
    link: P.qrReport,
  },
  {
    problem: 'Instagram posts need taking down',
    fix: [
      'Open **Social**. The red box **Take these Instagram posts down** lists each one.',
      'Tell the owner.',
    ],
    who: 'The owner deletes posts in the Instagram app.',
    link: P.social,
  },
  {
    problem: 'An offer shows as failed',
    fix: [
      'Open **Offers** and the **Skipped and failed** tab. Read the reason under **Why**.',
      'Press **Try again**. The offer goes back in the queue and its pictures are painted again on the next run, or press **Run now**. This costs AI money again.',
      'If it fails a second time, leave it and note the reason.',
    ],
    who: 'The owner, if the same offer fails twice or many fail together.',
    link: P.offers,
  },
  {
    problem: 'An offer was skipped',
    fix: [
      'Open **Offers** and the **Skipped and failed** tab. Read the reason under **Why**.',
      'A skipped offer is final. It means a safety check stopped it: the person unsubscribed, bought, said not to reuse their photo, had offers stopped, or the day the offer was for has passed.',
      'Do nothing to get round it. If the reason surprises you, tell the owner.',
    ],
    who: 'The owner, if the reason looks wrong.',
    link: P.offers,
  },
  {
    problem: 'A customer asks not to have their photo reused',
    fix: [
      'Tell them every offer email has a "Please don\'t reuse my photo" link. One click and they are done. The email preferences page also has a switch called "Paint my pet into new designs from the photo I sent".',
      'If an offer for them is waiting in **Offers**, press **Stop offers for this person** on its card. They get no more offers.',
      'If they want no marketing email at all, find them in **Customers** and press **Unsubscribe**, but only because they asked.',
    ],
    who: 'Tell the owner. Deleting a photo is the owner\'s job.',
    link: P.offers,
  },
  {
    problem: 'A picture in the offers queue looks wrong',
    fix: [
      'Open **Offers** and the **Waiting for approval** tab.',
      'Press **Drop this picture** on the bad one, or **Paint a different one** to replace it. Two good pictures must be left.',
      'If none look right, press **Skip this person**. Do not approve it.',
    ],
    who: 'Tell the owner if the same fault keeps coming up.',
    link: P.offers,
  },
  {
    problem: 'A customer is upset or asks for a refund',
    fix: [
      `Reply kindly from ${SUPPORT_EMAIL}. Say you are looking into it.`,
      'Find the order in **Orders** and note what happened.',
      'Do not promise a refund or a delivery date.',
    ],
    who: 'The owner decides every refund.',
    link: P.orders,
  },
  {
    problem: 'A page says to run a migration or the table is missing',
    fix: [
      'Do not run anything yourself.',
      'Write down the page and the file name it gives.',
    ],
    who: 'The owner runs migrations by hand in Supabase.',
  },
  {
    problem: 'You cannot sign in, or the admin sends you to the login page',
    fix: [
      'Sign in again with your own account.',
      'If it still fails, ask the owner to check your account.',
    ],
    who: 'The owner.',
  },
];

// ---------------------------------------------------------------------------------------------
// Helpers for the page
// ---------------------------------------------------------------------------------------------

export function allTasks(): Task[] {
  return ROUTINES.flatMap(r => r.tasks);
}

export function routineById(id: RoutineId): Routine {
  const r = ROUTINES.find(x => x.id === id);
  if (!r) throw new Error(`Unknown routine ${id}`);
  return r;
}

/** Key -> the tick period of the routine it belongs to (null: not ticked). */
export function periodOfTask(key: string): TickPeriod | null | undefined {
  for (const r of ROUTINES) if (r.tasks.some(t => t.key === key)) return r.period;
  return undefined;
}
