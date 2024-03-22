import { TLSSocket } from 'tls';
import { Socket } from 'net';
import { IncomingMessage } from 'http';
import { URL, URLSearchParams } from 'url';
import { parseQueryObjects } from '../helpers';
import { parseCookie } from './cookie';
import { HttpContext } from './types';
import { HttpError } from './http-error';

/**
 * A component that parses the url and header information from the raw incommingMessage
 * And adding `host`, `protocol`, `headers`, `url` and `method` properties
 *
 * @category http
 */
export function toHttpRequest(incommingMessage: IncomingMessage): HttpContext {
  const socket: TLSSocket | Socket = incommingMessage.socket;
  const protocol = socket instanceof TLSSocket && socket.encrypted ? 'https' : 'http';
  const headers = incommingMessage.headers;
  const method = incommingMessage.method ?? '';
  const host = (headers['x-forwarded-host'] as string)?.split(',')[0] ?? headers['host'];
  if (!host) {
    throw new HttpError(404, { message: 'Invalid host' });
  }
  let url = new URL('/', `${protocol}://${host}`);
  try {
    url = new URL(incommingMessage.url ?? '', `${protocol}://${host}`);
  } catch (err) {
    url = new URL('/', `${protocol}://${host}`);
  }
  const query = parseQueryObjects(new URLSearchParams(incommingMessage.url?.split('?')?.[1] ?? ''));
  const cookies = headers.cookie ? parseCookie(headers.cookie) : undefined;

  return { incommingMessage, host, protocol, headers, url, method, cookies, query, body: incommingMessage };
}

export function toHttpMalformedRequest(incommingMessage: IncomingMessage): HttpContext {
  const socket: TLSSocket | Socket = incommingMessage.socket;
  const protocol = socket instanceof TLSSocket && socket.encrypted ? 'https' : 'http';
  const headers = incommingMessage.headers;
  const method = incommingMessage.method ?? '';
  const host = '';
  const url = new URL('http://example.com');
  const query = parseQueryObjects(new URLSearchParams(incommingMessage.url?.split('?')?.[1] ?? ''));
  const cookies = headers.cookie ? parseCookie(headers.cookie) : undefined;

  return { incommingMessage, host, protocol, headers, url, method, cookies, query, body: incommingMessage };
}
