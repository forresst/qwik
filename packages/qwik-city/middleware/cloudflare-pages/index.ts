import type { QwikCityRequestOptions, QwikCityRequestContext } from '../request-handler/types';
import { notFoundHandler, requestHandler } from '../request-handler';
import type { Render } from '@builder.io/qwik/server';

// @builder.io/qwik-city/middleware/cloudflare-pages

/**
 * @public
 */
export function qwikCity(render: Render, opts?: QwikCityCloudflarePagesOptions) {
  async function onRequest({ request, next, waitUntil }: EventPluginContext) {
    try {
      const url = new URL(request.url);

      // https://developers.cloudflare.com/workers/runtime-apis/cache/
      const useCache = url.hostname !== 'localhost' && request.method === 'GET';
      const cacheKey = new Request(url.href, request);
      const cache = useCache ? await caches.open('custom:qwikcity') : null;
      if (cache) {
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          return cachedResponse;
        }
      }

      const requestCtx: QwikCityRequestContext<Response> = {
        url,
        request,
        response: (status, headers, body) => {
          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();

          body({
            write: (chunk) => {
              if (typeof chunk === 'string') {
                const encoder = new TextEncoder();
                writer.write(encoder.encode(chunk));
              } else {
                writer.write(chunk);
              }
            },
          }).finally(() => {
            writer.close();
          });

          const response = new Response(readable, { status, headers });
          if (response.ok && cache && response.headers.has('Cache-Control')) {
            // Store the fetched response as cacheKey
            // Use waitUntil so you can return the response without blocking on
            // writing to cache
            waitUntil(cache.put(cacheKey, response.clone()));
          }
          return response;
        },
      };

      const handledResponse = await requestHandler<Response>(requestCtx, render, opts);
      if (handledResponse) {
        return handledResponse;
      }

      const nextResponse = await next();
      if (nextResponse.status === 404) {
        const notFoundResponse = await notFoundHandler<Response>(requestCtx);
        return notFoundResponse;
      }

      return nextResponse;
    } catch (e: any) {
      return new Response(String(e || 'Error'), {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  return onRequest;
}

/**
 * @public
 */
export interface QwikCityCloudflarePagesOptions extends QwikCityRequestOptions {}

/**
 * @public
 */
export interface EventPluginContext {
  request: Request;
  waitUntil: (promise: Promise<any>) => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
}
