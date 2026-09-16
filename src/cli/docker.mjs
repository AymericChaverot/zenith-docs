// Container files for a ZenithDocs site: a multi-stage Dockerfile that builds the site with
// Node, then serves the static output from an unprivileged nginx. Node built-ins only, since
// `create` writes them before anything is installed.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

/** Package managers the Dockerfile knows how to install with, and their lockfiles. */
const INSTALL = {
  npm: {
    lockfile: 'package-lock.json',
    manifests: 'package.json package-lock.json*',
    setup: '',
    cache: '/root/.npm',
    install: 'if [ -f package-lock.json ]; then npm ci; else npm install; fi',
    build: 'npm run build',
  },
  pnpm: {
    lockfile: 'pnpm-lock.yaml',
    // pnpm-workspace.yaml holds the approved build scripts, which the install needs.
    manifests: 'package.json pnpm-lock.yaml* pnpm-workspace.yaml*',
    setup: 'ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0\nRUN corepack enable pnpm\n',
    cache: '/root/.local/share/pnpm/store',
    install: 'if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi',
    build: 'pnpm run build',
  },
};

/** Extensions worth compressing: text formats. Images and Pagefind chunks are already compact. */
const COMPRESSIBLE = ['html', 'css', 'js', 'mjs', 'json', 'svg', 'txt', 'md', 'xml'];

/**
 * @param {{ packageManager?: string }} [options]
 * @returns {Record<string, string>}
 */
export function dockerFiles({ packageManager = 'npm' } = {}) {
  const pm = INSTALL[/** @type {keyof typeof INSTALL} */ (packageManager)] ?? INSTALL.npm;
  const find = COMPRESSIBLE.map((extension) => `-name '*.${extension}'`).join(' -o ');

  const dockerfile = `# syntax=docker/dockerfile:1

# ---- Build: install the dependencies and render the site to static files ----
FROM node:24-alpine AS build
# ZenithDocs installs from its GitHub repository, which takes git.
RUN apk add --no-cache git
${pm.setup}WORKDIR /app

# Dependencies first, so editing a page does not reinstall everything.
COPY ${pm.manifests} ./
RUN --mount=type=cache,target=${pm.cache} \\
    ${pm.install}

COPY . .
RUN ${pm.build}

# Compress once here, so the server never compresses on the fly.
RUN find dist -type f \\( ${find} \\) -exec gzip -9 -k {} +

# ---- Serve: nginx, running as an unprivileged user, and nothing else ----
FROM nginxinc/nginx-unprivileged:alpine-slim

COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 8080;
    root /usr/share/nginx/html;
    server_tokens off;
    # Redirects such as /guide to /guide/ keep the host and port the browser used.
    absolute_redirect off;

    gzip_static on;
    charset utf-8;
    charset_types text/css application/javascript application/json text/plain text/markdown image/svg+xml;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    error_page 404 /404.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Built assets have a content hash in their name: they never change.
    location /_astro/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
    }

    # The Markdown version of each page, for LLMs.
    location ~ \\.md$ {
        default_type text/markdown;
    }
}
EOF

# A site served from a sub-path, with \`base: '/docs'\`, goes to /usr/share/nginx/html/docs
# instead, with \`error_page 404 /docs/404.html\` above.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
`;

  const dockerignore = `# Rebuilt inside the image
node_modules
dist
.astro
.zenith

# Remove this line to use \`lastUpdated\`, which reads the git history
.git

Dockerfile
.dockerignore
*.log
.env
.env.*
`;

  return { Dockerfile: dockerfile, '.dockerignore': dockerignore };
}

const HELP = `Add a Dockerfile to a ZenithDocs site

Usage
  zenith docker [options]

Writes a Dockerfile and a .dockerignore to the current directory. The image builds the site,
then serves it with nginx on port 8080:

  docker build -t my-docs .
  docker run --rm -p 8080:8080 my-docs

Options
      --force   Overwrite existing files
  -h, --help    Show this message
`;

/**
 * `zenith docker`: writes the container files into an existing project.
 *
 * @param {string[]} argv Arguments after \`docker\`.
 * @param {string} root
 */
export function docker(argv, root) {
  const { values } = parseArgs({
    args: argv,
    options: {
      force: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }

  const manifest = join(root, 'package.json');
  if (!existsSync(manifest)) {
    throw new Error('No package.json here. Run `zenith docker` from the root of the site.');
  }
  const scripts = JSON.parse(readFileSync(manifest, 'utf8')).scripts ?? {};
  if (!scripts.build) {
    throw new Error('package.json has no `build` script, which the image runs. Add `"build": "zenith build"`.');
  }

  const packageManager = detectPackageManager(root);
  const workspace = join(root, 'pnpm-workspace.yaml');
  if (packageManager === 'pnpm' && !(existsSync(workspace) && readFileSync(workspace, 'utf8').includes('esbuild'))) {
    console.warn(
      'pnpm-workspace.yaml does not approve the esbuild build script, so pnpm will refuse to install in the image.\nAdd it with:\n\n  allowBuilds:\n    esbuild: true\n',
    );
  }
  const files = dockerFiles({ packageManager });
  const existing = Object.keys(files).filter((name) => existsSync(join(root, name)));
  if (existing.length > 0 && !values.force) {
    throw new Error(`${existing.join(' and ')} already exist. Pass --force to overwrite them.`);
  }

  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(root, name), contents);
  }

  console.log(`Created Dockerfile and .dockerignore, installing with ${packageManager}.

  docker build -t my-docs .
  docker run --rm -p 8080:8080 my-docs
`);
}

/**
 * pnpm when the project has its lockfile, npm otherwise.
 *
 * @param {string} root
 */
export function detectPackageManager(root) {
  return existsSync(join(root, INSTALL.pnpm.lockfile)) ? 'pnpm' : 'npm';
}
