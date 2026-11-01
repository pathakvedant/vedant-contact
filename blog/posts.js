/*
 DAILY BLOG: add a new post by copying one block below and pasting it at the TOP of the list.
 - slug:    short-url-name (lowercase, hyphens, unique)
 - date:    YYYY-MM-DD
 - cat:     APCD | Fans | Steel | ERP | Dashboards | Marketing | Data Story  (or a new one)
 - body:    plain text. "## " = heading, "- " = bullet, "> " = quote, **bold**. Leave a blank line between paragraphs.
 Then add the post URL to sitemap.xml and upload to GitHub.
*/
window.POSTS = [
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
