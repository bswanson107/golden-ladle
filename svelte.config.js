import adapter from '@sveltejs/adapter-static';

/** GitHub project site: https://<user>.github.io/golden-ladle/ */
const githubPages = process.env.GITHUB_PAGES === 'true';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    compilerOptions: {
        runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
    },
    kit: {
        adapter: adapter({
            fallback: 'index.html'
        }),
        paths: {
            base: githubPages ? '/golden-ladle' : ''
        },
        prerender: {
            // Dynamic routes like /league/[id] are handled client-side via SPA fallback
            handleUnseenRoutes: 'ignore'
        }
    }
};

export default config;
