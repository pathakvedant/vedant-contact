/*
 DAILY BLOG: add a new post by copying one block below and pasting it at the TOP of the list.
 - slug:    short-url-name (lowercase, hyphens, unique)
 - date:    YYYY-MM-DD
 - cat:     Marketing | Business Development | APCD | Fans | Steel | ERP | Dashboards | Data Story  (or a new one)
 - excerpt: answer the title's question in one or two plain sentences. Search engines and AI tools quote this
 - body:    plain text. "## " = heading, "- " = bullet, "> " = quote, **bold**. Leave a blank line between paragraphs.
 Then run: python tools/build_site.py   (this creates the post's own page and updates the sitemap)
 and upload to GitHub. Without that step the post still shows on the homepage, but Google won't index it separately.
*/
window.POSTS = [
{
 slug: "get-b2b-leads-without-ranking-on-google",
 date: "2026-11-01",
 cat: "Marketing",
 title: "How can a manufacturer get B2B leads without ranking on Google's first page?",
 excerpt: "Go where industrial buyers already are: LinkedIn, existing customers, dealers, trade directories, trade shows and direct outreach. Search is one channel, and in B2B it is rarely the first one to pay off.",
 tags: ["B2B marketing","lead generation","manufacturing","LinkedIn"],
 body: `
Ranking on page one takes months and can't be guaranteed. Meanwhile, you need enquiries this quarter. A manufacturer's buyer list is small and findable, which is a real advantage: you can go to them directly.

## Start with the people who already know you

- **Past customers:** call them. Ask about spares, upgrades and who else in the group has the same problem
- **Referrals:** ask right after a successful commissioning, when trust is highest
- **Dealers and consultants:** one good EPC or consultant relationship can bring repeated enquiries

## Go direct to named accounts

- List 50 target plants in the right industries
- Find the plant head, maintenance head and purchase head on LinkedIn
- Open with something useful about their process, not your catalogue

## Show up where buyers look

- **LinkedIn:** two posts a week from a real person, not only a company page
- **Google Business Profile:** free, and it covers searches for your name and company
- **Trade directories:** IndiaMART, TradeIndia and industry associations
- **Trade shows:** book meetings before the event and follow up within 48 hours

## Measure one thing

Ask every new enquiry "how did you find us?" and record it. After three months, stop what brings nothing and double what works.

> Search brings people who are already looking. Outreach reaches the buyers who haven't started looking yet.

The website still matters. When your name comes up, buyers will check you out, and that page has to earn their trust.
`
},
{
 slug: "what-does-business-development-do-in-manufacturing",
 date: "2026-11-01",
 cat: "Business Development",
 title: "What does business development do in a manufacturing company?",
 excerpt: "Business development finds new accounts, markets and partners, then builds the relationship and technical trust that turns them into long-term customers. Sales closes orders; BD creates the opportunities.",
 tags: ["business development","manufacturing","client conversion","sales"],
 body: `
In a manufacturing company, sales usually handles today's enquiries. Business development decides where next year's orders will come from.

## What BD actually does

- **Market mapping:** which industries, regions and applications fit the product
- **Account targeting:** which plants, and who influences the decision there
- **Opening doors:** first meetings, site visits and technical conversations
- **Partnerships:** dealers, EPC contractors and consultants
- **Feedback:** telling the factory what the market is asking for

## Why engineering knowledge changes the result

Industrial buyers are spending on equipment that has to run for years, and a failure stops their plant. They trust someone who can walk the site, ask the right questions and explain why something failed.

> Solve one real problem during the first site visit and you stop being a vendor.

## The numbers worth tracking

- New qualified accounts per quarter
- Conversion at each stage: lead, qualified, visit, proposal, order
- Time from first contact to order
- Share of revenue from accounts won in the last two years

## Where companies go wrong

The most common mistake is measuring BD only on this month's orders. Industrial sales cycles are long, so that pushes people back to chasing easy quotations and away from building new accounts.
`
},
{
 slug: "does-a-manufacturing-company-need-branding",
 date: "2026-11-01",
 cat: "Marketing",
 title: "Does a manufacturing company really need branding?",
 excerpt: "Yes. In B2B manufacturing, branding is not about a fancy logo. It is the trust and clarity that gets you shortlisted before anyone compares prices.",
 tags: ["branding","B2B marketing","manufacturing"],
 body: `
Many manufacturers believe that quality speaks for itself. It does, but only after someone has bought from you. Branding is what gets you onto the shortlist in the first place.

## What a brand means for a manufacturer

- **A clear promise:** what you do better, and for whom, in one sentence
- **Consistency:** the same name, logo and message on the website, catalogue, LinkedIn and visiting card
- **Proof:** case studies, photographs of real installations and technical data
- **People:** engineers and founders who are visible and helpful

## Where to start

- Write your one-sentence positioning. If your team gives five different answers, start there
- Fix your company profile and catalogue so they answer what buyers ask
- Make your website pass the 30-second test: what do you make, for whom, and why trust you?
- Turn your three best projects into short case studies

## What it pays back

A stronger brand helps you get enquiries before the price discussion starts, and lets your sales team spend less time proving you are credible.

> Buyers rarely choose the unknown supplier, even at a lower price, when a breakdown would stop their plant.

Branding doesn't need a big budget. It needs clarity, consistency and patience.
`
},
{
 slug: "steel-plant-digital-transformation-first-90-days",
 date: "2026-11-01",
 cat: "Steel",
 title: "Digital transformation in a steel plant: the first 90 days",
 excerpt: "Steel plants don't need a big-bang ERP. They need three numbers they can trust every morning. Here's how I start.",
 tags: ["steel","digital transformation","ERP","MIS"],
 body: `
Most steel plants I walk into already have data: weighbridge slips, furnace logs, dispatch registers, Excel MIS. The problem isn't missing data. Nobody trusts it.

## Days 1–30: find the three numbers

Ask the plant head one question: **"Which three numbers decide your day?"** It's usually production tonnage, power consumption per tonne and dispatch vs. orders. Everything else can wait.

- Map where each number is born (shop floor, weighbridge, SAP/Tally, register)
- Find who touches it before it reaches management
- Note every manual re-entry. That's where the errors are

## Days 31–60: one source of truth

Bring those three numbers into one clean table with automated refresh. No new software yet, just Power Query and discipline.

> If the number on the dashboard doesn't match the number in the meeting, the dashboard loses forever.

## Days 61–90: earn the right to go bigger

Once leadership opens the dashboard every morning, you have the trust to talk about ERP modules, mobile data capture and automation. Transformation is **70% process and people, 30% tools**.
`
},
{
 slug: "bag-filter-high-differential-pressure-rca",
 date: "2026-10-31",
 cat: "APCD",
 title: "Bag filter showing high ΔP? A 6-step root cause checklist",
 excerpt: "High differential pressure is the most common dust collector complaint. It's rarely 'just change the bags'.",
 tags: ["bag filter","dust collector","RCA","differential pressure"],
 body: `
A rising differential pressure (ΔP) across a bag filter means lower suction at the hoods, dust escaping and a fan working harder. Before you order new bags, run this checklist.

## 1. Check the cleaning system

- Is compressed air pressure at the header within spec (usually 5–6 bar)?
- Are all solenoid and diaphragm valves firing? Listen to each one
- Is the sequential timer set right for the dust load?

## 2. Check for moisture

Moisture plus fine dust makes a cake that pulse-jet cleaning can't remove. Look for condensation from gas below dew point, leaking water seals or wet compressed air.

## 3. Check the air-to-cloth ratio

If the process airflow has grown since commissioning, the filter is undersized. Measure the actual flow and compare it with the design.

## 4. Check bag media vs. application

Temperature, chemistry and particle size decide the media. Polyester in a hot, acidic stream will blind and fail early.

## 5. Check hopper discharge

A full hopper re-entrains dust onto the bags. Check the rotary airlock and screw conveyor.

## 6. Then, and only then, look at the bags

> Changing bags without fixing the root cause just resets the clock.

Log the ΔP every shift. A simple trend chart tells you more than any single reading.
`
},
{
 slug: "how-to-select-industrial-fan-duty-point",
 date: "2026-10-30",
 cat: "Fans",
 title: "How to select an industrial fan: why the duty point matters",
 excerpt: "A fan isn't selected by airflow alone. Where the fan curve meets the system curve decides efficiency, power and life.",
 tags: ["fan selection","ID fan","fan curve","energy"],
 body: `
Every fan has a performance curve: pressure against airflow. Every duct system has a resistance curve that rises with the square of flow. **Where they cross is the duty point**, and that's where your fan will actually run, whatever the datasheet says.

## Common mistakes

- **Adding big safety margins.** An oversized fan runs throttled, wasting power and causing vibration
- **Ignoring density.** Hot gas is lighter, so pressure and power change with temperature and altitude
- **Selecting off the peak.** Running left of the peak pressure point causes surging

## What I check in fan design software

- Duty point near the best-efficiency point
- Margin on flow and pressure (typically 10–20%, not 50%)
- Motor power at the worst case (cold start)
- Tip speed, noise and material for the gas

> Try the fan curve simulator on my homepage. Push the system resistance up and watch the duty point slide.

A well-selected fan can cut 15–30% of a dust collection system's power bill. That's often the fastest payback in the plant.
`
},
{
 slug: "choosing-right-apcd-bag-filter-cyclone-scrubber-esp",
 date: "2026-10-29",
 cat: "APCD",
 title: "Bag filter, cyclone, scrubber or ESP: choosing the right APCD",
 excerpt: "There is no 'best' air pollution control device, only the best one for your dust, temperature and emission norms.",
 tags: ["APCD","bag filter","cyclone","scrubber","ESP"],
 body: `
In 5+ years of consulting on Air Pollution Control Devices, the most expensive mistake I've seen is choosing the equipment before understanding the application.

## Start with five questions

- What is the dust (type, particle size, abrasiveness, stickiness)?
- What is the gas temperature and moisture?
- What is the airflow, and does it vary?
- What emission limit must you meet?
- Is the dust explosive or combustible?

## A quick guide

- **Cyclone:** coarse dust (above 10 µm), low cost, often a pre-cleaner
- **Bag filter:** fine dust, very high efficiency, temperature-limited by media
- **Wet scrubber:** sticky, hot or explosive dust and gases, but you then need to handle water
- **ESP:** very high volumes at high temperature, as in power and cement; high capital cost

> The right APCD is the cheapest one that meets the norm reliably for ten years, not the cheapest one on the quotation.

Often the answer is a combination: a cyclone in front to protect a bag filter, with the right fan behind it.
`
},
{
 slug: "power-bi-dashboard-manufacturing-kpis",
 date: "2026-10-28",
 cat: "Dashboards",
 title: "Why most manufacturing dashboards fail (and how to fix them)",
 excerpt: "A dashboard fails when it answers questions nobody asked. Design backward from the decision.",
 tags: ["Power BI","dashboard","KPI","manufacturing"],
 body: `
I've seen beautiful dashboards with 40 charts that nobody opens after week two. The problem is never the tool. It's the design.

## Design backward from decisions

Ask each user: **what do you decide every week, and what number tells you?** Build only those KPIs first.

- Plant head: OEE, tonnage, power per tonne
- Sales head: orders vs. target, pipeline, collections
- Purchase: stock days, pending POs, price variance

## Rules I follow

- One page, one question
- The most important number goes top-left, biggest
- Every KPI shows a target and a trend, not just a value
- Colour only for exceptions: red means act now

> If a chart doesn't change a decision, delete it.

Try the interactive dashboard on my homepage. Filter by year and segment, and every number recalculates.
`
},
{
 slug: "erp-go-live-hypercare-checklist",
 date: "2026-10-27",
 cat: "ERP",
 title: "ERP go-live: the 30-day hypercare checklist",
 excerpt: "Go-live isn't the finish line. The first 30 days decide whether people use the ERP or go back to Excel.",
 tags: ["ERP","go-live","hypercare","implementation"],
 body: `
Most ERP failures happen after go-live, not before. Users hit a problem, nobody fixes it quickly, and the parallel Excel sheet quietly comes back.

## Week 1

- A 15-minute stand-up every day with key users from each department
- One issue tracker. No issues by WhatsApp or hallway
- Master data freeze: no new item codes without approval

## Weeks 2–3

- Reconcile stock: system vs. physical for the top 50 items
- Reconcile ledgers: debtors and creditors vs. old books
- Retrain on the five most common errors

## Week 4

- Switch off the old system and old sheets formally
- Publish the first management report from the ERP
- Hand over to a support process with clear owners

> Adoption beats configuration. A simple ERP people use beats a perfect one they avoid.
`
},
{
 slug: "b2b-marketing-manufacturing-sell-outcomes",
 date: "2026-10-26",
 cat: "Marketing",
 title: "B2B marketing for manufacturers: sell outcomes, not specs",
 excerpt: "Industrial buyers compare spec sheets in minutes. What wins the order is proof, speed and trust.",
 tags: ["B2B marketing","manufacturing","LinkedIn","lead generation"],
 body: `
In industrial sales, everyone's catalogue looks the same. Same flange sizes, same efficiency claims, same "ISO certified". So how do buyers choose?

## What actually converts

- **Case studies with numbers:** "Reduced emissions from 150 to 30 mg/Nm³ at a steel re-rolling mill"
- **Response time:** the first useful technical reply often wins
- **Engineering credibility:** a site visit and an RCA report beat a brochure

## A simple LinkedIn system

- Two posts a week: one problem-solution, one project result
- Comment on your buyers' posts, not just your own
- Turn every site visit into a short, anonymised lesson

## Track the funnel

Leads → qualified → site visit → proposal → order. Measure conversion at each step. Over five years, tracking this pushed my conversion rate up steadily, because you fix the stage that leaks.
`
},
{
 slug: "raw-data-to-business-story",
 date: "2026-10-25",
 cat: "Data Story",
 title: "From raw data to a story the boss will act on",
 excerpt: "Analysis isn't finished when the chart is ready. It's finished when someone makes a decision.",
 tags: ["data storytelling","business analysis","excel"],
 body: `
Management doesn't want your pivot table. They want to know **what happened, why, and what to do**.

## My four-step structure

- **Headline:** one sentence with the main number ("Sales grew 18%, but the South fell 21%")
- **Three insights:** biggest contributor, fastest mover, biggest risk
- **One action:** specific, owned and dated
- **Appendix:** the data, for anyone who wants to check

## Engineering habits that help

As a mechanical engineer I learned to ask "what's the root cause?" before "what's the fix?". The same works in business data: a drop in sales is a symptom, and pricing, coverage or competition is the cause.

> Try it: the "Raw Data → Story" tool on my homepage turns a sales table into a headline, insights and an action.
`
}
];
