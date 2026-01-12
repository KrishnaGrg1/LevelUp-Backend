import { AuthenticatedSocket } from '../middlewares/socketAuthMiddleware';
import { translate, Language } from '../translation/translation';

interface SocketErrorOptions {
  code: string;
  messageKey: string;
  lang?: Language;
  additionalData?: Record<string, any>;
}

interface SocketSuccessOptions {
  messageKey: string;
  lang?: Language;
  data?: Record<string, any>;
}

export function emitSocketError(
  socket: AuthenticatedSocket,
  event: string,
  options: SocketErrorOptions
): void {
  const lang = options.lang || 'eng';
  socket.emit(event, {
    message: translate(options.messageKey, lang),
    code: options.code,
    messageKey: options.messageKey,
    ...options.additionalData,
  });
}

export function emitSocketSuccess(
  socket: AuthenticatedSocket,
  event: string,
  options: SocketSuccessOptions
): void {
  const lang = options.lang || 'eng';
  socket.emit(event, {
    message: translate(options.messageKey, lang),
    messageKey: options.messageKey,
    ...options.data,
  });
}

/**
 * Type guard for checking if socket has authenticated user
 * After calling this function and it returns true, socket.user is guaranteed to be defined
 */
export function checkAuthentication(
  socket: AuthenticatedSocket
): socket is AuthenticatedSocket & {
  user: NonNullable<AuthenticatedSocket['user']>;
} {
  if (!socket.user) {
    emitSocketError(socket, 'error', {
      code: 'NOT_AUTHENTICATED',
      messageKey: 'error.auth.not_authenticated',
    });
    return false;
  }
  return true;
}

export function validateMessageContent(
  socket: AuthenticatedSocket,
  content: string,
  maxLength: number = 2000
): boolean {
  if (!content || content.trim().length === 0) {
    emitSocketError(socket, 'error', {
      code: 'MESSAGE_EMPTY',
      messageKey: 'error.message.empty',
    });
    return false;
  }

  if (content.length > maxLength) {
    emitSocketError(socket, 'error', {
      code: 'MESSAGE_TOO_LONG',
      messageKey: 'error.message.too_long',
      additionalData: { maxLength },
    });
    return false;
  }

  return true;
}
