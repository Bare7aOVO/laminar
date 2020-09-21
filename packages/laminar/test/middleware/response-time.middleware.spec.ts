import axios from 'axios';
import { laminar, responseTimeMiddleware, start, stop, Laminar, textOk } from '../../src';

let server: Laminar;

const api = axios.create({ baseURL: 'http://localhost:8096' });

describe('responseTimeMiddleware middleware', () => {
  afterEach(() => stop(server));

  it('Should measure small response time', async () => {
    const responseTime = responseTimeMiddleware();
    server = laminar({
      port: 8096,
      app: responseTime(async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        return textOk('OK');
      }),
    });
    await start(server);

    const result = await api.get('/test');
    expect(result.status).toBe(200);
    expect(Number(result.headers['x-response-time'])).toBeGreaterThan(14);
    expect(Number(result.headers['x-response-time'])).toBeLessThan(54);
  });

  it('Should measure larger response time', async () => {
    const responseTime = responseTimeMiddleware();
    server = laminar({
      port: 8096,
      app: responseTime(async () => {
        await new Promise((resolve) => setTimeout(resolve, 55));
        return textOk('OK');
      }),
    });
    await start(server);

    const result = await api.get('/test');

    expect(result.status).toBe(200);
    expect(Number(result.headers['x-response-time'])).toBeGreaterThan(54);
    expect(Number(result.headers['x-response-time'])).toBeLessThan(100);
  });

  it('Should use custom header', async () => {
    const responseTime = responseTimeMiddleware({ header: 'My-Time' });
    server = laminar({
      port: 8096,
      app: responseTime(() => textOk('OK')),
    });
    await start(server);

    const result = await api.get('/test');

    expect(result.status).toBe(200);
    expect(Number(result.headers['my-time'])).toBeGreaterThan(0);
    expect(Number(result.headers['my-time'])).toBeLessThan(50);
  });
});