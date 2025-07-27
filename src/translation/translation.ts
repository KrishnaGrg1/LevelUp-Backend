import arab from './arab/index';
import chin from './chin/index';
import eng from './eng/index';
import nep from './nep/index';
import span from './spanish/index';
import jap from './jap/index';
import hind from './hind/index';

export type Language =
  | 'eng'
  | 'arab'
  | 'chin'
  | 'nep'
  | 'span'
  | 'jap'
  | 'hind';
export type MessageType = 'error' | 'success';

const messages: Record<Language, any> = {
  arab: arab,
  chin: chin,
  eng: eng,
  nep: nep,
  span: span,
  jap: jap,
  hind: hind,
};

function getNestedValue(obj: any, keyPath: string): any {
  return keyPath.split('.').reduce((acc, key) => acc?.[key], obj);
}

export const translate = (fullKey: string, lang: Language = 'eng'): string => {
  const [type, ...keyParts] = fullKey.split('.');
  const keyPath = keyParts.join('.');

  if (type !== 'success' && type !== 'error') return fullKey;

  const langPack = messages[lang] || messages.eng;
  const messageSet = langPack[type] || messages.eng[type];

  const translated = getNestedValue(messageSet, keyPath);
  return translated || fullKey;
};
