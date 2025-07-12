import { NextFunction, Response } from 'express';
import IRequest from './authMiddleware';
import { Language } from '../translation/translation';
export interface TranslationRequest extends IRequest {
  language?: string;
}

const translationMiddeware = async (
  req: TranslationRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const middleawarelanguageHeader = req.headers['x-language'];

    if (
      !middleawarelanguageHeader ||
      typeof middleawarelanguageHeader !== 'string'
    ) {
      req.language = 'eng';
    } else {
      req.language = middleawarelanguageHeader as Language;
    }

    next(); // only call once
  } catch (error) {
    console.error('Translation middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export default translationMiddeware;
