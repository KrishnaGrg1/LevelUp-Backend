import { translate, Language } from '../translation/translation';

export function makeSuccessResponse(
  data: any,
  messageKey: string,
  lang: Language = 'eng',
  statusCode = 200,
  headers?: Record<string, string>
) {
  return {
    statusCode,
    headers,
    body: {
      message: translate(messageKey, lang),
      data,
    },
  };
}

export function makeErrorResponse(
  error: Error,
  messageKey: string,
  lang: Language = 'eng',
  statusCode = 500,
  headers?: Record<string, string>
) {
  return {
    statusCode,
    headers,
    body: {
      message: translate(messageKey, lang),
      error: error.message,
    },
  };
}
