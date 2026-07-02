// Static blog build: posts/*.md -> _site/ (site root + /blog/). Run: node build.js
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = __dirname;
const OUT = path.join(ROOT, '_site');
const POSTS = path.join(ROOT, 'posts');
const SITE_URL = 'https://wience.tech';

const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ![caption](images/x.jpg) -> <figure> with caption; images/ paths resolve to /blog/images/
marked.use({
    renderer: {
        image(token) {
            const src = token.href.startsWith('images/') ? '/blog/' + token.href : token.href;
            const caption = token.text ? `<figcaption>${esc(token.text)}</figcaption>` : '';
            return `<figure><img src="${esc(src)}" alt="${esc(token.text || '')}" loading="lazy">${caption}</figure>`;
        }
    }
});

function parsePost(file) {
    const src = fs.readFileSync(path.join(POSTS, file), 'utf8');
    const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) throw new Error(`${file}: missing frontmatter`);
    const meta = {};
    for (const line of m[1].split('\n')) {
        const i = line.indexOf(':');
        if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    if (!meta.title || !meta.date) throw new Error(`${file}: frontmatter needs title and date`);
    const slug = file.replace(/\.md$/, '');
    // unwrap <figure> from the <p> marked puts standalone images in
    const html = marked.parse(m[2]).replace(/<p>(<figure[\s\S]*?<\/figure>)<\/p>/g, '$1');
    return { slug, title: meta.title, date: new Date(meta.date), description: meta.description || '', html };
}

const displayDate = (d) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

// Shared shell reproducing the index.html aesthetic (Times, 650px, time-tinted bg, cursor trail)
function page({ title, description, url, body }) {
    return `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:image" content="${SITE_URL}/og.png">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="article">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="alternate" type="application/rss+xml" title="Wince Dela Fuente" href="/feed.xml">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: "Times New Roman", Times, serif;
            font-size: 16px;
            line-height: 1.6;
            color: #000;
            padding: 40px 20px 60px;
            max-width: 650px;
            margin: 0 auto;
            transition: background-color 0.5s ease;
        }

        .crumb, .date { font-size: 13px; color: #666; }
        .crumb { margin-bottom: 30px; }
        .crumb a, .date a { color: #666; }
        .date { margin-bottom: 30px; }

        h1 { font-size: 24px; font-weight: normal; margin-bottom: 4px; }
        h2 { font-size: 18px; font-weight: normal; margin-top: 28px; margin-bottom: 10px; }
        h3 { font-size: 16px; font-weight: bold; margin-top: 24px; margin-bottom: 8px; }

        p { margin-bottom: 14px; }
        ul, ol { margin-left: 22px; margin-bottom: 14px; }
        li { margin-bottom: 4px; }

        a { color: #000; text-decoration: underline; text-underline-offset: 2px; }
        a:hover { color: #666; }

        figure { margin: 28px 0; }
        figure img { display: block; width: 100%; border-radius: 3px; }
        figcaption { font-size: 13px; color: #666; font-style: italic; text-align: center; margin-top: 8px; }

        blockquote { border-left: 2px solid #ccc; padding-left: 14px; color: #444; font-style: italic; margin-bottom: 14px; }

        code { font-family: monospace; font-size: 13px; background: rgba(0, 0, 0, 0.05); padding: 1px 4px; border-radius: 3px; }
        pre { background: rgba(0, 0, 0, 0.04); padding: 14px; border-radius: 3px; overflow-x: auto; margin-bottom: 14px; line-height: 1.5; }
        pre code { background: none; padding: 0; }

        hr { border: none; border-top: 1px solid #ddd; width: 100px; margin: 30px auto; }

        .posts { list-style: none; margin-left: 0; }
        .posts li { margin-bottom: 8px; }

        .end-nav { margin-top: 40px; font-size: 13px; }

        .trail {
            position: fixed;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.15);
            pointer-events: none;
            z-index: 9999;
            transition: transform 0.1s ease;
        }
    </style>
</head>

<body>
${body}
    <script>
        // Time-aware background (same tints as the homepage)
        const hour = new Date().getHours();
        let bgColor;
        if (hour >= 5 && hour < 12) bgColor = "#fffef5";
        else if (hour >= 12 && hour < 17) bgColor = "#ffffff";
        else if (hour >= 17 && hour < 21) bgColor = "#fff8f5";
        else bgColor = "#f5f7ff";
        document.body.style.backgroundColor = bgColor;

        // Cursor trail
        const trails = [];
        for (let i = 0; i < 8; i++) {
            const trail = document.createElement('div');
            trail.className = 'trail';
            trail.style.opacity = (1 - i / 8) * 0.5;
            trail.style.width = (6 - i * 0.5) + 'px';
            trail.style.height = (6 - i * 0.5) + 'px';
            document.body.appendChild(trail);
            trails.push({ el: trail, x: 0, y: 0 });
        }
        let mouseX = 0, mouseY = 0;
        document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
        function animateTrail() {
            let x = mouseX, y = mouseY;
            trails.forEach((trail) => {
                trail.el.style.left = trail.x + 'px';
                trail.el.style.top = trail.y + 'px';
                const nextX = x, nextY = y;
                x = trail.x; y = trail.y;
                trail.x += (nextX - trail.x) * 0.3;
                trail.y += (nextY - trail.y) * 0.3;
            });
            requestAnimationFrame(animateTrail);
        }
        animateTrail();
    </script>
</body>

</html>
`;
}

// --- build ---
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'blog'), { recursive: true });

// root static files (index.html, CNAME, resume.pdf, favicons, og.png, ...)
const EXCLUDE = new Set(['build.js', 'package.json', 'package-lock.json', 'README.md']);
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.isFile() && !EXCLUDE.has(entry.name) && !entry.name.startsWith('.')) {
        fs.copyFileSync(path.join(ROOT, entry.name), path.join(OUT, entry.name));
    }
}

// post images
const imagesDir = path.join(POSTS, 'images');
if (fs.existsSync(imagesDir)) fs.cpSync(imagesDir, path.join(OUT, 'blog', 'images'), {
    recursive: true,
    filter: (src) => !src.endsWith('.md'),
});

// posts, newest first (skip tooling files like CLAUDE.md/README.md)
const NOT_POSTS = new Set(['CLAUDE.md', 'README.md', 'AGENTS.md']);
const posts = fs.readdirSync(POSTS).filter((f) => f.endsWith('.md') && !NOT_POSTS.has(f)).map(parsePost)
    .sort((a, b) => b.date - a.date);

for (const post of posts) {
    const body = `    <p class="crumb"><a href="/">wience.tech</a> · <a href="/blog/">writing</a></p>
    <h1>${esc(post.title)}</h1>
    <p class="date">${displayDate(post.date)}</p>
    <article>
${post.html}    </article>
    <p class="end-nav"><a href="/blog/">← writing</a></p>`;
    fs.mkdirSync(path.join(OUT, 'blog', post.slug), { recursive: true });
    fs.writeFileSync(path.join(OUT, 'blog', post.slug, 'index.html'), page({
        title: post.title,
        description: post.description || `An essay by Wince Dela Fuente`,
        url: `${SITE_URL}/blog/${post.slug}/`,
        body,
    }));
}

// blog index
const listItems = posts.map((p) =>
    `        <li><a href="/blog/${p.slug}/">${esc(p.title)}</a> <span class="date">— ${displayDate(p.date)}</span></li>`
).join('\n');
fs.writeFileSync(path.join(OUT, 'blog', 'index.html'), page({
    title: 'writing · Wince Dela Fuente',
    description: 'Essays by Wince Dela Fuente',
    url: `${SITE_URL}/blog/`,
    body: `    <p class="crumb"><a href="/">wience.tech</a></p>
    <h1>writing</h1>
    <p class="date">essays, notes, things I've learned</p>
    <ul class="posts">
${listItems}
    </ul>`,
}));

// RSS
const rssItems = posts.map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE_URL}/blog/${p.slug}/</link>
      <guid>${SITE_URL}/blog/${p.slug}/</guid>
      <pubDate>${p.date.toUTCString()}</pubDate>
      <description><![CDATA[${p.html}]]></description>
    </item>`).join('\n');
fs.writeFileSync(path.join(OUT, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Wince Dela Fuente</title>
    <link>${SITE_URL}</link>
    <description>Essays by Wince Dela Fuente</description>
${rssItems}
  </channel>
</rss>
`);

console.log(`Built ${posts.length} post(s) -> _site/`);
