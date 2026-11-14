import { supabaseService } from './supabase.js';

function resolveApiBaseUrl() {
  const configured = import.meta.env?.VITE_API_BASE_URL;
  const fallback = import.meta.env?.DEV ? 'http://127.0.0.1:4000' : '';
  const value = String(configured || fallback).trim();
  if (!value) {
    throw new Error('VITE_API_BASE_URL is required to use tenant sign-in.');
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('VITE_API_BASE_URL must be a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('VITE_API_BASE_URL must use HTTP or HTTPS.');
  }
  if (import.meta.env?.PROD && url.protocol !== 'https:') {
    throw new Error('Tenant API must use HTTPS in production.');
  }

  return url.toString().replace(/\/$/, '');
}

export async function tenantApiGet(path, tenantId = null) {
  if (!['/tenants', '/tenants/me'].includes(path)) {
    throw new Error('Unsupported API path.');
  }

  const session = await supabaseService.getCurrentSession();
  if (!session?.access_token) {
    throw new Error('Your session has expired. Sign in again.');
  }

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${session.access_token}`
  };
  if (tenantId) headers['X-Tenant-ID'] = tenantId;

  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method: 'GET',
    headers,
    credentials: 'omit',
    cache: 'no-store'
  });

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('The tenant API returned an invalid response.');
  }

  if (!response.ok || body?.success !== true) {
    const message = typeof body?.error?.message === 'string'
      ? body.error.message
      : `Tenant API request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.code = body?.error?.code || 'API_REQUEST_FAILED';
    throw error;
  }

  return body;
}
