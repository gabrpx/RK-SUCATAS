import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';

vi.mock('../src/server/env.js', () => ({ requireEnv: () => 'test-jwt-secret' }));

import { autenticar } from './auth';

const originalNodeEnv = process.env.NODE_ENV;

function requisicao(remoteAddress: string): AuthenticatedRequest {
  return {
    headers: {},
    socket: { remoteAddress },
  } as unknown as AuthenticatedRequest;
}

function resposta() {
  const result = { status: vi.fn(), json: vi.fn() };
  result.status.mockReturnValue(result);
  return result;
}

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe('autenticar', () => {
  it('nega token ausente em production mesmo quando o proxy usa loopback', () => {
    process.env.NODE_ENV = 'production';
    const req = requisicao('127.0.0.1');
    const res = resposta();
    const next = vi.fn() as unknown as NextFunction;

    autenticar(req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Token ausente' });
    expect(next).not.toHaveBeenCalled();
  });

  it('mantém o bypass de localhost fora de production', () => {
    process.env.NODE_ENV = 'development';
    const req = requisicao('::1');
    const res = resposta();
    const next = vi.fn() as unknown as NextFunction;

    autenticar(req, res as unknown as Response, next);

    expect(req.usuario?.username).toBe('localhost');
    expect(req.usuario?.roles).toContain('admin');
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
