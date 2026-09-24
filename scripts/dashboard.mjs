import { build, context } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'dashboard-dist');
const serve = process.argv.includes('--serve');
const assets = ['index.html', 'og.png', 'robots.txt', 'sitemap.xml'];

const options = {
    absWorkingDir: root,
    entryPoints: ['dashboard/client.js'],
    outfile: join(output, 'assets/dashboard.js'),
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2020',
    minify: !serve,
    inject: ['dashboard/buffer-shim.ts'],
    logLevel: 'info',
    plugins: [{
        name: 'static-dashboard',
        setup(builder) {
            builder.onLoad({ filter: /dashboard\/client\.js$/ }, async (args) => ({
                contents: await readFile(args.path, 'utf8'),
                loader: 'js',
                watchFiles: assets.map((asset) => join(root, 'dashboard', asset)),
            }));
            builder.onEnd(async (result) => {
                if (result.errors.length) return;
                await mkdir(output, { recursive: true });
                for (const asset of assets) {
                    await copyFile(join(root, 'dashboard', asset), join(output, asset));
                }
                await writeFile(join(output, '.nojekyll'), '');
            });
        },
    }],
};

if (serve) {
    const ctx = await context(options);
    await ctx.watch();
    const { port } = await ctx.serve({ servedir: output, host: '127.0.0.1', port: Number(process.env.PORT ?? 3000) });
    console.log(`Dashboard: http://localhost:${port} (static files; the browser calls Toncenter directly)`);
} else {
    await build(options);
}
