import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { json, urlencoded, static as expressStatic } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { StorefrontPublicService } from './storefront/storefront-public.service';

function escapeHtmlAttr(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Encerramento gracioso de conexões Prisma e recursos ao receber SIGTERM/SIGINT
  app.enableShutdownHooks();

  // Aumenta o limite de payload para suportar importações grandes (ex.: inventário com 1500+ itens)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.enableCors();
  app.setGlobalPrefix('api');

  // Serve o build estático do frontend (SPA) na mesma origem quando disponível
  const frontendDist =
    process.env.FRONTEND_DIST_PATH ||
    path.resolve(process.cwd(), '..', 'frontend', 'dist');
  const indexHtmlPath = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(
      expressStatic(frontendDist, {
        index: false,
        setHeaders: (res, filePath) => {
          if (
            filePath.includes(`${path.sep}assets${path.sep}`) ||
            filePath.includes('/assets/')
          ) {
            res.setHeader(
              'Cache-Control',
              'public, max-age=31536000, immutable',
            );
          } else if (
            filePath.endsWith('sw.js') ||
            filePath.includes('workbox-') ||
            filePath.endsWith('registerSW.js') ||
            filePath.endsWith('manifest.webmanifest')
          ) {
            res.setHeader(
              'Cache-Control',
              'no-store, no-cache, must-revalidate, proxy-revalidate',
            );
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        },
      }),
    );
    const baseIndexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    let storefrontPublicService: StorefrontPublicService | null = null;
    try {
      storefrontPublicService = app.get(StorefrontPublicService);
    } catch {
      storefrontPublicService = null;
    }

    expressApp.use(async (req: any, res: any, next: any) => {
      if (
        (req.method === 'GET' || req.method === 'HEAD') &&
        !req.path.startsWith('/api') &&
        !req.path.startsWith('/uploads') &&
        !req.path.startsWith('/assets/')
      ) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

        const storeMatch = req.path.match(
          /^\/loja\/([a-zA-Z0-9-]+)(?:\/produto\/([a-zA-Z0-9-]+))?\/?$/,
        );
        if (storeMatch && storefrontPublicService) {
          try {
            const meta = await storefrontPublicService.getShareMetadata(
              storeMatch[1],
              storeMatch[2],
            );
            const title = escapeHtmlAttr(meta.title);
            const desc = escapeHtmlAttr(meta.description);
            const ogTags = [
              `<meta property="og:type" content="website" />`,
              `<meta property="og:title" content="${title}" />`,
              `<meta property="og:description" content="${desc}" />`,
              `<meta property="og:url" content="${escapeHtmlAttr(meta.canonicalPath)}" />`,
              meta.imageUrl
                ? `<meta property="og:image" content="${escapeHtmlAttr(meta.imageUrl)}" />`
                : '',
              `<meta name="twitter:card" content="summary_large_image" />`,
              `<meta name="twitter:title" content="${title}" />`,
              `<meta name="twitter:description" content="${desc}" />`,
            ]
              .filter(Boolean)
              .join('\n    ');

            const customHtml = baseIndexHtml
              .replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
              .replace('</head>', `    ${ogTags}\n  </head>`);
            return res.type('html').send(customHtml);
          } catch {
            // Fallback para o index.html padrão
          }
        }

        return res.sendFile(indexHtmlPath);
      }
      next();
    });
    logger.log(`🌐 Frontend SPA habilitado em mesma origem: ${frontendDist}`);
  }

  const port = process.env.PORT ?? 3530;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 PDV Lojista rodando em: http://0.0.0.0:${port}/api`);
}
bootstrap();
