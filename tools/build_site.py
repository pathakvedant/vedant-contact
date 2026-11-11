"""Builds the search-friendly pages for the TRAASS site.

Run from anywhere after adding a post to blog/posts.js:
    python tools/build_site.py

Creates blog/<slug>.html for each post, blog/index.html, the profile and service
pages, blog/pages.js and sitemap.xml, and refreshes the article links in index.html.
"""
import html
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://traass.in/"
LINKEDIN = "https://www.linkedin.com/in/vedant-pathak-65915b160/"
EMAIL = "vedant@traass.in"
PERSON_ID = SITE + "#vedant"
ORG_ID = SITE + "#traass"
FONTS = "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Inter:wght@300;400;600;700&display=swap"
BIO = ("Vedant Pathak (VP) is the founder of TRAASS: a B.Tech Mechanical Engineer and Certified Data Analyst "
       "working across business analysis, B2B marketing, business development and APCD.")
e = html.escape


def read_posts():
    src = (ROOT / "blog" / "posts.js").read_text(encoding="utf-8")
    pattern = re.compile(
        r'\{\s*slug:\s*"(.*?)",\s*date:\s*"(.*?)",\s*cat:\s*"(.*?)",\s*title:\s*"(.*?)",\s*'
        r'excerpt:\s*"(.*?)",\s*tags:\s*\[(.*?)\],\s*body:\s*`(.*?)`\s*\}', re.S)
    posts = []
    for slug, date, cat, title, excerpt, tags, body in pattern.findall(src):
        posts.append(dict(slug=slug, date=date, cat=cat, title=title, excerpt=excerpt,
                          tags=re.findall(r'"(.*?)"', tags), body=body))
    return sorted(posts, key=lambda p: p["date"], reverse=True)


# One picture per line: ![alt text|caption](images/file.jpg){position}. Position: full, center, left, right or cover.
# Only pictures stored in blog/images/ are allowed. The blog editor (blog-admin.html) writes this line for you.
IMG_LINE = re.compile(r"^!\[([^\]|]*)(?:\|([^\]]*))?\]\((images/[a-z0-9][a-z0-9-]{0,80}\.(?:jpg|jpeg|png|webp))\)(?:\{(full|center|left|right|cover)\})?$")


def first_cover(body):
    """The picture marked {cover}, else the first picture in the post, else None."""
    pics = [IMG_LINE.match(x.strip()) for x in body.splitlines()]
    pics = [m for m in pics if m]
    cover = next((m for m in pics if m.group(4) == "cover"), pics[0] if pics else None)
    return cover.group(3) if cover else None


def md(text, img_prefix=""):
    def inline(s):
        return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", e(s, quote=False))
    out, in_list = [], False
    for line in text.strip().splitlines():
        line = line.strip()
        pic = IMG_LINE.match(line)
        if pic:
            if in_list:
                out.append("</ul>")
                in_list = False
            alt, cap, src, pos = pic.group(1).strip(), (pic.group(2) or "").strip(), pic.group(3), pic.group(4) or "center"
            fig = f'<figure class="pimg pimg-{pos}"><img src="{img_prefix}{src}" alt="{e(alt)}" loading="lazy" decoding="async">'
            out.append(fig + (f"<figcaption>{e(cap)}</figcaption>" if cap else "") + "</figure>")
            continue
        if line.startswith("- "):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{inline(line[2:])}</li>")
            continue
        if in_list:
            out.append("</ul>")
            in_list = False
        if not line:
            continue
        if line.startswith("## "):
            out.append(f"<h2>{inline(line[3:])}</h2>")
        elif line.startswith("> "):
            out.append(f"<blockquote>{inline(line[2:])}</blockquote>")
        else:
            out.append(f"<p>{inline(line)}</p>")
    if in_list:
        out.append("</ul>")
    return "\n".join(out)


def page(path, title, desc, schema, body, og_type="website", og_image=None):
    """Writes one standalone page. `path` is relative to the site root."""
    og_image = og_image or SITE + "og-image.png"
    up = "../" * path.count("/")
    url = SITE + path.replace("index.html", "")
    ld = json.dumps({"@context": "https://schema.org", "@graph": schema}, ensure_ascii=False).replace("</", "<\\/")
    doc = f"""<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="author" content="Vedant Pathak">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#05060f">
<link rel="canonical" href="{url}">
<link rel="icon" href="{up}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="{up}apple-touch-icon.png">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="TRAASS · Vedant Pathak">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{og_image}">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{ld}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{FONTS}" rel="stylesheet">
<link rel="stylesheet" href="{up}assets/style.css">
</head>
<body>
<header class="pagehead"><div class="wrap">
 <a href="{up}index.html" class="logo" aria-label="TRAASS home"><img src="{up}assets/traass-logo-reversed.svg" alt="TRAASS logo" width="156" height="40"><small>BY VEDANT PATHAK</small></a>
 <div class="links" role="navigation" aria-label="Main"><a href="{up}index.html">Home</a><a href="{up}vedant-pathak.html">About</a><a href="{up}fan-software.html">Fan Software</a><a href="{up}markets.html">Markets</a><a href="{up}b2b-marketing-business-development.html">Marketing &amp; BD</a><a href="{up}apcd-consulting.html">APCD</a><a href="{up}blog/index.html">Blog</a><a href="{up}index.html#contact">Contact</a></div>
</div></header>
<main class="pagebody">
{body}
</main>
<footer><div class="wrap"><div class="copy">© TRAASS · Vedant Pathak · <a href="mailto:{EMAIL}">{EMAIL}</a> · <a href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a></div></div></footer>
</body>
</html>
"""
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(doc, encoding="utf-8", newline="\n")


def crumbs(up, items):
    parts = [f'<a href="{up}index.html">Home</a>'] + [f'<a href="{up}{href}">{e(n)}</a>' if href else e(n) for n, href in items]
    return f'<div class="crumbs" role="navigation" aria-label="Breadcrumb">{" › ".join(parts)}</div>'


def crumb_schema(items):
    full = [("Home", SITE)] + items
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(full)]}


def author_box(up):
    return (f'<aside class="author"><img src="{up}assets/vedant-pathak.jpg" alt="Vedant Pathak (VP)" width="84" height="84" loading="lazy">'
            f'<div><p><strong><a href="{up}vedant-pathak.html">Vedant Pathak (VP)</a></strong>, founder of TRAASS</p>'
            f'<p>Business Analyst, B2B marketing and business development for manufacturing, and APCD expert. '
            f'B.Tech Mechanical, Certified Data Analyst. <a href="{up}index.html#contact">Get in touch →</a></p></div></aside>')


def person_ref():
    return {"@type": "Person", "@id": PERSON_ID, "name": "Vedant Pathak", "alternateName": "VP",
            "url": SITE + "vedant-pathak.html", "sameAs": [LINKEDIN], "image": SITE + "assets/vedant-pathak.jpg"}


def build_posts(posts):
    for i, p in enumerate(posts):
        url = f"{SITE}blog/{p['slug']}.html"
        related = [x for x in posts if x["cat"] == p["cat"] and x is not p][:2] or [x for x in posts if x is not p][:2]
        rel = "".join(f'<li><a href="{x["slug"]}.html">{e(x["title"])}</a></li>' for x in related)
        minutes = max(1, round(len(p["body"].split()) / 200))
        body = f"""{crumbs("../", [("Blog", "blog/index.html"), (p["cat"], "")])}
<article>
<div class="meta"><span class="c">{e(p["cat"])}</span><time datetime="{p["date"]}">{p["date"]}</time><span>{minutes} min read</span></div>
<h1>{e(p["title"])}</h1>
<p class="answer"><strong>Short answer:</strong> {e(p["excerpt"])}</p>
<div class="content">
{md(p["body"])}
</div>
</article>
{author_box("../")}
<h2 class="subhead">Related <span>articles</span></h2>
<ul class="linklist">{rel}</ul>
<p style="margin-top:24px"><a class="btn fill" href="../index.html#contact">Talk to me about this →</a></p>"""
        schema = [
            {"@type": "BlogPosting", "headline": p["title"], "description": p["excerpt"], "datePublished": p["date"],
             "dateModified": p["date"], "url": url, "mainEntityOfPage": url, "image": (SITE + "blog/" + first_cover(p["body"])) if first_cover(p["body"]) else SITE + "og-image.png",
             "keywords": p["tags"], "articleSection": p["cat"], "author": person_ref(),
             "publisher": {"@type": "Organization", "@id": ORG_ID, "name": "TRAASS", "logo": {"@type": "ImageObject", "url": SITE + "assets/traass-logo.png"}}},
            crumb_schema([("Blog", SITE + "blog/"), (p["title"], url)]),
        ]
        cov = first_cover(p["body"])
        page(f"blog/{p['slug']}.html", f"{p['title']} | Vedant Pathak", p["excerpt"], schema, body, "article",
             og_image=(SITE + "blog/" + cov) if cov else None)


def build_blog_index(posts):
    items = "".join(
        f'<li><a href="{p["slug"]}.html">{e(p["title"])}</a><small>{e(p["cat"])} · {p["date"]}</small>{e(p["excerpt"])}</li>' for p in posts)
    body = f"""{crumbs("../", [("Blog", "")])}
<h1>Blog: B2B marketing, business development, APCD and data</h1>
<p class="answer">Practical articles by <a href="../vedant-pathak.html">Vedant Pathak (VP)</a> for people who run, sell for or maintain manufacturing plants.</p>
<ul class="linklist content">{items}</ul>"""
    schema = [{"@type": "Blog", "name": "TRAASS Blog by Vedant Pathak", "url": SITE + "blog/", "author": person_ref(),
               "blogPost": [{"@type": "BlogPosting", "headline": p["title"], "url": f"{SITE}blog/{p['slug']}.html", "datePublished": p["date"]} for p in posts]},
              crumb_schema([("Blog", SITE + "blog/")])]
    page("blog/index.html", "Blog | Vedant Pathak (VP) | TRAASS",
         "Practical articles on B2B marketing, business development, APCD, dust collection, ERP and dashboards for manufacturers, by Vedant Pathak.",
         schema, body)


# Questions people (and AI assistants) ask about Vedant Pathak. Shown on the profile page and marked up as FAQPage.
# Every answer uses only facts already stated elsewhere on the site.
PROFILE_FAQ = [
    ("Who is Vedant Pathak (VP)?",
     "Vedant Pathak, known as VP, is the founder of TRAASS (traass.in). He is a B.Tech Mechanical Engineer and Certified Data Analyst who works as a "
     "Business Analyst in the mechanical domain, in B2B marketing and business development for manufacturers, and as an APCD and industrial fan expert "
     "with 5+ years in dust collection systems."),
    ("Which Vedant Pathak is the founder of TRAASS?",
     "The Vedant Pathak who founded TRAASS is the mechanical engineer and business analyst who works with manufacturing companies on B2B marketing, "
     "business development, APCD (air pollution control devices), dust collection and industrial fans. His website is traass.in and his email is vedant@traass.in."),
    ("What is TRAASS?",
     "TRAASS is Vedant Pathak's practice for B2B marketing, business development, business analysis, dashboards, ERP implementation, digital transformation, "
     "and APCD and dust collection consulting, for companies from steel to FMCG. It also publishes TRAASS Fan Pro, a centrifugal fan design tool."),
    ("What is Vedant Pathak an expert in?",
     "Air pollution control devices (bag filters, cyclones, wet scrubbers and ESPs), dust collection systems and their root cause analysis, industrial "
     "centrifugal fan selection and design, B2B marketing and business development for manufacturers, and business analysis with dashboards and ERP."),
    ("How can I contact Vedant Pathak?",
     "Email vedant@traass.in, connect on LinkedIn, or use the contact form on traass.in."),
]


def build_profile():
    faq_html = "".join(f"<h3>{e(q)}</h3><p>{e(a)}</p>" for q, a in PROFILE_FAQ)
    posts = read_posts()
    article_links = "".join(f'<li><a href="blog/{p["slug"]}.html">{e(p["title"])}</a></li>' for p in posts)
    body = f"""{crumbs("", [("About Vedant Pathak", "")])}
<div class="profile-top"><img src="assets/vedant-pathak.jpg" alt="Vedant Pathak (VP), founder of TRAASS" width="170" height="170">
<div><h1>Vedant Pathak (VP)</h1><p class="answer" style="margin:0">{e(BIO)}</p></div></div>
<div class="content">
<h2>Quick facts</h2>
<ul>
<li><strong>Name:</strong> Vedant Pathak, also known as VP</li>
<li><strong>Role:</strong> Founder of TRAASS (traass.in)</li>
<li><strong>Education:</strong> B.Tech, Mechanical Engineering; Certified Data Analyst</li>
<li><strong>Known for:</strong> APCD and dust collection systems, industrial fan design, B2B marketing and business development for manufacturers, business analysis</li>
<li><strong>Industries:</strong> manufacturing, from steel to FMCG</li>
<li><strong>Country:</strong> India</li>
<li><strong>Contact:</strong> <a href="mailto:{EMAIL}">{EMAIL}</a></li>
</ul>
<h2>What I do</h2>
<ul>
<li><strong>B2B marketing and branding</strong> for manufacturing companies</li>
<li><strong>Business development and client conversion</strong>: from market mapping to closed orders</li>
<li><strong>Business analysis</strong>: turning raw data into a story and a decision</li>
<li><strong>Interactive dashboards, ERP implementation and digital transformation</strong></li>
<li><strong>APCD and dust collection consulting</strong>: application study, RCA of existing systems and the best-suited solution</li>
</ul>
<h2>Experience</h2>
<ul>
<li><strong>Now:</strong> transforming businesses in every industry, from steel to FMCG, with ERP, dashboards and data-driven decisions</li>
<li><strong>Last 5 years:</strong> digital marketing, branding, B2B marketing for manufacturing and client conversion</li>
<li><strong>5+ years:</strong> Air Pollution Control Devices and dust collection systems, consulting customers on the best-suited APCD</li>
<li><strong>Expert</strong> in industrial fan design software</li>
</ul>
<h2>Software: TRAASS Fan Pro</h2>
<p>Vedant Pathak builds <a href="fan-software.html">TRAASS Fan Pro</a>, a centrifugal fan design tool for industrial fans: duty point, wheel geometry, blade and disc stresses, shaft and critical speed, bearings, motor and start-up, built on textbook methods and maker catalogue data.</p>
<h2>Education and certification</h2>
<ul><li>B.Tech, Mechanical Engineering</li><li>Certified Data Analyst</li></ul>
<h2>Services</h2>
<ul><li><a href="b2b-marketing-business-development.html">B2B Marketing &amp; Business Development for Manufacturers</a></li><li><a href="apcd-consulting.html">APCD &amp; Dust Collection Consulting</a></li><li><a href="index.html#services">All services</a></li></ul>
<h2>Articles by Vedant Pathak</h2>
<ul>{article_links}</ul>
<h2>Frequently asked questions</h2>
{faq_html}
<h2>Contact</h2>
<p>Email <a href="mailto:{EMAIL}">{EMAIL}</a>, connect on <a href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a>, or use the <a href="index.html#contact">contact form</a>.</p>
</div>"""
    person = {**person_ref(), "description": BIO, "email": "mailto:" + EMAIL,
              "jobTitle": ["Business Analyst (Mechanical Domain)", "B2B Marketing & Business Development Specialist", "APCD Expert", "Founder, TRAASS"],
              "worksFor": {"@type": "ProfessionalService", "@id": ORG_ID, "name": "TRAASS"},
              "knowsAbout": ["B2B Marketing", "Business Development", "Branding", "Business Analysis", "Power BI", "ERP Implementation", "Digital Transformation", "APCD", "Dust Collection Systems", "Industrial Fan Design", "Steel Industry", "FMCG", "Manufacturing"]}
    url = SITE + "vedant-pathak.html"
    person["alternateName"] = ["VP", "Vedant Pathak VP", "Vedant Pathak TRAASS"]
    person["hasCredential"] = [{"@type": "EducationalOccupationalCredential", "name": "B.Tech, Mechanical Engineering", "credentialCategory": "degree"},
                               {"@type": "EducationalOccupationalCredential", "name": "Certified Data Analyst", "credentialCategory": "certificate"}]
    person["nationality"] = {"@type": "Country", "name": "India"}
    schema = [{"@type": "ProfilePage", "url": url, "name": "Vedant Pathak (VP)", "dateModified": date.today().isoformat(), "mainEntity": person},
              {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in PROFILE_FAQ]},
              crumb_schema([("About Vedant Pathak", url)])]
    page("vedant-pathak.html", "Vedant Pathak (VP): Founder of TRAASS, APCD Consultant and Fan Software | Profile", BIO, schema, body, "profile")


def service_page(path, h1, title, answer, content, service):
    url = SITE + path
    body = f"""{crumbs("", [(h1, "")])}
<h1>{e(h1)}</h1>
<p class="answer">{e(answer)}</p>
<div class="content">
{content}
</div>
{author_box("")}
<p><a class="btn fill" href="index.html#contact">Discuss your requirement →</a></p>"""
    schema = [{"@type": "Service", "name": service, "description": answer, "url": url, "areaServed": "IN",
               "provider": {"@type": "ProfessionalService", "@id": ORG_ID, "name": "TRAASS", "url": SITE, "founder": person_ref()}},
              crumb_schema([(h1, url)])]
    page(path, title, answer, schema, body)


def build_fan_software():
    """Public product page for TRAASS Fan Pro (the tool itself is behind the login at fan-pro.html)."""
    path, url = "fan-software.html", SITE + "fan-software.html"
    h1 = "TRAASS Fan Pro: Centrifugal Fan Design Software"
    answer = ("TRAASS Fan Pro is centrifugal fan design software by Vedant Pathak (VP): from the duty point to the wheel, blades, "
              "shaft, bearings, motor, start-up and casing, for industrial fans in clean air, dust and hot gas.")
    body = f"""{crumbs("", [("Centrifugal fan software", "")])}
<h1>{e(h1)}</h1>
<p class="answer">{e(answer)}</p>
<p><a class="btn fill" href="fan-pro.html">Log in to Fan Pro →</a> <a class="btn" href="mailto:{EMAIL}?subject=Fan%20Pro%20access">Request access</a></p>
<div class="content">
<h2>What the centrifugal fan software designs</h2>
<ul>
<li><strong>Fan selection:</strong> size, speed and wheel type (backward curved, backward inclined, airfoil, radial tip, radial, paddle, forward curved) for your flow, pressure, temperature, altitude and dust</li>
<li><strong>Aerodynamics:</strong> velocity triangles, slip, losses, performance curve, stall margin and the operating point on your system curve</li>
<li><strong>Impeller strength:</strong> blade, backplate and shroud thickness, with stress checked along the whole blade, overspeed, temperature and wear allowance</li>
<li><strong>Shaft and critical speed:</strong> stepped shaft, deflection, fatigue and first critical speed with margin</li>
<li><strong>Bearings and housings:</strong> spherical roller or ball bearings and SNL plummer blocks picked from maker catalogue data, life, lubrication and regreasing interval</li>
<li><strong>Motor and start-up:</strong> motor from catalogue data, start time for direct-on-line, star-delta, soft starter and VFD, hot and cold gas, damper open or closed</li>
<li><strong>Casing, hub and accessories:</strong> volute, plate and stiffeners, hub and key, inlet box, damper and silencer</li>
<li><strong>Balance and vibration:</strong> balance grade and vibration limits by fan category</li>
<li><strong>Outputs:</strong> CAD drawings (DXF, SVG, STL, STEP), an Excel calculation sheet and a Word report</li>
</ul>
<h2>Built on published engineering</h2>
<p>The calculations follow textbook fluid mechanics and strength of materials, AMCA fan standards and bearing and motor maker catalogue data, and each method is checked against its source. Every value the software picks can be overridden by the engineer.</p>
<h2>Who it is for</h2>
<p>Fan manufacturers, APCD and dust collection companies, consultants and plant engineers who design or check centrifugal fans and blowers.</p>
<h2>Access</h2>
<p>Fan Pro runs in the browser. Access is by login, given by the admin. <a href="mailto:{EMAIL}?subject=Fan%20Pro%20access">Email {EMAIL}</a> for access or a demo.</p>
<h2>Related reading</h2>
<ul>
<li><a href="blog/how-to-select-industrial-fan-duty-point.html">How to select an industrial fan: why the duty point matters</a></li>
<li><a href="apcd-consulting.html">APCD consulting: air pollution control system consultant</a></li>
</ul>
</div>
{author_box("")}"""
    schema = [{"@type": "SoftwareApplication", "name": "TRAASS Fan Pro", "alternateName": "TRAASS centrifugal fan design software",
               "applicationCategory": "EngineeringApplication", "operatingSystem": "Web browser", "url": url, "description": answer,
               "author": person_ref(), "publisher": {"@id": ORG_ID},
               "featureList": ["Centrifugal fan selection", "Velocity triangles and performance curve", "Impeller blade and disc stress",
                               "Shaft and critical speed", "Bearing and plummer block selection", "Motor and start-up analysis",
                               "Casing and stiffeners", "Balance and vibration limits", "CAD, Excel and Word outputs"]},
              crumb_schema([("Centrifugal fan software", url)])]
    page(path, "Centrifugal Fan Design Software | TRAASS Fan Pro by Vedant Pathak", answer, schema, body)


def build_services():
    service_page(
        "b2b-marketing-business-development.html",
        "B2B Marketing & Digital Marketing for Manufacturers",
        "B2B Marketing & Digital Marketing for Manufacturers | Vedant Pathak, TRAASS",
        "Vedant Pathak (VP) of TRAASS does B2B marketing and digital marketing for manufacturers: website and search visibility, LinkedIn and email campaigns, branding, business development and client conversion, measured at every funnel stage.",
        """<h2>Who this is for</h2>
<p>Manufacturers and industrial suppliers who rely on a few relationships for orders, and want a steadier flow of qualified enquiries.</p>
<h2>Marketing and branding</h2>
<ul>
<li><strong>Brand and positioning:</strong> a clear promise, consistent identity, catalogues and company profiles</li>
<li><strong>Digital marketing:</strong> website, search visibility, LinkedIn and email campaigns</li>
<li><strong>Technical content:</strong> case studies and application notes that buyers trust</li>
<li><strong>Events:</strong> trade-show planning and follow-up</li>
</ul>
<h2>Business development</h2>
<ul>
<li><strong>Market mapping:</strong> target industries, accounts and decision makers</li>
<li><strong>Prospecting:</strong> outreach that opens technical conversations</li>
<li><strong>Techno-commercial consulting:</strong> site visits and the right solution</li>
<li><strong>Proposals and closing:</strong> offers, follow-up and negotiation</li>
<li><strong>Pipeline and CRM:</strong> lead scoring, conversion tracking and forecasting</li>
</ul>
<h2>Why an engineer doing this helps</h2>
<p>Industrial buyers want to know you understand their plant. A B.Tech Mechanical background and 5+ years with APCD customers means the conversation starts with their problem, and a data analyst's habits mean every channel gets measured in enquiries and orders.</p>
<h2>How the work runs</h2>
<ul><li>Find the right accounts</li><li>Qualify early</li><li>Consult before selling</li><li>Propose around the outcome</li><li>Close with disciplined follow-up</li><li>Turn each result into proof for the next client</li></ul>
<p>Try the <a href="index.html#growth">funnel calculator</a> to find where your own sales funnel leaks. Related reading: <a href="blog/get-b2b-leads-without-ranking-on-google.html">getting leads without ranking on Google</a>, <a href="blog/what-does-business-development-do-in-manufacturing.html">what business development does</a> and <a href="blog/does-a-manufacturing-company-need-branding.html">branding for manufacturers</a>.</p>""",
        "B2B Marketing, Digital Marketing & Business Development for Manufacturers")
    service_page(
        "apcd-consulting.html",
        "APCD Consultant: Air Pollution Control System Consulting",
        "APCD Consultant | Air Pollution Control System Consultant in India | Vedant Pathak",
        "Vedant Pathak (VP) of TRAASS is an APCD consultant: an air pollution control system consultant for plants in India. Application study, root cause analysis of existing dust collection systems, and selection of the best-suited air pollution control device and fan, based on 5+ years in the field.",
        """<h2>What an APCD (air pollution control system) consultant does</h2>
<p>An APCD consultant, or air pollution control system consultant, studies your process and dust, finds why an existing system is underperforming, and recommends the air pollution control device that meets the emission norm reliably: bag filter, cyclone, wet scrubber or ESP, with the right fan.</p>
<h2>What I help with</h2>
<ul>
<li><strong>Application study:</strong> dust type, particle size, temperature, moisture, airflow and emission limits</li>
<li><strong>Root cause analysis:</strong> low suction, high differential pressure, bag failure, leakage and fan vibration</li>
<li><strong>Equipment selection:</strong> bag filter, cyclone, wet scrubber or ESP</li>
<li><strong>Fan selection:</strong> duty point, static pressure, efficiency and motor sizing, using fan design software</li>
<li><strong>Proof with data:</strong> before and after readings in a dashboard</li>
</ul>
<h2>Related reading</h2>
<ul>
<li><a href="blog/choosing-right-apcd-bag-filter-cyclone-scrubber-esp.html">Bag filter, cyclone, scrubber or ESP: choosing the right APCD</a></li>
<li><a href="blog/bag-filter-high-differential-pressure-rca.html">Bag filter showing high ΔP? A 6-step root cause checklist</a></li>
<li><a href="blog/how-to-select-industrial-fan-duty-point.html">How to select an industrial fan</a></li>
</ul>""",
        "APCD Consulting: Air Pollution Control System Consultant")


def _plain(fragment: str) -> str:
    """HTML to readable Markdown-ish text for AI tools: headings, list items and paragraphs, no markup."""
    t = re.sub(r"(?is)<(script|style|svg|noscript|nav|header|footer)[^>]*>.*?</\1>", " ", fragment)
    t = re.sub(r"(?is)<h1[^>]*>(.*?)</h1>", r"\n# \1\n", t)
    t = re.sub(r"(?is)<h2[^>]*>(.*?)</h2>", r"\n## \1\n", t)
    t = re.sub(r"(?is)<h3[^>]*>(.*?)</h3>", r"\n### \1\n", t)
    t = re.sub(r"(?is)<li[^>]*>", "\n- ", t)
    t = re.sub(r"(?is)</(p|div|ul|ol|section|article|li|tr)>", "\n", t)
    t = html.unescape(re.sub(r"(?s)<[^>]+>", "", t))
    lines = [re.sub(r"[ \t]+", " ", x).strip() for x in t.splitlines()]
    out, blank = [], False
    for x in lines:
        if not x:
            if not blank and out:
                out.append("")
            blank = True
            continue
        out.append(x)
        blank = False
    return "\n".join(out).strip()


def build_llms_full(posts):
    """llms-full.txt: the full readable text of the key pages in one file, for AI assistants and answer engines."""
    pages = ["vedant-pathak.html", "apcd-consulting.html", "fan-software.html", "b2b-marketing-business-development.html"] + [f"blog/{p['slug']}.html" for p in posts]
    parts = [f"# TRAASS · Vedant Pathak (VP): full text of {SITE}\n\nUpdated {date.today().isoformat()}. Summary: {SITE}llms.txt\n"]
    for rel in pages:
        f = ROOT / rel
        if not f.exists():
            continue
        h = f.read_text(encoding="utf-8")
        main = re.search(r"(?is)<main[^>]*>(.*?)</main>", h)
        parts.append(f"\n---\nSource: {SITE}{rel}\n\n" + _plain(main.group(1) if main else h))
    (ROOT / "llms-full.txt").write_text("\n".join(parts) + "\n", encoding="utf-8", newline="\n")
    return len(pages)


def build_sitemap(posts):
    newest = posts[0]["date"]
    today = date.today().isoformat()
    urls = [("", today, "1.0"), ("vedant-pathak.html", today, "0.9"),
            ("b2b-marketing-business-development.html", newest, "0.9"),
            ("apcd-consulting.html", newest, "0.9"), ("fan-software.html", today, "0.9"), ("markets.html", newest, "0.8"), ("blog/", newest, "0.8")]
    urls += [(f"blog/{p['slug']}.html", p["date"], "0.7") for p in posts]
    rows = "\n".join(f"  <url><loc>{SITE}{u}</loc><lastmod>{d}</lastmod><priority>{pr}</priority></url>" for u, d, pr in urls)
    (ROOT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{rows}\n</urlset>\n',
        encoding="utf-8", newline="\n")
    return len(urls)


def update_home(posts):
    path = ROOT / "index.html"
    text = path.read_text(encoding="utf-8")
    links = "".join(f'<li><a href="blog/{p["slug"]}.html">{e(p["title"])}</a></li>' for p in posts[:5])
    new, count = re.subn(r"<!--ARTICLES-->.*?<!--/ARTICLES-->", lambda _: f"<!--ARTICLES-->{links}<!--/ARTICLES-->", text, flags=re.S)
    if count != 1:
        raise SystemExit("Could not find the article markers in index.html")
    path.write_bytes(new.encode("utf-8"))


def main():
    posts = read_posts()
    build_posts(posts)
    build_blog_index(posts)
    build_profile()
    build_services()
    build_fan_software()
    (ROOT / "blog" / "pages.js").write_text(
        "window.POST_PAGES=" + json.dumps([p["slug"] for p in posts]) + ";\n", encoding="utf-8", newline="\n")
    total = build_sitemap(posts)
    update_home(posts)
    n_llm = build_llms_full(posts)
    print(f"Built {len(posts)} posts; sitemap has {total} URLs; llms-full.txt has {n_llm} pages")


if __name__ == "__main__":
    main()
