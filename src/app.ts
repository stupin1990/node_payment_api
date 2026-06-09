import express, { type ErrorRequestHandler, type Request } from 'express';
import { HttpError } from './errors.js';
import { createInvoice, getInvoiceStatus } from './services/invoice-service.js';
import { processWebhook } from './services/webhook-service.js';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

export const app = express();

app.use(
  express.json({
    verify: (req: RawBodyRequest, _res, buffer) => {
      req.rawBody = Buffer.from(buffer);
    },
  }),
);

app.post('/invoice', async (req, res, next) => {
  try {
    const invoice = await createInvoice(req.body);
    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
});

app.post('/webhook', async (req: RawBodyRequest, res, next) => {
  try {
    const result = await processWebhook({
      rawBody: req.rawBody ?? Buffer.from(JSON.stringify(req.body)),
      body: req.body,
      headers: {
        signature: req.header('X-Signature') ?? undefined,
        timestamp: req.header('X-Timestamp') ?? undefined,
        nonce: req.header('X-Nonce') ?? undefined,
      },
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/invoice/:id', async (req, res, next) => {
  try {
    const invoice = await getInvoiceStatus(req.params.id);
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: 'invalid json' });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'internal server error' });
};

app.use(errorHandler);
