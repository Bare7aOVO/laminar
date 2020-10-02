import { spawn } from 'child_process';
import { join } from 'path';
import axios from 'axios';

describe('Split App Integration Tests', () => {
  it('Should work as an app', async () => {
    const service = spawn('yarn', ['ts-node', 'src/index.ts'], {
      cwd: join(__dirname, '..'),
      detached: true,
    });

    try {
      service.stderr.on('data', (data) => console.error(String(data)));
      await new Promise((resolve) => {
        service.stdout.on('data', (data) =>
          String(data).includes('Laminar: Running') ? resolve() : undefined,
        );
      });

      const api = axios.create({ baseURL: `http://localhost:3300` });

      await expect(api.get('/user/3')).resolves.toMatchObject({
        status: 200,
        data: { id: '3', name: 'John' },
      });
    } finally {
      /**
       * Since we need to kill the service and _all of its children_ we need to kill the whole group itself
       * https://azimi.me/2014/12/31/kill-child_process-node-js.html
       */
      process.kill(-service.pid);
    }
  });
});
