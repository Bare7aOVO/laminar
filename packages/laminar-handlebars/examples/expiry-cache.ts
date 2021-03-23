import { init, router, get, post, HttpService } from '@ovotech/laminar';
import { handlebarsMiddleware } from '@ovotech/laminar-handlebars';
import { join } from 'path';

const handlebars = handlebarsMiddleware({ dir: join(__dirname, 'templates-html'), cacheType: 'expiry' });

const http = new HttpService({
  listener: handlebars(
    router(
      get('/', async ({ hbs }) => hbs('index')),
      post('/result', async ({ hbs, body: { name } }) => hbs('result', { name })),
    ),
  ),
});

init({ initOrder: [http], logger: console });
