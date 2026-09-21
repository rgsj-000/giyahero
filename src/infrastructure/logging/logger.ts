export type LogFields = Record<string, string | number | boolean | null | undefined>;

function emit(level: 'info' | 'warn' | 'error', event: string, fields: LogFields = {}) {
  const entry = JSON.stringify({
    level,
    event,
    ...fields,
    timestamp: new Date().toISOString(),
  });

  console[level](entry);
}

export const logger = {
  info: (event: string, fields?: LogFields) => emit('info', event, fields),
  warn: (event: string, fields?: LogFields) => emit('warn', event, fields),
  error: (event: string, fields?: LogFields) => emit('error', event, fields),
};
