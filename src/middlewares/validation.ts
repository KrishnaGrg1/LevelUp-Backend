import { NextFunction, Request, Response } from 'express';
import { ObjectSchema } from 'joi';

interface IvalidatonSchema {
  body?: ObjectSchema;
  params?: ObjectSchema;
  query?: ObjectSchema;
  headers?: ObjectSchema;
}

const validate = (validateSchema: IvalidatonSchema = {}) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { body, params, query, headers } = validateSchema;

    try {
      if (body) {
        const validateResult = await body.validateAsync(req.body, {
          abortEarly: true,
        });
        req.body = validateResult;
      }
      if (params) {
        const validateResult = await params.validateAsync(req.params, {
          abortEarly: true,
        });
        req.params = validateResult;
      }
      if (query) {
        // Validate query but don't try to reassign - just validate it exists and is correct
        await query.validateAsync(req.query, {
          abortEarly: true,
        });
        // Don't reassign: req.query is read-only in newer Express versions
      }
      if (headers) {
        const validateResult = await headers.validateAsync(req.headers, {
          abortEarly: true,
        });
        req.headers = validateResult as any;
      }
      next();
    } catch (e) {
      if (e instanceof Error) {
        res.status(500).json({
          message: e.message,
        });
      } else {
        res.status(500).json({
          message: 'Unexpected error has occurred',
        });
      }
    }
  };
};

export default validate;
